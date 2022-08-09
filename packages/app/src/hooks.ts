import { sessionUserQuery } from '$lib/session';
import { query } from '$lib/zeus';
import type { ExternalFetch, GetSession, Handle } from '@sveltejs/kit';
import * as cookie from 'cookie';

export const handle: Handle = async ({ event, resolve }) => {
  const { token } = cookie.parse(event.request.headers.get('Cookie') ?? '');
  if (token) {
    try {
      const { me } = await query(fetch, { me: sessionUserQuery() }, { token });
      event.locals.token = token;
      event.locals.me = me;
    } catch {}
  }

  event.locals.mobile = Boolean(
    event.request.headers.get('User-Agent')?.toLowerCase().includes('mobile')
  );

  const response = await resolve(event);

  // Delete invalid token
  if (token && !event.locals.me) {
    response.headers.append(
      'Set-Cookie',
      'token=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict'
    );
  }

  return response;
};

export const getSession: GetSession = ({ locals }) => {
  if (!locals.token) return { mobile: locals.mobile };
  return { token: locals.token, me: locals.me, mobile: locals.mobile };
};

export const externalFetch: ExternalFetch = async (request) =>
  fetch(request).catch(() => {
    throw new TypeError('Impossible de joindre le serveur.');
  });
