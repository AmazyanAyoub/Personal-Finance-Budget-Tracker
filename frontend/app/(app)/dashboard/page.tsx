"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { getDashboard } from "@/lib/api";
import { getToken } from "@/lib/auth";

function fromCents(cents: number) {
  return (cents / 100).toFixed(2);
}
function toMAD(cents: number) {
  return Math.round(cents / 100);
}

export default function DashboardPage() {
  const token = getToken();

  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(token!),
    enabled: !!token,
  });

  if (!data) return <p>Loading...</p>;

  const lifestyleOver = data.lifestyle_remaining_cents < 0;
  const maxCategory = Math.max(...data.spending_by_category.map((c) => c.amount_cents), 1);
  const thisMonth = data.monthly_trend.find((t) => t.year === data.year && t.month === data.month);

  return (
    <div className="flex flex-col gap-10 max-w-4xl">
      <h1 className="text-3xl font-normal">Dashboard — {data.year}-{String(data.month).padStart(2, "0")}</h1>

      <div className="border border-border rounded-[10px] bg-surface p-8 shadow-sm flex flex-col gap-10">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-6">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-muted-foreground">Savings</span>
            <span className="font-mono tabular-nums font-medium text-lg">{fromCents(data.savings_cents)} MAD</span>
            <span className="text-sm text-muted-foreground">Emergency Fund total</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-muted-foreground">Emergency fund</span>
            <span className="font-mono tabular-nums font-medium text-lg">{data.ef_progress_pct}%</span>
            <span className="text-sm text-muted-foreground font-mono tabular-nums">
              {fromCents(data.ef_current_balance_cents)} / {fromCents(data.ef_target_cents)} MAD
            </span>
            {data.ef_is_met ? (
              <span className="text-sm text-success">Target met</span>
            ) : data.ef_projected_months_to_target !== null ? (
              <span className="text-sm text-muted-foreground">~{data.ef_projected_months_to_target} months to go</span>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-muted-foreground">Available this month</span>
            <span className={`font-mono tabular-nums font-medium text-lg ${lifestyleOver ? "text-danger" : ""}`}>
              {fromCents(data.lifestyle_remaining_cents)} MAD
            </span>
            <span className="text-sm text-muted-foreground">of {fromCents(data.lifestyle_budget_cents)} MAD budgeted</span>
            {lifestyleOver && <span className="text-sm text-danger">Over budget</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-muted-foreground">Investments</span>
            <span className="font-mono tabular-nums font-medium text-lg">{fromCents(data.investments_total_cents)} MAD</span>
            <a href="/investments" className="text-sm text-brand underline">View details</a>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-muted-foreground">Debt</span>
            <span className="font-mono tabular-nums font-medium text-lg">{fromCents(data.total_debt_remaining_cents)} MAD</span>
            <span className="text-sm text-muted-foreground">{data.debt_count} debt{data.debt_count === 1 ? "" : "s"}</span>
            <a href="/debts" className="text-sm text-brand underline">View details</a>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
          <div className="flex flex-col gap-4">
            <span className="text-base text-muted-foreground">Spending by category</span>
            {data.spending_by_category.length === 0 && (
              <span className="text-sm text-muted-foreground">No expenses logged this month yet.</span>
            )}
            {data.spending_by_category.map((c) => (
              <div key={c.category} className="flex items-center gap-3">
                <span className="w-28 text-base truncate">{c.category}</span>
                <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                  <div className="h-full bg-accent" style={{ width: `${(c.amount_cents / maxCategory) * 100}%` }} />
                </div>
                <span className="text-sm font-mono tabular-nums text-muted-foreground w-20 text-right">
                  {fromCents(c.amount_cents)} MAD
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-4">
            <span className="text-base text-muted-foreground">Income vs expenses (this month)</span>
            {thisMonth ? (
              <div className="flex items-end gap-8 h-36">
                <div className="flex flex-col items-center gap-2.5">
                  <div
                    className="w-12 bg-success rounded-t-[6px]"
                    style={{ height: `${Math.max((toMAD(thisMonth.income_cents) / Math.max(toMAD(thisMonth.income_cents), toMAD(thisMonth.expense_cents), 1)) * 110, 4)}px` }}
                  />
                  <span className="text-sm text-muted-foreground">Income</span>
                  <span className="text-sm font-mono tabular-nums">{fromCents(thisMonth.income_cents)} MAD</span>
                </div>
                <div className="flex flex-col items-center gap-2.5">
                  <div
                    className="w-12 bg-danger rounded-t-[6px]"
                    style={{ height: `${Math.max((toMAD(thisMonth.expense_cents) / Math.max(toMAD(thisMonth.income_cents), toMAD(thisMonth.expense_cents), 1)) * 110, 4)}px` }}
                  />
                  <span className="text-sm text-muted-foreground">Expenses</span>
                  <span className="text-sm font-mono tabular-nums">{fromCents(thisMonth.expense_cents)} MAD</span>
                </div>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">No data for this month yet.</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-10">
        <div>
          <h2 className="font-medium text-lg mb-3">Income vs expenses — last 6 months</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={data.monthly_trend.map((t) => ({
                name: `${t.year}-${String(t.month).padStart(2, "0")}`,
                income: toMAD(t.income_cents),
                expenses: toMAD(t.expense_cents),
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#DDD3B8" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="income" fill="#2C5941" name="Income (MAD)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" fill="#9C4A3C" name="Expenses (MAD)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div>
          <h2 className="font-medium text-lg mb-2">Budget: planned vs actual (% of income)</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Freedom Funds actual = Investments + Debt payments logged this month (EF isn't dated per-month, so it's excluded from this comparison).
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.budget_comparison.map((b) => ({ name: b.bucket, planned: b.planned_pct, actual: b.actual_pct }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#DDD3B8" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="planned" fill="#6E6656" name="Planned %" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual" fill="#A8823D" name="Actual %" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
