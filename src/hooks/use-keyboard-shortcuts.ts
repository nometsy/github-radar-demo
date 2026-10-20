"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * Keyboard shortcuts for desktop use:
 * `/` focuses the global search, `g` followed by a section letter jumps
 * between the main views. Ignored while the user types in a field.
 */
export function useKeyboardShortcuts(): void {
  const router = useRouter();

  React.useEffect(() => {
    let pendingG = false;
    let timer: number | undefined;

    const isTyping = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target.isContentEditable
      );
    };

    const focusSearch = () => {
      const input = document.querySelector<HTMLInputElement>(
        'input[aria-label="Search GitHub repositories"]',
      );
      input?.focus();
      input?.select();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target)) return;

      if (pendingG) {
        pendingG = false;
        window.clearTimeout(timer);
        const routes: Record<string, string> = {
          d: "/",
          f: "/fresh",
          t: "/trending",
          a: "/ai",
          s: "/search",
          w: "/watchlist",
          c: "/compare",
        };
        const target = routes[event.key.toLowerCase()];
        if (target) {
          event.preventDefault();
          router.push(target);
        }
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        focusSearch();
        return;
      }

      if (event.key.toLowerCase() === "g") {
        pendingG = true;
        timer = window.setTimeout(() => {
          pendingG = false;
        }, 1200);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(timer);
    };
  }, [router]);
}
