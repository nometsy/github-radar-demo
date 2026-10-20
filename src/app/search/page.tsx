import { Suspense } from "react";
import { RepoGridSkeleton } from "@/components/radar/repo-card";
import { SmartSearchView } from "@/components/radar/smart-search-view";

export const metadata = {
  title: "Smart Search",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = params.q;
  const query = Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");

  // The key forces a fresh mount whenever the URL query changes, so the view
  // never needs to sync external state into local state through an effect.
  return (
    <Suspense fallback={<RepoGridSkeleton count={6} />}>
      <SmartSearchView key={query} initialQuery={query} />
    </Suspense>
  );
}
