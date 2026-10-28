import 'server-only';
import { adminAuditLog, getDb } from '@redcore/db';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { adminBasePath, CONSOLE_HEADER } from '@/lib/admin-path';
import { getSession } from './auth';

export type StaffRole = 'admin' | 'manager';

/** Разделы консоли и роли, которым они доступны. Менеджер не видит пользователей и настройки. */
export const sectionRoles = {
  dashboard: ['admin', 'manager'],
  orders: ['admin', 'manager'],
  products: ['admin', 'manager'],
  stock: ['admin', 'manager'],
  reviews: ['admin', 'manager'],
  promos: ['admin', 'manager'],
  games: ['admin', 'manager'],
  ai: ['admin', 'manager'],
  payments: ['admin', 'manager'],
  users: ['admin'],
  settings: ['admin'],
  mcp: ['admin'],
  audit: ['admin'],
} as const satisfies Record<string, readonly StaffRole[]>;

export type ConsoleSection = keyof typeof sectionRoles;

export interface Staff {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
  twoFactorEnabled: boolean;
}

/** Консоль открывается только через секретный путь — proxy ставит служебный заголовок. */
export async function assertConsoleRequest(): Promise<string> {
  const base = adminBasePath();
  const marker = (await headers()).get(CONSOLE_HEADER);
  if (!base || marker !== base) notFound();
  return base;
}

export const getStaff = cache(async (): Promise<Staff | null> => {
  const session = await getSession();
  const u = session?.user as
    | {
        id: string;
        email: string;
        name: string;
        role?: string;
        twoFactorEnabled?: boolean | null;
        banned?: boolean | null;
      }
    | undefined;
  if (!u || u.banned || (u.role !== 'admin' && u.role !== 'manager')) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    twoFactorEnabled: Boolean(u.twoFactorEnabled),
  };
});

export function canAccess(role: StaffRole, section: ConsoleSection): boolean {
  return (sectionRoles[section] as readonly StaffRole[]).includes(role);
}

/**
 * Гард страниц и actions консоли: сотрудник с включённой 2FA и доступом к разделу.
 * Без 2FA — только на страницу подключения; чужой раздел — 404 (не раскрываем его наличие).
 */
export async function requireStaff(section: ConsoleSection): Promise<Staff> {
  const base = adminBasePath();
  if (!base) notFound();
  const staff = await getStaff();
  if (!staff) redirect(`${base}/login`);
  if (!staff.twoFactorEnabled) redirect(`${base}/login?step=enroll`);
  if (!canAccess(staff.role, section)) notFound();
  return staff;
}

async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip');
}

/** Запись в журнал аудита: каждое изменение данных из консоли и каждый вход. */
export async function audit(
  actor: { id: string | null; email: string | null },
  action: string,
  entity: string,
  entityId?: string | null,
  diff?: Record<string, unknown>,
): Promise<void> {
  const db = await getDb();
  await db.insert(adminAuditLog).values({
    actorId: actor.id,
    actorEmail: actor.email,
    action,
    entity,
    entityId: entityId ?? null,
    diff: diff ?? null,
    ip: await clientIp(),
  });
}
