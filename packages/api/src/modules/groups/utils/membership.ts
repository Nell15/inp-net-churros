import { type Context } from '#lib';
import {} from '#modules/global';
import {} from '../index.js';

export function onBoard(
  permissions:
    | { president: boolean; treasurer: boolean; vicePresident: boolean; secretary: boolean }
    | undefined
    | null,
): boolean {
  if (!permissions) return false;
  return (
    permissions.president ||
    permissions.treasurer ||
    permissions.vicePresident ||
    permissions.secretary
  );
}

export function userIsPresidentOf(user: Context['user'], groupUid: string): boolean {
  return Boolean(
    user?.groups.some(({ group: { uid }, president }) => uid === groupUid && president),
  );
}

export function userIsTreasurerOf(user: Context['user'], groupUid: string): boolean {
  return Boolean(
    user?.groups.some(({ group: { uid }, treasurer }) => uid === groupUid && treasurer),
  );
}
export function userIsOnBoardOf(user: Context['user'], groupUid: string): boolean {
  return Boolean(
    user?.groups.some(
      ({ group: { uid }, ...permissions }) => uid === groupUid && onBoard(permissions),
    ),
  );
}
export function userIsMemberOf(user: Context['user'], groupUid: string): boolean {
  return Boolean(user?.groups.some(({ group: { uid } }) => uid === groupUid));
}
