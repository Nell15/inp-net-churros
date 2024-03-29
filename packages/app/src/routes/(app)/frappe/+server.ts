import { yearTier } from '$lib/dates';
import { redirectToLogin } from '$lib/session';
import { makeMutation } from '$lib/zeus';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals, url, fetch }) => {
  const { me, token } = locals;
  if (!me) throw redirectToLogin(url.pathname);
  const tier = yearTier(me.graduationYear);

  try {
    void makeMutation(
      { updateSubjectsExamDates: true },
      {
        fetch,
        token,
      },
    );
  } catch (error) {
    console.error(`Could not update subject exam dates: ${error?.toString() ?? ''}`);
  }

  throw redirect(
    303,
    me.major
      ? tier > 3
        ? `/documents/${me.major.uid}`
        : `/documents/${me.major.uid}/${tier}a${
            tier === 3 ? '' : me.apprentice ? '-fisa' : '-fise'
          }/`
      : '/documents/',
  );
};
