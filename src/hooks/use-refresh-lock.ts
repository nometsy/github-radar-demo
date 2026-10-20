"use client";

import * as React from "react";
import { toast } from "sonner";

/**
 * Prevents accidental request storms against the unauthenticated GitHub quota.
 */
export function useRefreshLock(cooldownMs = 8_000) {
  const lockUntil = React.useRef(0);

  const guard = React.useCallback(
    (action: () => void) => {
      if (Date.now() < lockUntil.current) {
        toast("Radar is cooling down", {
          description: "Wait a few seconds before refreshing again.",
        });
        return;
      }
      lockUntil.current = Date.now() + cooldownMs;
      action();
    },
    [cooldownMs],
  );

  return guard;
}
