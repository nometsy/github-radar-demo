"use client";

import * as React from "react";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "panel tech-corners flex flex-col items-center justify-center gap-3 rounded-xl px-6 py-14 text-center",
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full border border-border/70 bg-muted/60">
        <Icon className="size-5 text-muted-foreground" aria-hidden />
      </span>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="max-w-xl text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Request failed",
  message,
  onRetry,
  className,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "panel flex flex-col items-center justify-center gap-3 rounded-xl border-[color:var(--destructive)]/30 px-6 py-12 text-center",
        className,
      )}
      role="alert"
    >
      <span className="flex size-12 items-center justify-center rounded-full border border-[color:var(--destructive)]/40 bg-[color:var(--destructive)]/10">
        <AlertTriangle
          className="size-5 text-[color:var(--destructive)]"
          aria-hidden
        />
      </span>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="max-w-xl text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="size-3.5" aria-hidden />
          Retry
        </Button>
      )}
    </div>
  );
}

export function InlineNote({
  children,
  tone = "muted",
  className,
}: {
  children: React.ReactNode;
  tone?: "muted" | "warning" | "success";
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-relaxed",
        tone === "muted" && "border-border/70 bg-muted/40 text-muted-foreground",
        tone === "warning" &&
          "border-[color:var(--warning)]/35 bg-[color:var(--warning)]/8 text-[color:var(--warning)]",
        tone === "success" &&
          "border-primary/35 bg-primary/8 text-[color:var(--primary)]",
        className,
      )}
    >
      {children}
    </p>
  );
}
