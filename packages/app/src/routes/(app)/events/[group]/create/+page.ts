import { isOnClubBoard } from '$lib/permissions';
import { redirectToLogin } from '$lib/session';
import { Selector, loadQuery } from '$lib/zeus';
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, parent, url, params }) => {
  const { me } = await parent();
  if (!me) throw redirectToLogin(url.pathname);

  if (
    !me.admin &&
    !me.groups.some(({ canEditArticles, ...perms }) => canEditArticles || isOnClubBoard(perms))
  )
    throw redirect(307, '..');

  return loadQuery(
    {
      group: [
        { uid: params.group },
        Selector('Group')({
          email: true,
          name: true,
          pictureFile: true,
          pictureFileDark: true,
          uid: true,
          id: true,
          studentAssociation: { school: { name: true } },
          children: {
            name: true,
            studentAssociation: { school: { name: true } },
          },
          members: {
            member: {
              uid: true,
              firstName: true,
              lastName: true,
              pictureFile: true,
              fullName: true,
            },
            canScanEvents: true,
          },
        }),
      ],
      lydiaAccounts: {
        id: true,
        name: true,
        group: {
          uid: true,
          name: true,
          pictureFile: true,
          pictureFileDark: true,
        },
      },
    },
    { fetch, parent },
  );
};
