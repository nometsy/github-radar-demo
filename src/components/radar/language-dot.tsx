"use client";

import { cn } from "@/lib/utils";

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572a5",
  Go: "#00add8",
  Rust: "#dea584",
  Java: "#b07219",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  Ruby: "#701516",
  PHP: "#4f5d95",
  Swift: "#f05138",
  Kotlin: "#a97bff",
  Dart: "#00b4ab",
  Elixir: "#6e4a7e",
  Haskell: "#5e5086",
  Lua: "#000080",
  Zig: "#ec915c",
  Shell: "#89e051",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  Astro: "#ff5a03",
  "Jupyter Notebook": "#da5b0b",
  Scala: "#c22d40",
  R: "#198ce7",
  Clojure: "#db5855",
  "Objective-C": "#438eff",
  Makefile: "#427819",
  Dockerfile: "#384d54",
};

const FALLBACK_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function languageColor(language: string | null): string {
  if (!language) return "var(--muted-foreground)";
  const known = LANGUAGE_COLORS[language];
  if (known) return known;
  let hash = 0;
  for (let index = 0; index < language.length; index += 1) {
    hash = (hash * 31 + language.charCodeAt(index)) % 997;
  }
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

export function LanguageDot({
  language,
  className,
}: {
  language: string | null;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        aria-hidden
        className="size-2 rounded-full"
        style={{ backgroundColor: languageColor(language) }}
      />
      {language ?? "Unknown"}
    </span>
  );
}
