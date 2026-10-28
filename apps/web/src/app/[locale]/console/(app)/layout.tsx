import { ConsoleNav, type NavSection } from '@/features/console/console-nav';
import { canAccess, requireStaff, sectionRoles } from '@/server/staff';

export default async function ConsoleAppLayout({ children }: LayoutProps<'/[locale]/console'>) {
  const staff = await requireStaff('dashboard');
  const sections = (Object.keys(sectionRoles) as NavSection[]).filter((s) =>
    canAccess(staff.role, s),
  );
  return (
    <div className="grid min-h-dvh lg:grid-cols-[15rem_minmax(0,1fr)]">
      <ConsoleNav
        sections={sections}
        staff={{ name: staff.name, login: staff.login, role: staff.role }}
      />
      <div className="min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">{children}</div>
    </div>
  );
}
