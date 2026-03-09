"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export default function ElectronAuthSuccess() {
  const searchParams = useSearchParams();
  const [launched, setLaunched] = useState(false);

  const openApp = useCallback(() => {
    const token = searchParams.get("token");
    if (!token) {
      return;
    }
    window.location.href = `chatjs:///auth/callback?token=${encodeURIComponent(token)}`;
    setLaunched(true);
  }, [searchParams]);

  useEffect(() => {
    // Small delay so the page renders before the browser shows the open-app dialog.
    const t = setTimeout(openApp, 600);
    return () => clearTimeout(t);
  }, [openApp]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 text-center">
      <div className="space-y-2">
        <h1 className="font-semibold text-2xl">Signed in successfully!</h1>
        <p className="text-muted-foreground text-sm">
          {launched
            ? "You can close this tab — ChatJS is opening."
            : "Opening ChatJS\u2026"}
        </p>
        <p className="text-muted-foreground text-xs">
          If nothing happens, open the packaged ChatJS app and try again. macOS
          custom protocol links do not register reliably from `electron .` in
          development.
        </p>
      </div>
      {launched && (
        <Button onClick={openApp} size="sm" variant="outline">
          Open ChatJS again
        </Button>
      )}
    </div>
  );
}
