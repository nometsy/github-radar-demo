"use client";

import * as React from "react";

const subscribe = () => () => undefined;

/**
 * False during server rendering and the hydration pass, true afterwards.
 * Uses `useSyncExternalStore` so no state is written from an effect.
 */
export function useHydrated(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
