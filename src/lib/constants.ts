export const APP_NAME = "GitHub Radar";
export const APP_VERSION = "1.0.0";
export const APP_DESCRIPTION =
  "Discover fresh and fast-moving open-source repositories with measured star growth, powered by the GitHub API.";

export const GITHUB_URL = "https://github.com";
export const GITHUB_TOKEN_URL = "https://github.com/settings/tokens";

export const WATCHLIST_STORAGE_KEY = "github-radar.watchlist.v1";
export const COMPARE_STORAGE_KEY = "github-radar.compare.v1";
export const COMPARE_LIMIT = 4;

export const RATE_LIMIT_POLL_MS = 60_000;
export const SEARCH_DEBOUNCE_MS = 450;
export const FILTER_DEBOUNCE_MS = 350;
export const SNAPSHOT_MIN_INTERVAL_MINUTES = 30;

export type FreshWindowHours = 6 | 12 | 24 | 72 | 168 | 720;
export type FreshSort = "stars" | "updated";
export type SmartSearchSort = "best" | "stars" | "updated";
export type FeedLens = "rising" | "today" | "fresh" | "active";
export type TrendingLaneId = "today" | "week" | "month" | "gems" | "ai";
export type AiCategoryId =
  | "artificial-intelligence"
  | "llm"
  | "agents"
  | "vibe-coding"
  | "developer-tools"
  | "automation"
  | "cybersecurity"
  | "open-source-tools";

export const FRESH_WINDOWS: {
  hours: FreshWindowHours;
  label: string;
  shortLabel: string;
  description: string;
}[] = [
  {
    hours: 6,
    label: "Last 6 hours",
    shortLabel: "6H",
    description: "Born minutes ago",
  },
  {
    hours: 12,
    label: "Last 12 hours",
    shortLabel: "12H",
    description: "Brand new",
  },
  {
    hours: 24,
    label: "Last 24 hours",
    shortLabel: "24H",
    description: "Born since yesterday",
  },
  {
    hours: 72,
    label: "Last 3 days",
    shortLabel: "3D",
    description: "Still warm",
  },
  {
    hours: 168,
    label: "Last 7 days",
    shortLabel: "7D",
    description: "This week's launches",
  },
  {
    hours: 720,
    label: "Last 30 days",
    shortLabel: "30D",
    description: "This month's cohort",
  },
];

export const FRESH_SORT_OPTIONS: { value: FreshSort; label: string }[] = [
  { value: "stars", label: "Most stars" },
  { value: "updated", label: "Recently updated" },
];

export const SMART_SEARCH_SORT_OPTIONS: {
  value: SmartSearchSort;
  label: string;
}[] = [
  { value: "best", label: "Best match" },
  { value: "stars", label: "Most stars" },
  { value: "updated", label: "Recently updated" },
];

export const CREATED_WINDOW_OPTIONS = [
  { value: 0, label: "Any time" },
  { value: 1, label: "Created today" },
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
  { value: 365, label: "Last year" },
] as const;

export const MIN_STAR_OPTIONS = [0, 10, 50, 100, 500, 1_000, 5_000] as const;
export const MIN_FORK_OPTIONS = [0, 5, 25, 100, 500] as const;

export const LANGUAGE_OPTIONS = [
  "TypeScript",
  "JavaScript",
  "Python",
  "Go",
  "Rust",
  "Java",
  "C++",
  "C",
  "C#",
  "Ruby",
  "PHP",
  "Swift",
  "Kotlin",
  "Dart",
  "Elixir",
  "Haskell",
  "Lua",
  "Zig",
  "Shell",
  "Jupyter Notebook",
  "HTML",
  "CSS",
  "Vue",
  "Svelte",
  "Astro",
  "Scala",
  "R",
  "Clojure",
  "OCaml",
  "Nim",
] as const;

export const FEED_LENSES: {
  id: FeedLens;
  label: string;
  hint: string;
}[] = [
  {
    id: "today",
    label: "New",
    hint: "Created ≤24h · newest first by stars",
  },
  {
    id: "rising",
    label: "Rising",
    hint: "Created ≤14d · ≥25 stars",
  },
  {
    id: "fresh",
    label: "Fresh",
    hint: "Created ≤3d · newest activity",
  },
  {
    id: "active",
    label: "Hot",
    hint: "Active ≤24h · ≥100 stars",
  },
];

export interface TrendingLaneConfig {
  id: TrendingLaneId;
  label: string;
  shortLabel: string;
  description: string;
  methodology: string;
  createdWithinDays: number;
  pushedWithinHours: number | null;
  minStars: number;
  maxStars: number | null;
  sort: "stars" | "updated";
  topic?: string;
  /** Hidden gems are re-ranked by estimated stars/day after the API call. */
  velocitySort?: boolean;
}

