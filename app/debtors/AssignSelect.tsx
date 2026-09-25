"use client";

import { useState } from "react";
import { assignDebtor } from "./actions";

export default function AssignSelect({
  debtorId,
  collectors,
  assignedUserId,
}: {
  debtorId: string;
  collectors: { id: string; name: string }[];
  assignedUserId: string | null;
}) {
  const [pending, setPending] = useState(false);

  return (
    <select
      defaultValue={assignedUserId || ""}
      disabled={pending}
      onChange={async (e) => {
        setPending(true);
        await assignDebtor(debtorId, e.target.value);
        setPending(false);
      }}
      className="text-xs rounded border border-slate-200 px-1.5 py-1 disabled:opacity-50"
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
