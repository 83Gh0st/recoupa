import Link from "next/link";
import type { Session } from "next-auth";
import { canAccess, type Role, type Area } from "@/lib/rbac";
import SignOutButton from "./SignOutButton";
import { initials } from "@/lib/format";

type NavItem = { href: string; label: string; area: Area };
type NavGroup = { title: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", area: "dashboard" },
      { href: "/handbook", label: "Handbook", area: "dashboard" },
    ],
  },
  {
    title: "Collection",
    items: [
      { href: "/queue", label: "Calling Queue", area: "queue" },
      { href: "/debtors", label: "Debtors", area: "debtors" },
      { href: "/disputes", label: "Disputes", area: "disputes" },
      { href: "/clients", label: "Principal Clients", area: "clients" },
      { href: "/corrections", label: "Payment Corrections", area: "corrections" },
    ],
  },
  {
    title: "Sales",
    items: [
      { href: "/sales/pipeline", label: "Pipeline", area: "salesPipeline" },
      { href: "/sales/queue", label: "Outreach Queue", area: "salesQueue" },
      { href: "/sales/prospects", label: "Prospects", area: "prospects" },
      { href: "/sales/import", label: "Import Sheet", area: "salesImport" },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/admin/users", label: "Team", area: "adminUsers" },
      { href: "/admin/tenants", label: "Tenants", area: "adminTenants" },
      { href: "/admin/commission", label: "Commission Rules", area: "adminCommission" },
      { href: "/admin/audit", label: "Audit Log", area: "adminAudit" },
    ],
  },
];

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  MANAGER: "Operations Manager",
  COLLECTOR: "Collector",
  SALES: "Sales Rep",
  CLIENT: "Client Portal",
};

export default function Shell({
  session,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  const role = session.user.role as Role;
  const visibleGroups = NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => canAccess(role, i.area)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden md:flex w-64 shrink-0 flex-col bg-brand-dark text-white">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="font-semibold text-lg tracking-tight">Recoupa</div>
          <div className="text-xs text-white/60">{session.user.tenantName}</div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {visibleGroups.map((g) => (
            <div key={g.title}>
              <div className="px-2 text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-1">
                {g.title}
              </div>
              <div className="space-y-0.5">
                {g.items.map((i) => (
                  <Link
                    key={i.href}
                    href={i.href}
                    className="block rounded-md px-2.5 py-1.5 text-sm text-white/85 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    {i.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-full bg-brand-light/80 flex items-center justify-center text-xs font-semibold shrink-0">
              {initials(session.user.name || session.user.email || "?")}
            </div>
            <div className="min-w-0">
              <div className="text-sm truncate">{session.user.name}</div>
              <div className="text-[11px] text-white/50">{ROLE_LABEL[role]}</div>
            </div>
          </div>
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 min-w-0 bg-background">
        <div className="mx-auto max-w-6xl px-4 md:px-8 py-6 md:py-8">{children}</div>
      </main>
    </div>
  );
}