export const TRENDING_LANES: TrendingLaneConfig[] = [
  {
    id: "today",
    label: "Trending Today",
    shortLabel: "TODAY",
    description: "Young projects making noise in the last 24 hours.",
    methodology:
      "Created in the last 45 days, pushed in the last 24h, ordered by total stars. This is activity, not measured growth.",
    createdWithinDays: 45,
    pushedWithinHours: 24,
    minStars: 20,
    maxStars: null,
    sort: "stars",
  },
  {
    id: "week",
    label: "Trending This Week",
    shortLabel: "WEEK",
    description: "Active projects with a week of signal behind them.",
    methodology:
      "Created in the last 90 days, pushed in the last 7 days, at least 100 stars. Ordered by total stars.",
    createdWithinDays: 90,
    pushedWithinHours: 24 * 7,
    minStars: 100,
    maxStars: null,
    sort: "stars",
  },
  {
    id: "month",
    label: "Trending This Month",
    shortLabel: "MONTH",
    description: "The established launches of the last few months.",
    methodology:
      "Created in the last 180 days, pushed in the last 30 days, at least 500 stars. Ordered by total stars.",
    createdWithinDays: 180,
    pushedWithinHours: 24 * 30,
    minStars: 500,
    maxStars: null,
    sort: "stars",
  },
  {
    id: "gems",
    label: "Hidden Gems",
    shortLabel: "GEMS",
    description: "Smaller, active projects with disproportionate momentum.",
    methodology:
      "Created in the last 90 days, 30–2,500 stars, pushed in the last 14 days. Re-ranked by estimated stars per day since creation. The estimate is not historical growth.",
    createdWithinDays: 90,
    pushedWithinHours: 24 * 14,
    minStars: 30,
    maxStars: 2_500,
    sort: "updated",
    velocitySort: true,
  },
  {
    id: "ai",
    label: "Rising AI",
    shortLabel: "AI",
    description: "New LLM and AI projects entering the radar.",
    methodology:
      "Repositories tagged with the llm topic, created in the last 180 days, at least 25 stars. Ordered by total stars.",
    createdWithinDays: 180,
    pushedWithinHours: 24 * 30,
    minStars: 25,
    maxStars: null,
    sort: "stars",
    topic: "llm",
  },
];

export type AiCategoryIcon =
  | "brain"
  | "llm"
  | "agents"
  | "sparkles"
  | "terminal"
  | "workflow"
  | "shield"
  | "boxes";

export interface AiCategoryConfig {
  id: AiCategoryId;
  label: string;
  shortLabel: string;
  description: string;
  query: string;
  fallbackQuery?: string;
  icon: AiCategoryIcon;
}

export const AI_CATEGORIES: AiCategoryConfig[] = [
  {
    id: "artificial-intelligence",
    label: "Artificial Intelligence",
    shortLabel: "AI",
    description: "Models, inference engines, research tooling and applied AI.",
    query: "topic:artificial-intelligence stars:>=100 fork:false archived:false",
    fallbackQuery:
      "artificial intelligence in:name,description,readme stars:>=500 fork:false archived:false",
    icon: "brain",
  },
  {
    id: "llm",
    label: "LLM",
    shortLabel: "LLM",
    description: "Large language models, local inference, fine-tuning and evals.",
    query: "topic:llm stars:>=100 fork:false archived:false",
    fallbackQuery:
      "large language model in:name,description,readme stars:>=500 fork:false archived:false",
    icon: "llm",
  },
  {
    id: "agents",
    label: "AI Agents",
    shortLabel: "AGENTS",
    description: "Autonomous agents, orchestration frameworks and tool protocols.",
    query: "topic:ai-agents stars:>=50 fork:false archived:false",
    fallbackQuery:
      "\"AI agent\" in:name,description,readme stars:>=200 fork:false archived:false",
    icon: "agents",
  },
  {
    id: "vibe-coding",
    label: "Vibe Coding",
    shortLabel: "VIBE",
    description: "AI-assisted building, prompt-to-app tools and agentic IDEs.",
    query: "topic:vibe-coding stars:>=10 fork:false archived:false",
    fallbackQuery:
      "\"vibe coding\" in:name,description,readme stars:>=10 fork:false archived:false",
    icon: "sparkles",
  },
  {
    id: "developer-tools",
    label: "Developer Tools",
    shortLabel: "DEVTOOLS",
    description: "Editors, CLIs, runtimes and tools that improve the craft.",
    query: "topic:developer-tools stars:>=100 fork:false archived:false",
    fallbackQuery:
      "developer tools in:description stars:>=1000 fork:false archived:false",
    icon: "terminal",
  },
  {
    id: "automation",
    label: "Automation",
    shortLabel: "AUTOMATION",
    description: "Workflow engines, scrapers, schedulers and integrations.",
    query: "topic:automation stars:>=100 fork:false archived:false",
    fallbackQuery:
      "automation in:name,description stars:>=1000 fork:false archived:false",
    icon: "workflow",
  },
  {
    id: "cybersecurity",
    label: "Cybersecurity",
    shortLabel: "SECURITY",
    description: "Offensive tooling, defensive systems and security research.",
    query: "topic:cybersecurity stars:>=100 fork:false archived:false",
    fallbackQuery:
      "cybersecurity in:name,description stars:>=500 fork:false archived:false",
    icon: "shield",
  },
  {
    id: "open-source-tools",
    label: "Open Source Tools",
    shortLabel: "OSS TOOLS",
    description: "Self-hosted and open-source tools with serious traction.",
    query: "topic:open-source stars:>=500",
    fallbackQuery:
      "open source tool in:description stars:>=2000",
    icon: "boxes",
  },
];

export const SEARCH_EXAMPLES = [
  "AI agent",
  "rust cli",
  "self-hosted",
  "vibe coding",
  "cybersecurity",
] as const;
