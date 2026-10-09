"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createDebt, getDashboard, listDebts, recordDebtPayment, updateDebt, type Debt } from "@/lib/api";
import { getToken } from "@/lib/auth";

function currentDate() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  return new Date(today.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function toCents(value: string) {
  return Math.round(Number(value) * 100);
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);
}

function formatDate(value: string | null) {
  if (!value) return "No target date";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function DebtsPage() {
  const token = getToken();
  const queryClient = useQueryClient();
  const [selectedDebtId, setSelectedDebtId] = useState<number | null>(null);
  const [createName, setCreateName] = useState("");
  const [startingBalance, setStartingBalance] = useState("");
  const [monthlyPayment, setMonthlyPayment] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(currentDate());
  const [paymentNote, setPaymentNote] = useState("");
  const [editName, setEditName] = useState("");
  const [editMonthlyPayment, setEditMonthlyPayment] = useState("");
  const [editTargetDate, setEditTargetDate] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["debts", "page"],
    queryFn: async () => {
      const [debts, dashboard] = await Promise.all([listDebts(token!, true), getDashboard(token!)]);
      return { debts, dashboard };
    },
    enabled: Boolean(token),
    retry: false,
  });

  async function refreshDebts() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["debts"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["money"] }),
    ]);
  }

  function selectDebt(debt: Debt) {
    setSelectedDebtId(debt.id);
    setPaymentAmount("");
    setPaymentNote("");
    setEditName(debt.name);
    setEditMonthlyPayment(String(debt.planned_monthly_payment_cents / 100));
    setEditTargetDate(debt.target_date ?? "");
    setMessage(null);
    setActionError(null);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || saving) return;
    const startingBalanceCents = toCents(startingBalance);
    const monthlyPaymentCents = monthlyPayment.trim() ? toCents(monthlyPayment) : 0;

    if (!createName.trim()) {
      setActionError("Enter a name for this debt.");
      return;
    }
    if (!Number.isFinite(startingBalanceCents) || startingBalanceCents <= 0) {
      setActionError("Enter a starting balance greater than zero.");
      return;
    }
    if (!Number.isFinite(monthlyPaymentCents) || monthlyPaymentCents < 0) {
      setActionError("Enter a valid planned monthly payment.");
      return;
    }

    setSaving("create");
    setMessage(null);
    setActionError(null);
    try {
      const created = await createDebt(token, { name: createName.trim(), starting_balance_cents: startingBalanceCents, planned_monthly_payment_cents: monthlyPaymentCents, target_date: targetDate || null });
      setCreateName("");
      setStartingBalance("");
      setMonthlyPayment("");
      setTargetDate("");
      await refreshDebts();
      selectDebt(created);
      setMessage("Debt created. Your total money did not change because no payment was made.");
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : "Could not create the debt.");
    } finally {
      setSaving(null);
    }
  }

  async function handlePayment(event: FormEvent<HTMLFormElement>, debt: Debt) {
    event.preventDefault();
    if (!token || saving) return;
    const amountCents = toCents(paymentAmount);

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setActionError("Enter a payment greater than zero.");
      return;
    }
    if (amountCents > debt.current_balance_cents) {
      setActionError(`The payment cannot exceed ${formatMoney(debt.current_balance_cents, data!.dashboard.currency)}.`);
      return;
    }

    setSaving("payment");
    setMessage(null);
    setActionError(null);
    try {
      await recordDebtPayment(token, debt.id, { amount_cents: amountCents, occurred_on: paymentDate, note: paymentNote.trim() || null });
      setPaymentAmount("");
      setPaymentNote("");
      await refreshDebts();
      setMessage(amountCents === debt.current_balance_cents ? "Final payment recorded. This debt is now paid." : "Debt payment recorded from Essentials.");
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : "Could not record the payment.");
    } finally {
      setSaving(null);
    }
  }

  async function handleEdit(event: FormEvent<HTMLFormElement>, debt: Debt) {
    event.preventDefault();
    if (!token || saving) return;
    const monthlyPaymentCents = editMonthlyPayment.trim() ? toCents(editMonthlyPayment) : 0;

    if (!editName.trim()) {
      setActionError("The debt name cannot be empty.");
      return;
    }
    if (!Number.isFinite(monthlyPaymentCents) || monthlyPaymentCents < 0) {
      setActionError("Enter a valid planned monthly payment.");
      return;
    }

    setSaving("edit");
    setMessage(null);
    setActionError(null);
    try {
      await updateDebt(token, debt.id, { name: editName.trim(), planned_monthly_payment_cents: monthlyPaymentCents, target_date: editTargetDate || null });
      await refreshDebts();
      setMessage("Debt details updated.");
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : "Could not update the debt.");
    } finally {
      setSaving(null);
    }
  }

  async function changeStatus(debt: Debt, status: "active" | "archived") {
    if (!token || saving) return;
    setSaving("status");
    setMessage(null);
    setActionError(null);
    try {
      await updateDebt(token, debt.id, { status });
      if (status === "archived") setSelectedDebtId(null);
      await refreshDebts();
      setMessage(status === "archived" ? "Paid debt archived." : "Debt restored.");
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : "Could not update the debt status.");
    } finally {
      setSaving(null);
    }
  }

  if (isPending) return <div className="mx-auto h-96 w-full max-w-6xl animate-pulse rounded-[22px] bg-surface" />;
  if (error || !data) return <div className="mx-auto max-w-xl rounded-[20px] border border-border bg-surface p-8 text-center"><h1 className="font-serif text-2xl">Could not load your debts</h1><p className="mt-3 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Try again."}</p><button type="button" onClick={() => refetch()} className="mt-6 rounded-[10px] bg-brand px-5 py-3 text-sm font-medium text-white">Try again</button></div>;

  const { debts, dashboard } = data;
  const activeDebts = debts.filter((debt) => debt.status !== "archived");
  const archivedDebts = debts.filter((debt) => debt.status === "archived");
  const selectedDebt = debts.find((debt) => debt.id === selectedDebtId && debt.status !== "archived") ?? null;
  const totalRemaining = activeDebts.reduce((total, debt) => total + debt.current_balance_cents, 0);
  const totalPaid = activeDebts.reduce((total, debt) => total + debt.amount_paid_cents, 0);
  const essentialsBalance = dashboard.tracks.find((track) => track.track_kind === "essentials")?.balance_cents ?? 0;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">Debts</p>
      <div className="mt-4 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div><h1 className="font-serif text-4xl tracking-tight">A clear path to debt freedom</h1><p className="mt-3 max-w-2xl text-muted-foreground">Debts belong to Essentials. Recording a payment reduces your remaining debt, available Essentials, and total money together.</p></div>
        <div className="rounded-[16px] bg-brand px-6 py-4 text-white"><p className="text-xs uppercase tracking-[0.16em] text-white/65">Total remaining</p><p className="mt-1 font-serif text-3xl">{formatMoney(totalRemaining, dashboard.currency)}</p><p className="mt-1 text-xs text-white/60">{formatMoney(totalPaid, dashboard.currency)} paid so far</p></div>
      </div>

      {(message || actionError) && <p role={actionError ? "alert" : "status"} className={`mt-6 rounded-[12px] border px-4 py-3 text-sm ${actionError ? "border-danger/20 bg-danger-tint text-danger" : "border-success/20 bg-success-tint text-success"}`}>{actionError ?? message}</p>}

      <section className="mt-7 rounded-[20px] border border-border bg-surface p-6 sm:p-8">
        <h2 className="font-serif text-2xl">Add a debt</h2><p className="mt-2 text-sm text-muted-foreground">This records what you owe. It does not remove money until you record a payment.</p>
        <form onSubmit={handleCreate} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium">Debt name<input value={createName} onChange={(event) => setCreateName(event.target.value)} required maxLength={255} placeholder="Car loan" className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-4 py-3 outline-none focus:border-brand" /></label>
          <label className="text-sm font-medium">Starting balance<div className="mt-2 flex rounded-[10px] border border-border px-4 focus-within:border-brand"><input value={startingBalance} onChange={(event) => setStartingBalance(event.target.value)} type="number" min="0.01" step="0.01" required className="min-w-0 flex-1 bg-transparent py-3 outline-none" /><span className="py-3 text-xs text-muted-foreground">{dashboard.currency}</span></div></label>
          <label className="text-sm font-medium">Planned monthly payment<div className="mt-2 flex rounded-[10px] border border-border px-4 focus-within:border-brand"><input value={monthlyPayment} onChange={(event) => setMonthlyPayment(event.target.value)} type="number" min="0" step="0.01" className="min-w-0 flex-1 bg-transparent py-3 outline-none" /><span className="py-3 text-xs text-muted-foreground">{dashboard.currency}</span></div></label>
          <label className="text-sm font-medium">Target payoff date<input value={targetDate} onChange={(event) => setTargetDate(event.target.value)} type="date" className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-4 py-3 outline-none focus:border-brand" /></label>
          <div className="sm:col-span-2 lg:col-span-4"><button type="submit" disabled={saving !== null} className="rounded-[10px] bg-brand px-6 py-3 text-sm font-medium text-white disabled:opacity-60">{saving === "create" ? "Creating…" : "Add debt"}</button></div>
        </form>
      </section>

      <section className="mt-6">
        <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Debt plan</p><h2 className="mt-2 font-serif text-2xl">Your active debts</h2></div><p className="text-xs text-muted-foreground">Essentials available: {formatMoney(essentialsBalance, dashboard.currency)}</p></div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {activeDebts.length === 0 ? <p className="rounded-[16px] border border-border bg-surface p-6 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">No active debts. That is a strong position.</p> : activeDebts.map((debt) => {
            const progress = Math.min(Math.max(debt.progress_pct, 0), 100);
            return <button key={debt.id} type="button" onClick={() => selectDebt(debt)} className={`rounded-[18px] border bg-surface p-6 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm ${selectedDebtId === debt.id ? "border-brand ring-2 ring-brand/10" : "border-border"}`}>
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">{formatDate(debt.target_date)}</p><h3 className="mt-2 font-serif text-2xl">{debt.name}</h3></div><span className={`rounded-full px-2 py-1 text-[10px] font-medium ${debt.status === "paid" ? "bg-success-tint text-success" : "bg-brand-tint text-brand"}`}>{debt.status === "paid" ? "Paid" : "Active"}</span></div>
              <p className="mt-6 font-serif text-3xl text-brand">{formatMoney(debt.current_balance_cents, dashboard.currency)}</p><p className="mt-1 text-xs text-muted-foreground">remaining from {formatMoney(debt.starting_balance_cents, dashboard.currency)}</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary"><div className={`h-full rounded-full ${debt.status === "paid" ? "bg-success" : "bg-brand"}`} style={{ width: `${progress}%` }} /></div>
              <div className="mt-2 flex justify-between gap-3 text-xs text-muted-foreground"><span>{debt.progress_pct}% paid</span><span>{formatMoney(debt.planned_monthly_payment_cents, dashboard.currency)}/month</span></div>
            </button>;
          })}
        </div>
      </section>

      {selectedDebt && <section className="mt-6 rounded-[20px] border border-brand/20 bg-surface p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Manage debt</p><h2 className="mt-2 font-serif text-3xl">{selectedDebt.name}</h2><p className="mt-2 text-sm text-muted-foreground">{formatMoney(selectedDebt.current_balance_cents, dashboard.currency)} remaining · {formatMoney(essentialsBalance, dashboard.currency)} available in Essentials</p></div><button type="button" onClick={() => setSelectedDebtId(null)} className="rounded-[9px] border border-border px-3 py-2 text-xs">Close</button></div>

        {selectedDebt.status === "active" ? <form onSubmit={(event) => handlePayment(event, selectedDebt)} className="mt-7 grid gap-4 sm:grid-cols-[1fr_180px]">
          <label className="text-sm font-medium">Payment amount<div className="mt-2 flex rounded-[10px] border border-border px-4 focus-within:border-brand"><input value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} type="number" min="0.01" max={selectedDebt.current_balance_cents / 100} step="0.01" required className="min-w-0 flex-1 bg-transparent py-3 outline-none" /><span className="py-3 text-xs text-muted-foreground">{dashboard.currency}</span></div></label>
          <label className="text-sm font-medium">Payment date<input value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} type="date" required className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-4 py-3 outline-none focus:border-brand" /></label>
          <label className="text-sm font-medium sm:col-span-2">Note (optional)<textarea value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} maxLength={500} rows={2} placeholder="Monthly payment" className="mt-2 w-full resize-none rounded-[10px] border border-border bg-transparent px-4 py-3 outline-none focus:border-brand" /></label>
          <div className="sm:col-span-2"><button type="submit" disabled={saving !== null} className="rounded-[10px] bg-brand px-6 py-3 text-sm font-medium text-white disabled:opacity-60">{saving === "payment" ? "Recording…" : "Record payment"}</button></div>
        </form> : <div className="mt-7 rounded-[14px] bg-success-tint p-5"><p className="font-medium text-success">This debt is fully paid.</p><p className="mt-1 text-sm text-muted-foreground">You can keep it as a completed record or archive it below.</p></div>}

        <div className="mt-8 border-t border-border pt-7"><h3 className="font-serif text-xl">Debt details</h3><form onSubmit={(event) => handleEdit(event, selectedDebt)} className="mt-5 grid gap-4 sm:grid-cols-3">
          <label className="text-sm font-medium">Name<input value={editName} onChange={(event) => setEditName(event.target.value)} required maxLength={255} className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-4 py-3 outline-none focus:border-brand" /></label>
          <label className="text-sm font-medium">Planned monthly payment<div className="mt-2 flex rounded-[10px] border border-border px-4"><input value={editMonthlyPayment} onChange={(event) => setEditMonthlyPayment(event.target.value)} type="number" min="0" step="0.01" className="min-w-0 flex-1 bg-transparent py-3 outline-none" /><span className="py-3 text-xs text-muted-foreground">{dashboard.currency}</span></div></label>
          <label className="text-sm font-medium">Target payoff date<input value={editTargetDate} onChange={(event) => setEditTargetDate(event.target.value)} type="date" className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-4 py-3 outline-none focus:border-brand" /></label>
          <div className="flex flex-wrap gap-3 sm:col-span-3"><button type="submit" disabled={saving !== null} className="rounded-[10px] bg-brand px-5 py-3 text-sm font-medium text-white disabled:opacity-60">{saving === "edit" ? "Saving…" : "Save details"}</button>{selectedDebt.status === "paid" && <button type="button" onClick={() => changeStatus(selectedDebt, "archived")} disabled={saving !== null} className="rounded-[10px] border border-danger/30 px-5 py-3 text-sm font-medium text-danger disabled:opacity-60">Archive paid debt</button>}<Link href="/money" className="rounded-[10px] border border-border px-5 py-3 text-sm font-medium">View money history</Link></div>
        </form></div>
      </section>}

      {archivedDebts.length > 0 && <section className="mt-6 rounded-[20px] border border-border bg-surface p-6 sm:p-8"><h2 className="font-serif text-2xl">Archived debts</h2><div className="mt-5 space-y-2">{archivedDebts.map((debt) => <div key={debt.id} className="flex flex-wrap items-center justify-between gap-4 rounded-[12px] bg-surface-alt px-4 py-3"><div><p className="text-sm font-medium">{debt.name}</p><p className="mt-1 text-xs text-muted-foreground">Paid in full · {formatMoney(debt.starting_balance_cents, dashboard.currency)} starting balance</p></div><button type="button" onClick={() => changeStatus(debt, "active")} disabled={saving !== null} className="rounded-[9px] border border-border px-4 py-2 text-xs disabled:opacity-60">Restore</button></div>)}</div></section>}
    </div>
  );
}
