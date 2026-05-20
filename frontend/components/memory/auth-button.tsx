"use client";

import Link from "next/link";
import { LogIn, LogOut, Settings, UserCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type AuthUser = {
  email?: string;
  name?: string;
};

export function AuthButton() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    let supabase: ReturnType<typeof createClient>;

    try {
      supabase = createClient();
    } catch {
      setReady(true);
      setUser(null);
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUser({
        email: data.user?.email ?? undefined,
        name: (data.user?.user_metadata?.name as string | undefined) ?? undefined
      });
      setReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(
        session?.user
          ? {
              email: session.user.email ?? undefined,
              name: (session.user.user_metadata?.name as string | undefined) ?? undefined
            }
          : null
      );
      setReady(true);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signIn() {
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return;
    }
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  }

  if (!ready) {
    return (
      <Button variant="ghost" size="icon" aria-label="Loading user">
        <UserCircle className="h-5 w-5" />
      </Button>
    );
  }

  if (!user) {
    return (
      <Button variant="quiet" onClick={signIn}>
        <LogIn className="h-4 w-4" />
        Google
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Button asChild variant="ghost" size="icon" title="Settings">
        <Link href="/settings">
          <Settings className="h-4 w-4" />
        </Link>
      </Button>
      <Button variant="ghost" onClick={signOut} title={user.email ?? "Sign out"}>
        <UserCircle className="h-5 w-5" />
        <span className="hidden max-w-28 truncate sm:inline">{user.name ?? user.email}</span>
        <LogOut className="h-4 w-4 text-slate-400" />
      </Button>
    </div>
  );
}
