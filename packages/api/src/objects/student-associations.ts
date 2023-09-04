import { GraphQLError } from 'graphql';
import { builder } from '../builder.js';
import { prisma } from '../prisma.js';
import { DateTimeScalar } from './scalars.js';
import { cancelLydiaTransaction, sendLydiaPaymentRequest } from '../services/lydia.js';

export const StudentAssociationType = builder.prismaObject('StudentAssociation', {
  fields: (t) => ({
    id: t.exposeID('id'),
    createdAt: t.expose('createdAt', { type: DateTimeScalar }),
    updatedAt: t.expose('updatedAt', { type: DateTimeScalar }),
    schoolId: t.exposeID('schoolId'),
    name: t.exposeString('name'),
    links: t.relation('links'),
    school: t.relation('school'),
    groups: t.relation('groups'),
    contributionPrice: t.exposeFloat('contributionPrice'),
  }),
});

builder.queryField('studentAssociations', (t) =>
  t.prismaField({
    type: [StudentAssociationType],
    authScopes(_, {}, { user }) {
      return Boolean(user);
    },
    async resolve(query) {
      return prisma.studentAssociation.findMany({
        ...query,
        orderBy: { updatedAt: 'desc' },
      });
    },
  })
);

builder.queryField('studentAssociation', (t) =>
  t.prismaField({
    type: StudentAssociationType,
    args: {
      id: t.arg.id(),
    },
    authScopes(_, {}, { user }) {
      return Boolean(user);
    },
    async resolve(query, _, { id }) {
      return prisma.studentAssociation.findUniqueOrThrow({
        ...query,
        where: { id },
      });
    },
  })
);

builder.mutationField('contribute', (t) =>
  t.field({
    type: 'Boolean',
    errors: {},
    args: {
      modelId: t.arg.id(),
      phone: t.arg.string(),
    },
    authScopes(_, {}, { user }) {
      return Boolean(user);
    },
    async resolve(_, { id, phone }, { user }) {
      if (!user) return false;

      const studentAssociation = await prisma.studentAssociation.findUnique({
        where: { id },
        include: { lydiaAccounts: true },
      });
      if (!studentAssociation) throw new GraphQLError('No student associaion found');

      const lydiaAccount = studentAssociation.lydiaAccounts[0];
      if (!lydiaAccount) throw new GraphQLError("Cette AE n'a pas de compte Lydia");

      await prisma.contribution.create({
        data: {
          studentAssociation: {
            connect: [{ id }, { name: "INP Toulouse" }]          },
          paid: false,
          user: {
            connect: { id: user.id },
          },
        },
      });

      await sendLydiaPaymentRequest(
        `la cotisation pour ${studentAssociation.name}`,
        studentAssociation.contributionPrice,
        phone,
        lydiaAccount.vendorToken
      );

      await prisma.logEntry.create({
        data: {
          area: 'contribution',
          action: 'create',
          target: id,
          message: `Created contribution for ${studentAssociation.name}`,
          user: { connect: { id: user.id } },
        },
      });

      return true;
    },
  })
);

builder.mutationField('cancelPendingContribution', (t) =>
  t.field({
    type: 'Boolean',
    args: {
      studentAssociationId: t.arg.id(),
    },
    authScopes(_, {}, { user }) {
      return Boolean(user);
    },
    async resolve(_, { studentAssociationId }, { user }) {
      if (!user) return false;

      const contribution = await prisma.contribution.findUnique({
        where: {
          userId_studentAssociationId: {
            userId: user.id,
            studentAssociationId,
          },
        },
        include: {
          transaction: true,
          studentAssociation: {
            include: {
              lydiaAccounts: true,
            },
          },
        },
      });

      if (
        contribution?.transaction?.requestId &&
        contribution.studentAssociation.lydiaAccounts[0]?.vendorToken
      ) {
        await cancelLydiaTransaction(
          contribution.transaction,
          contribution.studentAssociation.lydiaAccounts[0].vendorToken
        );
      }

      await prisma.contribution.delete({
        where: {
          userId_studentAssociationId: {
            userId: user.id,
            studentAssociationId,
          },
        },
      });

      await prisma.logEntry.create({
        data: {
          area: 'contribution',
          action: 'delete',
          target: studentAssociationId,
          message: `Deleted contribution for ${contribution?.studentAssociation.name ?? ''}`,
          user: { connect: { id: user.id } },
        },
      });
      return true;
    },
  })
);

// TODO maybe query to get list of all contributors of a student association
