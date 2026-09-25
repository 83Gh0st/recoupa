export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
    </Card>
  );
}

const BADGE_STYLES: Record<string, string> = {
  OPEN: "bg-slate-100 text-slate-700",
  PROMISED: "bg-amber-100 text-amber-800",
  DISPUTED: "bg-rose-100 text-rose-700",
  NO_ANSWER: "bg-sky-100 text-sky-700",
  DECLINED: "bg-slate-200 text-slate-500",
  RESOLVED: "bg-emerald-100 text-emerald-700",
  PARTIAL: "bg-amber-100 text-amber-800",
  SETTLED: "bg-emerald-100 text-emerald-700",
  WRITE_OFF: "bg-slate-200 text-slate-500",
  PENDING: "bg-slate-100 text-slate-700",
  DEPOSITED: "bg-sky-100 text-sky-700",
  CLEARED: "bg-emerald-100 text-emerald-700",
  BOUNCED: "bg-rose-100 text-rose-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
  NEW: "bg-slate-100 text-slate-700",
  ENGAGED: "bg-sky-100 text-sky-700",
  NEGOTIATING: "bg-amber-100 text-amber-800",
  PROPOSAL_SENT: "bg-violet-100 text-violet-700",
  MEETING_SET: "bg-indigo-100 text-indigo-700",
  LOST: "bg-slate-200 text-slate-500",
  CONVERTED: "bg-emerald-100 text-emerald-700",
};

export function Badge({ value }: { value: string }) {
  const style = BADGE_STYLES[value] ?? "bg-slate-100 text-slate-700";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style}`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center text-sm text-slate-500 py-12 border border-dashed border-slate-200 rounded-xl">
      {children}
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-rose-600">{message}</p>;
}

export const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand";
export const labelClass = "block text-xs font-medium text-slate-600 mb-1";
export const btnPrimary =
  "inline-flex items-center justify-center rounded-md bg-brand px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-dark transition-colors disabled:opacity-50";
export const btnSecondary =
  "inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50";
export const tableClass = "w-full text-sm";
export const thClass =
  "text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-3 py-2 border-b border-slate-200";
export const tdClass = "px-3 py-2.5 border-b border-slate-100 align-top";
