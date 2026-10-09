"use client";

import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createGoal, getDashboard, listGoals, releaseGoalMoney, reserveGoalMoney, spendGoalMoney, updateGoal, type Goal, type TrackKind } from "@/lib/api";
import { getToken } from "@/lib/auth";

type GoalAction = "reserve" | "release" | "spend";

const TRACKS: { value: TrackKind; label: string }[] = [
  { value: "essentials", label: "Essentials" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "investments", label: "Investments" },
];

const ACTIONS: { value: GoalAction; label: string; description: string }[] = [
  { value: "reserve", label: "Save money", description: "Move money from the linked track into this goal." },
  { value: "release", label: "Return money", description: "Move reserved money back to the linked track." },
  { value: "spend", label: "Use money", description: "Record real spending from this goal." },
];

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
  if (!value) return "No deadline";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function statusLabel(goal: Goal) {
  if (goal.system_role === "emergency_fund") return "Protected emergency fund";
  if (goal.status === "completed") return "Target reached";
  if (goal.status === "archived") return "Archived";
  return "In progress";
}

export default function GoalsPage() {
  const token = getToken();
  const queryClient = useQueryClient();
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null);
  const [goalAction, setGoalAction] = useState<GoalAction>("reserve");
  const [amount, setAmount] = useState("");
  const [actionDate, setActionDate] = useState(currentDate());
  const [note, setNote] = useState("");
  const [createName, setCreateName] = useState("");
  const [createType, setCreateType] = useState("");
  const [createTrack, setCreateTrack] = useState<TrackKind>("lifestyle");
  const [createTarget, setCreateTarget] = useState("");
  const [createDate, setCreateDate] = useState("");
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("");
  const [editTrack, setEditTrack] = useState<TrackKind>("lifestyle");
  const [editTarget, setEditTarget] = useState("");
  const [editDate, setEditDate] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["goals", "page"],
    queryFn: async () => {
      const [goals, dashboard] = await Promise.all([listGoals(token!, true), getDashboard(token!)]);
      return { goals, dashboard };
    },
    enabled: Boolean(token),
    retry: false,
  });

  async function refreshGoals() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["goals"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["money"] }),
    ]);
  }

  function selectGoal(goal: Goal) {
    setSelectedGoalId(goal.id);
    setGoalAction("reserve");
    setAmount("");
    setNote("");
    setEditName(goal.name);
    setEditType(goal.type_name);
    setEditTrack(goal.linked_track_kind);
    setEditTarget(goal.target_cents === null ? "" : String(goal.target_cents / 100));
    setEditDate(goal.target_date ?? "");
    setMessage(null);
    setActionError(null);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || saving) return;
    const targetCents = createTarget.trim() ? toCents(createTarget) : null;

    if (!createName.trim() || !createType.trim()) {
      setActionError("Enter both a goal name and a goal type.");
      return;
    }
    if (targetCents !== null && (!Number.isFinite(targetCents) || targetCents <= 0)) {
      setActionError("Enter a valid target or leave it empty.");
      return;
    }

    setSaving("create");
    setMessage(null);
    setActionError(null);
    try {
      const created = await createGoal(token, { name: createName.trim(), type_name: createType.trim(), linked_track_kind: createTrack, target_cents: targetCents, target_date: createDate || null });
      setCreateName("");
      setCreateType("");
      setCreateTarget("");
      setCreateDate("");
      await refreshGoals();
      selectGoal(created);
      setMessage("Goal created.");
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : "Could not create the goal.");
    } finally {
      setSaving(null);
    }
  }

  async function handleMoneyAction(event: FormEvent<HTMLFormElement>, goal: Goal) {
    event.preventDefault();
    if (!token || saving) return;
    const amountCents = toCents(amount);

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setActionError("Enter an amount greater than zero.");
      return;
    }

    setSaving("money");
    setMessage(null);
    setActionError(null);
    const payload = { amount_cents: amountCents, occurred_on: actionDate, note: note.trim() || null };

    try {
      if (goalAction === "reserve") await reserveGoalMoney(token, goal.id, payload);
      if (goalAction === "release") await releaseGoalMoney(token, goal.id, payload);
      if (goalAction === "spend") await spendGoalMoney(token, goal.id, payload);
      setAmount("");
      setNote("");
      await refreshGoals();
      setMessage(goalAction === "reserve" ? "Money saved toward the goal." : goalAction === "release" ? "Money returned to the linked track." : "Goal spending recorded.");
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : "Could not update the goal balance.");
    } finally {
      setSaving(null);
    }
  }

  async function handleEdit(event: FormEvent<HTMLFormElement>, goal: Goal) {
    event.preventDefault();
    if (!token || saving) return;
    const targetCents = editTarget.trim() ? toCents(editTarget) : null;

    if (!editName.trim() || !editType.trim()) {
      setActionError("The goal name and type cannot be empty.");
      return;
    }
    if (targetCents !== null && (!Number.isFinite(targetCents) || targetCents <= 0)) {
      setActionError("Enter a valid target or leave it empty.");
      return;
    }

    setSaving("edit");
    setMessage(null);
    setActionError(null);
    try {
      await updateGoal(token, goal.id, { name: editName.trim(), type_name: editType.trim(), linked_track_kind: goal.system_role === "emergency_fund" ? "essentials" : editTrack, target_cents: targetCents, target_date: editDate || null });
      await refreshGoals();
      setMessage("Goal details updated.");
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : "Could not update the goal.");
    } finally {
      setSaving(null);
    }
  }

  async function changeStatus(goal: Goal, status: "active" | "archived") {
    if (!token || saving) return;
    setSaving("status");
    setMessage(null);
    setActionError(null);
    try {
      await updateGoal(token, goal.id, { status });
      if (status === "archived") setSelectedGoalId(null);
      await refreshGoals();
      setMessage(status === "archived" ? "Goal archived." : "Goal restored.");
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : "Could not update the goal status.");
    } finally {
      setSaving(null);
    }
  }

  if (isPending) return <div className="mx-auto h-96 w-full max-w-6xl animate-pulse rounded-[22px] bg-surface" />;
  if (error || !data) return <div className="mx-auto max-w-xl rounded-[20px] border border-border bg-surface p-8 text-center"><h1 className="font-serif text-2xl">Could not load your goals</h1><p className="mt-3 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Try again."}</p><button type="button" onClick={() => refetch()} className="mt-6 rounded-[10px] bg-brand px-5 py-3 text-sm font-medium text-white">Try again</button></div>;

  const { goals, dashboard } = data;
  const activeGoals = goals.filter((goal) => goal.status !== "archived").sort((first, second) => Number(second.system_role === "emergency_fund") - Number(first.system_role === "emergency_fund"));
  const archivedGoals = goals.filter((goal) => goal.status === "archived");
  const selectedGoal = goals.find((goal) => goal.id === selectedGoalId && goal.status !== "archived") ?? null;
  const totalReserved = activeGoals.reduce((total, goal) => total + goal.current_balance_cents, 0);
  const selectedTrack = selectedGoal ? dashboard.tracks.find((track) => track.track_kind === selectedGoal.linked_track_kind) : null;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">Goals</p>
      <div className="mt-4 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div><h1 className="font-serif text-4xl tracking-tight">Save with a clear purpose</h1><p className="mt-3 max-w-2xl text-muted-foreground">Goals replace the old Wallet system. Money remains part of your total, but Nisba clearly marks what it is reserved for.</p></div>
        <div className="rounded-[16px] bg-brand px-6 py-4 text-white"><p className="text-xs uppercase tracking-[0.16em] text-white/65">Reserved across goals</p><p className="mt-1 font-serif text-3xl">{formatMoney(totalReserved, dashboard.currency)}</p></div>
      </div>

      {(message || actionError) && <p role={actionError ? "alert" : "status"} className={`mt-6 rounded-[12px] border px-4 py-3 text-sm ${actionError ? "border-danger/20 bg-danger-tint text-danger" : "border-success/20 bg-success-tint text-success"}`}>{actionError ?? message}</p>}

      <section className="mt-7 rounded-[20px] border border-border bg-surface p-6 sm:p-8">
        <h2 className="font-serif text-2xl">Create a goal</h2>
        <p className="mt-2 text-sm text-muted-foreground">You choose the name, type, funding track, target, and deadline.</p>
        <form onSubmit={handleCreate} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm font-medium">Name<input value={createName} onChange={(event) => setCreateName(event.target.value)} required maxLength={100} placeholder="Morocco trip" className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-4 py-3 outline-none focus:border-brand" /></label>
          <label className="text-sm font-medium">Type<input value={createType} onChange={(event) => setCreateType(event.target.value)} required maxLength={100} placeholder="Travel, car, taxes…" className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-4 py-3 outline-none focus:border-brand" /></label>
          <label className="text-sm font-medium">Fund from<select value={createTrack} onChange={(event) => setCreateTrack(event.target.value as TrackKind)} className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-4 py-3 outline-none focus:border-brand">{TRACKS.map((track) => <option key={track.value} value={track.value}>{track.label}</option>)}</select></label>
          <label className="text-sm font-medium">Target (optional)<div className="mt-2 flex rounded-[10px] border border-border px-4 focus-within:border-brand"><input value={createTarget} onChange={(event) => setCreateTarget(event.target.value)} type="number" min="0.01" step="0.01" className="min-w-0 flex-1 bg-transparent py-3 outline-none" /><span className="py-3 text-xs text-muted-foreground">{dashboard.currency}</span></div></label>
          <label className="text-sm font-medium">Deadline (optional)<input value={createDate} onChange={(event) => setCreateDate(event.target.value)} type="date" className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-4 py-3 outline-none focus:border-brand" /></label>
          <div className="sm:col-span-2 lg:col-span-5"><button type="submit" disabled={saving !== null} className="rounded-[10px] bg-brand px-6 py-3 text-sm font-medium text-white disabled:opacity-60">{saving === "create" ? "Creating…" : "Create goal"}</button></div>
        </form>
      </section>

      <section className="mt-6">
        <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Active goals</p><h2 className="mt-2 font-serif text-2xl">Your reserved money</h2></div><p className="text-xs text-muted-foreground">Select a goal to manage it.</p></div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {activeGoals.map((goal) => {
            const progress = goal.progress_pct === null ? null : Math.min(Math.max(goal.progress_pct, 0), 100);
            return <button key={goal.id} type="button" onClick={() => selectGoal(goal)} className={`rounded-[18px] border bg-surface p-6 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm ${selectedGoalId === goal.id ? "border-brand ring-2 ring-brand/10" : "border-border"}`}>
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs capitalize text-muted-foreground">{goal.type_name} · {goal.linked_track_kind}</p><h3 className="mt-2 font-serif text-2xl">{goal.name}</h3></div>{goal.system_role === "emergency_fund" && <span className="rounded-full bg-brand-tint px-2 py-1 text-[10px] font-medium text-brand">Protected</span>}</div>
              <p className="mt-6 font-serif text-3xl text-brand">{formatMoney(goal.current_balance_cents, dashboard.currency)}</p>
              {goal.target_cents !== null && <><div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-brand" style={{ width: `${progress ?? 0}%` }} /></div><div className="mt-2 flex justify-between gap-3 text-xs text-muted-foreground"><span>{goal.progress_pct ?? 0}% complete</span><span>Target {formatMoney(goal.target_cents, dashboard.currency)}</span></div></>}
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4 text-xs"><span className="text-muted-foreground">{statusLabel(goal)}</span><span>{formatDate(goal.target_date)}</span></div>
            </button>;
          })}
        </div>
      </section>

      {selectedGoal && <section className="mt-6 rounded-[20px] border border-brand/20 bg-surface p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Manage goal</p><h2 className="mt-2 font-serif text-3xl">{selectedGoal.name}</h2><p className="mt-2 text-sm text-muted-foreground">{formatMoney(selectedGoal.current_balance_cents, dashboard.currency)} reserved · {formatMoney(selectedTrack?.balance_cents ?? 0, dashboard.currency)} available in {selectedGoal.linked_track_kind}</p></div><button type="button" onClick={() => setSelectedGoalId(null)} className="rounded-[9px] border border-border px-3 py-2 text-xs">Close</button></div>

        <div className="mt-7 grid gap-2 sm:grid-cols-3">{ACTIONS.map((item) => <button key={item.value} type="button" onClick={() => { setGoalAction(item.value); setActionError(null); setMessage(null); }} className={`rounded-[12px] border p-4 text-left ${goalAction === item.value ? "border-brand bg-brand-tint" : "border-border"}`}><span className="block text-sm font-medium">{item.label}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{item.description}</span></button>)}</div>

        <form onSubmit={(event) => handleMoneyAction(event, selectedGoal)} className="mt-6 grid gap-4 sm:grid-cols-[1fr_180px]">
          <label className="text-sm font-medium">Amount<div className="mt-2 flex rounded-[10px] border border-border px-4 focus-within:border-brand"><input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min="0.01" step="0.01" required className="min-w-0 flex-1 bg-transparent py-3 outline-none" /><span className="py-3 text-xs text-muted-foreground">{dashboard.currency}</span></div></label>
          <label className="text-sm font-medium">Date<input value={actionDate} onChange={(event) => setActionDate(event.target.value)} type="date" required className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-4 py-3 outline-none focus:border-brand" /></label>
          <label className="text-sm font-medium sm:col-span-2">Note (optional)<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={2} className="mt-2 w-full resize-none rounded-[10px] border border-border bg-transparent px-4 py-3 outline-none focus:border-brand" /></label>
          <div className="sm:col-span-2"><button type="submit" disabled={saving !== null} className="rounded-[10px] bg-brand px-6 py-3 text-sm font-medium text-white disabled:opacity-60">{saving === "money" ? "Saving…" : ACTIONS.find((item) => item.value === goalAction)?.label}</button></div>
        </form>

        <div className="mt-8 border-t border-border pt-7"><h3 className="font-serif text-xl">Goal details</h3><form onSubmit={(event) => handleEdit(event, selectedGoal)} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm font-medium">Name<input value={editName} onChange={(event) => setEditName(event.target.value)} required maxLength={100} className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-3 py-3 outline-none focus:border-brand" /></label>
          <label className="text-sm font-medium">Type<input value={editType} onChange={(event) => setEditType(event.target.value)} required maxLength={100} className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-3 py-3 outline-none focus:border-brand" /></label>
          <label className="text-sm font-medium">Linked track<select value={editTrack} onChange={(event) => setEditTrack(event.target.value as TrackKind)} disabled={selectedGoal.system_role === "emergency_fund"} className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-3 py-3 outline-none disabled:bg-surface-alt disabled:text-muted-foreground">{TRACKS.map((track) => <option key={track.value} value={track.value}>{track.label}</option>)}</select></label>
          <label className="text-sm font-medium">Target<div className="mt-2 flex rounded-[10px] border border-border px-3"><input value={editTarget} onChange={(event) => setEditTarget(event.target.value)} type="number" min="0.01" step="0.01" className="min-w-0 flex-1 bg-transparent py-3 outline-none" /><span className="py-3 text-xs text-muted-foreground">{dashboard.currency}</span></div></label>
          <label className="text-sm font-medium">Deadline<input value={editDate} onChange={(event) => setEditDate(event.target.value)} type="date" className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-3 py-3 outline-none focus:border-brand" /></label>
          <div className="flex flex-wrap gap-3 sm:col-span-2 lg:col-span-5"><button type="submit" disabled={saving !== null} className="rounded-[10px] border border-brand bg-brand px-5 py-3 text-sm font-medium text-white disabled:opacity-60">{saving === "edit" ? "Saving…" : "Save details"}</button>{selectedGoal.system_role !== "emergency_fund" && <button type="button" onClick={() => changeStatus(selectedGoal, "archived")} disabled={saving !== null} className="rounded-[10px] border border-danger/30 px-5 py-3 text-sm font-medium text-danger disabled:opacity-60">Archive goal</button>}</div>
        </form></div>
      </section>}

      {archivedGoals.length > 0 && <section className="mt-6 rounded-[20px] border border-border bg-surface p-6 sm:p-8"><h2 className="font-serif text-2xl">Archived goals</h2><div className="mt-5 space-y-2">{archivedGoals.map((goal) => <div key={goal.id} className="flex flex-wrap items-center justify-between gap-4 rounded-[12px] bg-surface-alt px-4 py-3"><div><p className="text-sm font-medium">{goal.name}</p><p className="mt-1 text-xs text-muted-foreground">{goal.type_name}</p></div><button type="button" onClick={() => changeStatus(goal, "active")} disabled={saving !== null} className="rounded-[9px] border border-border px-4 py-2 text-xs disabled:opacity-60">Restore</button></div>)}</div></section>}
    </div>
  );
}
