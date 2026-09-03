"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createIncomeEntry,
  deleteIncomeEntry,
  getMonthlyIncomeSummary,
  getOnboardingStatus,
  listIncomeEntries,
  updateIncomeEntry,
  type IncomeEntry,
} from "@/lib/api";
import { getToken } from "@/lib/auth";
import { AuthGuard } from "../auth-guard";

function toCents(amount: number) {
  return Math.round(amount * 100);
}

function fromCents(cents: number) {
  return (cents / 100).toFixed(2);
}

const SOURCE_LABEL: Record<string, string> = { fixed: "Fixed", freelance: "Freelance" };

function IncomeManager() {
  const token = getToken()!;
  const queryClient = useQueryClient();
  const today = new Date();

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [source, setSource] = useState("fixed");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today.toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: onboarding } = useQuery({
    queryKey: ["onboarding-status"],
    queryFn: () => getOnboardingStatus(token),
  });
  const { data: entries } = useQuery({
    queryKey: ["income-entries", year, month],
    queryFn: () => listIncomeEntries(token, year, month),
  });
  const { data: summary } = useQuery({
    queryKey: ["income-summary", year, month],
    queryFn: () => getMonthlyIncomeSummary(token, year, month),
  });

  const allowedSources =
    onboarding?.income_mode === "fixed_only"
      ? ["fixed"]
      : onboarding?.income_mode === "freelance_only"
      ? ["freelance"]
      : ["fixed", "freelance"];

  function resetForm() {
    setEditingId(null);
    setSource(allowedSources[0]);
    setAmount("");
    setDate(today.toISOString().slice(0, 10));
    setNote("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cents = toCents(Number(amount));
    if (!cents || cents <= 0) {
      setError("Enter a valid amount");
      return;
    }
    try {
      if (editingId) {
        await updateIncomeEntry(token, editingId, { source, amount_cents: cents, date, note: note || undefined });
      } else {
        await createIncomeEntry(token, { source, amount_cents: cents, date, note: note || undefined });
      }
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["income-entries"] });
      queryClient.invalidateQueries({ queryKey: ["income-summary"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function handleEdit(entry: IncomeEntry) {
    setEditingId(entry.id);
    setSource(entry.source);
    setAmount(fromCents(entry.amount_cents));
    setDate(entry.date);
    setNote(entry.note ?? "");
  }

  async function handleDelete(id: number) {
    await deleteIncomeEntry(token, id);
    queryClient.invalidateQueries({ queryKey: ["income-entries"] });
    queryClient.invalidateQueries({ queryKey: ["income-summary"] });
  }

  function changeMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m);
    setYear(y);
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-6">
      <h1 className="text-2xl font-bold">Income</h1>

      <div className="flex items-center gap-4">
        <button onClick={() => changeMonth(-1)} className="border rounded px-2 py-1">←</button>
        <span>{year}-{String(month).padStart(2, "0")}</span>
        <button onClick={() => changeMonth(1)} className="border rounded px-2 py-1">→</button>
      </div>

      {summary && (
        <div className="text-sm text-gray-600">
          Total: {fromCents(summary.total_cents)} MAD — Fixed: {fromCents(summary.fixed_cents)} / Freelance: {fromCents(summary.freelance_cents)} ({summary.entry_count} entries)
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex w-96 flex-col gap-3">
        {allowedSources.length > 1 && (
          <select value={source} onChange={(e) => setSource(e.target.value)} className="border rounded px-2 py-1">
            {allowedSources.map((s) => (
              <option key={s} value={s}>{SOURCE_LABEL[s]}</option>
            ))}
          </select>
        )}
        <input type="number" step="0.01" placeholder="Amount (MAD)" value={amount}
          onChange={(e) => setAmount(e.target.value)} className="border rounded px-2 py-1" required />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="border rounded px-2 py-1" required />
        <input type="text" placeholder="Note (optional)" value={note}
          onChange={(e) => setNote(e.target.value)} className="border rounded px-2 py-1" />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" className="bg-black text-white rounded px-3 py-2">
            {editingId ? "Save changes" : "Add entry"}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="border rounded px-3 py-2">Cancel</button>
          )}
        </div>
      </form>

      <table className="w-full max-w-lg text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-1">Date</th><th>Source</th><th>Amount</th><th>Note</th><th></th>
          </tr>
        </thead>
        <tbody>
          {entries?.map((entry) => (
            <tr key={entry.id} className="border-b">
              <td className="py-1">{entry.date}</td>
              <td>{SOURCE_LABEL[entry.source]}</td>
              <td>{fromCents(entry.amount_cents)} MAD</td>
              <td>{entry.note}</td>
              <td className="flex gap-2 py-1">
                <button onClick={() => handleEdit(entry)} className="text-blue-600">Edit</button>
                <button onClick={() => handleDelete(entry.id)} className="text-red-600">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

export default function IncomePage() {
  return (
    <AuthGuard>
      <IncomeManager />
    </AuthGuard>
  );
}
