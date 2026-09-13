"use client";

import { useState } from "react";
import Link from "next/link";

function formatMAD(n: number) {
  return Math.round(n).toLocaleString("en-US") + " MAD";
}

function LogoMark({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <g transform="rotate(-90 12 12)">
        <circle cx="12" cy="12" r="9" fill="none" className="stroke-border" strokeWidth="3.4" />
        <circle cx="12" cy="12" r="9" fill="none" className="stroke-brand" strokeWidth="3.4" strokeDasharray="16.96 39.55" strokeLinecap="round" />
        <circle cx="12" cy="12" r="9" fill="none" className="stroke-brand-mid" strokeWidth="3.4" strokeDasharray="31.10 25.41" strokeDashoffset="-16.96" strokeLinecap="round" />
        <circle cx="12" cy="12" r="9" fill="none" className="stroke-gold" strokeWidth="3.4" strokeDasharray="8.48 48.03" strokeDashoffset="-48.06" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export default function LandingPage() {
  const [income, setIncome] = useState(10000);
  const [cushionState, setCushionState] = useState<"building" | "complete">("building");

  const freedom = income * 0.3;
  const essentials = income * 0.55;
  const lifestyle = income * 0.15;

  return (
    <div className="flex flex-col">
      {/* ================= NAV ================= */}
      <header className="w-full border-b border-border bg-surface/80 backdrop-blur sticky top-0 z-30">
        <nav className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark />
            <span className="font-serif text-xl font-medium tracking-tight">Nisba</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-[15px] text-muted-foreground">
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#emergency-fund" className="hover:text-foreground transition-colors">Emergency fund</a>
            <a href="#dashboard-preview" className="hover:text-foreground transition-colors">Dashboard</a>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/login" className="text-[15px] text-muted-foreground hover:text-foreground transition-colors">Log in</Link>
            <Link href="/register" className="text-[15px] bg-brand hover:bg-brand-hover text-white px-5 py-2.5 rounded-[10px] transition-colors">Create account</Link>
          </div>
        </nav>
      </header>

      {/* ================= HERO ================= */}
      <section className="relative w-full hero-mesh overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 py-24 md:py-32 flex flex-col lg:flex-row items-center gap-16 relative z-10">
          <div className="flex flex-col gap-7 flex-1 max-w-xl">
            <h1 className="rise-in rise-in-1 font-serif text-5xl md:text-6xl leading-[1.08] tracking-tight">Give every dirham a job.</h1>
            <p className="rise-in rise-in-2 text-lg text-muted-foreground leading-relaxed max-w-md">
              Set three percentages once. Nisba splits every dirham the moment it lands, builds your safety cushion first, then starts moving itself into investing and debt.
            </p>
            <div className="rise-in rise-in-3 flex items-center gap-5">
              <Link href="/register" className="bg-brand hover:bg-brand-hover text-white px-6 py-3.5 rounded-[10px] text-[15px] transition-colors">Create account</Link>
              <Link href="/login" className="text-[15px] text-muted-foreground hover:text-foreground transition-colors">Log in</Link>
            </div>
            <p className="rise-in rise-in-4 text-sm text-muted-foreground flex items-center gap-2">
              <svg viewBox="0 0 16 16" className="w-4 h-4 shrink-0 stroke-muted-foreground" fill="none">
                <path d="M8 1.5l5.5 2.2v3.6c0 3.6-2.35 6.7-5.5 7.7-3.15-1-5.5-4.1-5.5-7.7V3.7L8 1.5z" strokeWidth="1.2" strokeLinejoin="round" />
              </svg>
              Free to start. No bank connection required.
            </p>
          </div>

          <div className="rise-in rise-in-5 border border-border rounded-[10px] bg-surface p-7 flex flex-col gap-6 w-full max-w-sm shadow-[0_1px_2px_rgba(28,27,24,0.04),0_8px_24px_-8px_rgba(28,27,24,0.08)]">
            <div className="flex flex-col gap-2">
              <label htmlFor="income-input" className="text-sm text-muted-foreground">Monthly income (MAD)</label>
              <input
                id="income-input"
                type="number"
                min={0}
                value={income}
                onChange={(e) => setIncome(Number(e.target.value) || 0)}
                className="border border-border rounded-[10px] px-4 py-3 font-mono tabular-nums text-xl bg-background focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
              />
            </div>

            <div className="flex items-center justify-center py-2">
              <div className="relative w-40 h-40">
                <svg viewBox="0 0 200 200" className="w-40 h-40">
                  <g transform="rotate(-90 100 100)">
                    <circle cx="100" cy="100" r="80" fill="none" className="stroke-border" strokeWidth="22" />
                    <circle cx="100" cy="100" r="80" fill="none" className="stroke-brand" strokeWidth="22" strokeDasharray="150.80 351.86" strokeLinecap="round" />
                    <circle cx="100" cy="100" r="80" fill="none" className="stroke-brand-mid" strokeWidth="22" strokeDasharray="276.46 226.19" strokeDashoffset="-150.80" strokeLinecap="round" />
                    <circle cx="100" cy="100" r="80" fill="none" className="stroke-gold" strokeWidth="22" strokeDasharray="75.40 427.26" strokeDashoffset="-427.26" strokeLinecap="round" />
                  </g>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs text-muted-foreground">split into</span>
                  <span className="font-serif text-2xl">3</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 font-mono tabular-nums text-[15px]">
              <div className="flex justify-between items-center">
                <span className="font-sans flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-brand shrink-0" />Freedom Funds</span>
                <span>{formatMAD(freedom)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-sans flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-brand-mid shrink-0" />Essentials</span>
                <span>{formatMAD(essentials)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-sans flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-gold shrink-0" />Lifestyle</span>
                <span>{formatMAD(lifestyle)}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">Example split (30/55/15). Yours is fully custom at signup.</p>
          </div>
        </div>
      </section>

      {/* ================= WHERE YOUR DIRHAM GOES ================= */}
      <section id="how-it-works" className="relative w-full bg-surface-alt ring-watermark">
        <div className="max-w-6xl mx-auto px-6 py-24 flex flex-col gap-12 relative">
          <div className="flex flex-col gap-4 max-w-2xl">
            <h2 className="font-serif text-3xl md:text-4xl tracking-tight">One split, three jobs.</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">Every dirham gets sorted the instant it arrives. No monthly math, no spreadsheet, no decision to make twice.</p>
          </div>

          <div className="flex w-full h-3 rounded-full overflow-hidden">
            <div className="bg-brand" style={{ width: "30%" }} />
            <div className="bg-brand-mid" style={{ width: "55%" }} />
            <div className="bg-gold" style={{ width: "15%" }} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="border border-border rounded-[10px] bg-surface p-6 flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-brand" />
                <span className="font-medium text-lg">Freedom Funds</span>
              </div>
              <span className="text-sm text-muted-foreground font-mono tabular-nums">20-40%</span>
              <p className="text-[15px] text-muted-foreground leading-relaxed">Investing and debt repayment, once your safety cushion is covered.</p>
            </div>
            <div className="border border-border rounded-[10px] bg-surface p-6 flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-brand-mid" />
                <span className="font-medium text-lg">Essentials</span>
              </div>
              <span className="text-sm text-muted-foreground font-mono tabular-nums">50-60%</span>
              <p className="text-[15px] text-muted-foreground leading-relaxed">Rent, groceries, bills. The costs that don't move.</p>
            </div>
            <div className="border border-border rounded-[10px] bg-surface p-6 flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-gold" />
                <span className="font-medium text-lg">Lifestyle</span>
              </div>
              <span className="text-sm text-muted-foreground font-mono tabular-nums">10-20%</span>
              <p className="text-[15px] text-muted-foreground leading-relaxed">Yours to spend freely, tracked automatically.</p>
            </div>
          </div>

          <div id="emergency-fund" className="flex items-center gap-3 pt-4">
            <svg viewBox="0 0 16 16" className="w-4 h-4 shrink-0 stroke-brand" fill="none">
              <path d="M8 2v10.5M8 12.5l-4-4M8 12.5l4-4" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[15px] text-muted-foreground">Freedom Funds has a first job before any of that:</span>
          </div>

          <div className="border border-border rounded-[10px] bg-surface p-8 md:p-9 flex flex-col gap-7">
            <div className="flex flex-col gap-3">
              <h3 className="font-serif text-2xl">Your safety cushion, funded first.</h3>
              <p className="text-[15px] text-muted-foreground leading-relaxed max-w-2xl">
                Before any investing or debt repayment happens, Freedom Funds builds a 3-6 month Essentials cushion. The target is set once at the start and never quietly recalculated. Once it's hit, the same money starts moving into investments and debt automatically.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setCushionState("building")}
                className={`px-5 py-2.5 rounded-[10px] text-[15px] border transition-colors ${
                  cushionState === "building" ? "bg-brand text-white border-brand" : "border-border text-muted-foreground"
                }`}
              >
                Building the cushion
              </button>
              <button
                onClick={() => setCushionState("complete")}
                className={`px-5 py-2.5 rounded-[10px] text-[15px] border transition-colors ${
                  cushionState === "complete" ? "bg-brand text-white border-brand" : "border-border text-muted-foreground"
                }`}
              >
                Cushion complete
              </button>
            </div>

            <div className="border border-border rounded-[10px] bg-surface-alt p-7">
              {cushionState === "building" ? (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                  <div className="flex-1 w-full h-3 bg-border rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-brand" style={{ width: "45%" }} />
                  </div>
                  <span className="text-muted-foreground text-lg hidden sm:block">→</span>
                  <div className="border border-border rounded-[10px] px-5 py-2.5 text-[15px] whitespace-nowrap bg-brand-tint text-brand">
                    Emergency fund, 45%
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                  <div className="border border-border rounded-[10px] px-5 py-2.5 text-[15px] whitespace-nowrap bg-success-tint text-success">
                    Emergency fund, funded
                  </div>
                  <span className="text-muted-foreground text-lg hidden sm:block">→</span>
                  <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
                    <div className="border border-border rounded-[10px] px-5 py-2.5 text-[15px] bg-surface">Investments</div>
                    <div className="border border-border rounded-[10px] px-5 py-2.5 text-[15px] bg-surface">Debt</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ================= DASHBOARD PREVIEW ================= */}
      <section id="dashboard-preview" className="w-full">
        <div className="max-w-6xl mx-auto px-6 py-24 flex flex-col gap-10">
          <div className="flex flex-col gap-4 max-w-2xl">
            <h2 className="font-serif text-3xl md:text-4xl tracking-tight">One dashboard, five numbers that matter.</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">Savings, emergency fund progress, what's left to spend, what's invested, what's owed. One glance, not five apps.</p>
          </div>

          <div className="border border-border rounded-[10px] bg-surface p-8 shadow-[0_1px_2px_rgba(28,27,24,0.04),0_8px_24px_-8px_rgba(28,27,24,0.08)] flex flex-col gap-10">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-6">
              <div className="flex flex-col gap-1.5">
                <span className="text-sm text-muted-foreground">Savings</span>
                <span className="font-mono tabular-nums font-medium text-lg">8,400 MAD</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm text-muted-foreground">Emergency fund</span>
                <span className="font-mono tabular-nums font-medium text-lg">56%</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm text-muted-foreground">Available this month</span>
                <span className="font-mono tabular-nums font-medium text-lg">2,150 MAD</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm text-muted-foreground">Investments</span>
                <span className="font-mono tabular-nums font-medium text-lg">3,200 MAD</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm text-muted-foreground">Debt</span>
                <span className="font-mono tabular-nums font-medium text-lg">4,000 MAD</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
              <div className="flex flex-col gap-4">
                <span className="text-[15px] text-muted-foreground">Spending by category</span>
                {[
                  { name: "Groceries", pct: 80 },
                  { name: "Rent", pct: 100 },
                  { name: "Dining out", pct: 45 },
                  { name: "Transport", pct: 30 },
                ].map((c) => (
                  <div key={c.name} className="flex items-center gap-3">
                    <span className="w-24 text-[15px] shrink-0">{c.name}</span>
                    <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-brand-mid" style={{ width: `${c.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-4">
                <span className="text-[15px] text-muted-foreground">Income vs expenses</span>
                <div className="flex items-end gap-8 h-36">
                  <div className="flex flex-col items-center gap-2.5">
                    <div className="w-12 rounded-t-[6px] bg-success" style={{ height: "110px" }} />
                    <span className="text-sm text-muted-foreground">Income</span>
                  </div>
                  <div className="flex flex-col items-center gap-2.5">
                    <div className="w-12 rounded-t-[6px] bg-danger" style={{ height: "68px" }} />
                    <span className="text-sm text-muted-foreground">Expenses</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= NO BANK CONNECTION ================= */}
      <section className="w-full bg-surface-alt">
        <div className="max-w-6xl mx-auto px-6 py-24 flex flex-col gap-12">
          <div className="flex flex-col gap-4 max-w-2xl">
            <h2 className="font-serif text-3xl md:text-4xl tracking-tight">No bank connection. That's on purpose.</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">Investments and debt are logged by you, not pulled from a linked account.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div className="flex flex-col gap-3">
              <svg viewBox="0 0 24 24" className="w-7 h-7 stroke-brand" fill="none">
                <path d="M12 2l7 3v5.5c0 4.9-3.2 9.1-7 10.5-3.8-1.4-7-5.6-7-10.5V5l7-3z" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
              <span className="font-medium text-lg">Private by default</span>
              <p className="text-[15px] text-muted-foreground leading-relaxed">Nothing to breach because nothing's connected in the first place.</p>
            </div>
            <div className="flex flex-col gap-3">
              <svg viewBox="0 0 24 24" className="w-7 h-7 stroke-brand" fill="none">
                <path d="M4 20l3.5-1L18.5 8 15.5 5 4.5 16 4 20z" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
              <span className="font-medium text-lg">Numbers you trust</span>
              <p className="text-[15px] text-muted-foreground leading-relaxed">Exactly what you enter, never a miscategorized transaction feed.</p>
            </div>
            <div className="flex flex-col gap-3">
              <svg viewBox="0 0 24 24" className="w-7 h-7 stroke-brand" fill="none">
                <rect x="3" y="10" width="18" height="10" rx="1.5" strokeWidth="1.4" />
                <path d="M7 10V7a5 5 0 0110 0v3" strokeWidth="1.4" />
              </svg>
              <span className="font-medium text-lg">Works with any account</span>
              <p className="text-[15px] text-muted-foreground leading-relaxed">Moroccan broker, foreign bank, cash. If you can count it, Nisba can track it.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= QUOTE / BOOK CREDIT ================= */}
      <section className="w-full relative overflow-hidden bg-gold-tint">
        <svg viewBox="0 0 200 160" className="absolute -right-10 -top-10 w-64 h-52 opacity-30 pointer-events-none fill-gold" fill="none">
          <path d="M20 100 Q20 50 70 40 L75 55 Q45 65 45 95 Q45 110 60 110 Q75 110 75 95 Q75 82 60 80 L60 65 Q95 68 95 100 Q95 125 65 125 Q20 125 20 100Z" />
        </svg>
        <div className="max-w-4xl mx-auto px-6 py-20 flex flex-col gap-8 relative">
          <p className="font-serif text-2xl md:text-3xl leading-snug text-brand">"Risk comes from not knowing what you are doing."</p>
          <span className="text-[15px] text-muted-foreground">— Warren Buffett</span>
          <div className="w-10 h-px bg-gold" />
          <p className="text-[15px] text-muted-foreground leading-relaxed max-w-xl">
            Nisba's percentage split is built on the method in <span className="italic">From Dirhams to Dreams</span> by Zouhir Chbakou, on breaking the silence around money in Morocco.
          </p>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="w-full bg-brand text-white">
        <div className="max-w-6xl mx-auto px-6 py-24 flex flex-col items-start gap-7">
          <h2 className="font-serif text-3xl md:text-4xl tracking-tight">Start giving your dirhams a job.</h2>
          <Link href="/register" className="bg-white text-brand px-6 py-3.5 rounded-[10px] text-[15px] font-medium hover:bg-white/90 transition-colors">
            Create account
          </Link>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="w-full border-t border-border bg-surface">
        <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col sm:flex-row justify-between gap-8">
          <div className="flex flex-col gap-1.5">
            <span className="font-serif text-lg font-medium">Nisba</span>
            <span className="text-[15px] text-muted-foreground">Give every dirham a job.</span>
          </div>
          <div className="flex gap-8 text-[15px] text-muted-foreground">
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#emergency-fund" className="hover:text-foreground transition-colors">Emergency fund</a>
            <a href="#dashboard-preview" className="hover:text-foreground transition-colors">Dashboard</a>
          </div>
          <span className="text-sm text-muted-foreground">Built by Ayoub Amazyan</span>
        </div>
      </footer>
    </div>
  );
}
