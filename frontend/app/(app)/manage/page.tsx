import Link from "next/link";

const SECTIONS = [
  {
    number: "01",
    title: "Money activity",
    description: "Record income, spending, transfers, and balance corrections.",
    href: "/money",
    color: "bg-brand",
  },
  {
    number: "02",
    title: "Debts",
    description: "Track balances and payments as part of Essentials.",
    href: "/debts",
    color: "bg-gold",
  },
  {
    number: "03",
    title: "Goals",
    description:
      "Reserve money for your emergency fund, travel, taxes, and future plans.",
    href: "/goals",
    color: "bg-brand-mid",
  },
  {
    number: "04",
    title: "Investments",
    description: "Keep a record of your investments.",
    href: "/investments",
    color: "bg-success",
  },
];

export default function ManagePage() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
        Your money
      </p>
      <h1 className="mt-4 font-serif text-4xl tracking-tight">
        What would you like to manage?
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
        Choose an area to view its records or make an update. Your dashboard
        brings everything together afterward.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="group rounded-[18px] border border-border bg-surface p-6 transition-all hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[0_12px_30px_-20px_rgba(35,44,92,0.35)]"
          >
            <div className="flex items-start justify-between">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-[10px] ${section.color} font-mono text-xs text-white`}
              >
                {section.number}
              </span>
              <span className="text-xl text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-brand">
                →
              </span>
            </div>

            <h2 className="mt-7 font-serif text-2xl">{section.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {section.description}
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-8 rounded-[16px] border border-border bg-brand-tint p-6">
        <p className="text-sm font-medium text-brand">
          Your plan stays yours.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Nisba records what you enter and offers guidance. It does not move
          money or make payments for you.
        </p>
      </div>
    </div>
  );
}
