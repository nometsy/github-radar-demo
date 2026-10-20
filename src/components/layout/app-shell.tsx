"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CodeXml, Menu, Radar, Search } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { RateLimitPill } from "@/components/layout/rate-limit-pill";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NAV_ITEMS, BOTTOM_NAV_PATHS } from "@/lib/navigation";
import { APP_NAME, APP_VERSION } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useCompare } from "@/providers/compare-provider";
import { useWatchlist } from "@/providers/watchlist-provider";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function brandCounts(entryCount: number, compareCount: number, href: string) {
  if (href === "/watchlist" && entryCount > 0) return entryCount;
  if (href === "/compare" && compareCount > 0) return compareCount;
  return null;
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { entries } = useWatchlist();
  const { items } = useCompare();

  return (
    <nav className="flex flex-col gap-1" aria-label="Main navigation">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const count = brandCounts(entries.length, items.length, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-sm transition-colors",
              active
                ? "border-primary/30 bg-primary/10 text-primary"
                : "text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="flex-1 truncate">{item.label}</span>
            {count !== null && (
              <Badge
                variant="secondary"
                className="h-5 min-w-5 justify-center px-1 font-mono text-[10px] tabular-nums"
              >
                {count}
              </Badge>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [value, setValue] = React.useState("");

  return (
    <form
      role="search"
      className={cn("relative", className)}
      onSubmit={(event) => {
        event.preventDefault();
        const query = value.trim();
        router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
      }}
    >
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search repositories, topics, keywords…"
        aria-label="Search GitHub repositories"
        className="h-9 pl-9 font-mono text-xs"
      />
    </form>
  );
}

function BottomNav() {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) =>
    (BOTTOM_NAV_PATHS as readonly string[]).includes(item.href),
  );

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/90 backdrop-blur-xl lg:hidden"
    >
      <ul className="grid grid-cols-5 px-safe pb-safe">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span className="max-w-full truncate">{item.shortLabel}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  useKeyboardShortcuts();

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border/70 bg-card/50 backdrop-blur-xl lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-border/70 px-5">
          <span className="radar-scope flex size-9 items-center justify-center rounded-full border border-primary/40 bg-primary/10">
            <Radar className="size-4 text-primary" aria-hidden />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold tracking-tight">
              {APP_NAME}
            </span>
            <span className="terminal-label block text-[10px] text-muted-foreground">
              v{APP_VERSION} · gh api
            </span>
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <p className="eyebrow mb-2 px-3">Navigate</p>
          <NavLinks />
          <div className="hairline my-4" />
          <p className="px-3 text-xs leading-relaxed text-muted-foreground">
            Growth numbers come from local snapshots only. Without collected
            history the radar says{" "}
            <span className="font-mono text-foreground">insufficient data</span>{" "}
            instead of guessing.
          </p>
        </div>

        <div className="border-t border-border/70 p-3">
          <a
            href="https://docs.github.com/rest"
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <CodeXml className="size-3.5" aria-hidden />
            GitHub REST API docs
          </a>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 pt-safe sm:px-6">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Open navigation"
                >
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="border-b border-border/70 px-5 py-4 text-left">
                  <SheetTitle className="flex items-center gap-2 text-sm">
                    <Radar className="size-4 text-primary" aria-hidden />
                    {APP_NAME}
                  </SheetTitle>
                </SheetHeader>
                <div className="px-3 py-4">
                  <NavLinks onNavigate={() => setMobileOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>

            <Link href="/" className="flex items-center gap-2 lg:hidden">
              <Radar className="size-4 text-primary" aria-hidden />
              <span className="text-sm font-semibold">Radar</span>
            </Link>

            <GlobalSearch className="hidden max-w-md flex-1 md:block" />

            <div className="ml-auto flex items-center gap-2">
              <RateLimitPill />
              <ThemeToggle />
            </div>
          </div>
          <div className="px-4 pb-3 md:hidden">
            <GlobalSearch />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 pb-24 pb-safe sm:px-6 sm:py-8 lg:pb-8">
          <motion.div
            key={pathname}
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </main>

        <footer className="mx-auto w-full max-w-7xl px-4 pb-10 pb-safe sm:px-6">
          <div className="hairline mb-4" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            {APP_NAME} reads GitHub&apos;s public REST API. Star counts and
            activity dates are live values from GitHub. Growth percentages are
            computed exclusively from snapshots this app has collected — they
            are never estimated, extrapolated or fabricated.
          </p>
          <p className="mt-3 hidden font-mono text-[11px] text-muted-foreground lg:block">
            Keyboard: <span className="text-foreground">/</span> search ·{" "}
            <span className="text-foreground">g</span> then{" "}
            <span className="text-foreground">d/f/t/a/s/w/c</span> — dashboard,
            fresh, trending, AI, search, watchlist, compare
          </p>
        </footer>
      </div>

      <BottomNav />
    </div>
  );
}
