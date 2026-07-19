/**
 * Fixed system user used only as a room-create seat filler.
 * Cannot log in, cannot be deleted; appears in invite pickers with isVirtual.
 */
export const VIRTUAL_PLACEHOLDER_USER_ID = '00000000-0000-4000-8000-000000000001';
export const VIRTUAL_PLACEHOLDER_USERNAME = 'virtual-placeholder';
export const VIRTUAL_PLACEHOLDER_DISPLAY_NAME = 'Virtual Placeholder';

export function isVirtualPlaceholderUser(user: {
  id?: string | null;
  username?: string | null;
}): boolean {
  return (
    user.id === VIRTUAL_PLACEHOLDER_USER_ID ||
    user.username === VIRTUAL_PLACEHOLDER_USERNAME
  );
}
