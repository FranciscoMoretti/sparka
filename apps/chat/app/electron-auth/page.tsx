"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import authClient from "@/lib/auth-client";

// This page is opened in the user's default browser by the Electron app.
// It initiates the OAuth flow here so the state cookie is stored in the
// browser (not in Electron), which prevents the state_mismatch error.
export default function ElectronAuth() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const provider = searchParams.get("provider");
    if (
      provider === "google" ||
      provider === "github" ||
      provider === "vercel"
    ) {
      authClient.signIn.social({
        provider,
        callbackURL: "/api/auth/electron-callback",
      });
    }
  }, [searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground text-sm">
        Redirecting to sign in&hellip;
      </p>
    </div>
  );
}
