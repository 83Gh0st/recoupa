"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, btnPrimary, btnSecondary, labelClass, inputClass } from "@/components/ui";

type PreviewResult = {
  total: number;
  validCount: number;
  errorCount: number;
  bySheet: Record<string, number>;
  errors: { row: number; sheet: string; issues: string[] }[];
  error?: string;
};

export default function SalesImportClient({ reps }: { reps: { id: string; name: string }[] }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [assignUserId, setAssignUserId] = useState("");
  const [skipExisting, setSkipExisting] = useState(true);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [imported, setImported] = useState<{ created: number; skipped: number } | null>(null);
  const [loading, setLoading] = useState<"preview" | "import" | null>(null);

  async function run(mode: "preview" | "import") {
    if (!file) return;
    setLoading(mode);
    setImported(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("mode", mode);
    fd.append("skipExisting", String(skipExisting));
    if (assignUserId) fd.append("assignUserId", assignUserId);

    const res = await fetch("/api/sales/import", { method: "POST", body: fd });
    const data = await res.json();
    setLoading(null);

    if (mode === "preview") setPreview(data);
    else {
      setImported(data);
      setPreview(null);
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-4 space-y-4">
        <div>
          <label className={labelClass}>Workbook (.xlsx, .xls, .csv)</label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setImported(null); }}
            className={inputClass}
          />
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Assign all rows to</label>
            <select className={inputClass} value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)}>
              <option value="">Leave unassigned</option>
              {reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm mt-6">
            <input type="checkbox" checked={skipExisting} onChange={(e) => setSkipExisting(e.target.checked)} />
            Skip firms that already exist
          </label>
        </div>
        <div className="flex gap-3">
          <button disabled={!file || loading !== null} onClick={() => run("preview")} className={btnSecondary}>
            {loading === "preview" ? "Previewing…" : "Preview"}
          </button>
          <button disabled={!preview || preview.validCount === 0 || loading !== null} onClick={() => run("import")} className={btnPrimary}>
            {loading === "import" ? "Importing…" : `Import ${preview?.validCount ?? 0} row(s)`}
          </button>
        </div>
      </Card>

      {preview && (
        <Card className="p-4">
          {preview.error ? (
            <p className="text-sm text-rose-600">{preview.error}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4 text-center">
                <div><div className="text-2xl font-semibold text-emerald-600">{preview.validCount}</div><div className="text-xs text-slate-500">Valid</div></div>
                <div><div className="text-2xl font-semibold text-rose-600">{preview.errorCount}</div><div className="text-xs text-slate-500">Errors</div></div>
              </div>
              <div className="text-xs text-slate-600 mb-2">
                {Object.entries(preview.bySheet).map(([sheet, count]) => (
                  <div key={sheet}>{sheet}: {count} row(s)</div>
                ))}
              </div>
              {preview.errors.length > 0 && (
                <div className="text-xs text-slate-500 max-h-40 overflow-y-auto border-t border-slate-100 pt-2">
                  {preview.errors.map((e, idx) => (
                    <div key={idx}>{e.sheet} row {e.row}: {e.issues.join(", ")}</div>
                  ))}
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {imported && (
        <Card className="p-4 bg-emerald-50 border-emerald-200">
          <p className="text-sm text-emerald-800">
            Imported - {imported.created} new prospect(s) created, {imported.skipped} skipped as existing.
          </p>
        </Card>
      )}
    </div>
  );
}
