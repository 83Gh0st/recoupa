"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, btnPrimary, btnSecondary, labelClass, inputClass } from "@/components/ui";

type ValidateResult = {
  total: number;
  validCount: number;
  duplicateCount: number;
  errorCount: number;
  errors: { row: number; issues: string[] }[];
  duplicateRows: number[];
  error?: string;
};

export default function ImportClient({
  clientId,
  collectors,
}: {
  clientId: string;
  collectors: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [assignUserId, setAssignUserId] = useState("");
  const [result, setResult] = useState<ValidateResult | null>(null);
  const [committed, setCommitted] = useState<{ debtorsCreated: number; invoicesCreated: number } | null>(null);
  const [loading, setLoading] = useState<"validate" | "commit" | null>(null);

  async function run(mode: "validate" | "commit") {
    if (!file) return;
    setLoading(mode);
    setCommitted(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("mode", mode);
    if (assignUserId) fd.append("assignUserId", assignUserId);

    const res = await fetch(`/api/clients/${clientId}/import`, { method: "POST", body: fd });
    const data = await res.json();
    setLoading(null);

    if (mode === "validate") {
      setResult(data);
    } else {
      setCommitted(data);
      setResult(null);
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-4 space-y-4">
        <div>
          <label className={labelClass}>Spreadsheet (.xlsx, .xls, .csv)</label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
              setCommitted(null);
            }}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-slate-400">
            One row = one invoice. Repeat the debtor name and phone on every invoice line for that
            debtor. Recognized columns (any naming): debtor name, phone, invoice number, invoice
            date, amount - plus optional due date, outstanding, collected, commission %, contact
            person, trade license, city.
          </p>
        </div>
        <div>
          <label className={labelClass}>Assign new debtors to (optional)</label>
          <select
            className={inputClass}
            value={assignUserId}
            onChange={(e) => setAssignUserId(e.target.value)}
          >
            <option value="">Leave unassigned</option>
            {collectors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-3">
          <button
            disabled={!file || loading !== null}
            onClick={() => run("validate")}
            className={btnSecondary}
          >
            {loading === "validate" ? "Validating…" : "Validate (dry run)"}
          </button>
          <button
            disabled={!result || result.validCount === 0 || loading !== null}
            onClick={() => run("commit")}
            className={btnPrimary}
          >
            {loading === "commit" ? "Committing…" : `Commit ${result?.validCount ?? 0} valid row(s)`}
          </button>
        </div>
      </Card>

      {result && (
        <Card className="p-4">
          {result.error ? (
            <p className="text-sm text-rose-600">{result.error}</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                <div>
                  <div className="text-2xl font-semibold text-emerald-600">{result.validCount}</div>
                  <div className="text-xs text-slate-500">Valid</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-amber-600">{result.duplicateCount}</div>
                  <div className="text-xs text-slate-500">Duplicates</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-rose-600">{result.errorCount}</div>
                  <div className="text-xs text-slate-500">Errors</div>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="text-xs text-slate-600 max-h-48 overflow-y-auto border-t border-slate-100 pt-3">
                  {result.errors.map((e) => (
                    <div key={e.row} className="py-0.5">
                      Row {e.row}: {e.issues.join(", ")}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {committed && (
        <Card className="p-4 bg-emerald-50 border-emerald-200">
          <p className="text-sm text-emerald-800">
            Committed - {committed.debtorsCreated} new debtor(s), {committed.invoicesCreated} invoice(s)
            created.
          </p>
        </Card>
      )}
    </div>
  );
}
