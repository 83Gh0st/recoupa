import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export type Role = "OWNER" | "MANAGER" | "COLLECTOR" | "SALES" | "CLIENT";

/** Fetch the current session (or null) on the server. */
export async function getSession(): Promise<Session | null> {
  return getServerSession(authOptions);
}

/** Use in server components / pages: redirects to /login if not authenticated. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Use in server actions: throws instead of redirecting (actions can't redirect mid-mutation safely). */
export async function requireUser() {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated.");
  return session.user;
}

/** Throws if the current user's role is not in `allowed`. */
export async function requireRole(allowed: Role[]) {
  const user = await requireUser();
  if (!allowed.includes(user.role as Role)) {
    throw new Error("You do not have permission to perform this action.");
  }
  return user;
}

/** Sidebar / route visibility matrix, mirrors the permission model used server-side. */
export const AREA_ACCESS: Record<string, Role[]> = {
  dashboard: ["OWNER", "MANAGER", "COLLECTOR", "SALES", "CLIENT"],
  queue: ["OWNER", "MANAGER", "COLLECTOR"],
  debtors: ["OWNER", "MANAGER", "COLLECTOR"],
  disputes: ["OWNER", "MANAGER", "COLLECTOR", "CLIENT"],
  clients: ["OWNER", "MANAGER", "CLIENT"],
  corrections: ["OWNER", "MANAGER", "COLLECTOR"],
  salesPipeline: ["OWNER", "MANAGER", "SALES"],
  salesQueue: ["OWNER", "MANAGER", "SALES"],
  prospects: ["OWNER", "MANAGER", "SALES"],
  salesImport: ["OWNER", "MANAGER"],
  clientImport: ["OWNER", "MANAGER"],
  adminUsers: ["OWNER", "MANAGER"],
  adminTenants: ["OWNER"],
  adminAudit: ["OWNER", "MANAGER"],
  adminCommission: ["OWNER", "MANAGER"],
};

export function canAccess(role: Role, area: keyof typeof AREA_ACCESS) {
  return AREA_ACCESS[area]?.includes(role) ?? false;
}
export type Area = keyof typeof AREA_ACCESS;

/** Guard for server components/pages. Redirects home with no crash if the role can't see this area. */
export async function requireArea(area: keyof typeof AREA_ACCESS) {
  const session = await requireSession();
  if (!canAccess(session.user.role as Role, area)) {
    redirect("/dashboard");
  }
  return session;
}
