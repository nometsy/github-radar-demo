"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { SystemResponse } from "@/lib/api-types";
import { RATE_LIMIT_POLL_MS } from "@/lib/constants";

export function useSystemStatus() {
  return useQuery({
    queryKey: ["system-status"],
    queryFn: ({ signal }) =>
      apiFetch<SystemResponse>("/api/system", { signal }),
    staleTime: 30_000,
    refetchInterval: RATE_LIMIT_POLL_MS,
    retry: 1,
  });
}
