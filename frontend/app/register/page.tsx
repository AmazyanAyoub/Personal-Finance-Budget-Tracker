import Link from "next/link";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Account creation is coming soon</h1>
      <p className="text-muted-foreground max-w-sm">
        Registration isn't open yet — this app is currently single-user.
      </p>
      <Link href="/login" className="bg-brand hover:bg-brand-hover text-white px-4 py-2 rounded-[10px] text-sm">
        Log in instead
      </Link>
    </main>
  );
}
