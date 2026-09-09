"use client";

// B-5: Auth state management hook.
// Reads/writes the session token from localStorage and fetches /auth/me.

import { useState, useEffect, useCallback } from "react";
import { getMe, logout as apiLogout } from "@/lib/api";
import type { User } from "@/lib/api";

const SESSION_KEY = "lexdiff_session";

export interface AuthState {
  user: User | null;
  loading: boolean;
  sessionToken: string | null;
  logout: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(SESSION_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    setSessionToken(token);
    getMe(token)
      .then(setUser)
      .catch(() => {
        localStorage.removeItem(SESSION_KEY);
        setSessionToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const logout = useCallback(async () => {
    if (sessionToken) {
      await apiLogout(sessionToken).catch(() => {});
    }
    localStorage.removeItem(SESSION_KEY);
    setSessionToken(null);
    setUser(null);
  }, [sessionToken]);

  return { user, loading, sessionToken, logout };
}
