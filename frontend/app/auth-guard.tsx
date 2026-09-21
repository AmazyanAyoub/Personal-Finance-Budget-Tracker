"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";

function subscribe() {
  return () => {};
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isClient = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot
  );

  const token = isClient ? getToken() : null;

  useEffect(() => {
    if (isClient && !token) {
      router.replace("/login");
    }
  }, [isClient, token, router]);

  if (!isClient || !token) {
    return null;
  }

  return <>{children}</>;
}