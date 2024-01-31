import { builder, prisma } from '#lib';
import {} from '#modules/global';
import { GraphQLError } from 'graphql';
import { uniqBy } from 'lodash';
import { UserType } from '#modules/users';
import {} from '../index.js';

builder.queryField('codeContributors', (t) =>
  t.prismaField({
    type: [UserType],
    errors: {},
    authScopes: () => true,
    async resolve() {
      const codeContributors = (await fetch(
        `https:///git.inpt.fr/api/v4/projects/${process.env.GITLAB_PROJECT_ID}/repository/contributors`,
      )
        .then(async (r) => r.json())
        .catch(() => {
          throw new GraphQLError('Connexion à git.inpt.fr impossible');
        })) as Array<{
        name: string;
        email: string;
        commits: number;
        additions: number;
        deletions: number;
      }>;
      const contributorEmails = [
        ...new Set(codeContributors.map((contributor) => contributor.email)),
      ];
      const uids = contributorEmails
        .filter((e) => e.endsWith('@bde.enseeiht.fr'))
        .map((e) => e.replace('@bde.enseeiht.fr', ''));

      const users = await prisma.user.findMany({
        where: {
          OR: [
            { email: { in: contributorEmails } },
            {
              otherEmails: { hasSome: contributorEmails },
            },
            {
              uid: { in: uids },
            },
          ],
        },
      });

      return uniqBy(users, (u) => u.id);
    },
  }),
);
