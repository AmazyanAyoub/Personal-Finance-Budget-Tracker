"use client";

import {
  useEffect,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { ApiError, getMe } from "@/lib/api";
import {
  clearToken,
  getToken,
} from "@/lib/auth";

function subscribe() {
  return () => {};
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

export function AuthGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  const isClient = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot
  );

  const token = isClient ? getToken() : null;

  const {
    data: currentUser,
    error,
    isPending,
    refetch,
  } = useQuery({
    queryKey: ["current-user", token],
    queryFn: () => getMe(token!),
    enabled: isClient && Boolean(token),
    retry: false,
    staleTime: 60_000,
  });

  const unauthorized =
    error instanceof ApiError &&
    error.status === 401;

  useEffect(() => {
    if (!isClient) return;

    if (!token || unauthorized) {
      clearToken();
      router.replace("/login");
    }
  }, [
    isClient,
    token,
    unauthorized,
    router,
  ]);

  if (
    !isClient ||
    !token ||
    unauthorized ||
    isPending
  ) {
    return null;
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-[20px] border border-border bg-surface p-8 text-center">
          <h1 className="font-serif text-2xl">
            Could not verify your session
          </h1>

          <p className="mt-3 text-sm text-muted-foreground">
            Check that the backend is running, then try
            again.
          </p>

          <button
            type="button"
            onClick={() => refetch()}
            className="mt-6 rounded-[10px] bg-brand px-5 py-3 text-sm font-medium text-white hover:bg-brand-hover"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (!currentUser) {
    return null;
  }

  return <>{children}</>;
}