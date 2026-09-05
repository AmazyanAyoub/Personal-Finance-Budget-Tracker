"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getBudgetEngineStatus, updateEfBalance } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { AuthGuard } from "../auth-guard";

function toCents(amount: number) {
  return Math.round(amount * 100);
}
function fromCents(cents: number) {
  return (cents / 100).toFixed(2);
}

function EmergencyFundManager() {
  const token = getToken()!;
  const queryClient = useQueryClient();

  const { data: status } = useQuery({ queryKey: ["budget-engine-status"], queryFn: () => getBudgetEngineStatus(token) });

  const [balanceInput, setBalanceInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleUpdateBalance(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cents = toCents(Number(balanceInput));
    if (isNaN(cents) || cents < 0) {
      setError("Enter a valid amount");
      return;
    }
    try {
      await updateEfBalance(token, cents);
      setBalanceInput("");
      queryClient.invalidateQueries({ queryKey: ["budget-engine-status"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-8 p-6">
      <h1 className="text-2xl font-bold">Emergency Fund</h1>

      {status && (
        <div className="w-full max-w-md border rounded p-4 flex flex-col gap-2">
          <p className="font-medium">{status.ef_is_met ? "Emergency Fund target met" : "Emergency Fund in progress"}</p>
          <div className="w-full bg-gray-200 rounded h-2">
            <div
              className="bg-green-600 h-2 rounded"
              style={{ width: `${Math.min((status.ef_current_balance_cents / status.ef_target_cents) * 100 || 0, 100)}%` }}
            />
          </div>
          <p className="text-sm text-gray-600">
            {fromCents(status.ef_current_balance_cents)} / {fromCents(status.ef_target_cents)} MAD
          </p>
          {!status.ef_is_met && (
            <p className="text-sm text-gray-600">
              This month's Freedom Funds: {fromCents(status.freedom_funds_cents)} MAD — recommended: put it all toward EF.
              {status.projected_months_to_target !== null && ` At this rate, ~${status.projected_months_to_target} months to target.`}
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleUpdateBalance} className="flex w-80 flex-col gap-3">
        <label className="font-medium">Update current EF balance</label>
        <input type="number" step="0.01" placeholder="Current EF balance (MAD)" value={balanceInput}
          onChange={(e) => setBalanceInput(e.target.value)} className="border rounded px-2 py-1" required />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button type="submit" className="bg-black text-white rounded px-3 py-2">Save balance</button>
      </form>
    </main>
  );
}

export default function EmergencyFundPage() {
  return (
    <AuthGuard>
      <EmergencyFundManager />
    </AuthGuard>
  );
}
