import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bot,
  GitCompareArrows,
  LayoutDashboard,
  Search,
  Sparkles,
  Star,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    shortLabel: "DASH",
    description: "Radar overview, feed and measured movers",
    icon: LayoutDashboard,
  },
  {
    href: "/fresh",
    label: "Fresh Repos",
    shortLabel: "FRESH",
    description: "Repositories created in the last 24 hours to 30 days",
    icon: Sparkles,
  },
  {
    href: "/trending",
    label: "Trending Radar",
    shortLabel: "TREND",
    description: "Lanes for today, this week, this month, gems and AI",
    icon: Activity,
  },
  {
    href: "/ai",
    label: "AI Discovery",
    shortLabel: "AI",
    description: "LLM, agents, vibe coding and applied AI categories",
    icon: Bot,
  },
  {
    href: "/search",
    label: "Smart Search",
    shortLabel: "SEARCH",
    description: "Query GitHub with filters and measured growth",
    icon: Search,
  },
  {
    href: "/watchlist",
    label: "Watchlist",
    shortLabel: "WATCH",
    description: "Locally saved repositories with snapshot growth",
    icon: Star,
  },
  {
    href: "/compare",
    label: "Compare",
    shortLabel: "VS",
    description: "Side-by-side metrics for up to four repositories",
    icon: GitCompareArrows,
  },
];

/** Sections that fit into the phone bottom navigation bar. */
export const BOTTOM_NAV_PATHS = [
  "/",
  "/fresh",
  "/trending",
  "/search",
  "/watchlist",
] as const;
