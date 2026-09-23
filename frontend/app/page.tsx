"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  LineChart,
  PiggyBank,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from "lucide-react";

const JOURNEY = [
  {
    label: "Track",
    title: "Know where every dirham goes.",
    description:
      "Bring income, spending, debt, savings, and investments into one clear financial picture.",
    icon: Wallet,
    metric: "Cash-flow clarity",
  },
  {
    label: "Protect",
    title: "Build the strength to stay invested.",
    description:
      "Create an emergency reserve and understand debt before taking unnecessary investment risk.",
    icon: ShieldCheck,
    metric: "Financial resilience",
  },
  {
    label: "Invest",
    title: "Turn consistency into capital.",
    description:
      "See what may be available for investing and record contributions without losing control of monthly commitments.",
    icon: TrendingUp,
    metric: "Investable momentum",
  },
  {
    label: "Review",
    title: "Measure decisions—not excitement.",
    description:
      "Review progress, contribution mix, cash flow, and financial commitments from one dashboard.",
    icon: BarChart3,
    metric: "Visible progress",
  },
];

const INVESTOR_NOTES = [
  {
    quote: "Price is what you pay; value is what you get.",
    author: "Benjamin Graham, quoted by Warren Buffett",
    source: "Berkshire Hathaway, 2008 shareholder letter",
    href: "https://berkshirehathaway.com/letters/2008ltr.pdf",
    lesson: "Separate the price of an asset from the value you believe it can create.",
  },
  {
    quote: "Pain + Reflection = Progress.",
    author: "Ray Dalio",
    source: "Principles",
    href: "https://www.principles.com/principles/9decb01f-5551-48b9-adf8-667670f4853e/",
    lesson: "Review mistakes honestly so that every decision improves the next one.",
  },
  {
    quote: "You shouldn’t expect to make money without bearing risk.",
    author: "Howard Marks",
    source: "The Indispensability of Risk",
    href: "https://www.oaktreecapital.com/insights/memo/the-indispensability-of-risk",
    lesson: "Understand the risk you accept instead of chasing return blindly.",
  },
];

function formatMAD(amount: number) {
  return `${Math.round(amount).toLocaleString("en-US")} MAD`;
}

