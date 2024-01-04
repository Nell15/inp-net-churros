import { browser } from '$app/environment';
import { redirectToLogin } from '$lib/session.js';
import { loadQuery } from '$lib/zeus';

export async function load({ parent, url, fetch }) {
  const { me } = await parent();
  if (!me) throw redirectToLogin(url.pathname, Object.fromEntries(url.searchParams.entries()));

  if (!browser) console.info(`[oauth] authorize(${me.uid}, ${url.search})`);

  const clientId = url.searchParams.get('client_id');

  if (!clientId) throw new Error('No client_id provided');

  const csrfState = url.searchParams.get('state') ?? '';

  const { thirdPartyApp } = await loadQuery(
    {
      thirdPartyApp: [
        { id: clientId },
        {
          name: true,
          website: true,
          description: true,
          faviconUrl: true,
          owner: {
            id: true,
            uid: true,
            name: true,
            pictureFile: true,
            pictureFileDark: true,
          },
        },
      ],
    },
    { fetch, parent },
  );

  return { app: thirdPartyApp, csrfState };
}
