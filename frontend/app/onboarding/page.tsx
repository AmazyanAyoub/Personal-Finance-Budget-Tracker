"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitOnboarding } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { AuthGuard } from "../auth-guard";

const INCOME_MODES = [
  { value: "fixed_only", label: "Fixed monthly income only" },
  { value: "fixed_plus_freelance", label: "Fixed + freelance" },
  { value: "freelance_only", label: "Freelance only" },
];

function OnboardingForm() {
  const router = useRouter();
  const [incomeMode, setIncomeMode] = useState("fixed_only");
  const [estimatedIncome, setEstimatedIncome] = useState("");
  const [freedomFundsPct, setFreedomFundsPct] = useState(20);
  const [essentialsPct, setEssentialsPct] = useState(50);
  const [lifestylePct, setLifestylePct] = useState(30);
  const [efMultiplier, setEfMultiplier] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const income = Number(estimatedIncome) || 0;
  const total = freedomFundsPct + essentialsPct + lifestylePct;

  function amountFor(pct: number) {
    return ((income * pct) / 100).toFixed(2);
  }

  function handleAmountChange(setPct: (n: number) => void, value: string) {
    if (!income) return;
    const pct = Math.round((Number(value) / income) * 100);
    setPct(Math.max(0, Math.min(100, pct)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (total !== 100) {
      setError(`Percentages must sum to 100 (currently ${total})`);
      return;
    }
    const estimateCents = Math.round(income * 100);
    if (!estimateCents || estimateCents <= 0) {
      setError("Enter a valid estimated monthly income");
      return;
    }
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setSubmitting(true);
    try {
      await submitOnboarding(token, {
        income_mode: incomeMode,
        freedom_funds_pct: freedomFundsPct,
        essentials_pct: essentialsPct,
        lifestyle_pct: lifestylePct,
        ef_multiplier: efMultiplier,
        estimated_monthly_income_cents: estimateCents,
      });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <form onSubmit={handleSubmit} className="flex w-[28rem] flex-col gap-6">
        <h1 className="text-xl font-bold">Set up your budget</h1>

        <section className="flex flex-col gap-2">
          <label className="font-medium">Income mode</label>
          {INCOME_MODES.map((m) => (
            <label key={m.value} className="flex items-center gap-2">
              <input type="radio" name="income_mode" value={m.value} checked={incomeMode === m.value}
                onChange={() => setIncomeMode(m.value)} />
              {m.label}
            </label>
          ))}
        </section>

        <section className="flex flex-col gap-2">
          <label className="font-medium">Estimated monthly income (MAD)</label>
          <input type="number" step="0.01" placeholder="e.g. 17000" value={estimatedIncome}
            onChange={(e) => setEstimatedIncome(e.target.value)} className="border rounded px-2 py-1" required />
          <p className="text-xs text-gray-500">Used to compute the split below and your EF target — not your ongoing income tracking.</p>
        </section>

        <section className="flex flex-col gap-3">
          <label className="font-medium">Budget split — total: {total}%{income > 0 && ` (of ${income} MAD)`}</label>

          <div className="flex items-center gap-2">
            <span className="w-32 text-sm">Freedom Funds</span>
            <input type="number" value={freedomFundsPct} onChange={(e) => setFreedomFundsPct(Number(e.target.value))}
              className="w-16 border rounded px-2 py-1" />
            <span className="text-sm">%</span>
            <input type="number" step="0.01" value={income ? amountFor(freedomFundsPct) : ""}
              onChange={(e) => handleAmountChange(setFreedomFundsPct, e.target.value)}
              placeholder="amount" disabled={!income} className="flex-1 border rounded px-2 py-1" />
            <span className="text-sm">MAD</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-32 text-sm">Essentials</span>
            <input type="number" value={essentialsPct} onChange={(e) => setEssentialsPct(Number(e.target.value))}
              className="w-16 border rounded px-2 py-1" />
            <span className="text-sm">%</span>
            <input type="number" step="0.01" value={income ? amountFor(essentialsPct) : ""}
              onChange={(e) => handleAmountChange(setEssentialsPct, e.target.value)}
              placeholder="amount" disabled={!income} className="flex-1 border rounded px-2 py-1" />
            <span className="text-sm">MAD</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-32 text-sm">Lifestyle</span>
            <input type="number" value={lifestylePct} onChange={(e) => setLifestylePct(Number(e.target.value))}
              className="w-16 border rounded px-2 py-1" />
            <span className="text-sm">%</span>
            <input type="number" step="0.01" value={income ? amountFor(lifestylePct) : ""}
              onChange={(e) => handleAmountChange(setLifestylePct, e.target.value)}
              placeholder="amount" disabled={!income} className="flex-1 border rounded px-2 py-1" />
            <span className="text-sm">MAD</span>
          </div>

          <p className="text-xs text-gray-500">Change either the % or the MAD amount for any row — the other side updates automatically.</p>
        </section>

        <section className="flex flex-col gap-2">
          <label className="flex items-center justify-between gap-2 font-medium">
            Emergency fund target (months of Essentials, 3-6)
            <input type="number" min={3} max={6} value={efMultiplier}
              onChange={(e) => setEfMultiplier(Number(e.target.value))} className="w-20 border rounded px-2 py-1" />
          </label>
        </section>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button type="submit" disabled={submitting} className="bg-black text-white rounded px-3 py-2 disabled:opacity-50">
          {submitting ? "Saving..." : "Finish setup"}
        </button>
      </form>
    </main>
  );
}

export default function OnboardingPage() {
  return (
    <AuthGuard>
      <OnboardingForm />
    </AuthGuard>
  );
}
