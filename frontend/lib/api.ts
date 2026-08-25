const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function getHealth() {
  const res = await fetch(`${API_URL}/health`);
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.status}`);
  }
  return res.json() as Promise<{ status: string }>;
}
