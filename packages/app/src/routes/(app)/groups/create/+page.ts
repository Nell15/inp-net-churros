import { GroupType, loadQuery } from '$lib/zeus';
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, parent }) => {
  const { me } = await parent();
  if (!me?.canEditGroups) throw redirect(307, '..');
  return {
    ...(await loadQuery(
      {
        schoolGroups: { majors: { id: true, name: true }, names: true },
      },
      { fetch, parent },
    )),
    lydiaAccountsOfGroup: [],
    group: {
      id: '',
      uid: '',
      type: GroupType.Club,
      parentId: undefined,
      groupId: '',
      studentAssociationId: me.contributesTo[0]?.id,
      name: '',
      color: '#aaaaaa',
      address: '',
      description: '',
      email: `contact@bde.${me.major?.schools[0].name.toLowerCase()}.fr`,
      longDescription: '',
      website: '',
      links: [],
      pictureFile: '',
      pictureFileDark: '',
      selfJoinable: false,
      related: [],
    },
  };
};
