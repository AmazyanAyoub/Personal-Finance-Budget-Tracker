"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createExpense,
  deleteExpense,
  getMonthlyExpenseSummary,
  listCategories,
  listExpenses,
  updateExpense,
  type Expense,
} from "@/lib/api";
import { getToken } from "@/lib/auth";
import { AuthGuard } from "../auth-guard";

function toCents(amount: number) {
  return Math.round(amount * 100);
}

function fromCents(cents: number) {
  return (cents / 100).toFixed(2);
}

function ExpenseManager() {
  const token = getToken()!;
  const queryClient = useQueryClient();
  const today = new Date();

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today.toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: () => listCategories(token) });
  const { data: expenses } = useQuery({
    queryKey: ["expenses", year, month],
    queryFn: () => listExpenses(token, year, month),
  });
  const { data: summary } = useQuery({
    queryKey: ["expense-summary", year, month],
    queryFn: () => getMonthlyExpenseSummary(token, year, month),
  });

  const categoryName = (id: number) => categories?.find((c) => c.id === id)?.name ?? id;

  function resetForm() {
    setEditingId(null);
    setAmount("");
    setNote("");
    setDate(today.toISOString().slice(0, 10));
    setCategoryId(categories?.[0]?.id ?? null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cents = toCents(Number(amount));
    if (!cents || cents <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (!categoryId) {
      setError("Pick a category");
      return;
    }
    try {
      const data = { amount_cents: cents, note, date, category_id: categoryId };
      if (editingId) {
        await updateExpense(token, editingId, data);
      } else {
        await createExpense(token, data);
      }
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense-summary"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function handleEdit(expense: Expense) {
    setEditingId(expense.id);
    setAmount(fromCents(expense.amount_cents));
    setNote(expense.note);
    setDate(expense.date);
    setCategoryId(expense.category_id);
  }

  async function handleDelete(id: number) {
    await deleteExpense(token, id);
    queryClient.invalidateQueries({ queryKey: ["expenses"] });
    queryClient.invalidateQueries({ queryKey: ["expense-summary"] });
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
      <h1 className="text-2xl font-bold">Expenses</h1>

      <div className="flex items-center gap-4">
        <button onClick={() => changeMonth(-1)} className="border rounded px-2 py-1">←</button>
        <span>{year}-{String(month).padStart(2, "0")}</span>
        <button onClick={() => changeMonth(1)} className="border rounded px-2 py-1">→</button>
      </div>

      {summary && (
        <div className="text-sm text-gray-600">
          Total: {fromCents(summary.total_cents)} MAD — Essentials: {fromCents(summary.essentials_cents)} / Lifestyle: {fromCents(summary.lifestyle_cents)} ({summary.entry_count} entries)
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex w-96 flex-col gap-3">
        <input type="number" step="0.01" placeholder="Amount (MAD)" value={amount}
          onChange={(e) => setAmount(e.target.value)} className="border rounded px-2 py-1" required />
        <input type="text" placeholder="Note" value={note}
          onChange={(e) => setNote(e.target.value)} className="border rounded px-2 py-1" required />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="border rounded px-2 py-1" required />
        <select value={categoryId ?? ""} onChange={(e) => setCategoryId(Number(e.target.value))}
          className="border rounded px-2 py-1" required>
          <option value="" disabled>Pick a category</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({c.bucket})</option>
          ))}
        </select>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" className="bg-black text-white rounded px-3 py-2">
            {editingId ? "Save changes" : "Add expense"}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="border rounded px-3 py-2">Cancel</button>
          )}
        </div>
      </form>

      <table className="w-full max-w-lg text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-1">Date</th><th>Note</th><th>Category</th><th>Amount</th><th></th>
          </tr>
        </thead>
        <tbody>
          {expenses?.map((expense) => (
            <tr key={expense.id} className="border-b">
              <td className="py-1">{expense.date}</td>
              <td>{expense.note}</td>
              <td>{categoryName(expense.category_id)}</td>
              <td>{fromCents(expense.amount_cents)} MAD</td>
              <td className="flex gap-2 py-1">
                <button onClick={() => handleEdit(expense)} className="text-blue-600">Edit</button>
                <button onClick={() => handleDelete(expense.id)} className="text-red-600">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

export default function ExpensesPage() {
  return (
    <AuthGuard>
      <ExpenseManager />
    </AuthGuard>
  );
}
