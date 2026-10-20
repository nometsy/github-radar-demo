import Link from "next/link";
import { Radar } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <span className="radar-scope flex size-14 items-center justify-center rounded-full border border-primary/40 bg-primary/10">
        <Radar className="size-6 text-primary" aria-hidden />
      </span>
      <p className="eyebrow">404 · off the scope</p>
      <h1 className="text-2xl font-semibold">This route is not on the radar</h1>
      <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
        The page you requested does not exist. Use the dashboard, search or
        trending lanes to get back to live repository data.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <Link href="/">Back to dashboard</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/search">Smart search</Link>
        </Button>
      </div>
    </div>
  );
}
