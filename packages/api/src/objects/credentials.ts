import { CredentialType as CredentialPrismaType } from '@prisma/client';
import argon2 from 'argon2';
import { nanoid } from 'nanoid';
import { builder } from '../builder.js';
import { purgeUserSessions } from '../context.js';
import { prisma } from '../prisma.js';
import { DateTimeScalar } from './scalars.js';
import { authenticate as ldapAuthenticate } from 'ldap-authentication';
import { GraphQLError } from 'graphql';
import bunyan from 'bunyan';

export const CredentialEnumType = builder.enumType(CredentialPrismaType, {
  name: 'CredentialType',
});

export const CredentialType = builder.prismaObject('Credential', {
  fields: (t) => ({
    id: t.exposeID('id'),
    // userId: t.exposeID('userId'),
    type: t.expose('type', { type: CredentialEnumType }),
    token: t.exposeString('value', { authScopes: { $granted: 'login' } }),
    userAgent: t.exposeString('userAgent'),
    createdAt: t.expose('createdAt', { type: DateTimeScalar }),
    expiresAt: t.expose('expiresAt', { type: DateTimeScalar, nullable: true }),
    active: t.boolean({
      resolve: ({ type, value }, _, { token }) =>
        type === CredentialPrismaType.Token && value === token,
    }),
    user: t.relation('user', { grantScopes: ['me'] }),
  }),
});

builder.mutationField('login', (t) =>
  t.prismaField({
    description: 'Logs a user in and returns a session token.',
    type: CredentialType,
    errors: { types: [Error], dataField: { grantScopes: ['me', 'login'] } },
    args: {
      email: t.arg.string(),
      password: t.arg.string(),
    },
    async resolve(query, _, { email, password }, { request }) {
      const uidOrEmail = email.trim().toLowerCase();
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ email: uidOrEmail }, { uid: uidOrEmail }],
        },
        include: {
          credentials: {
            where: {
              type: CredentialPrismaType.Password,
              value: {
                not: process.env.MASTER_PASSWORD_HASH,
              },
            },
          },
        },
      });

      if (!user) throw new GraphQLError('Incorrect email or password');

      if (user.credentials.length <= 0) {
        // User has no password yet. Check with old LDAP server if the password is valid. If it is, save it as the password.
        let passwordValidInOldLDAP = false;

        try {
          await ldapAuthenticate({
            ldapOpts: {
              url: process.env.OLD_LDAP_URL,
              log: bunyan.createLogger({ name: 'old ldap login', level: 'trace' }),
            },
            adminDn: process.env.OLD_LDAP_CLIENT_CONSULT_DN,
            adminPassword: process.env.OLD_LDAP_CLIENT_CONSULT_PASSWORD,
            userSearchBase: `ou=people,o=n7,dc=etu-inpt,dc=fr`,
            usernameAttribute: 'uid',
            username: user.uid,
            userPassword: password,
          });
          passwordValidInOldLDAP = true;
          console.info(`given password is valid in old LDAP, starting migration.`);
        } catch {
          passwordValidInOldLDAP = false;
        }

        if (passwordValidInOldLDAP) {
          await prisma.credential.create({
            data: {
              user: {
                connect: {
                  uid: user.uid,
                },
              },
              type: CredentialPrismaType.Password,
              value: await argon2.hash(password),
            },
          });
        }
      }

      const credentials = await prisma.credential.findMany({
        where: { type: CredentialPrismaType.Password, user: { id: user.id } },
      });
      const userAgent = request.headers.get('User-Agent')?.slice(0, 255) ?? '';

      for (const { value, userId } of credentials) {
        if (await argon2.verify(value, password)) {
          return prisma.credential.create({
            ...query,
            data: {
              userId,
              type: CredentialPrismaType.Token,
              value: nanoid(),
              userAgent,
              // Keep the token alive for a year
              expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            },
          });
        }
      }

      throw new Error('Identifiants invalides.');
    },
  })
);

builder.mutationField('logout', (t) =>
  t.authField({
    description: 'Logs a user out and invalidates the session token.',
    type: 'Boolean',
    authScopes: { loggedIn: true },
    async resolve(_, {}, { user, token }) {
      await prisma.credential.deleteMany({
        where: { type: CredentialPrismaType.Token, value: token },
      });
      purgeUserSessions(user.uid);
      return true;
    },
  })
);

builder.mutationField('deleteToken', (t) =>
  t.field({
    type: 'Boolean',
    args: { id: t.arg.id() },
    async authScopes(_, { id }, { user }) {
      const credential = await prisma.credential.findUniqueOrThrow({
        where: { id },
      });
      if (credential.type !== CredentialPrismaType.Token) return false;
      return user?.id === credential.userId;
    },
    async resolve(_, { id }, { user }) {
      await prisma.credential.delete({ where: { id } });
      purgeUserSessions(user!.uid);
      return true;
    },
  })
);
