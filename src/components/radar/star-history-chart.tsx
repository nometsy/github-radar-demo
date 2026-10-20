"use client";

import * as React from "react";
import { LineChart } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SnapshotHistory } from "@/lib/radar/types";
import { formatCompactNumber, formatDateTime, formatNumber } from "@/lib/utils";

export function StarHistoryChart({
  history,
  height = 220,
}: {
  history: SnapshotHistory;
  height?: number;
}) {
  const data = React.useMemo(
    () =>
      history.points.map((point) => ({
        t: new Date(point.capturedAt).getTime(),
        stars: point.stars,
        forks: point.forks,
      })),
    [history.points],
  );

  if (data.length < 2) {
    return (
      <div
        className="panel bg-terminal flex flex-col items-center justify-center gap-2 rounded-xl px-6 text-center"
        style={{ height }}
      >
        <LineChart className="size-5 text-muted-foreground" aria-hidden />
        <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
          No snapshot history
        </p>
        <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
          {history.totalPoints === 1
            ? "One snapshot has been captured. A second collection later will start drawing real growth here."
            : "This repository has no collected snapshots yet. Use “Collect snapshot” to record a baseline, then collect again later."}
        </p>
      </div>
    );
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="starsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="var(--border)"
            strokeDasharray="3 6"
            vertical={false}
          />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(value: number) =>
              new Date(value).toISOString().slice(5, 10)
            }
            stroke="var(--muted-foreground)"
            fontSize={10}
            fontFamily="var(--font-mono)"
            tickLine={false}
            axisLine={false}
            minTickGap={28}
          />
          <YAxis
            dataKey="stars"
            stroke="var(--muted-foreground)"
            fontSize={10}
            fontFamily="var(--font-mono)"
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(value: number) => formatCompactNumber(value)}
            domain={["auto", "auto"]}
          />
          <RechartsTooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--popover-foreground)",
            }}
            labelFormatter={(value) =>
              formatDateTime(new Date(Number(value)))
            }
            formatter={(value) => [formatNumber(Number(value)), "stars"]}
          />
          <Area
            type="monotone"
            dataKey="stars"
            stroke="var(--primary)"
            strokeWidth={2}
            fill="url(#starsFill)"
            dot={{ r: 2, fill: "var(--primary)", strokeWidth: 0 }}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
