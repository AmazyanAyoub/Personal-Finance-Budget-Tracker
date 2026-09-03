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
  const [freedomFunds, setFreedomFunds] = useState(20);
  const [essentials, setEssentials] = useState(50);
  const [lifestyle, setLifestyle] = useState(30);
  const [efMultiplier, setEfMultiplier] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const total = freedomFunds + essentials + lifestyle;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (total !== 100) {
      setError(`Percentages must sum to 100 (currently ${total})`);
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
        freedom_funds_pct: freedomFunds,
        essentials_pct: essentials,
        lifestyle_pct: lifestyle,
        ef_multiplier: efMultiplier,
      });
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <form onSubmit={handleSubmit} className="flex w-96 flex-col gap-6">
        <h1 className="text-xl font-bold">Set up your budget</h1>

        <section className="flex flex-col gap-2">
          <label className="font-medium">Income mode</label>
          {INCOME_MODES.map((m) => (
            <label key={m.value} className="flex items-center gap-2">
              <input
                type="radio"
                name="income_mode"
                value={m.value}
                checked={incomeMode === m.value}
                onChange={() => setIncomeMode(m.value)}
              />
              {m.label}
            </label>
          ))}
        </section>

        <section className="flex flex-col gap-2">
          <label className="font-medium">Budget split — current total: {total}</label>
          <label className="flex items-center justify-between gap-2">
            Freedom Funds %
            <input
              type="number"
              value={freedomFunds}
              onChange={(e) => setFreedomFunds(Number(e.target.value))}
              className="w-20 border rounded px-2 py-1"
            />
          </label>
          <label className="flex items-center justify-between gap-2">
            Essentials %
            <input
              type="number"
              value={essentials}
              onChange={(e) => setEssentials(Number(e.target.value))}
              className="w-20 border rounded px-2 py-1"
            />
          </label>
          <label className="flex items-center justify-between gap-2">
            Lifestyle %
            <input
              type="number"
              value={lifestyle}
              onChange={(e) => setLifestyle(Number(e.target.value))}
              className="w-20 border rounded px-2 py-1"
            />
          </label>
        </section>

        <section className="flex flex-col gap-2">
          <label className="flex items-center justify-between gap-2 font-medium">
            Emergency fund target (months of Essentials, 3-6)
            <input
              type="number"
              min={3}
              max={6}
              value={efMultiplier}
              onChange={(e) => setEfMultiplier(Number(e.target.value))}
              className="w-20 border rounded px-2 py-1"
            />
          </label>
        </section>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="bg-black text-white rounded px-3 py-2 disabled:opacity-50"
        >
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
