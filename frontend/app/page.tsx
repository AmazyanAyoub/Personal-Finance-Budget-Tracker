"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getHealth, getMe } from "@/lib/api";
import { getToken, clearToken } from "@/lib/auth";
import { AuthGuard } from "./auth-guard";

function HomeContent() {
  const router = useRouter();
  const token = getToken();

  const { data: health } = useQuery({ queryKey: ["health"], queryFn: getHealth });
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => getMe(token!),
    enabled: !!token,
  });

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">Personal Finance & Budget Tracker</h1>
      <p>Backend status: {health?.status ?? "checking..."}</p>
      <p>Logged in as: {me?.email ?? "..."}</p>
      <button onClick={handleLogout} className="border rounded px-3 py-2">
        Log out
      </button>
    </main>
  );
}

export default function Home() {
  return (
    <AuthGuard>
      <HomeContent />
    </AuthGuard>
  );
}
