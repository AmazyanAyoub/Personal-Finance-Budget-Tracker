"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getDashboard } from "@/lib/api";
import { getToken } from "@/lib/auth";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatMAD(cents: number) {
  return `${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} MAD`;
}

function shortMAD(cents: number) {
  return Math.round(cents / 100);
}

export default function DashboardPage() {
  const token = getToken();

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(token!),
    enabled: !!token,
    retry: false,
  });

  if (isPending) {
    return (
      <div className="mx-auto max-w-6xl">
        <p className="text-sm text-muted-foreground">
          Loading your dashboard…
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-6xl rounded-[18px] border border-border bg-surface p-8">
        <h1 className="font-serif text-2xl">Could not load your dashboard</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Check that the backend is running, then try again.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-6 rounded-[10px] bg-brand px-5 py-3 text-sm text-white hover:bg-brand-hover"
        >
          Try again
        </button>
      </div>
    );
  }

  const monthName = MONTHS[data.month - 1] ?? "This month";
  const lifestyleOverBudget = data.lifestyle_remaining_cents < 0;
  const efProgress = Math.max(0, Math.min(100, data.ef_progress_pct));

  const thisMonth = data.monthly_trend.find(
    (item) => item.year === data.year && item.month === data.month
  );

  const monthlyIncome = thisMonth?.income_cents ?? 0;
  const monthlyExpenses = thisMonth?.expense_cents ?? 0;
  const largestMonthlyAmount = Math.max(monthlyIncome, monthlyExpenses, 1);

  const essentialsCategories = data.spending_by_category
    .filter((category) => category.bucket === "essentials")
    .sort((a, b) => b.amount_cents - a.amount_cents);

  const lifestyleCategories = data.spending_by_category
    .filter((category) => category.bucket === "lifestyle")
    .sort((a, b) => b.amount_cents - a.amount_cents);

  const trendData = data.monthly_trend.map((item) => ({
    month: `${MONTHS[item.month - 1]?.slice(0, 3) ?? ""} ${String(
      item.year
    ).slice(2)}`,
    Income: shortMAD(item.income_cents),
    Expenses: shortMAD(item.expense_cents),
  }));

    const essentials = data.budget_comparison.find(
    (item) => item.bucket === "essentials"
  );
  const essentialsSpentCents = essentials?.actual_cents ?? 0;
  const essentialsBudgetCents = essentials?.planned_cents ?? 0;
  const essentialsOverBudget = essentialsSpentCents > essentialsBudgetCents;

  const summaryCards = [
    {
      label: "Essentials spent",
      value: formatMAD(essentialsSpentCents),
      detail: `of ${formatMAD(essentialsBudgetCents)} planned · regular debt payments included`,      href: "/manage",
      accent: essentialsOverBudget ? "bg-danger" : "bg-brand-mid",
    },
    {
      label: "Lifestyle spent",
      value: formatMAD(data.lifestyle_spent_cents),
      detail: `of ${formatMAD(data.lifestyle_budget_cents)} planned`,
      href: "/expenses",
      accent: lifestyleOverBudget ? "bg-danger" : "bg-gold",
    },
    {
      label: "Emergency fund",
      value: formatMAD(data.ef_current_balance_cents),
      detail: `${efProgress}% of target`,
      href: "/emergency-fund",
      accent: "bg-brand",
    },
    {
      label: "Investments logged",
      value: formatMAD(data.investments_total_cents),
      detail: "View investments",
      href: "/investments",
      accent: "bg-success",
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-8">
      {/* Page heading */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
            Your overview
          </p>
          <h1 className="mt-3 font-serif text-4xl tracking-tight">
            Dashboard
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {monthName} {data.year} · A clearer view of your money
          </p>
        </div>

        <Link
          href="/manage"
          className="w-fit rounded-[10px] bg-brand px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
        >
          Manage money →
        </Link>
      </div>

      {/* Main numbers */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="group min-w-0 rounded-[18px] border border-border bg-surface p-6 transition-colors hover:border-brand/30"
          >
            <div className={`mb-6 h-1 w-10 rounded-full ${card.accent}`} />
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="mt-3 break-words font-serif text-2xl tracking-tight">
              {card.value}
            </p>
            <p className="mt-3 text-xs text-muted-foreground group-hover:text-brand">
              {card.detail} →
            </p>
          </Link>
        ))}
      </section>

      {(data.extra_debt_payments_this_month_cents > 0 ||
        data.available_savings_cents !== null) && (
        <section className="grid gap-4 md:grid-cols-2">
          {data.extra_debt_payments_this_month_cents > 0 && (
            <div className="rounded-[18px] border border-gold/30 bg-gold/10 p-6">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
                Financial move
              </p>

              <h2 className="mt-3 font-serif text-2xl">
                Extra debt payoff
              </h2>

              <p className="mt-3 font-serif text-3xl text-foreground">
                {formatMAD(
                  data.extra_debt_payments_this_month_cents
                )}
              </p>

              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                This reduced your debt balance but is kept
                separate from regular monthly expenses.
              </p>

              <div className="mt-5 space-y-2 border-t border-gold/20 pt-4 text-xs text-muted-foreground">
                {data.extra_debt_payments_from_income_cents >
                  0 && (
                  <p className="flex justify-between gap-4">
                    <span>From current income</span>
                    <span className="font-mono text-foreground">
                      {formatMAD(
                        data.extra_debt_payments_from_income_cents
                      )}
                    </span>
                  </p>
                )}

                {data.extra_debt_payments_from_savings_cents >
                  0 && (
                  <p className="flex justify-between gap-4">
                    <span>From existing savings</span>
                    <span className="font-mono text-foreground">
                      {formatMAD(
                        data.extra_debt_payments_from_savings_cents
                      )}
                    </span>
                  </p>
                )}

                {data.extra_debt_payments_undisclosed_cents >
                  0 && (
                  <p className="flex justify-between gap-4">
                    <span>Source not disclosed</span>
                    <span className="font-mono text-foreground">
                      {formatMAD(
                        data.extra_debt_payments_undisclosed_cents
                      )}
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}

          {data.available_savings_cents !== null && (
            <div className="rounded-[18px] border border-border bg-surface p-6">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
                Optional context
              </p>

              <h2 className="mt-3 font-serif text-2xl">
                Reported available savings
              </h2>

              <p className="mt-3 font-serif text-3xl text-brand">
                {formatMAD(data.available_savings_cents)}
              </p>

              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                This is the amount you chose to disclose
                outside your emergency fund. Nisba does not
                automatically subtract debt payments from it.
              </p>
            </div>
          )}
        </section>
      )}

      {/* Emergency fund guidance */}
      <section className="grid gap-8 rounded-[20px] border border-border bg-surface p-6 md:grid-cols-[1fr_1.2fr] md:items-center md:p-8">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
            Your safety cushion
          </p>
          <h2 className="mt-3 font-serif text-2xl">
            {data.ef_is_met
              ? "Your emergency-fund target is met."
              : "Keep building your emergency fund."}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {data.ef_is_met
              ? "Nisba now recommends considering investments for your Freedom Funds. The decision is still yours."
              : "Nisba recommends prioritising your emergency fund before investing your Freedom Funds."}
          </p>
          <Link
            href="/emergency-fund"
            className="mt-5 inline-block text-sm font-medium text-brand underline decoration-brand/30 underline-offset-4"
          >
            View emergency fund
          </Link>
        </div>

        <div className="rounded-[16px] bg-background p-6">
          <div className="flex items-end justify-between gap-4">
            <span className="text-sm text-muted-foreground">
              Progress toward target
            </span>
            <span className="font-serif text-3xl text-brand">
              {efProgress}%
            </span>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${efProgress}%` }}
            />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {formatMAD(data.ef_current_balance_cents)} of{" "}
            {formatMAD(data.ef_target_cents)}
          </p>
          {!data.ef_is_met &&
            data.ef_projected_months_to_target !== null && (
              <p className="mt-2 text-xs text-muted-foreground">
                Estimated {data.ef_projected_months_to_target} months to
                target at the current recommended pace.
              </p>
            )}
        </div>
      </section>

      {/* Current month */}
      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        <section className="min-w-0 rounded-[20px] border border-border bg-surface p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
                This month
              </p>
              <h2 className="mt-2 font-serif text-2xl">
                Income vs expenses
              </h2>
            </div>
          </div>

          {thisMonth ? (
            <div className="mt-8 space-y-7">
              <div>
                <div className="mb-3 flex flex-wrap justify-between gap-2 text-sm">
                  <span>Income</span>
                  <span className="font-mono tabular-nums">
                    {formatMAD(monthlyIncome)}
                  </span>
                </div>
                <div className="h-4 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-success"
                    style={{
                      width: `${(monthlyIncome / largestMonthlyAmount) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-3 flex flex-wrap justify-between gap-2 text-sm">
                  <span>Regular Expenses</span>
                  <span className="font-mono tabular-nums">
                    {formatMAD(monthlyExpenses)}
                  </span>
                </div>
                <div className="h-4 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-danger"
                    style={{
                      width: `${(monthlyExpenses / largestMonthlyAmount) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-8 text-sm text-muted-foreground">
              No income or expense data for this month yet.
            </p>
          )}
        </section>

        <section className="min-w-0 rounded-[20px] border border-border bg-surface p-6 md:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
            This month
          </p>
          <h2 className="mt-2 font-serif text-2xl">
            Where your money went
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Spending grouped by Essentials and Lifestyle.
          </p>

          {essentialsCategories.length === 0 &&
          lifestyleCategories.length === 0 ? (
            <p className="mt-8 text-sm text-muted-foreground">
              No regular expenses or debt payments logged this month yet.
            </p>
          ) : (
            <div className="mt-8 space-y-9">
              {[
                {
                  name: "Essentials",
                  categories: essentialsCategories,
                  totalCents: essentialsSpentCents,
                  maxAmount: Math.max(
                    ...essentialsCategories.map((item) => item.amount_cents),
                    1
                  ),
                  color: "bg-brand-mid",
                },
                {
                  name: "Lifestyle",
                  categories: lifestyleCategories,
                  totalCents: data.lifestyle_spent_cents,
                  maxAmount: Math.max(
                    ...lifestyleCategories.map((item) => item.amount_cents),
                    1
                  ),
                  color: "bg-gold",
                },
              ].map((group) => (
                <div key={group.name}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-3">
                    <h3 className="font-medium">{group.name}</h3>
                    <span className="font-mono text-sm tabular-nums">
                      {formatMAD(group.totalCents)}
                    </span>
                  </div>

                  {group.categories.length === 0 ? (
                    <p className="mt-4 text-sm text-muted-foreground">
                      Nothing logged here this month.
                    </p>
                  ) : (
                    <div className="mt-5 space-y-5">
                      {group.categories.map((category) => (
                        <div key={category.category}>
                          <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
                            <span className="min-w-0 truncate">
                              {category.category}
                            </span>
                            <span className="font-mono tabular-nums">
                              {formatMAD(category.amount_cents)}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-border">
                            <div
                              className={`h-full rounded-full ${group.color}`}
                              style={{
                                width: `${
                                  (category.amount_cents / group.maxAmount) *
                                  100
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <Link
            href="/manage"
            className="mt-7 inline-block text-sm font-medium text-brand underline decoration-brand/30 underline-offset-4"
          >
            Manage expenses and debt payments
          </Link>
        </section>
      </div>

      {/* Six-month trend */}
      <section className="min-w-0 rounded-[20px] border border-border bg-surface p-6 md:p-8">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
            The bigger picture
          </p>
          <h2 className="mt-2 font-serif text-2xl">
            Income and expenses over time
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The last six months, in MAD. Regular debt payments are included;
            extra debt payoffs are shown separately.
          </p>
        </div>

        <div className="mt-8 flex gap-5 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-success" />
            Income
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-danger" />
            Expenses
          </span>
        </div>

        <div className="mt-5 overflow-x-auto">
          <div className="h-72 min-w-[480px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={trendData}
                margin={{ top: 12, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="#E6E1D6"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#78766D", fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#78766D", fontSize: 12 }}
                  width={45}
                />
                <Tooltip />
                <Bar
                  dataKey="Income"
                  fill="#2F6B4F"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
                <Bar
                  dataKey="Expenses"
                  fill="#A54B3F"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
}