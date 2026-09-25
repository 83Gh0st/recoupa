"use client";

import { useTransition } from "react";

export default function AssignSelect({
  debtorId,
  currentUserId,
  collectors,
  onAssign,
}: {
  debtorId: string;
  currentUserId: string | null;
  collectors: { id: string; name: string }[];
  onAssign: (debtorId: string, userId: string) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      defaultValue={currentUserId ?? ""}
      disabled={pending}
      onChange={(e) => {
        const value = e.target.value;
        startTransition(() => {
          onAssign(debtorId, value);
        });
      }}
      className="text-xs rounded border border-slate-300 px-1.5 py-1 disabled:opacity-50"
    >
      <option value="">Unassigned</option>
      {collectors.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
