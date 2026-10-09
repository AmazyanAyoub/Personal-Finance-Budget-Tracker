"use client";

import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createAllocationPlan,
  createCategory,
  getCurrentAllocationPlan,
  getFinancialProfile,
  listAllocationPlans,
  listCategories,
  updateCategory,
  updateFinancialProfile,
  type TrackKind,
} from "@/lib/api";
import { getToken } from "@/lib/auth";

const TRACKS: { value: TrackKind; label: string }[] = [
  { value: "essentials", label: "Essentials" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "investments", label: "Investments" },
];

function currentDate() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  return new Date(today.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function formatMAD(cents: number) {
  return `${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
}

export default function SettingsPage() {
  const token = getToken();
  const queryClient = useQueryClient();

  const [essentialsPct, setEssentialsPct] = useState(50);
  const [lifestylePct, setLifestylePct] = useState(30);
  const [investmentsPct, setInvestmentsPct] = useState(20);
  const [effectiveFrom, setEffectiveFrom] = useState(currentDate());
  const [categoryName, setCategoryName] = useState("");
  const [categoryTrack, setCategoryTrack] = useState<TrackKind>("essentials");
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["settings", "complete"],
    queryFn: async () => {
      const [profile, currentPlan, plans, categories] = await Promise.all([
        getFinancialProfile(token!),
        getCurrentAllocationPlan(token!),
        listAllocationPlans(token!),
        listCategories(token!, true),
      ]);
      return { profile, currentPlan, plans, categories };
    },
    enabled: Boolean(token),
    retry: false,
  });

  async function refreshSettings() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["settings"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  }

  async function handleProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || saving) return;

    const form = new FormData(event.currentTarget);
    const income = Number(form.get("expected-income"));

    if (!Number.isFinite(income) || income <= 0) {
      setActionError("Enter a valid expected monthly income.");
      return;
    }

    setSaving("profile");
    setMessage(null);
    setActionError(null);

    try {
      await updateFinancialProfile(token, { expected_monthly_income_cents: Math.round(income * 100) });
      await refreshSettings();
      setMessage("Financial profile updated.");
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : "Could not update your profile.");
    } finally {
      setSaving(null);
    }
  }

  async function handlePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || saving) return;

    const total = essentialsPct + lifestylePct + investmentsPct;
    if (total !== 100) {
      setActionError(`The allocation percentages must equal 100%. They currently equal ${total}%.`);
      return;
    }

    setSaving("plan");
    setMessage(null);
    setActionError(null);

    try {
      await createAllocationPlan(token, {
        essentials_pct: essentialsPct,
        lifestyle_pct: lifestylePct,
        investments_pct: investmentsPct,
        effective_from: effectiveFrom,
      });
      await refreshSettings();
      setMessage("New allocation plan saved.");
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : "Could not save the allocation plan.");
    } finally {
      setSaving(null);
    }
  }

  async function handleCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || saving || !categoryName.trim()) return;

    setSaving("category");
    setMessage(null);
    setActionError(null);

    try {
      await createCategory(token, { name: categoryName.trim(), track_kind: categoryTrack });
      setCategoryName("");
      await refreshSettings();
      setMessage("Category created.");
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : "Could not create the category.");
    } finally {
      setSaving(null);
    }
  }

  async function toggleCategory(categoryId: number, active: boolean) {
    if (!token || saving) return;

    setSaving(`category-${categoryId}`);
    setMessage(null);
    setActionError(null);

    try {
      await updateCategory(token, categoryId, { active: !active });
      await refreshSettings();
      setMessage(active ? "Category deactivated." : "Category activated.");
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : "Could not update the category.");
    } finally {
      setSaving(null);
    }
  }

  if (isPending) {
    return <div className="mx-auto h-96 w-full max-w-5xl animate-pulse rounded-[22px] bg-surface" />;
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-xl rounded-[20px] border border-border bg-surface p-8 text-center">
        <h1 className="font-serif text-2xl">Could not load your settings</h1>
        <p className="mt-3 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Try again."}</p>
        <button type="button" onClick={() => refetch()} className="mt-6 rounded-[10px] bg-brand px-5 py-3 text-sm font-medium text-white">Try again</button>
      </div>
    );
  }

  const total = essentialsPct + lifestylePct + investmentsPct;
  const personalCategories = data.categories.filter((category) => !category.is_system);
  const systemCategories = data.categories.filter((category) => category.is_system);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">Settings</p>
      <h1 className="mt-4 font-serif text-4xl tracking-tight">Your financial setup</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">Update your expected income, future allocation plans, and personal spending categories.</p>

      {(message || actionError) && (
        <p role={actionError ? "alert" : "status"} className={`mt-7 rounded-[12px] border px-4 py-3 text-sm ${actionError ? "border-danger/20 bg-danger-tint text-danger" : "border-success/20 bg-success-tint text-success"}`}>
          {actionError ?? message}
        </p>
      )}

      <section className="mt-8 rounded-[20px] border border-border bg-surface p-6 sm:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Financial profile</p>
        <h2 className="mt-3 font-serif text-2xl">Income and currency</h2>
        <p className="mt-2 text-sm text-muted-foreground">Your currency cannot change after money has been recorded.</p>

        <form key={data.profile.updated_at} onSubmit={handleProfile} className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Currency
            <input value={data.profile.currency} disabled className="mt-2 w-full rounded-[10px] border border-border bg-surface-alt px-4 py-3 text-muted-foreground" />
          </label>

          <label className="text-sm font-medium">
            Expected monthly income
            <div className="mt-2 flex rounded-[10px] border border-border px-4 focus-within:border-brand">
              <input name="expected-income" type="number" min="0.01" step="0.01" required defaultValue={data.profile.expected_monthly_income_cents / 100} className="min-w-0 flex-1 bg-transparent py-3 outline-none" />
              <span className="py-3 text-sm text-muted-foreground">MAD</span>
            </div>
          </label>

          <div className="sm:col-span-2">
            <button type="submit" disabled={saving !== null} className="rounded-[10px] bg-brand px-5 py-3 text-sm font-medium text-white disabled:opacity-60">
              {saving === "profile" ? "Saving…" : "Save profile"}
            </button>
          </div>
        </form>
      </section>

      <section className="mt-6 rounded-[20px] border border-border bg-surface p-6 sm:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Allocation plan</p>
        <h2 className="mt-3 font-serif text-2xl">Create a future allocation</h2>
        <p className="mt-2 text-sm text-muted-foreground">Your current plan is {data.currentPlan.essentials_pct}% Essentials, {data.currentPlan.lifestyle_pct}% Lifestyle, and {data.currentPlan.investments_pct}% Investments.</p>

        <form onSubmit={handlePlan} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Essentials", essentialsPct, setEssentialsPct],
            ["Lifestyle", lifestylePct, setLifestylePct],
            ["Investments", investmentsPct, setInvestmentsPct],
          ].map(([label, value, setter]) => (
            <label key={String(label)} className="text-sm font-medium">
              {String(label)}
              <div className="mt-2 flex rounded-[10px] border border-border px-3">
                <input type="number" min="0" max="100" step="1" value={Number(value)} onChange={(event) => (setter as (value: number) => void)(Number(event.target.value))} className="min-w-0 flex-1 bg-transparent py-3 outline-none" />
                <span className="py-3 text-muted-foreground">%</span>
              </div>
            </label>
          ))}

          <label className="text-sm font-medium">
            Effective from
            <input type="date" required value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-3 py-3 outline-none focus:border-brand" />
          </label>

          <div className="flex items-center justify-between gap-4 sm:col-span-2 lg:col-span-4">
            <p className={`text-sm ${total === 100 ? "text-success" : "text-danger"}`}>Total: {total}%</p>
            <button type="submit" disabled={saving !== null || total !== 100} className="rounded-[10px] bg-brand px-5 py-3 text-sm font-medium text-white disabled:opacity-60">
              {saving === "plan" ? "Saving…" : "Save new plan"}
            </button>
          </div>
        </form>

        <div className="mt-8 border-t border-border pt-6">
          <h3 className="font-serif text-xl">Plan history</h3>
          <div className="mt-4 space-y-2">
            {data.plans.map((plan) => (
              <div key={plan.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-surface-alt px-4 py-3 text-sm">
                <span>{plan.effective_from}</span>
                <span className="text-muted-foreground">{plan.essentials_pct}% Essentials · {plan.lifestyle_pct}% Lifestyle · {plan.investments_pct}% Investments</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-[20px] border border-border bg-surface p-6 sm:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Categories</p>
        <h2 className="mt-3 font-serif text-2xl">Your spending categories</h2>
        <p className="mt-2 text-sm text-muted-foreground">System categories are shared defaults. Your personal categories can be activated or deactivated.</p>

        <form onSubmit={handleCategory} className="mt-6 grid gap-4 sm:grid-cols-[1fr_180px_auto]">
          <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} maxLength={100} required placeholder="Category name" className="rounded-[10px] border border-border bg-transparent px-4 py-3 outline-none focus:border-brand" />
          <select value={categoryTrack} onChange={(event) => setCategoryTrack(event.target.value as TrackKind)} className="rounded-[10px] border border-border bg-transparent px-4 py-3 outline-none focus:border-brand">
            {TRACKS.map((track) => <option key={track.value} value={track.value}>{track.label}</option>)}
          </select>
          <button type="submit" disabled={saving !== null} className="rounded-[10px] bg-brand px-5 py-3 text-sm font-medium text-white disabled:opacity-60">
            {saving === "category" ? "Creating…" : "Add category"}
          </button>
        </form>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="font-serif text-xl">Personal categories</h3>
            <div className="mt-4 space-y-2">
              {personalCategories.length === 0 ? (
                <p className="rounded-[12px] bg-surface-alt p-4 text-sm text-muted-foreground">No personal categories yet.</p>
              ) : personalCategories.map((category) => (
                <div key={category.id} className="flex items-center justify-between gap-4 rounded-[12px] border border-border px-4 py-3">
                  <div>
                    <p className={`text-sm font-medium ${category.active ? "" : "text-muted-foreground"}`}>{category.name}</p>
                    <p className="mt-1 text-xs capitalize text-muted-foreground">{category.track_kind}</p>
                  </div>
                  <button type="button" onClick={() => toggleCategory(category.id, category.active)} disabled={saving !== null} className="rounded-[8px] border border-border px-3 py-2 text-xs disabled:opacity-60">
                    {saving === `category-${category.id}` ? "Saving…" : category.active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-serif text-xl">System categories</h3>
            <div className="mt-4 space-y-2">
              {systemCategories.map((category) => (
                <div key={category.id} className="flex items-center justify-between gap-4 rounded-[12px] bg-surface-alt px-4 py-3">
                  <span className="text-sm font-medium">{category.name}</span>
                  <span className="text-xs capitalize text-muted-foreground">{category.track_kind}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <p className="mt-8 text-xs text-muted-foreground">Current expected income: {formatMAD(data.profile.expected_monthly_income_cents)}</p>
    </div>
  );
}
