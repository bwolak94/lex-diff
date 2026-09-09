"use client";

// B-5: Magic-link callback — receives ?token= from email link,
// exchanges it for a session token, stores in localStorage, redirects home.

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { verifyMagicLinkToken } from "@/lib/api";

const SESSION_KEY = "lexdiff_session";

export default function AuthCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setError("No token provided.");
      return;
    }
    verifyMagicLinkToken(token)
      .then(({ sessionToken }) => {
        localStorage.setItem(SESSION_KEY, sessionToken);
        router.replace("/");
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Invalid or expired link.");
      });
  }, [params, router]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-sm w-full text-center space-y-4">
          <h1 className="text-xl font-bold text-red-600">Sign-in failed</h1>
          <p className="text-slate-600 text-sm">{error}</p>
          <a href="/login" className="text-blue-600 underline text-sm">
            Try again
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <p className="text-slate-500">Signing you in…</p>
    </main>
  );
}
