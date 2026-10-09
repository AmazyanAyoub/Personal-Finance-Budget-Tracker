"use client";

import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addExpense, addIncome, adjustTotalBalance, getDashboard, listCategories, listMoneyEvents, reverseMoneyEvent, transferBetweenTracks, type MoneyEvent, type MoneyEventType, type TrackKind } from "@/lib/api";
import { getToken } from "@/lib/auth";

type Action = "income" | "expense" | "transfer" | "adjustment";

const TRACKS: { value: TrackKind; label: string }[] = [
  { value: "essentials", label: "Essentials" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "investments", label: "Investments" },
];

const ACTIONS: { value: Action; label: string; description: string }[] = [
  { value: "income", label: "Add income", description: "Money you received" },
  { value: "expense", label: "Add expense", description: "Money you spent" },
  { value: "transfer", label: "Move allocation", description: "Move money between tracks" },
  { value: "adjustment", label: "Correct balance", description: "Match Nisba to your real balance" },
];

const EVENT_LABELS: Record<MoneyEventType, string> = {
  opening_balance: "Opening balance",
  income: "Income",
  expense: "Expense",
  goal_reserve: "Saved toward goal",
  goal_release: "Released from goal",
  goal_spend: "Spent from goal",
  track_transfer: "Allocation moved",
  debt_payment: "Debt payment",
  investment_buy: "Investment bought",
  investment_sell: "Investment sold",
  investment_income: "Investment income",
  investment_fee: "Investment fee",
  balance_adjustment: "Balance corrected",
  reversal: "Mistake cancelled",
};

const NON_REVERSIBLE = new Set<MoneyEventType>(["opening_balance", "reversal", "investment_buy", "investment_sell", "investment_income", "investment_fee"]);

