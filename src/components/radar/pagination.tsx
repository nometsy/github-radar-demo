"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PageHeading({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="max-w-3xl space-y-1.5">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="page-title font-semibold tracking-tight text-balance">
          {title}
        </h1>
        {description && (
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {children}
        </div>
      )}
    </header>
  );
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
  disabled,
  className,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  if (pageCount <= 1) return null;

  const candidates = new Set<number>([
    1,
    pageCount,
    page - 1,
    page,
    page + 1,
  ]);
  const pages = [...candidates]
    .filter((candidate) => candidate >= 1 && candidate <= pageCount)
    .sort((a, b) => a - b);

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex flex-wrap items-center justify-center gap-1.5",
        className,
      )}
    >
      <Button
        variant="outline"
        size="icon"
        className="tap-target size-9 sm:size-8"
        aria-label="Previous page"
        disabled={disabled || page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="size-4" />
      </Button>

      {pages.map((candidate, index) => {
        const previous = pages[index - 1];
        const gap = previous !== undefined && candidate - previous > 1;
        return (
          <React.Fragment key={candidate}>
            {gap && (
              <span className="px-1 font-mono text-xs text-muted-foreground">
                …
              </span>
            )}
            <Button
              variant={candidate === page ? "default" : "outline"}
              size="sm"
              className="tap-target h-9 min-w-9 px-2 font-mono text-xs tabular-nums sm:h-8 sm:min-w-8"
              aria-current={candidate === page ? "page" : undefined}
              disabled={disabled}
              onClick={() => onPageChange(candidate)}
            >
              {candidate}
            </Button>
          </React.Fragment>
        );
      })}

      <Button
        variant="outline"
        size="icon"
        className="tap-target size-9 sm:size-8"
        aria-label="Next page"
        disabled={disabled || page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight className="size-4" />
      </Button>
    </nav>
  );
}
