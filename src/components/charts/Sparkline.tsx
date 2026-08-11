"use client";

import { useMemo } from "react";

interface SparklineProps {
  values: number[];
  tone: "up" | "down" | "flat";
  height?: number;
  width?: number;
}

const TONE_VAR: Record<SparklineProps["tone"], string> = {
  up: "var(--up)",
  down: "var(--down)",
  flat: "var(--ink-muted)",
};

export function Sparkline({ values, tone, height = 40, width = 96 }: SparklineProps) {
  const { path, highlightPath, endX, endY } = useMemo(() => {
    const n = values.length;
    if (n < 2) return { path: "", highlightPath: "", endX: 0, endY: 0 };
    const high = Math.max(...values);
    const low = Math.min(...values);
    const pad = (high - low) * 0.12 || high * 0.02 || 1;
    const domainHigh = high + pad;
    const domainLow = low - pad;
    const stepX = width / (n - 1);
    const y = (v: number) =>
      ((domainHigh - v) / (domainHigh - domainLow || 1)) * height;

    const coords = values.map((v, i) => [i * stepX, y(v)] as const);
    const path = coords.map(([x, cy], i) => `${i === 0 ? "M" : "L"}${x},${cy}`).join(" ");
    // Highlight just the final segment in the tone color, per the sparkline
    // spec: history in a muted hue, the current period in the accent.
    const [x1, y1] = coords[coords.length - 2];
    const [x2, y2] = coords[coords.length - 1];
    const highlightPath = `M${x1},${y1} L${x2},${y2}`;

    return { path, highlightPath, endX: x2, endY: y2 };
  }, [values, height, width]);

  if (!path) return null;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="overflow-visible">
      <path d={path} fill="none" stroke="var(--ink-muted)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.55} />
      <path d={highlightPath} fill="none" stroke={TONE_VAR[tone]} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={endX} cy={endY} r={2.5} fill={TONE_VAR[tone]} stroke="var(--surface)" strokeWidth={1.5} />
    </svg>
  );
}
