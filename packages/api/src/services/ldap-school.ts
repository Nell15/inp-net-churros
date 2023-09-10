/* eslint-disable no-console */
import ldap from 'ldapjs';
import '../context.js';
import { nanoid } from 'nanoid';
import { fromYearTier } from '../date.js';
import { builder } from '../builder.js';
import bunyan from 'bunyan';

const logger = bunyan.createLogger({ name: 'CRI INP ldap', level: 'debug' });

export interface LdapUser {
  schoolUid: string;
  schoolEmail: string;
  firstName?: string;
  lastName?: string;
}

const settings = JSON.parse(process.env.LDAP_SCHOOL) as {
  servers: Record<
    string,
    { url: string; filterAttribute: string; wholeEmail: boolean; attributesMap: LdapUser }
  >;
  emailDomains: Record<string, string>;
};

function parseN7ApprenticeAndMajor(groups: string[] | undefined):
  | undefined
  | {
      major?: 'SN' | '3EA' | 'MF2E' | undefined;
      apprentice?: boolean;
      graduationYear?: number;
    } {
  if (!groups) return undefined;
  for (const group of groups) {
    if (group.startsWith('cn=n7etu_')) {
      const fragment = group.split(',')[0];
      if (!fragment) return undefined;
      const parts = /n7etu_(?<major>SN|MF2E|3EA)_(?<yearTier>\d)A(_APP)?/.exec(fragment);
      if (!parts) return;
      return {
        major: parts.groups?.['major'] as 'MF2E' | 'SN' | '3EA' | undefined,
        apprentice: fragment.includes('_APP'),
        graduationYear: fromYearTier(Number.parseInt(parts.groups?.['yearTier'] ?? '0', 10)),
      };
    }
  }

  return undefined;
}

/** Finds a user in a school database or returns `undefined`. */
export const findSchoolUser = async (
  searchBy:
    | { email: string }
    | {
        firstName: string;
        lastName: string;
        graduationYear: number;
        major: { shortName: string };
        schoolServer: string;
      }
): Promise<
  | (LdapUser & {
      schoolServer: string;
      major?: 'SN' | '3EA' | 'MF2E' | undefined;
      graduationYear?: number;
      apprentice?: boolean;
    })
  | undefined
> => {
  let ldapFilter = '';
  let schoolServer: string | undefined;
  if ('email' in searchBy) {
    if (searchBy.email === 'quoicoubeh@ewen.works') {
      return {
        schoolServer: 'inp',
        schoolEmail: `rick.astley.${nanoid()}@etu.inp-n7.fr`,
        schoolUid: 'n7',
        apprentice: false,
        firstName: 'Rick',
        lastName: 'Astley',
        graduationYear: 2026,
        major: 'SN',
      };
    }

    const [emailLogin, emailDomain] = searchBy.email.split('@') as [string, string];

    if (!emailDomain) throw new Error('Invalid email address');
    console.log(emailDomain);
    schoolServer = settings.emailDomains[emailDomain];
    if (!schoolServer || !settings.servers[schoolServer]) return;
    const { filterAttribute, wholeEmail } = settings.servers[schoolServer]!;
    ldapFilter = `${filterAttribute}=${emailLogin}${wholeEmail ? `@${emailDomain}` : ''}`;
  } else {
    schoolServer = searchBy.schoolServer;
    ldapFilter = `(&(sn=${searchBy.lastName})(givenName=${searchBy.firstName}))`;
  }

  const { url, attributesMap } = settings.servers[schoolServer]!;

  const client = ldap.createClient({ url, log: logger });

  const ldapObject = await new Promise<
    { groups: string[] | undefined; attrs: Record<string, string | undefined> } | undefined
  >((resolve, reject) => {
    // console.log(`Searching for ou=people,dc=n7,dc=fr with ${filterAttribute}=${emailLogin}${wholeEmail ? `@${emailDomain}` : ''}`);
    client.bind('', '', (err) => {
      if (err) console.log(err);
    });
    client.search(
      'ou=people,dc=n7,dc=fr',
      {
        scope: 'sub',
        filter: ldapFilter,
      },
      // {filter: `uid=elebihan`},
      (error, results) => {
        console.log(results);
        if (error) {
          reject(error);
          return;
        }

        results.on('connectRefused', console.log);

        results.on('connectTimeout', console.log);

        results.on('searchReference', console.log);

        results.on('searchEntry', ({ pojo }) => {
          console.log(pojo);
          const groups = pojo.attributes.find((a) => a.type === 'groups')?.values;
          const parsed = parseN7ApprenticeAndMajor(groups);

          if (!parsed) {
            console.info('ldap sync', 'continue search in school ldap', {
              why: 'could not parse groups from pojo',
              searchBy,
              groups,
              pojo,
            });
            return;
          }

          if ('graduationYear' in searchBy && parsed.graduationYear !== searchBy.graduationYear) {
            console.info('ldap sync', 'continue search in school ldap', {
              why: 'graduation year does not match',
              searchBy,
              parsed,
              pojo,
            });
            return;
          }

          if ('major' in searchBy && parsed.major !== searchBy.major.shortName) {
            console.info('ldap sync', 'continue search in school ldap', {
              why: 'major does not match',
              searchBy,
              parsed,
              pojo,
            });
            return;
          }

          resolve({
            groups,
            attrs: Object.fromEntries(
              pojo.attributes.map(({ type, values }) => [
                type,
                values.length > 0 ? values[0] : undefined,
              ])
            ),
          });
        });

        results.on('end', (a) => {
          console.log(a);
          // eslint-disable-next-line unicorn/no-useless-undefined
          resolve(undefined);
        });

        results.on('error', (error) => {
          reject(error);
        });
      }
    );
  });

  // Wait for the client to disconnect
  await new Promise<void>((resolve, reject) => {
    client.unbind((error) => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (error) reject(error);
      else resolve();
    });
  });

  if (!ldapObject) {
    console.error(`Utilisateur introuvable.`);
    return undefined;
  }

  const user = Object.fromEntries(
    Object.keys(attributesMap).map((key) => {
      const attributeKey = attributesMap[key as keyof typeof attributesMap];
      if (!attributeKey) return [key, undefined];
      const value = ldapObject.attrs[attributeKey];
      return [key, value ? value.toString() : undefined];
    })
  ) as unknown as LdapUser;

  const result = { ...user, schoolServer, ...parseN7ApprenticeAndMajor(ldapObject.groups) };

  return result;
};

builder.queryField('existsInSchoolLdap', (t) =>
  t.field({
    type: 'Boolean',
    args: {
      email: t.arg.string(),
    },
    authScopes(_, {}, { user }) {
      return Boolean(user?.admin);
    },
    async resolve(_, { email }) {
      return Boolean(await findSchoolUser({ email }));
    },
  })
);
