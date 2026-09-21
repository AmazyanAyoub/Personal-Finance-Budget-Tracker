"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ApiError, getOnboardingStatus } from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";
import { AuthGuard } from "../auth-guard";
import { Sidebar } from "../sidebar";

function LoadingScreen({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex max-w-sm flex-col items-center text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-brand" />
        <h1 className="mt-6 font-serif text-2xl">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </main>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const token = getToken();

  const {
    data: onboarding,
    error,
    isPending,
    refetch,
  } = useQuery({
    queryKey: ["onboarding-status"],
    queryFn: () => getOnboardingStatus(token!),
    enabled: Boolean(token),
    retry: false,
  });

  const sessionExpired =
    error instanceof ApiError && error.status === 401;

  useEffect(() => {
    if (sessionExpired) {
      clearToken();
      router.replace("/login");
      return;
    }

    if (onboarding && !onboarding.is_onboarded) {
      router.replace("/onboarding");
    }
  }, [sessionExpired, onboarding, router]);

  if (sessionExpired) {
    return (
      <LoadingScreen
        title="Your session has expired"
        description="Redirecting you to the login page…"
      />
    );
  }

  if (isPending) {
    return (
      <LoadingScreen
        title="Loading your account"
        description="Preparing your financial overview…"
      />
    );
  }

  if (onboarding && !onboarding.is_onboarded) {
    return (
      <LoadingScreen
        title="Preparing your setup"
        description="Redirecting you to onboarding…"
      />
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <div
          role="alert"
          className="w-full max-w-md rounded-[20px] border border-border bg-surface p-8 text-center"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-danger-tint text-danger">
            !
          </div>
          <h1 className="mt-6 font-serif text-2xl">
            Could not load your account
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Check that the backend is running and that your connection is
            available.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-6 rounded-[10px] bg-brand px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1 p-5 sm:p-6 md:p-8 lg:p-10">
        {children}
      </main>
    </div>
  );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}