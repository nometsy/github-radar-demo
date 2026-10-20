"use client";

import * as React from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WatchlistProvider } from "@/providers/watchlist-provider";
import { CompareProvider } from "@/providers/compare-provider";
import { ApiClientError } from "@/lib/api-client";

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme === "light" ? "light" : "dark"}
      position="bottom-right"
      offset="16px"
      mobileOffset={{ bottom: 76, left: 12, right: 12 }}
      closeButton
      toastOptions={{
        className:
          "!font-sans !border !border-border !bg-popover !text-popover-foreground !shadow-2xl",
        descriptionClassName: "!text-muted-foreground",
      }}
    />
  );
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 10 * 60_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              if (failureCount >= 1) return false;
              if (error instanceof ApiClientError && error.status < 500) {
                return false;
              }
              return true;
            },
          },
        },
      }),
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WatchlistProvider>
            <CompareProvider>
              {children}
              <ThemedToaster />
            </CompareProvider>
          </WatchlistProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