function currentDate() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  return new Date(today.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function toCents(value: string) {
  return Math.round(Number(value) * 100);
}

function EventChanges({ event, currency }: { event: MoneyEvent; currency: string }) {
  const changes = [
    ["Essentials", event.essentials_delta_cents],
    ["Lifestyle", event.lifestyle_delta_cents],
    ["Investments", event.investments_delta_cents],
    ["Goal", event.goal_delta_cents],
  ].filter(([, amount]) => Number(amount) !== 0) as [string, number][];

  if (!changes.length) return null;
  return <p className="mt-2 text-xs text-muted-foreground">{changes.map(([label, amount]) => `${label} ${amount > 0 ? "+" : ""}${formatMoney(amount, currency)}`).join(" · ")}</p>;
}

export default function MoneyPage() {
  const token = getToken();
  const queryClient = useQueryClient();
  const [action, setAction] = useState<Action>("income");
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(currentDate());
  const [categoryId, setCategoryId] = useState("");
  const [fromTrack, setFromTrack] = useState<TrackKind>("essentials");
  const [toTrack, setToTrack] = useState<TrackKind>("lifestyle");
  const [affectedTrack, setAffectedTrack] = useState<TrackKind>("essentials");
  const [reversingId, setReversingId] = useState<number | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [reversalDate, setReversalDate] = useState(currentDate());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["money", "overview"],
    queryFn: async () => {
      const [dashboard, events, categories] = await Promise.all([getDashboard(token!), listMoneyEvents(token!, { limit: 200 }), listCategories(token!)]);
      return { dashboard, events, categories };
    },
    enabled: Boolean(token),
    retry: false,
  });

  async function refreshMoney() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["money"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["goals"] }),
      queryClient.invalidateQueries({ queryKey: ["debts"] }),
    ]);
  }

  function resetForm() {
    setAmount("");
    setName("");
    setNote("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || saving) return;
    const amountCents = toCents(amount);

    if (!Number.isFinite(amountCents) || (action === "adjustment" ? amountCents < 0 : amountCents <= 0)) {
      setActionError(action === "adjustment" ? "Enter your real total balance. It can be zero." : "Enter an amount greater than zero.");
      return;
    }

    setSaving(true);
    setMessage(null);
    setActionError(null);

    try {
      if (action === "income") {
        if (!name.trim()) throw new Error("Enter a name for this income.");
        await addIncome(token, { name: name.trim(), amount_cents: amountCents, occurred_on: date, note: note.trim() || null });
      }
      if (action === "expense") {
        const selectedCategory = Number(categoryId || data?.categories[0]?.id);
        if (!selectedCategory) throw new Error("Choose an expense category.");
        await addExpense(token, { amount_cents: amountCents, category_id: selectedCategory, occurred_on: date, note: note.trim() || null });
      }
      if (action === "transfer") {
        if (fromTrack === toTrack) throw new Error("Choose two different tracks.");
        await transferBetweenTracks(token, { from_track: fromTrack, to_track: toTrack, amount_cents: amountCents, occurred_on: date, note: note.trim() || null });
      }
      if (action === "adjustment") {
        if (!note.trim()) throw new Error("Explain why you are correcting the balance.");
        await adjustTotalBalance(token, { actual_total_money_cents: amountCents, affected_track: affectedTrack, occurred_on: date, reason: note.trim() });
      }

      resetForm();
      await refreshMoney();
      setMessage(action === "adjustment" ? "Balance corrected." : "Money activity recorded.");
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : "Could not save this activity.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReversal(event: FormEvent<HTMLFormElement>, eventId: number) {
    event.preventDefault();
    if (!token || saving || !reversalReason.trim()) return;
    setSaving(true);
    setMessage(null);
    setActionError(null);

    try {
      await reverseMoneyEvent(token, eventId, { occurred_on: reversalDate, reason: reversalReason.trim() });
      setReversingId(null);
      setReversalReason("");
      await refreshMoney();
      setMessage("The mistaken activity was cancelled. Its history remains visible.");
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : "Could not cancel this activity.");
    } finally {
      setSaving(false);
    }
  }

  if (isPending) return <div className="mx-auto h-96 w-full max-w-6xl animate-pulse rounded-[22px] bg-surface" />;
  if (error || !data) {
    return <div className="mx-auto max-w-xl rounded-[20px] border border-border bg-surface p-8 text-center"><h1 className="font-serif text-2xl">Could not load your money</h1><p className="mt-3 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Try again."}</p><button type="button" onClick={() => refetch()} className="mt-6 rounded-[10px] bg-brand px-5 py-3 text-sm font-medium text-white">Try again</button></div>;
  }

  const { dashboard, events, categories } = data;
  const reversedIds = new Set(events.filter((item) => item.event_type === "reversal" && item.reverses_event_id).map((item) => item.reverses_event_id));

  return (
    <div className="mx-auto w-full max-w-6xl">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">Money activity</p>
      <div className="mt-4 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div><h1 className="font-serif text-4xl tracking-tight">Every dirham, in one place</h1><p className="mt-3 max-w-2xl text-muted-foreground">Record money coming in or going out. Nisba keeps your total and three tracks synchronized automatically.</p></div>
        <div className="rounded-[16px] bg-brand px-6 py-4 text-white"><p className="text-xs uppercase tracking-[0.16em] text-white/65">Total money</p><p className="mt-1 font-serif text-3xl">{formatMoney(dashboard.total_money_cents, dashboard.currency)}</p></div>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        {TRACKS.map((track) => {
          const balance = dashboard.tracks.find((item) => item.track_kind === track.value);
          return <div key={track.value} className="rounded-[16px] border border-border bg-surface p-5"><p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{track.label}</p><p className="mt-2 font-serif text-2xl">{formatMoney(balance?.balance_cents ?? 0, dashboard.currency)}</p><p className="mt-1 text-xs text-muted-foreground">{balance?.percentage ?? 0}% of new income</p></div>;
        })}
      </div>

      {(message || actionError) && <p role={actionError ? "alert" : "status"} className={`mt-6 rounded-[12px] border px-4 py-3 text-sm ${actionError ? "border-danger/20 bg-danger-tint text-danger" : "border-success/20 bg-success-tint text-success"}`}>{actionError ?? message}</p>}

      <section className="mt-6 rounded-[20px] border border-border bg-surface p-6 sm:p-8">
        <h2 className="font-serif text-2xl">Record an activity</h2>
        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {ACTIONS.map((item) => <button key={item.value} type="button" onClick={() => { setAction(item.value); setActionError(null); setMessage(null); }} className={`rounded-[12px] border p-4 text-left transition-colors ${action === item.value ? "border-brand bg-brand-tint" : "border-border hover:border-brand/40"}`}><span className="block text-sm font-medium">{item.label}</span><span className="mt-1 block text-xs text-muted-foreground">{item.description}</span></button>)}
        </div>

        <form onSubmit={handleSubmit} className="mt-7 grid gap-5 sm:grid-cols-2">
          {action === "income" && <label className="text-sm font-medium">Income name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required placeholder="Salary, freelance…" className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-4 py-3 outline-none focus:border-brand" /></label>}
          {action === "expense" && <label className="text-sm font-medium">Category<select value={categoryId || String(categories[0]?.id ?? "")} onChange={(event) => setCategoryId(event.target.value)} required className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-4 py-3 outline-none focus:border-brand"><option value="" disabled>Choose a category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name} · {category.track_kind}</option>)}</select></label>}
          {action === "transfer" && <><label className="text-sm font-medium">Move from<select value={fromTrack} onChange={(event) => setFromTrack(event.target.value as TrackKind)} className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-4 py-3 outline-none focus:border-brand">{TRACKS.map((track) => <option key={track.value} value={track.value}>{track.label}</option>)}</select></label><label className="text-sm font-medium">Move to<select value={toTrack} onChange={(event) => setToTrack(event.target.value as TrackKind)} className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-4 py-3 outline-none focus:border-brand">{TRACKS.map((track) => <option key={track.value} value={track.value}>{track.label}</option>)}</select></label></>}
          {action === "adjustment" && <label className="text-sm font-medium">Apply the difference to<select value={affectedTrack} onChange={(event) => setAffectedTrack(event.target.value as TrackKind)} className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-4 py-3 outline-none focus:border-brand">{TRACKS.map((track) => <option key={track.value} value={track.value}>{track.label}</option>)}</select></label>}
          <label className="text-sm font-medium">{action === "adjustment" ? "Your real total balance" : "Amount"}<div className="mt-2 flex rounded-[10px] border border-border px-4 focus-within:border-brand"><input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min={action === "adjustment" ? "0" : "0.01"} step="0.01" required className="min-w-0 flex-1 bg-transparent py-3 outline-none" /><span className="py-3 text-sm text-muted-foreground">{dashboard.currency}</span></div></label>
          <label className="text-sm font-medium">Date<input value={date} onChange={(event) => setDate(event.target.value)} type="date" required className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-4 py-3 outline-none focus:border-brand" /></label>
          <label className="text-sm font-medium sm:col-span-2">{action === "adjustment" ? "Reason" : "Note (optional)"}<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} required={action === "adjustment"} rows={3} placeholder={action === "adjustment" ? "Why does the real balance differ?" : "Add context if useful"} className="mt-2 w-full resize-none rounded-[10px] border border-border bg-transparent px-4 py-3 outline-none focus:border-brand" /></label>
          <div className="sm:col-span-2"><button type="submit" disabled={saving} className="rounded-[10px] bg-brand px-6 py-3 text-sm font-medium text-white disabled:opacity-60">{saving ? "Saving…" : ACTIONS.find((item) => item.value === action)?.label}</button></div>
        </form>
      </section>

      <section className="mt-6 rounded-[20px] border border-border bg-surface p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Complete history</p><h2 className="mt-2 font-serif text-2xl">Recent activity</h2></div><p className="text-xs text-muted-foreground">Cancelling a mistake keeps both records for a clear history.</p></div>
        <div className="mt-6 space-y-3">
          {events.length === 0 ? <p className="rounded-[12px] bg-surface-alt p-5 text-sm text-muted-foreground">No money activity yet.</p> : events.map((item) => {
            const isCancelled = reversedIds.has(item.id);
            const canReverse = !NON_REVERSIBLE.has(item.event_type) && !isCancelled;
            return <article key={item.id} className={`rounded-[14px] border p-4 ${isCancelled ? "border-border bg-surface-alt opacity-65" : "border-border"}`}>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{EVENT_LABELS[item.event_type]}</p>{isCancelled && <span className="rounded-full bg-danger-tint px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-danger">Cancelled</span>}</div><p className="mt-1 text-xs text-muted-foreground">{formatDate(item.occurred_on)} · Event #{item.id}</p>{item.note && <p className="mt-2 text-sm text-muted-foreground">{item.note}</p>}<EventChanges event={item} currency={dashboard.currency} /></div>
                <div className="sm:text-right"><p className={`font-mono text-sm font-medium ${item.cash_delta_cents > 0 ? "text-success" : item.cash_delta_cents < 0 ? "text-danger" : "text-muted-foreground"}`}>{item.cash_delta_cents > 0 ? "+" : ""}{formatMoney(item.cash_delta_cents, dashboard.currency)}</p>{canReverse && <button type="button" onClick={() => { setReversingId(reversingId === item.id ? null : item.id); setReversalReason(""); setActionError(null); }} className="mt-3 text-xs text-danger underline-offset-4 hover:underline">Cancel mistake</button>}</div>
              </div>
              {reversingId === item.id && <form onSubmit={(event) => handleReversal(event, item.id)} className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-[1fr_160px_auto]"><input value={reversalReason} onChange={(event) => setReversalReason(event.target.value)} required maxLength={500} placeholder="Why was this entry wrong?" className="rounded-[10px] border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-brand" /><input value={reversalDate} onChange={(event) => setReversalDate(event.target.value)} type="date" required className="rounded-[10px] border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-brand" /><button type="submit" disabled={saving} className="rounded-[10px] bg-danger px-4 py-2 text-sm font-medium text-white disabled:opacity-60">Confirm cancellation</button></form>}
            </article>;
          })}
        </div>
      </section>
    </div>
  );
}
