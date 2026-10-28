import 'server-only';
import { canAccess, getStaff, type ConsoleSection } from './staff';

/** Гард API консоли: сотрудник с 2FA и доступом к разделу; иначе 404 (не раскрываем API). */
export async function staffForApi(section: ConsoleSection) {
  const staff = await getStaff();
  if (!staff || !staff.twoFactorEnabled || !canAccess(staff.role, section)) return null;
  return staff;
}

export const notFound = () => new Response('Not found', { status: 404 });
