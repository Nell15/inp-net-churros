import { prisma, type Context } from '#lib';
import {} from '#modules/global';
import {} from '../index.js';

export async function canEditApp(
  _: unknown,
  { id }: { id: string },
  { user }: { user?: Context['user'] | undefined },
) {
  if (!user) return false;
  if (user.admin) return true;

  return Boolean(
    await prisma.thirdPartyApp.count({
      where: {
        id,
        owner: {
          members: {
            some: {
              member: { id: user.id },
              OR: [
                {
                  president: true,
                },
                {
                  vicePresident: true,
                },
                {
                  secretary: true,
                },
                {
                  treasurer: true,
                },
              ],
            },
          },
        },
      },
    }),
  );
}