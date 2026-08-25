"use client";

import { useQuery } from "@tanstack/react-query";
import { getHealth } from "@/lib/api";

export default function Home() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">Personal Finance & Budget Tracker</h1>
      <p>
        Backend status:{" "}
        {isLoading ? "checking..." : isError ? "unreachable" : data?.status}
      </p>
    </main>
  );
}
