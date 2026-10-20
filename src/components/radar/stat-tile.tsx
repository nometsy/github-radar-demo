"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "default" | "primary" | "cyan" | "warning";
  className?: string;
}) {
  return (
    <div className={cn("panel tech-corners rounded-xl px-4 py-3.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow">{label}</p>
        {Icon && (
          <Icon
            className={cn(
              "size-4",
              tone === "default" && "text-muted-foreground",
              tone === "primary" && "text-primary",
              tone === "cyan" && "text-cyan",
              tone === "warning" && "text-[color:var(--warning)]",
            )}
          />
        )}
      </div>
      <p
        className={cn(
          "mt-2 font-mono text-2xl leading-none font-semibold tabular-nums",
          tone === "primary" && "text-primary",
          tone === "cyan" && "text-cyan",
          tone === "warning" && "text-[color:var(--warning)]",
        )}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
