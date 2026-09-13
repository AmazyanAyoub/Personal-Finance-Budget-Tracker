"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createInvestment,
  deleteInvestment,
  getInvestmentSummary,
  listInvestments,
  listInvestmentTypes,
} from "@/lib/api";
import { getToken } from "@/lib/auth";
import { AuthGuard } from "../../auth-guard";

function toCents(amount: number) {
  return Math.round(amount * 100);
}
function fromCents(cents: number) {
  return (cents / 100).toFixed(2);
}

function InvestmentsManager() {
  const token = getToken()!;
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const [typeId, setTypeId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: types } = useQuery({ queryKey: ["investment-types"], queryFn: () => listInvestmentTypes(token) });
  const { data: investments } = useQuery({ queryKey: ["investments"], queryFn: () => listInvestments(token) });
  const { data: summary } = useQuery({ queryKey: ["investment-summary"], queryFn: () => getInvestmentSummary(token) });

  const typeName = (id: number) => types?.find((t) => t.id === id)?.name ?? id;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cents = toCents(Number(amount));
    if (!cents || cents <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (!typeId) {
      setError("Pick a type");
      return;
    }
    try {
      await createInvestment(token, { investment_type_id: typeId, amount_cents: cents, date, note: note || undefined });
      setAmount("");
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      queryClient.invalidateQueries({ queryKey: ["investment-summary"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleDelete(id: number) {
    await deleteInvestment(token, id);
    queryClient.invalidateQueries({ queryKey: ["investments"] });
    queryClient.invalidateQueries({ queryKey: ["investment-summary"] });
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-6">
      <h1 className="text-2xl font-bold">Investments</h1>

      {summary && (
        <div className="text-center">
          <p className="text-2xl font-bold">{fromCents(summary.total_invested_cents)} MAD total</p>
          {summary.by_type.map((t) => (
            <p key={t.type} className="text-sm text-gray-500">{t.type}: {fromCents(t.amount_cents)} MAD</p>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex w-96 flex-col gap-3">
        <select value={typeId ?? ""} onChange={(e) => setTypeId(Number(e.target.value))}
          className="border rounded px-2 py-1" required>
          <option value="" disabled>Pick a type</option>
          {types?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input type="number" step="0.01" placeholder="Amount (MAD)" value={amount}
          onChange={(e) => setAmount(e.target.value)} className="border rounded px-2 py-1" required />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="border rounded px-2 py-1" required />
        <input type="text" placeholder="Note (optional)" value={note}
          onChange={(e) => setNote(e.target.value)} className="border rounded px-2 py-1" />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button type="submit" className="bg-black text-white rounded px-3 py-2">Log investment</button>
      </form>

      <table className="w-full max-w-lg text-sm">
        <thead>
          <tr className="text-left border-b"><th className="py-1">Date</th><th>Type</th><th>Amount</th><th>Note</th><th></th></tr>
        </thead>
        <tbody>
          {investments?.map((inv) => (
            <tr key={inv.id} className="border-b">
              <td className="py-1">{inv.date}</td>
              <td>{typeName(inv.investment_type_id)}</td>
              <td>{fromCents(inv.amount_cents)} MAD</td>
              <td>{inv.note}</td>
              <td className="py-1"><button onClick={() => handleDelete(inv.id)} className="text-red-600">Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

export default function InvestmentsPage() {
  return (
    <AuthGuard>
      <InvestmentsManager />
    </AuthGuard>
  );
}
