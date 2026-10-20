"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[github-radar] Route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <span className="flex size-14 items-center justify-center rounded-full border border-[color:var(--destructive)]/40 bg-[color:var(--destructive)]/10">
        <AlertTriangle
          className="size-6 text-[color:var(--destructive)]"
          aria-hidden
        />
      </span>
      <h1 className="text-2xl font-semibold">Radar signal lost</h1>
      <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
        {error.message ||
          "An unexpected error interrupted this view. The radar can retry without reloading the whole app."}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset} variant="default">
          <RefreshCw className="size-4" aria-hidden />
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="size-4" aria-hidden />
            Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}
