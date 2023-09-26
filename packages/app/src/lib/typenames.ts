/* @generated from schema by /packages/api/build/scripts/update-id-prefix-to-typename-map.js */
const ID_PREFIXES_TO_TYPENAMES = {
  u: 'User',
  godparentreq: 'GodparentRequest',
  candidate: 'UserCandidate',
  passreset: 'PasswordReset',
  emailchange: 'EmailChange',
  service: 'Service',
  link: 'Link',
  major: 'Major',
  minor: 'Minor',
  school: 'School',
  credential: 'Credential',
  ae: 'StudentAssociation',
  contribution: 'Contribution',
  contributionoption: 'ContributionOption',
  g: 'Group',
  a: 'Article',
  e: 'Event',
  tg: 'TicketGroup',
  t: 'Ticket',
  r: 'Registration',
  log: 'LogEntry',
  lydia: 'LydiaAccount',
  lydiapayment: 'LydiaTransaction',
  barweek: 'BarWeek',
  notifsub: 'NotificationSubscription',
  notif: 'Notification',
  notifsetting: 'NotificationSetting',
  ann: 'Announcement',
  subj: 'Subject',
  doc: 'Document',
  comment: 'Comment',
} as const;
/* end @generated from schema */

export const TYPENAMES_TO_ID_PREFIXES = Object.fromEntries(
  Object.entries(ID_PREFIXES_TO_TYPENAMES).map(([prefix, typename]) => [typename, prefix]),
) as Record<
  (typeof ID_PREFIXES_TO_TYPENAMES)[keyof typeof ID_PREFIXES_TO_TYPENAMES],
  keyof typeof ID_PREFIXES_TO_TYPENAMES
>;

export function removeIdPrefix(
  typename: keyof typeof TYPENAMES_TO_ID_PREFIXES,
  id: string,
): string {
  if (!id.startsWith(`${TYPENAMES_TO_ID_PREFIXES[typename]}:`)) return id;
  return id.replace(`${TYPENAMES_TO_ID_PREFIXES[typename]}:`, '');
}

export function ensureIdPrefix(
  typename: keyof typeof TYPENAMES_TO_ID_PREFIXES,
  id: string,
): string {
  if (id.startsWith(`${TYPENAMES_TO_ID_PREFIXES[typename]}:`)) return id;
  return `${TYPENAMES_TO_ID_PREFIXES[typename]}:${id}`;
}