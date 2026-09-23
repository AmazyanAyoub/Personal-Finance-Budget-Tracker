"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Banknote,
  CircleDollarSign,
  CreditCard,
  PiggyBank,
  ShieldCheck,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  getDashboard,
  getInvestmentSummary,
  getMonthlyIncomeSummary,
  listDebts,
} from "@/lib/api";
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

const CHART_COLORS = [
  "#232C5C",
  "#8891C4",
  "#B8863A",
  "#2F6B4F",
  "#A54B3F",
  "#78766D",
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

function percentage(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.min(
    Math.max(Math.round((value / total) * 100), 0),
    100
  );
}

function BudgetCard({
  title,
  planned,
  used,
  href,
  color,
}: {
  title: string;
  planned: number;
  used: number;
  href: string;
  color: string;
}) {
  const remaining = planned - used;
  const progress = percentage(used, planned);
  const isOverBudget = remaining < 0;

  return (
    <Link
      href={href}
      className="group rounded-[18px] border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p
            className={`mt-2 font-serif text-2xl ${
              isOverBudget ? "text-danger" : "text-foreground"
            }`}
          >
            {formatMAD(Math.abs(remaining))}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isOverBudget ? "over budget" : "remaining"}
          </p>
        </div>

        <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-brand" />
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-border">
        <div
          className={`h-full rounded-full ${
            isOverBudget ? "bg-danger" : color
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-3 flex justify-between gap-4 text-xs text-muted-foreground">
        <span>{formatMAD(used)} used</span>
        <span>{formatMAD(planned)} planned</span>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const token = getToken();

  const {
    data: overview,
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: ["dashboard", "complete-overview"],
    queryFn: async () => {
      const dashboard = await getDashboard(token!);

      const [incomeSummary, debts, investmentSummary] =
        await Promise.all([
          getMonthlyIncomeSummary(
            token!,
            dashboard.year,
            dashboard.month
          ),
          listDebts(token!),
          getInvestmentSummary(token!),
        ]);

      return {
        dashboard,
        incomeSummary,
        debts,
        investmentSummary,
      };
    },
    enabled: !!token,
    retry: false,
  });

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="h-64 animate-pulse rounded-[24px] bg-brand/10" />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-40 animate-pulse rounded-[18px] bg-surface"
            />
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="h-80 animate-pulse rounded-[20px] bg-surface" />
          <div className="h-80 animate-pulse rounded-[20px] bg-surface" />
        </div>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="mx-auto max-w-4xl rounded-[20px] border border-border bg-surface p-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-danger">
          Connection problem
        </p>

        <h1 className="mt-3 font-serif text-3xl">
          Could not load your financial overview
        </h1>

        <p className="mt-3 text-sm text-muted-foreground">
          Check that the backend is running, then try again.
        </p>

        <button
          type="button"
          onClick={() => refetch()}
          className="mt-6 rounded-[10px] bg-brand px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-hover"
        >
          Try again
        </button>
      </div>
    );
  }

  const {
    dashboard,
    incomeSummary,
    debts,
    investmentSummary,
  } = overview;

  const monthName =
    MONTHS[dashboard.month - 1] ?? "This month";

  const thisMonth = dashboard.monthly_trend.find(
    (item) =>
      item.year === dashboard.year &&
      item.month === dashboard.month
  );

  const monthlyIncome =
    thisMonth?.income_cents ?? incomeSummary.total_cents;

  const monthlyExpenses =
    thisMonth?.expense_cents ?? 0;

  const amountAfterRoutineExpenses =
    monthlyIncome - monthlyExpenses;

  const essentials =
    dashboard.budget_comparison.find(
      (item) => item.bucket === "essentials"
    );

  const lifestyle =
    dashboard.budget_comparison.find(
      (item) => item.bucket === "lifestyle"
    );

  const freedomFunds =
    dashboard.budget_comparison.find(
      (item) => item.bucket === "freedom_funds"
    );

  const essentialsPlanned =
    essentials?.planned_cents ?? 0;

  const essentialsUsed =
    essentials?.actual_cents ?? 0;

  const lifestylePlanned =
    lifestyle?.planned_cents ?? 0;

  const lifestyleUsed =
    lifestyle?.actual_cents ?? 0;

  const freedomFundsPlanned =
    freedomFunds?.planned_cents ?? 0;

  const freedomFundsUsed =
    freedomFunds?.actual_cents ?? 0;

  const freedomFundsRemaining =
    freedomFundsPlanned - freedomFundsUsed;

  const totalDebtStarting = debts.reduce(
    (total, debt) =>
      total + debt.starting_balance_cents,
    0
  );

  const totalDebtRemaining = debts.reduce(
    (total, debt) =>
      total + debt.current_balance_cents,
    0
  );

  const totalDebtPaid = Math.max(
    totalDebtStarting - totalDebtRemaining,
    0
  );

  const debtProgress = percentage(
    totalDebtPaid,
    totalDebtStarting
  );

  const monthlyDebtCommitment = debts
    .filter((debt) => !debt.is_paid_off)
    .reduce(
      (total, debt) =>
        total + debt.monthly_payment_cents,
      0
    );

  const efProgress = Math.min(
    Math.max(dashboard.ef_progress_pct, 0),
    100
  );

  const spendingData = dashboard.spending_by_category
    .filter((item) => item.amount_cents > 0)
    .sort(
      (first, second) =>
        second.amount_cents - first.amount_cents
    )
    .map((item) => ({
      name: item.category,
      value: shortMAD(item.amount_cents),
      amountCents: item.amount_cents,
      bucket: item.bucket,
    }));

  // const largestSpendingAmount = Math.max(
  //   ...dashboard.spending_by_category.map(
  //     (item) => item.amount_cents
  //   ),
  //   1
  // );

  const investmentData =
    investmentSummary.by_type
      .filter((item) => item.amount_cents > 0)
      .sort(
        (first, second) =>
          second.amount_cents - first.amount_cents
      );

  const trendData = dashboard.monthly_trend.map(
    (item) => ({
      month: `${
        MONTHS[item.month - 1]?.slice(0, 3) ?? ""
      } ${String(item.year).slice(2)}`,
      Income: shortMAD(item.income_cents),
      Expenses: shortMAD(item.expense_cents),
    })
  );

  const financialDirection = dashboard.ef_is_met
    ? "Your safety target is complete. Your Freedom Funds can now support your investment plan."
    : "Build your safety foundation first. Your Freedom Funds can help close the emergency-fund gap.";

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-7">
      {/* Heading */}
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-gold">
            Financial command center
          </p>

          <h1 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">
            Your money, in motion.
          </h1>

          <p className="mt-3 text-sm text-muted-foreground">
            {monthName} {dashboard.year} · Track today and
            build toward tomorrow.
          </p>
        </div>

        <Link
          href="/manage"
          className="inline-flex w-fit items-center gap-2 rounded-[10px] bg-brand px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-hover"
        >
          Manage money
          <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      {/* Investment-focused hero */}
      <section className="relative overflow-hidden rounded-[26px] bg-brand px-6 py-8 text-white shadow-sm sm:px-8 lg:px-10 lg:py-10">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full border border-white/10" />
        <div className="absolute -bottom-28 right-20 h-72 w-72 rounded-full border border-gold/20" />

        <div className="relative grid gap-8 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white/80">
              <TrendingUp className="h-3.5 w-3.5 text-gold" />
              This month&apos;s financial direction
            </div>

            <h2 className="mt-5 max-w-2xl font-serif text-3xl leading-tight sm:text-4xl">
              {dashboard.ef_is_met
                ? "Your foundation is ready for the next investment step."
                : "Strong investments begin with a strong foundation."}
            </h2>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70">
              {financialDirection}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href={
                  dashboard.ef_is_met
                    ? "/investments"
                    : "/emergency-fund"
                }
                className="inline-flex items-center gap-2 rounded-[10px] bg-gold px-5 py-3 text-sm font-medium text-white transition hover:brightness-110"
              >
                {dashboard.ef_is_met
                  ? "Review investments"
                  : "Build emergency fund"}

                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/income"
                className="inline-flex items-center gap-2 rounded-[10px] border border-white/20 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Review income
              </Link>
            </div>
          </div>

          <div className="rounded-[20px] border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-white/60">
              Freedom Funds this month
            </p>

            <p className="mt-3 font-serif text-3xl">
              {formatMAD(freedomFundsPlanned)}
            </p>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-gold"
                style={{
                  width: `${percentage(
                    freedomFundsUsed,
                    freedomFundsPlanned
                  )}%`,
                }}
              />
            </div>

            <div className="mt-3 flex justify-between gap-4 text-xs text-white/65">
              <span>
                {formatMAD(freedomFundsUsed)} allocated
              </span>

              <span>
                {formatMAD(
                  Math.max(freedomFundsRemaining, 0)
                )}{" "}
                left
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Main overview */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link
          href="/income"
          className="group rounded-[18px] border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-success/40 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-[12px] bg-success-tint p-2.5 text-success">
              <Banknote className="h-5 w-5" />
            </div>

            <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1" />
          </div>

          <p className="mt-5 text-sm text-muted-foreground">
            Monthly income
          </p>

          <p className="mt-2 font-serif text-2xl">
            {formatMAD(incomeSummary.total_cents)}
          </p>

          <p className="mt-2 text-xs text-muted-foreground">
            {formatMAD(
              incomeSummary.additional_income_cents
            )}{" "}
            additional income
          </p>
        </Link>

        <Link
          href="/expenses"
          className="group rounded-[18px] border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-danger/40 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-[12px] bg-danger-tint p-2.5 text-danger">
              <WalletCards className="h-5 w-5" />
            </div>

            <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1" />
          </div>

          <p className="mt-5 text-sm text-muted-foreground">
            Routine spending
          </p>

          <p className="mt-2 font-serif text-2xl">
            {formatMAD(monthlyExpenses)}
          </p>

          <p
            className={`mt-2 text-xs ${
              amountAfterRoutineExpenses < 0
                ? "text-danger"
                : "text-muted-foreground"
            }`}
          >
            {formatMAD(
              Math.abs(amountAfterRoutineExpenses)
            )}{" "}
            {amountAfterRoutineExpenses < 0
              ? "above income"
              : "after routine expenses"}
          </p>
        </Link>

        <Link
          href="/debts"
          className="group rounded-[18px] border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-[12px] bg-gold-tint p-2.5 text-gold">
              <CreditCard className="h-5 w-5" />
            </div>

            <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1" />
          </div>

          <p className="mt-5 text-sm text-muted-foreground">
            Debt remaining
          </p>

          <p className="mt-2 font-serif text-2xl">
            {formatMAD(totalDebtRemaining)}
          </p>

          <p className="mt-2 text-xs text-muted-foreground">
            {debts.length}{" "}
            {debts.length === 1 ? "debt" : "debts"} ·{" "}
            {debtProgress}% repaid
          </p>
        </Link>

        <Link
          href="/investments"
          className="group rounded-[18px] border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-[12px] bg-brand-tint p-2.5 text-brand">
              <TrendingUp className="h-5 w-5" />
            </div>

            <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1" />
          </div>

          <p className="mt-5 text-sm text-muted-foreground">
            Total contributions
          </p>

          <p className="mt-2 font-serif text-2xl">
            {formatMAD(
              investmentSummary.total_invested_cents
            )}
          </p>

          <p className="mt-2 text-xs text-muted-foreground">
            {formatMAD(freedomFundsUsed)} contributed this
            month
          </p>
        </Link>
      </section>

      {/* Remaining budgets */}
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
              Budget pulse
            </p>

            <h2 className="mt-2 font-serif text-2xl">
              What is still available?
            </h2>
          </div>

          <p className="text-xs text-muted-foreground">
            Regular debt payments are included in Essentials.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <BudgetCard
            title="Essentials"
            planned={essentialsPlanned}
            used={essentialsUsed}
            href="/expenses"
            color="bg-brand-mid"
          />

          <BudgetCard
            title="Lifestyle"
            planned={lifestylePlanned}
            used={lifestyleUsed}
            href="/expenses"
            color="bg-gold"
          />

          <BudgetCard
            title="Freedom Funds"
            planned={freedomFundsPlanned}
            used={freedomFundsUsed}
            href={
              dashboard.ef_is_met
                ? "/investments"
                : "/emergency-fund"
            }
            color="bg-success"
          />
        </div>
      </section>

      {/* Income and expenses */}
      <section className="grid min-w-0 gap-5 lg:grid-cols-2">
        <div className="min-w-0 rounded-[20px] border border-border bg-surface p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
                Income structure
              </p>

              <h2 className="mt-2 font-serif text-2xl">
                Where your income came from
              </h2>
            </div>

            <div className="rounded-[12px] bg-success-tint p-2.5 text-success">
              <CircleDollarSign className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-8 space-y-6">
            <div>
              <div className="mb-2 flex justify-between gap-4 text-sm">
                <span>Expected monthly income</span>

                <span className="font-mono">
                  {formatMAD(
                    incomeSummary.base_income_cents
                  )}
                </span>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{
                    width: `${percentage(
                      incomeSummary.base_income_cents,
                      incomeSummary.total_cents
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex justify-between gap-4 text-sm">
                <span>Additional income</span>

                <span className="font-mono">
                  {formatMAD(
                    incomeSummary.additional_income_cents
                  )}
                </span>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-success"
                  style={{
                    width: `${percentage(
                      incomeSummary.additional_income_cents,
                      incomeSummary.total_cents
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between rounded-[14px] bg-background p-4">
            <span className="text-sm text-muted-foreground">
              Total income
            </span>

            <span className="font-serif text-xl">
              {formatMAD(incomeSummary.total_cents)}
            </span>
          </div>

          <Link
            href="/income"
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-brand"
          >
            View income details
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="min-w-0 rounded-[20px] border border-border bg-surface p-6 sm:p-7">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
              Spending structure
            </p>

            <h2 className="mt-2 font-serif text-2xl">
              Where your money went
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              Amounts shown in MAD.
            </p>
          </div>

          {spendingData.length === 0 ? (
            <div className="mt-8 rounded-[16px] border border-dashed border-border bg-background p-8 text-center">
              <WalletCards className="mx-auto h-7 w-7 text-muted-foreground" />

              <p className="mt-3 text-sm font-medium">
                No spending logged yet
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Expenses will appear here after you add them.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid items-center gap-5 sm:grid-cols-[0.8fr_1.2fr]">
              <div className="h-56 min-w-0">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <PieChart>
                    <Pie
                      data={spendingData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={82}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {spendingData.map((item, index) => (
                        <Cell
                          key={item.name}
                          fill={
                            CHART_COLORS[
                              index % CHART_COLORS.length
                            ]
                          }
                        />
                      ))}
                    </Pie>

                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3">
                {spendingData.slice(0, 6).map(
                  (item, index) => (
                    <div
                      key={`${item.bucket}-${item.name}`}
                      className="flex items-center justify-between gap-4 text-sm"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor:
                              CHART_COLORS[
                                index %
                                  CHART_COLORS.length
                              ],
                          }}
                        />

                        <span className="truncate">
                          {item.name}
                        </span>
                      </div>

                      <span className="shrink-0 font-mono text-xs">
                        {formatMAD(item.amountCents)}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          <Link
            href="/expenses"
            className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-brand"
          >
            View expense details
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Debt overview */}
      <section className="rounded-[20px] border border-border bg-surface p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
              Debt health
            </p>

            <h2 className="mt-2 font-serif text-2xl">
              Your repayment progress
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              Debt belongs to your Essentials plan, but its
              progress deserves a clear view.
            </p>
          </div>

          <Link
            href="/debts"
            className="inline-flex w-fit items-center gap-2 text-sm font-medium text-brand"
          >
            Manage debts
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {debts.length === 0 ? (
          <div className="mt-7 rounded-[16px] border border-dashed border-border bg-background p-8 text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-success" />

            <p className="mt-3 font-medium">
              No active debts
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Your dashboard will show debt repayment progress
              here when needed.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[0.7fr_1.3fr]">
            <div className="rounded-[18px] bg-background p-6">
              <p className="text-sm text-muted-foreground">
                Total remaining
              </p>

              <p className="mt-2 font-serif text-3xl">
                {formatMAD(totalDebtRemaining)}
              </p>

              <div className="mt-6 h-3 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-success"
                  style={{
                    width: `${debtProgress}%`,
                  }}
                />
              </div>

              <div className="mt-3 flex justify-between gap-4 text-xs text-muted-foreground">
                <span>{debtProgress}% repaid</span>
                <span>
                  {formatMAD(totalDebtPaid)} paid
                </span>
              </div>

              <div className="mt-6 border-t border-border pt-5">
                <p className="text-xs text-muted-foreground">
                  Planned monthly commitment
                </p>

                <p className="mt-1 font-mono text-sm">
                  {formatMAD(monthlyDebtCommitment)}
                </p>
              </div>
            </div>

            <div className="space-y-5">
              {debts.map((debt) => (
                <div key={debt.id}>
                  <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">
                        {debt.name}
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {debt.progress_pct}% paid
                      </p>
                    </div>

                    <p className="font-mono text-sm">
                      {formatMAD(
                        debt.current_balance_cents
                      )}{" "}
                      remaining
                    </p>
                  </div>

                  <div className="h-2.5 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-success"
                      style={{
                        width: `${Math.min(
                          Math.max(
                            debt.progress_pct,
                            0
                          ),
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {dashboard.extra_debt_payments_this_month_cents >
          0 && (
          <div className="mt-7 rounded-[16px] border border-gold/30 bg-gold-tint p-5">
            <p className="text-sm font-medium text-foreground">
              Extra debt reduction this month:{" "}
              {formatMAD(
                dashboard.extra_debt_payments_this_month_cents
              )}
            </p>

            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              This reduced your debt balance but was kept
              separate from routine monthly expenses.
            </p>
          </div>
        )}
      </section>

      {/* Emergency fund and investments */}
      <section className="grid gap-5 lg:grid-cols-2">
        <Link
          href="/emergency-fund"
          className="group rounded-[20px] border border-border bg-surface p-6 transition hover:border-brand/30 sm:p-7"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
                Safety foundation
              </p>

              <h2 className="mt-2 font-serif text-2xl">
                Emergency fund
              </h2>
            </div>

            <div className="rounded-[12px] bg-brand-tint p-2.5 text-brand">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-7 flex items-end justify-between gap-4">
            <div>
              <p className="font-serif text-3xl">
                {formatMAD(
                  dashboard.ef_current_balance_cents
                )}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                of {formatMAD(dashboard.ef_target_cents)}
              </p>
            </div>

            <p className="font-serif text-3xl text-brand">
              {efProgress}%
            </p>
          </div>

          <div className="mt-5 h-3 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${efProgress}%` }}
            />
          </div>

          <p className="mt-5 text-sm leading-6 text-muted-foreground">
            {dashboard.ef_is_met
              ? "Your target is met. You have built the safety layer supporting your investment plan."
              : "Continue building this reserve before directing all Freedom Funds toward investments."}
          </p>

          <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-brand">
            View emergency fund
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </span>
        </Link>

        <Link
          href="/investments"
          className="group rounded-[20px] border border-border bg-surface p-6 transition hover:border-success/30 sm:p-7"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
                Wealth building
              </p>

              <h2 className="mt-2 font-serif text-2xl">
                Investment contributions
              </h2>
            </div>

            <div className="rounded-[12px] bg-success-tint p-2.5 text-success">
              <PiggyBank className="h-5 w-5" />
            </div>
          </div>

          <p className="mt-7 font-serif text-3xl">
            {formatMAD(
              investmentSummary.total_invested_cents
            )}
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            Total money contributed — not market value or
            investment returns.
          </p>

          {investmentData.length === 0 ? (
            <div className="mt-6 rounded-[14px] border border-dashed border-border bg-background p-5">
              <p className="text-sm font-medium">
                No contributions logged yet
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Your investment allocation will appear here.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {investmentData
                .slice(0, 4)
                .map((investment, index) => (
                  <div key={investment.type}>
                    <div className="mb-2 flex justify-between gap-4 text-sm">
                      <span>{investment.type}</span>

                      <span className="font-mono text-xs">
                        {formatMAD(
                          investment.amount_cents
                        )}
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-border">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${percentage(
                            investment.amount_cents,
                            investmentSummary.total_invested_cents
                          )}%`,
                          backgroundColor:
                            CHART_COLORS[
                              index % CHART_COLORS.length
                            ],
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          )}

          <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-brand">
            View investments
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </span>
        </Link>
      </section>

      {/* Six-month trend */}
      <section className="min-w-0 rounded-[20px] border border-border bg-surface p-6 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
              Financial rhythm
            </p>

            <h2 className="mt-2 font-serif text-2xl">
              Income and spending over time
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              The last six months in MAD. Extra debt
              repayments are excluded from routine spending.
            </p>
          </div>

          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-success" />
              Income
            </span>

            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-danger" />
              Expenses
            </span>
          </div>
        </div>

        <div className="mt-8 overflow-x-auto">
          <div className="h-80 min-w-[560px]">
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <BarChart
                data={trendData}
                margin={{
                  top: 12,
                  right: 8,
                  left: 0,
                  bottom: 0,
                }}
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
                  tick={{
                    fill: "#78766D",
                    fontSize: 12,
                  }}
                />

                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{
                    fill: "#78766D",
                    fontSize: 12,
                  }}
                  width={55}
                />

                <Tooltip />

                <Bar
                  dataKey="Income"
                  fill="#2F6B4F"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={30}
                />

                <Bar
                  dataKey="Expenses"
                  fill="#A54B3F"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={30}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Optional savings */}
      {dashboard.available_savings_cents !== null && (
        <section className="flex flex-col gap-5 rounded-[20px] border border-border bg-surface-alt p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
              Private financial context
            </p>

            <h2 className="mt-2 font-serif text-2xl">
              Available savings
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              This optional amount is separate from your
              emergency fund. Nisba displays it as context and
              does not automatically spend or subtract from it.
            </p>
          </div>

          <p className="shrink-0 font-serif text-3xl text-brand">
            {formatMAD(
              dashboard.available_savings_cents
            )}
          </p>
        </section>
      )}
    </div>
  );
}