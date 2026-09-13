"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearToken } from "@/lib/auth";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/income", label: "Income" },
  { href: "/expenses", label: "Expenses" },
  { href: "/debts", label: "Debts" },
  { href: "/investments", label: "Investments" },
  { href: "/emergency-fund", label: "Emergency Fund" },
];

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 flex flex-col gap-1 px-3 py-6">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={`px-3 py-2.5 rounded-[10px] text-base ${
              active
                ? "bg-brand-tint text-brand font-medium"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden sm:flex w-60 shrink-0 border-r border-border bg-surface flex-col h-screen sticky top-0">
        <div className="px-6 py-6 border-b border-border">
          <Link href="/dashboard" className="text-xl font-medium">Nisba</Link>
        </div>
        <NavLinks pathname={pathname} />
        <div className="px-3 py-6 border-t border-border">
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2.5 rounded-[10px] text-base text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            Log out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="sm:hidden w-full border-b border-border bg-surface flex items-center justify-between px-4 h-16 sticky top-0 z-20">
        <Link href="/dashboard" className="text-lg font-medium">Nisba</Link>
        <button
          onClick={() => setOpen(!open)}
          className="text-base text-muted-foreground border border-border rounded-[10px] px-3 py-1.5"
        >
          Menu
        </button>
      </div>
      {open && (
        <div className="sm:hidden fixed inset-0 top-16 bg-background z-10 flex flex-col">
          <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
          <div className="px-3 py-6 border-t border-border">
            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2.5 rounded-[10px] text-base text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </>
  );
}
