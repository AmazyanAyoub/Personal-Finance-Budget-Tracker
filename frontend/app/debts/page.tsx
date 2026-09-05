"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createDebt, deleteDebt, listDebts, listDebtPayments, logDebtPayment, type Debt } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { AuthGuard } from "../auth-guard";

function toCents(amount: number) {
  return Math.round(amount * 100);
}
function fromCents(cents: number) {
  return (cents / 100).toFixed(2);
}

function DebtCard({ debt }: { debt: Debt }) {
  const token = getToken()!;
  const queryClient = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  const { data: payments } = useQuery({
    queryKey: ["debt-payments", debt.id],
    queryFn: () => listDebtPayments(token, debt.id),
    enabled: showHistory,
  });

  async function handleLogPayment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cents = toCents(Number(paymentAmount));
    if (!cents || cents <= 0) {
      setError("Enter a valid amount");
      return;
    }
    try {
      await logDebtPayment(token, debt.id, { amount_cents: cents, date: paymentDate });
      setPaymentAmount("");
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["debt-payments", debt.id] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleDelete() {
    await deleteDebt(token, debt.id);
    queryClient.invalidateQueries({ queryKey: ["debts"] });
  }

  return (
    <div className="border rounded p-4 flex flex-col gap-2 w-full max-w-lg">
      <div className="flex justify-between items-center">
        <h2 className="font-bold">{debt.name}</h2>
        <button onClick={handleDelete} className="text-red-600 text-sm">Delete</button>
      </div>

      <div className="w-full bg-gray-200 rounded h-2">
        <div className="bg-green-600 h-2 rounded" style={{ width: `${Math.min(debt.progress_pct, 100)}%` }} />
      </div>
      <p className="text-sm text-gray-600">
        {debt.is_paid_off
          ? "Paid off"
          : `${fromCents(debt.current_balance_cents)} MAD remaining of ${fromCents(debt.starting_balance_cents)} MAD (${debt.progress_pct}% paid)`}
      </p>
      <p className="text-xs text-gray-500">
        Monthly payment: {fromCents(debt.monthly_payment_cents)} MAD
        {debt.payoff_target_date && ` — target: ${debt.payoff_target_date}`}
      </p>

      {!debt.is_paid_off && (
        <form onSubmit={handleLogPayment} className="flex gap-2 items-end">
          <input type="number" step="0.01" placeholder="Amount (MAD)" value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)} className="border rounded px-2 py-1 w-32" />
          <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)}
            className="border rounded px-2 py-1" />
          <button type="submit" className="bg-black text-white rounded px-3 py-1">Log payment</button>
        </form>
      )}
      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button onClick={() => setShowHistory((s) => !s)} className="text-sm underline self-start">
        {showHistory ? "Hide" : "Show"} payment history
      </button>
      {showHistory && (
        <ul className="text-sm">
          {payments?.map((p) => (
            <li key={p.id}>{p.date} — {fromCents(p.amount_cents)} MAD</li>
          ))}
          {payments?.length === 0 && <li className="text-gray-400">No payments yet</li>}
        </ul>
      )}
    </div>
  );
}

function DebtManager() {
  const token = getToken()!;
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [monthlyPayment, setMonthlyPayment] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: debts } = useQuery({ queryKey: ["debts"], queryFn: () => listDebts(token) });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const balanceCents = toCents(Number(balance));
    const monthlyCents = toCents(Number(monthlyPayment));
    if (!balanceCents || balanceCents <= 0 || !monthlyCents || monthlyCents <= 0) {
      setError("Enter valid amounts");
      return;
    }
    try {
      await createDebt(token, {
        name,
        balance_cents: balanceCents,
        monthly_payment_cents: monthlyCents,
        payoff_target_date: targetDate || undefined,
      });
      setName("");
      setBalance("");
      setMonthlyPayment("");
      setTargetDate("");
      queryClient.invalidateQueries({ queryKey: ["debts"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-6">
      <h1 className="text-2xl font-bold">Debts</h1>

      <form onSubmit={handleCreate} className="flex w-96 flex-col gap-3">
        <input type="text" placeholder="Name (e.g. Car loan)" value={name}
          onChange={(e) => setName(e.target.value)} className="border rounded px-2 py-1" required />
        <input type="number" step="0.01" placeholder="Starting balance (MAD)" value={balance}
          onChange={(e) => setBalance(e.target.value)} className="border rounded px-2 py-1" required />
        <input type="number" step="0.01" placeholder="Monthly payment (MAD)" value={monthlyPayment}
          onChange={(e) => setMonthlyPayment(e.target.value)} className="border rounded px-2 py-1" required />
        <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}
          className="border rounded px-2 py-1" />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button type="submit" className="bg-black text-white rounded px-3 py-2">Add debt</button>
      </form>

      <div className="flex flex-col gap-4 w-full items-center">
        {debts?.map((debt) => <DebtCard key={debt.id} debt={debt} />)}
      </div>
    </main>
  );
}

export default function DebtsPage() {
  return (
    <AuthGuard>
      <DebtManager />
    </AuthGuard>
  );
}