function LogoMark({
  className = "h-8 w-8",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
    >
      <circle
        cx="24"
        cy="24"
        r="20"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.14"
        strokeWidth="6"
      />
      <path
        d="M24 4a20 20 0 0 1 19 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M44 24a20 20 0 0 1-27 19"
        fill="none"
        stroke="#8891C4"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M8 37A20 20 0 0 1 5 20"
        fill="none"
        stroke="#B8863A"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GrowthIllustration() {
  return (
    <svg
      viewBox="0 0 520 250"
      className="h-auto w-full"
      role="img"
      aria-label="Illustration of steadily growing investment contributions"
    >
      <defs>
        <linearGradient
          id="growth-area"
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop
            offset="0%"
            stopColor="#B8863A"
            stopOpacity="0.28"
          />
          <stop
            offset="100%"
            stopColor="#B8863A"
            stopOpacity="0"
          />
        </linearGradient>

        <pattern
          id="zellige-grid"
          width="42"
          height="42"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M21 2 40 21 21 40 2 21Z"
            fill="none"
            stroke="#232C5C"
            strokeOpacity="0.07"
          />
        </pattern>
      </defs>

      <rect
        width="520"
        height="250"
        rx="18"
        fill="url(#zellige-grid)"
      />

      {[55, 105, 155, 205].map((y) => (
        <line
          key={y}
          x1="30"
          y1={y}
          x2="490"
          y2={y}
          stroke="#E6E1D6"
          strokeDasharray="5 7"
        />
      ))}

      <path
        d="M35 205 C92 199 112 188 155 178 C205 165 226 176 272 143 C316 111 342 127 382 91 C421 57 450 71 486 35 L486 222 L35 222Z"
        fill="url(#growth-area)"
      />

      <path
        d="M35 205 C92 199 112 188 155 178 C205 165 226 176 272 143 C316 111 342 127 382 91 C421 57 450 71 486 35"
        fill="none"
        stroke="#B8863A"
        strokeWidth="5"
        strokeLinecap="round"
        className="nisba-growth-line"
      />

      {[
        [35, 205],
        [155, 178],
        [272, 143],
        [382, 91],
        [486, 35],
      ].map(([x, y], index) => (
        <g key={`${x}-${y}`}>
          <circle
            cx={x}
            cy={y}
            r="9"
            fill="#FFFFFF"
            stroke="#232C5C"
            strokeWidth="3"
          />
          {index === 4 && (
            <circle
              cx={x}
              cy={y}
              r="17"
              fill="none"
              stroke="#B8863A"
              strokeOpacity="0.3"
              className="nisba-pulse-ring"
            />
          )}
        </g>
      ))}
    </svg>
  );
}

export default function LandingPage() {
  const [monthlyIncome, setMonthlyIncome] = useState(15000);
  const [activeStage, setActiveStage] = useState(0);

  const illustrativeMonthlyInvestment =
    monthlyIncome * 0.2;

  const illustrativeAnnualInvestment =
    illustrativeMonthlyInvestment * 12;

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveStage(
        (current) => (current + 1) % JOURNEY.length
      );
    }, 3800);

    return () => window.clearInterval(interval);
  }, []);

  const activeJourneyStage = JOURNEY[activeStage];
  const ActiveJourneyIcon = activeJourneyStage.icon;

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <nav className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link
            href="/"
            className="flex items-center gap-3 text-brand"
            aria-label="Nisba home"
          >
            <LogoMark />

            <span className="font-serif text-2xl tracking-tight text-foreground">
              Nisba
            </span>
          </Link>

          <div className="hidden items-center gap-8 text-sm text-muted-foreground lg:flex">
            <a
              href="#vision"
              className="transition-colors hover:text-brand"
            >
              Vision
            </a>

            <a
              href="#method"
              className="transition-colors hover:text-brand"
            >
              Method
            </a>

            <a
              href="#preview"
              className="transition-colors hover:text-brand"
            >
              Dashboard
            </a>

            <a
              href="#wisdom"
              className="transition-colors hover:text-brand"
            >
              Investor notes
            </a>
          </div>

          <Link
            href="/login"
            className="group inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
          >
            Enter Nisba
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-1"
              aria-hidden="true"
            />
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="hero-mesh relative border-b border-border">
        <div
          className="pointer-events-none absolute -left-32 top-32 h-72 w-72 rounded-full border border-brand/10"
          aria-hidden="true"
        />

        <div
          className="pointer-events-none absolute -right-20 top-10 h-[420px] w-[420px] rounded-full border border-gold/15"
          aria-hidden="true"
        />

        <div className="relative mx-auto grid min-h-[780px] max-w-7xl gap-16 px-5 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:py-24">
          <div className="max-w-2xl">
            <div className="rise-in inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold-tint px-4 py-2 text-xs font-medium uppercase tracking-[0.17em] text-gold">
              <TrendingUp
                className="h-3.5 w-3.5"
                aria-hidden="true"
              />
              Investment discipline, built in MAD
            </div>

            <h1 className="rise-in rise-in-2 mt-7 text-balance font-serif text-5xl leading-[1.02] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
              Build the financial system behind{" "}
              <span className="relative whitespace-nowrap text-brand">
                better investments.
                <span
                  className="absolute -bottom-2 left-0 h-1 w-full rounded-full bg-gold/70"
                  aria-hidden="true"
                />
              </span>
            </h1>

            <p className="rise-in rise-in-3 mt-8 max-w-xl text-lg leading-8 text-muted-foreground">
              Nisba helps you understand your cash flow,
              protect your financial base, and turn consistent
              savings into intentional investment capital.
            </p>

            <div className="rise-in rise-in-4 mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link
                href="/login"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-brand px-7 py-4 text-sm font-medium text-white transition-all hover:-translate-y-0.5 hover:bg-brand-hover hover:shadow-lg"
              >
                Open your financial cockpit
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>

              <a
                href="#method"
                className="inline-flex items-center justify-center rounded-full border border-border bg-surface px-7 py-4 text-sm font-medium transition-colors hover:border-brand/30 hover:text-brand"
              >
                Explore the method
              </a>
            </div>

            <div className="rise-in rise-in-5 mt-10 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2 flex items-center gap-4 rounded-[18px] border border-success/25 bg-success-tint p-4 shadow-sm">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success text-white">
                  <ShieldCheck className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-success">
                    Private by design
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    No bank connection required
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    You stay in control and only enter the financial information you choose.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-[16px] border border-border bg-surface p-4">
                <div className="rounded-full bg-brand-tint p-2 text-brand">
                  <Wallet className="h-4 w-4" />
                </div>

                <div>
                  <p className="text-sm font-medium">
                    Made for Morocco
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Built around Moroccan dirhams.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-[16px] border border-border bg-surface p-4">
                <div className="rounded-full bg-gold-tint p-2 text-gold">
                  <BookOpen className="h-4 w-4" />
                </div>

                <div>
                  <p className="text-sm font-medium">
                    Responsible guidance
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Principles and education—not promises.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Investment cockpit */}
          <div className="relative mx-auto w-full max-w-2xl">
            <div
              className="nisba-float-reverse absolute -right-5 bottom-20 z-20 hidden rounded-[16px] border border-gold/25 bg-gold-tint px-5 py-4 shadow-xl sm:block"
              aria-hidden="true"
            >
              <p className="text-[10px] uppercase tracking-[0.18em] text-gold">
                Annual potential
              </p>
              <p className="mt-2 font-mono text-lg text-foreground">
                {formatMAD(illustrativeAnnualInvestment)}
              </p>
            </div>

            <div className="relative overflow-hidden rounded-[30px] border border-brand/15 bg-surface p-5 shadow-[0_35px_100px_-45px_rgba(35,44,92,0.55)] sm:p-8">
              <div
                className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-gold/10 blur-3xl"
                aria-hidden="true"
              />

              <div className="relative flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
                    Investment runway
                  </p>
                  <h2 className="mt-2 font-serif text-2xl">
                    See what consistency can build.
                  </h2>
                </div>

                <span className="rounded-full bg-success-tint px-3 py-1.5 text-xs text-success">
                  Interactive preview
                </span>
              </div>

              <label
                htmlFor="landing-income"
                className="relative mt-8 block text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground"
              >
                Example monthly income
              </label>

              <div className="relative mt-3 flex items-center rounded-[14px] border border-border bg-background px-5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/10">
                <input
                  id="landing-income"
                  type="number"
                  min="0"
                  step="100"
                  value={monthlyIncome}
                  onChange={(event) =>
                    setMonthlyIncome(
                      Math.max(
                        0,
                        Number(event.target.value) || 0
                      )
                    )
                  }
                  className="min-w-0 flex-1 bg-transparent py-4 font-mono text-xl outline-none"
                />

                <span className="text-sm text-muted-foreground">
                  MAD
                </span>
              </div>

              <div className="relative mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[16px] bg-brand p-5 text-white">
                  <p className="text-xs text-white/60">
                    Illustrative monthly capital
                  </p>
                  <p className="mt-3 font-serif text-3xl">
                    {formatMAD(
                      illustrativeMonthlyInvestment
                    )}
                  </p>
                  <p className="mt-2 text-xs text-white/60">
                    Example using 20%—you choose your plan.
                  </p>
                </div>

                <div className="rounded-[16px] border border-border bg-background p-5">
                  <p className="text-xs text-muted-foreground">
                    Illustrative annual consistency
                  </p>
                  <p className="mt-3 font-serif text-3xl text-brand">
                    {formatMAD(
                      illustrativeAnnualInvestment
                    )}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Contributions only, not projected returns.
                  </p>
                </div>
              </div>

              <div className="relative mt-5 rounded-[18px] border border-border bg-background p-4 sm:p-6">
                <GrowthIllustration />
              </div>

              <div className="relative mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  {
                    label: "Track",
                    detail: "Cash flow",
                    color: "bg-brand",
                  },
                  {
                    label: "Protect",
                    detail: "Safety reserve",
                    color: "bg-brand-mid",
                  },
                  {
                    label: "Invest",
                    detail: "Consistent capital",
                    color: "bg-gold",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[14px] border border-border bg-surface-alt p-4"
                  >
                    <span
                      className={`block h-1.5 w-8 rounded-full ${item.color}`}
                    />
                    <p className="mt-4 text-sm font-medium">
                      {item.label}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Manifesto */}
      <section
        id="vision"
        className="relative overflow-hidden bg-brand text-white"
      >
        <div
          className="absolute inset-0 opacity-10"
          aria-hidden="true"
          style={{
            backgroundImage:
              "linear-gradient(45deg, transparent 45%, white 45%, white 47%, transparent 47%), linear-gradient(-45deg, transparent 45%, white 45%, white 47%, transparent 47%)",
            backgroundSize: "80px 80px",
          }}
        />

        <div className="relative mx-auto flex min-h-[560px] max-w-7xl flex-col items-center justify-center px-5 py-24 text-center sm:px-8">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-white/55">
            The Nisba vision
          </p>

          <h2 className="mt-8 max-w-5xl text-balance font-serif text-5xl leading-tight tracking-[-0.04em] sm:text-7xl lg:text-8xl">
            From Dirhams{" "}
            <span className="italic text-[#E3B565]">
              to dreams.
            </span>
          </h2>

          <p className="mt-8 max-w-2xl text-base leading-8 text-white/70 sm:text-lg">
            Wealth is rarely built in one dramatic move. It
            grows through clear decisions repeated with
            patience: understand, protect, invest, review.
          </p>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            {[
              "Track",
              "Protect",
              "Invest",
              "Review",
              "Grow",
            ].map((step, index) => (
              <div
                key={step}
                className="flex items-center gap-3"
              >
                <span className="rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm">
                  {step}
                </span>

                {index < 4 && (
                  <ArrowRight
                    className="h-4 w-4 text-[#E3B565]"
                    aria-hidden="true"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Method */}
      <section
        id="method"
        className="border-b border-border bg-surface-alt"
      >
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
          <div className="grid gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:gap-20">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
                The method
              </p>

              <h2 className="mt-5 text-balance font-serif text-4xl tracking-[-0.03em] sm:text-5xl">
                Investing begins before you buy an asset.
              </h2>

              <p className="mt-6 max-w-xl text-base leading-8 text-muted-foreground">
                Strong investment habits start with visibility,
                resilience, and consistency. Nisba connects
                those foundations instead of treating investing
                as an isolated action.
              </p>

              <div className="mt-10 space-y-3">
                {JOURNEY.map((stage, index) => {
                  const Icon = stage.icon;
                  const isActive = index === activeStage;

                  return (
                    <button
                      key={stage.label}
                      type="button"
                      onClick={() => setActiveStage(index)}
                      className={`group flex w-full items-center gap-4 rounded-[16px] border p-4 text-left transition-all ${
                        isActive
                          ? "border-brand bg-surface shadow-sm"
                          : "border-transparent hover:border-border hover:bg-surface/60"
                      }`}
                    >
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors ${
                          isActive
                            ? "bg-brand text-white"
                            : "bg-brand-tint text-brand"
                        }`}
                      >
                        <Icon
                          className="h-5 w-5"
                          aria-hidden="true"
                        />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block text-xs uppercase tracking-[0.17em] text-muted-foreground">
                          0{index + 1}
                        </span>
                        <span className="mt-1 block font-medium">
                          {stage.label}
                        </span>
                      </span>

                      <span
                        className={`h-2 w-2 rounded-full transition-colors ${
                          isActive
                            ? "bg-gold"
                            : "bg-border"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex min-h-[560px] items-center rounded-[28px] border border-border bg-surface p-6 sm:p-10 lg:p-14">
              <div
                key={activeJourneyStage.label}
                className="rise-in w-full"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-gold-tint text-gold">
                  <ActiveJourneyIcon
                    className="h-7 w-7"
                    aria-hidden="true"
                  />
                </div>

                <p className="mt-10 text-xs font-medium uppercase tracking-[0.2em] text-gold">
                  {activeJourneyStage.metric}
                </p>

                <h3 className="mt-4 max-w-xl font-serif text-4xl leading-tight tracking-[-0.03em]">
                  {activeJourneyStage.title}
                </h3>

                <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
                  {activeJourneyStage.description}
                </p>

                <div className="mt-10 grid grid-cols-4 gap-3">
                  {JOURNEY.map((stage, index) => (
                    <button
                      key={stage.label}
                      type="button"
                      onClick={() => setActiveStage(index)}
                      aria-label={`Show ${stage.label} stage`}
                      className={`h-2 rounded-full transition-all ${
                        index === activeStage
                          ? "bg-gold"
                          : index < activeStage
                            ? "bg-brand"
                            : "bg-border"
                      }`}
                    />
                  ))}
                </div>

                <div className="mt-12 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[16px] bg-background p-5">
                    <p className="text-xs text-muted-foreground">
                      What Nisba provides
                    </p>
                    <p className="mt-2 font-medium">
                      Structure, visibility, and guidance
                    </p>
                  </div>

                  <div className="rounded-[16px] bg-background p-5">
                    <p className="text-xs text-muted-foreground">
                      What remains yours
                    </p>
                    <p className="mt-2 font-medium">
                      Every financial decision
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Literature and principles */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-brand-tint text-brand">
                <BookOpen
                  className="h-6 w-6"
                  aria-hidden="true"
                />
              </div>

              <p className="mt-8 text-xs font-medium uppercase tracking-[0.2em] text-gold">
                Knowledge before noise
              </p>

              <h2 className="mt-5 text-balance font-serif text-4xl tracking-[-0.03em] sm:text-5xl">
                Built from books. Adapted to real life.
              </h2>
            </div>

            <div>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                Nisba is shaped by established ideas found in
                respected financial and investment literature.
                Those ideas are translated into practical tools
                for people earning, spending, saving, and
                investing in Morocco.
              </p>

              <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground">
                Every future strategy added to Nisba should
                have a clear source, an understandable reason,
                and an honest explanation of its risks. No
                anonymous tips. No guaranteed returns.
              </p>
            </div>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {[
              {
                number: "01",
                title: "Protect your ability to invest",
                text: "A safety reserve can reduce the chance that an emergency forces you to sell an investment at the wrong time.",
              },
              {
                number: "02",
                title: "Consistency before prediction",
                text: "A repeatable contribution habit is more useful than building a plan around perfect market timing.",
              },
              {
                number: "03",
                title: "Measure honestly",
                text: "Contributions, current value, profit, risk, and performance are different numbers and should never be confused.",
              },
            ].map((principle) => (
              <article
                key={principle.number}
                className="group rounded-[20px] border border-border bg-surface-alt p-7 transition-all hover:-translate-y-1 hover:border-brand/25 hover:shadow-lg"
              >
                <span className="font-mono text-xs text-gold">
                  {principle.number}
                </span>

                <h3 className="mt-8 font-serif text-2xl leading-tight">
                  {principle.title}
                </h3>

                <p className="mt-4 text-sm leading-7 text-muted-foreground">
                  {principle.text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Dashboard preview */}
      <section
        id="preview"
        className="border-b border-border bg-surface-alt"
      >
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
                Your financial cockpit
              </p>

              <h2 className="mt-5 text-balance font-serif text-4xl tracking-[-0.03em] sm:text-5xl">
                See today’s money and tomorrow’s potential
                together.
              </h2>
            </div>

            <p className="max-w-sm text-sm leading-7 text-muted-foreground">
              The live dashboard uses your actual records. This
              preview is illustrative.
            </p>
          </div>

          <div className="mt-14 overflow-hidden rounded-[26px] border border-border bg-surface shadow-[0_30px_100px_-55px_rgba(35,44,92,0.45)]">
            <div className="flex flex-col gap-4 border-b border-border px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  September overview
                </p>
                <h3 className="mt-2 font-serif text-2xl">
                  Investment readiness
                </h3>
              </div>

              <span className="w-fit rounded-full bg-success-tint px-4 py-2 text-xs font-medium text-success">
                Financial base progressing
              </span>
            </div>

            <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Monthly income",
                  value: "17,000 MAD",
                  detail: "Base + additional",
                  color: "text-foreground",
                },
                {
                  label: "Potential to invest",
                  value: "3,400 MAD",
                  detail: "After EF recommendation",
                  color: "text-brand",
                },
                {
                  label: "Investments contributed",
                  value: "42,000 MAD",
                  detail: "Recorded capital",
                  color: "text-success",
                },
                {
                  label: "Debt remaining",
                  value: "47,000 MAD",
                  detail: "Across active debts",
                  color: "text-danger",
                },
              ].map((metric) => (
                <div
                  key={metric.label}
                  className="bg-surface p-6 sm:p-8"
                >
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    {metric.label}
                  </p>
                  <p
                    className={`mt-5 font-serif text-2xl ${metric.color}`}
                  >
                    {metric.value}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {metric.detail}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[20px] bg-background p-6">
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-gold">
                      Contribution trajectory
                    </p>
                    <h4 className="mt-2 font-serif text-xl">
                      Capital built over time
                    </h4>
                  </div>

                  <LineChart
                    className="h-6 w-6 text-brand"
                    aria-hidden="true"
                  />
                </div>

                <div className="mt-6">
                  <GrowthIllustration />
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[20px] bg-brand p-6 text-white">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/55">
                    Emergency fund
                  </p>
                  <p className="mt-4 font-serif text-3xl">
                    82%
                  </p>

                  <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15">
                    <div className="h-full w-[82%] rounded-full bg-[#E3B565]" />
                  </div>

                  <p className="mt-4 text-xs leading-6 text-white/65">
                    Close to unlocking the full investing
                    recommendation.
                  </p>
                </div>

                <div className="rounded-[20px] border border-border bg-surface-alt p-6">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Budget remaining
                  </p>

                  <div className="mt-5 space-y-5">
                    <div>
                      <div className="flex justify-between gap-4 text-sm">
                        <span>Essentials</span>
                        <span className="font-mono">
                          2,100 MAD
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-border">
                        <div className="h-full w-[42%] rounded-full bg-brand-mid" />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between gap-4 text-sm">
                        <span>Lifestyle</span>
                        <span className="font-mono">
                          950 MAD
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-border">
                        <div className="h-full w-[63%] rounded-full bg-gold" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Investor notes */}
      <section
        id="wisdom"
        className="border-b border-border bg-surface"
      >
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
          <div className="max-w-3xl">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
              Investor notes
            </p>

            <h2 className="mt-5 text-balance font-serif text-4xl tracking-[-0.03em] sm:text-5xl">
              Principles worth keeping close.
            </h2>

            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Not predictions. Not shortcuts. Just reminders
              from investors known for thinking seriously
              about value, learning, and risk.
            </p>
          </div>

          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {INVESTOR_NOTES.map((note, index) => (
              <article
                key={note.author}
                className="flex min-h-[390px] flex-col rounded-[22px] border border-border bg-surface-alt p-7 sm:p-8"
              >
                <div className="flex items-center justify-between">
                  <span className="font-serif text-5xl leading-none text-gold/45">
                    “
                  </span>

                  <span className="font-mono text-xs text-muted-foreground">
                    0{index + 1}
                  </span>
                </div>

                <blockquote className="mt-8 font-serif text-2xl leading-relaxed">
                  {note.quote}
                </blockquote>

                <div className="mt-auto pt-10">
                  <p className="text-sm font-medium">
                    {note.author}
                  </p>

                  <a
                    href={note.href}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs text-brand underline decoration-brand/25 underline-offset-4 hover:decoration-brand"
                  >
                    {note.source}
                  </a>

                  <p className="mt-5 border-t border-border pt-5 text-xs leading-6 text-muted-foreground">
                    {note.lesson}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-background">
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand/10"
          aria-hidden="true"
        />

        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/15"
          aria-hidden="true"
        />

        <div className="relative mx-auto flex min-h-[590px] max-w-5xl flex-col items-center justify-center px-5 py-24 text-center sm:px-8">
          <PiggyBank
            className="h-10 w-10 text-gold"
            aria-hidden="true"
          />

          <p className="mt-8 text-xs font-medium uppercase tracking-[0.24em] text-gold">
            Start with clarity
          </p>

          <h2 className="mt-5 text-balance font-serif text-5xl tracking-[-0.04em] sm:text-6xl">
            Your next investment starts with the decisions you
            make today.
          </h2>

          <p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground">
            Track the money. Strengthen the foundation. Build
            the habit. Let every dirham move with intention.
          </p>

          <Link
            href="/login"
            className="group mt-10 inline-flex items-center gap-2 rounded-full bg-brand px-8 py-4 text-sm font-medium text-white transition-all hover:-translate-y-0.5 hover:bg-brand-hover hover:shadow-lg"
          >
            Continue to Nisba
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-1"
              aria-hidden="true"
            />
          </Link>

          <p className="mt-6 max-w-xl text-xs leading-6 text-muted-foreground">
            Nisba is an educational and organizational tool.
            It does not guarantee returns or provide
            individualized financial advice.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Link
            href="/"
            className="flex items-center gap-3 text-brand"
          >
            <LogoMark className="h-6 w-6" />
            <span className="font-serif text-lg text-foreground">
              Nisba
            </span>
          </Link>

          <p className="max-w-xl text-xs leading-6 text-muted-foreground">
            A Morocco-focused system for clearer money
            decisions and disciplined investing.
          </p>

          <Link
            href="/login"
            className="text-sm font-medium text-brand underline decoration-brand/25 underline-offset-4"
          >
            Log in
          </Link>
        </div>
      </footer>
    </main>
  );
}