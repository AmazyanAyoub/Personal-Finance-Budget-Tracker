"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearToken } from "@/lib/auth";

const MONEY_PAGES = [
  "/manage",
  "/money",
  "/goals",
  "/debts",
  "/investments",
];

function Navigation({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const dashboardActive = pathname === "/dashboard";
  const manageActive = MONEY_PAGES.includes(pathname);
  const settingsActive = pathname === "/settings";

  return (
    <nav className="flex flex-1 flex-col px-4 py-8" aria-label="Main navigation">
      <p className="px-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Overview
      </p>

      <Link
        href="/dashboard"
        onClick={onNavigate}
        aria-current={dashboardActive ? "page" : undefined}
        className={`mt-4 rounded-[10px] px-4 py-3 text-sm transition-colors ${
          dashboardActive
            ? "bg-brand-tint font-medium text-brand"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        }`}
      >
        Dashboard
      </Link>

      <p className="mt-9 px-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Take action
      </p>

      <Link
        href="/manage"
        onClick={onNavigate}
        aria-current={manageActive ? "page" : undefined}
        className={`mt-4 rounded-[10px] px-4 py-3 text-sm transition-colors ${
          manageActive
            ? "bg-brand-tint font-medium text-brand"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        }`}
      >
        Manage money
      </Link>

      <Link
        href="/money"
        onClick={onNavigate}
        aria-current={pathname === "/money" ? "page" : undefined}
        className={`mt-2 rounded-[10px] px-4 py-3 text-sm transition-colors ${
          pathname === "/money"
            ? "bg-brand-tint font-medium text-brand"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        }`}
      >
        Money activity
      </Link>

      <Link
        href="/goals"
        onClick={onNavigate}
        aria-current={pathname === "/goals" ? "page" : undefined}
        className={`mt-2 rounded-[10px] px-4 py-3 text-sm transition-colors ${
          pathname === "/goals"
            ? "bg-brand-tint font-medium text-brand"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        }`}
      >
        Goals
      </Link>

      <Link
        href="/debts"
        onClick={onNavigate}
        aria-current={pathname === "/debts" ? "page" : undefined}
        className={`mt-2 rounded-[10px] px-4 py-3 text-sm transition-colors ${
          pathname === "/debts"
            ? "bg-brand-tint font-medium text-brand"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        }`}
      >
        Debts
      </Link>

      <Link
        href="/investments"
        onClick={onNavigate}
        aria-current={pathname === "/investments" ? "page" : undefined}
        className={`mt-2 rounded-[10px] px-4 py-3 text-sm transition-colors ${
          pathname === "/investments"
            ? "bg-brand-tint font-medium text-brand"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        }`}
      >
        Investments
      </Link>

      <p className="mt-3 px-4 text-xs leading-relaxed text-muted-foreground">
        Income, spending, allocations, debts, goals, and investments.
      </p>

      <Link
        href="/settings"
        onClick={onNavigate}
        aria-current={settingsActive ? "page" : undefined}
        className={`mt-3 rounded-[10px] px-4 py-3 text-sm transition-colors ${
          settingsActive
            ? "bg-brand-tint font-medium text-brand"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        }`}
      >
        Settings
      </Link>
    </nav>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function handleLogout() {
    setOpen(false);
    clearToken();
    router.replace("/login");
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="border-b border-border px-7 py-7">
          <Link href="/dashboard" className="font-serif text-2xl text-brand">
            Nisba
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">
            Give every dirham a job.
          </p>
        </div>

        <Navigation pathname={pathname} />

        <div className="border-t border-border p-4">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-[10px] px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            Log out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-surface px-5 md:hidden">
        <Link href="/dashboard" className="font-serif text-xl text-brand">
          Nisba
        </Link>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          className="rounded-[10px] border border-border px-3 py-2 text-sm"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      {open && (
        <div
          id="mobile-navigation"
          className="fixed inset-x-0 bottom-0 top-16 z-20 flex flex-col overflow-y-auto bg-surface md:hidden"
        >
          <Navigation
            pathname={pathname}
            onNavigate={() => setOpen(false)}
          />
          <div className="border-t border-border p-4">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full rounded-[10px] px-4 py-3 text-left text-sm text-muted-foreground hover:bg-secondary"
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </>
  );
}
