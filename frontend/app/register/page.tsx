import Link from "next/link";

export default function RegisterPage() {
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-2">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-brand px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute -right-48 -top-48 h-[700px] w-[700px] rounded-full border border-white/15"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-[470px] w-[470px] rounded-full border border-white/15"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute right-4 top-4 h-[230px] w-[230px] rounded-full border border-white/15"
          aria-hidden="true"
        />

        <Link href="/" className="relative flex w-fit items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/40">
            <span className="h-3 w-3 rounded-full bg-gold" />
          </span>
          <span className="font-serif text-2xl">Nisba</span>
        </Link>

        <div className="relative max-w-lg">
          <p className="mb-6 text-xs font-medium uppercase tracking-[0.25em] text-white/60">
            A more thoughtful way to budget
          </p>
          <h1 className="font-serif text-5xl leading-[1.1] tracking-tight xl:text-6xl">
            Make space for what matters.
          </h1>
          <p className="mt-7 max-w-md text-lg leading-relaxed text-white/70">
            A simple plan for today, a safety cushion for tomorrow, and a
            clearer path forward.
          </p>

          <div className="mt-12 grid max-w-md grid-cols-3 gap-2">
            <div className="h-2 rounded-full bg-white" />
            <div className="h-2 rounded-full bg-brand-mid" />
            <div className="h-2 rounded-full bg-gold" />
          </div>
          <div className="mt-4 flex max-w-md justify-between text-xs text-white/60">
            <span>Freedom Funds</span>
            <span>Essentials</span>
            <span>Lifestyle</span>
          </div>
        </div>

        <p className="relative text-sm text-white/50">
          Give every dirham a job.
        </p>
      </section>

      {/* Registration status */}
      <section className="flex min-h-screen flex-col px-6 py-8 sm:px-12 lg:px-16">
        <div className="flex items-center justify-between">
          <Link href="/" className="font-serif text-xl text-brand lg:hidden">
            Nisba
          </Link>
          <Link
            href="/"
            className="ml-auto text-sm text-muted-foreground transition-colors hover:text-brand"
          >
            ← Back to home
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-16">
          <div className="w-full max-w-md">
            <div className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-gold-tint">
              <span className="font-serif text-3xl text-gold">N</span>
            </div>

            <p className="mt-10 text-xs font-medium uppercase tracking-[0.2em] text-gold">
              Private preview
            </p>
            <h2 className="mt-4 font-serif text-4xl leading-tight tracking-tight">
              Account creation is coming later.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground">
              Nisba is currently a single-user app. Registration isn’t open
              yet, so there’s no signup form to complete right now.
            </p>

            <div className="mt-9 rounded-[16px] border border-border bg-surface p-6">
              <p className="text-sm font-medium text-foreground">
                Already have access?
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Log in to continue to your dashboard and financial plan.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex rounded-[10px] bg-brand px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
              >
                Go to login
              </Link>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Built by Ayoub Amazyan
        </p>
      </section>
    </main>
  );
}