"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getDashboard, type MoneyEventType, type TrackKind } from "@/lib/api";
import { getToken } from "@/lib/auth";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const TRACKS: Record<TrackKind, { label: string; color: string; tint: string }> = {
  essentials: { label: "Essentials", color: "bg-brand", tint: "bg-brand-tint" },
  lifestyle: { label: "Lifestyle", color: "bg-gold", tint: "bg-gold-tint" },
  investments: { label: "Investments", color: "bg-success", tint: "bg-success-tint" },
};
const EVENT_LABELS: Record<MoneyEventType, string> = {
  opening_balance: "Opening balance",
  income: "Income",
  expense: "Expense",
  goal_reserve: "Saved toward goal",
  goal_release: "Returned from goal",
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

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);
}

function formatCompact(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function clamp(value: number) {
  return Math.min(Math.max(value, 0), 100);
}

function SummaryLink({ href, label, value, detail }: { href: string; label: string; value: string; detail: string }) {
  return <Link href={href} className="group rounded-[18px] border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-sm"><div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{label}</p><span className="text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-brand">→</span></div><p className="mt-4 font-serif text-2xl">{value}</p><p className="mt-2 text-xs text-muted-foreground">{detail}</p></Link>;
}

export default function DashboardPage() {
  const token = getToken();
  const { data: dashboard, isPending, error, refetch } = useQuery({
    queryKey: ["dashboard", "v2"],
    queryFn: () => getDashboard(token!),
    enabled: Boolean(token),
    retry: false,
  });

  if (isPending) return <div className="mx-auto w-full max-w-7xl space-y-5"><div className="h-64 animate-pulse rounded-[24px] bg-brand/10" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-36 animate-pulse rounded-[18px] bg-surface" />)}</div></div>;
  if (error || !dashboard) return <div className="mx-auto max-w-xl rounded-[20px] border border-border bg-surface p-8 text-center"><h1 className="font-serif text-2xl">Could not load your dashboard</h1><p className="mt-3 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Try again."}</p><button type="button" onClick={() => refetch()} className="mt-6 rounded-[10px] bg-brand px-5 py-3 text-sm font-medium text-white">Try again</button></div>;

  const currency = dashboard.currency;
  const activity = dashboard.monthly_activity;
  const expectedIncomeProgress = dashboard.expected_monthly_income_cents > 0 ? clamp(activity.income_cents * 100 / dashboard.expected_monthly_income_cents) : 0;
  const maxSpending = Math.max(...dashboard.spending_by_category.map((item) => item.amount_cents), 1);
  const trend = dashboard.monthly_trend.map((item) => ({
    name: `${MONTHS[item.month - 1]} ${String(item.year).slice(-2)}`,
    moneyIn: item.money_in_cents / 100,
    moneyOut: item.money_out_cents / 100,
    closing: item.closing_money_cents / 100,
  }));

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">Financial overview</p><h1 className="mt-4 font-serif text-4xl tracking-tight">Your money, clearly explained</h1><p className="mt-3 text-sm text-muted-foreground">Live position as of {formatDate(dashboard.as_of_date)}.</p></div>
        <Link href="/money" className="w-fit rounded-[10px] bg-brand px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-hover">Record money activity</Link>
      </div>

      <section className="relative mt-7 overflow-hidden rounded-[26px] bg-brand p-7 text-white sm:p-9 lg:p-10">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border border-white/10" /><div className="absolute -bottom-32 right-36 h-80 w-80 rounded-full border border-gold/20" />
        <div className="relative grid gap-8 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
          <div><p className="text-xs uppercase tracking-[0.18em] text-white/60">Total money you currently have</p><p className="mt-3 font-serif text-5xl tracking-tight sm:text-6xl">{formatMoney(dashboard.total_money_cents, currency)}</p><p className="mt-4 max-w-2xl text-sm leading-6 text-white/65">This is your single cash total. Moving money between tracks or into goals does not change it; only real money entering or leaving does.</p></div>
          <div className="grid gap-px overflow-hidden rounded-[16px] bg-white/15 sm:grid-cols-2 lg:grid-cols-1"><div className="bg-white/10 p-4"><p className="text-xs text-white/60">Available in tracks</p><p className="mt-2 font-serif text-2xl">{formatMoney(dashboard.money_in_tracks_cents, currency)}</p></div><div className="bg-white/10 p-4"><p className="text-xs text-white/60">Reserved in goals</p><p className="mt-2 font-serif text-2xl">{formatMoney(dashboard.money_in_goals_cents, currency)}</p></div></div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryLink href="/goals" label="Reserved goals" value={formatMoney(dashboard.money_in_goals_cents, currency)} detail={`${dashboard.goals.length} active or completed goals`} />
        <SummaryLink href="/debts" label="Remaining debt" value={formatMoney(dashboard.total_debt_cents, currency)} detail={`${dashboard.debts.filter((debt) => debt.status === "active").length} active debts`} />
        <SummaryLink href="/investments" label="Investment value" value={formatMoney(dashboard.total_investment_value_cents, currency)} detail="Latest recorded portfolio values" />
        <SummaryLink href="/dashboard" label="Estimated net worth" value={formatMoney(dashboard.estimated_net_worth_cents, currency)} detail="Money + investments − debts" />
      </section>

      <section className="mt-7"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Available money</p><h2 className="mt-2 font-serif text-2xl">Your three tracks</h2></div><Link href="/settings" className="text-sm font-medium text-brand">Change future allocation →</Link></div><div className="mt-5 grid gap-4 md:grid-cols-3">{dashboard.tracks.map((track) => {
        const style = TRACKS[track.track_kind];
        return <Link key={track.track_kind} href="/money" className="rounded-[18px] border border-border bg-surface p-6 transition hover:border-brand/30"><div className="flex items-center justify-between gap-3"><span className={`rounded-full px-3 py-1 text-xs ${style.tint}`}>{track.percentage}% of new income</span><span className="text-muted-foreground">→</span></div><p className="mt-6 text-sm text-muted-foreground">{style.label}</p><p className={`mt-2 font-serif text-3xl ${track.balance_cents < 0 ? "text-danger" : ""}`}>{formatMoney(track.balance_cents, currency)}</p><div className="mt-5 h-1.5 overflow-hidden rounded-full bg-secondary"><div className={`h-full w-full rounded-full ${style.color}`} /></div></Link>;
      })}</div></section>

      <section className="mt-7 rounded-[22px] border border-border bg-surface p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">This month</p><h2 className="mt-2 font-serif text-2xl">Money activity</h2></div><p className={`font-serif text-2xl ${activity.net_money_change_cents < 0 ? "text-danger" : "text-success"}`}>{activity.net_money_change_cents > 0 ? "+" : ""}{formatMoney(activity.net_money_change_cents, currency)} net</p></div>
        <div className="mt-6 grid gap-px overflow-hidden rounded-[16px] border border-border bg-border sm:grid-cols-2 lg:grid-cols-5">{[
          ["Income", activity.income_cents, "text-success"],
          ["Expenses", activity.expenses_cents, "text-danger"],
          ["Debt payments", activity.debt_payments_cents, "text-danger"],
          ["Investment purchases", activity.investment_purchases_cents, "text-brand"],
          ["Investment income", activity.investment_income_cents, "text-success"],
        ].map(([label, value, color]) => <div key={String(label)} className="bg-surface p-4"><p className="text-xs text-muted-foreground">{String(label)}</p><p className={`mt-2 font-mono text-sm ${String(color)}`}>{formatMoney(Number(value), currency)}</p></div>)}</div>
        <div className="mt-6"><div className="flex justify-between gap-4 text-xs"><span className="text-muted-foreground">Income received versus expected</span><span>{formatMoney(activity.income_cents, currency)} / {formatMoney(dashboard.expected_monthly_income_cents, currency)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-success" style={{ width: `${expectedIncomeProgress}%` }} /></div></div>
      </section>

      <section className="mt-7 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-[22px] border border-border bg-surface p-5 sm:p-7"><p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Six-month trend</p><h2 className="mt-2 font-serif text-2xl">Money in, money out, closing total</h2><div className="mt-6 h-72 w-full"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} /><XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={(value) => formatCompact(Number(value), currency)} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} width={68} /><Tooltip formatter={(value) => formatMoney(Math.round(Number(value) * 100), currency)} contentStyle={{ border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface)", fontSize: 12 }} /><Bar dataKey="moneyIn" name="Money in" fill="var(--success)" radius={[4, 4, 0, 0]} /><Bar dataKey="moneyOut" name="Money out" fill="var(--gold)" radius={[4, 4, 0, 0]} /><Line type="monotone" dataKey="closing" name="Closing total" stroke="var(--brand)" strokeWidth={3} dot={{ r: 3 }} /></ComposedChart></ResponsiveContainer></div></div>

        <div className="rounded-[22px] border border-border bg-surface p-6 sm:p-7"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Spending</p><h2 className="mt-2 font-serif text-2xl">By category</h2></div><Link href="/money" className="text-sm text-brand">Details →</Link></div><div className="mt-6 space-y-4">{dashboard.spending_by_category.length === 0 ? <p className="rounded-[12px] bg-surface-alt p-4 text-sm text-muted-foreground">No expenses recorded this month.</p> : dashboard.spending_by_category.map((category) => <div key={category.category_id}><div className="flex justify-between gap-3 text-sm"><div><span className="font-medium">{category.category_name}</span><span className="ml-2 text-xs capitalize text-muted-foreground">{category.track_kind}</span></div><span className="font-mono text-xs">{formatMoney(category.amount_cents, currency)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary"><div className={`h-full rounded-full ${TRACKS[category.track_kind].color}`} style={{ width: `${category.amount_cents * 100 / maxSpending}%` }} /></div></div>)}</div></div>
      </section>

      <section className="mt-7 grid gap-6 xl:grid-cols-3">
        <div className="rounded-[22px] border border-border bg-surface p-6"><div className="flex items-center justify-between gap-3"><h2 className="font-serif text-2xl">Goals</h2><Link href="/goals" className="text-sm text-brand">View all →</Link></div><div className="mt-5 space-y-3">{dashboard.goals.length === 0 ? <p className="text-sm text-muted-foreground">No goals yet.</p> : dashboard.goals.slice(0, 3).map((goal) => <Link key={goal.id} href="/goals" className="block rounded-[12px] bg-surface-alt p-4"><div className="flex justify-between gap-3"><p className="text-sm font-medium">{goal.name}</p><span className="text-xs text-muted-foreground">{goal.progress_pct === null ? "Open goal" : `${goal.progress_pct}%`}</span></div><p className="mt-2 font-serif text-xl">{formatMoney(goal.current_balance_cents, currency)}</p>{goal.target_cents !== null && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-brand" style={{ width: `${clamp(goal.progress_pct ?? 0)}%` }} /></div>}</Link>)}</div></div>

        <div className="rounded-[22px] border border-border bg-surface p-6"><div className="flex items-center justify-between gap-3"><h2 className="font-serif text-2xl">Debts</h2><Link href="/debts" className="text-sm text-brand">View all →</Link></div><div className="mt-5 space-y-3">{dashboard.debts.length === 0 ? <p className="text-sm text-muted-foreground">No debts recorded.</p> : dashboard.debts.slice(0, 3).map((debt) => <Link key={debt.id} href="/debts" className="block rounded-[12px] bg-surface-alt p-4"><div className="flex justify-between gap-3"><p className="text-sm font-medium">{debt.name}</p><span className="text-xs capitalize text-muted-foreground">{debt.status}</span></div><p className="mt-2 font-serif text-xl">{formatMoney(debt.current_balance_cents, currency)}</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-gold" style={{ width: `${clamp(debt.progress_pct)}%` }} /></div></Link>)}</div></div>

        <div className="rounded-[22px] border border-border bg-surface p-6"><div className="flex items-center justify-between gap-3"><h2 className="font-serif text-2xl">Investments</h2><Link href="/investments" className="text-sm text-brand">View all →</Link></div><div className="mt-5 space-y-3">{dashboard.investments.length === 0 ? <p className="text-sm text-muted-foreground">No assets recorded.</p> : dashboard.investments.slice(0, 3).map((asset) => <Link key={asset.id} href="/investments" className="block rounded-[12px] bg-surface-alt p-4"><div className="flex justify-between gap-3"><div><p className="text-sm font-medium">{asset.name}</p><p className="mt-1 text-xs text-muted-foreground">{asset.asset_type} · {Number(asset.current_units).toLocaleString("en-US", { maximumFractionDigits: 8 })} units</p></div><span className="text-xs capitalize text-muted-foreground">{asset.status}</span></div><p className="mt-2 font-serif text-xl">{asset.current_value_cents === null ? "Not valued" : formatMoney(asset.current_value_cents, currency)}</p></Link>)}</div></div>
      </section>

      <section className="mt-7 rounded-[22px] border border-border bg-surface p-6 sm:p-8"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Ledger</p><h2 className="mt-2 font-serif text-2xl">Recent activity</h2></div><Link href="/money" className="text-sm font-medium text-brand">Full history →</Link></div><div className="mt-6 divide-y divide-border">{dashboard.recent_events.length === 0 ? <p className="py-4 text-sm text-muted-foreground">No money activity yet.</p> : dashboard.recent_events.map((event) => <div key={event.id} className="flex flex-col justify-between gap-2 py-4 sm:flex-row sm:items-center"><div><p className="text-sm font-medium">{EVENT_LABELS[event.event_type]}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(event.occurred_on)}{event.note ? ` · ${event.note}` : ""}</p></div><p className={`font-mono text-sm font-medium ${event.cash_delta_cents > 0 ? "text-success" : event.cash_delta_cents < 0 ? "text-danger" : "text-muted-foreground"}`}>{event.cash_delta_cents > 0 ? "+" : ""}{formatMoney(event.cash_delta_cents, currency)}</p></div>)}</div></section>

      <p className="mt-7 text-xs leading-relaxed text-muted-foreground">Estimated net worth uses your declared money plus the latest known investment values minus remaining debts. Assets without a valuation contribute zero until you record their value.</p>
    </div>
  );
}
