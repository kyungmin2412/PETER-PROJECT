"use client";

import { useId, useMemo, useState } from "react";
import { formatNumber } from "@/lib/format";

interface Point {
  date: string;
  value: number;
}

interface LineChartProps {
  points: Point[];
  decimals?: number;
  height?: number;
  bands?: { from: number; to: number; color: string }[];
}

const WIDTH = 640;

export function LineChart({ points, decimals = 2, height = 160, bands }: LineChartProps) {
  const gradientId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const chartTop = 8;
  const chartBottom = height - 22;
  const chartHeight = chartBottom - chartTop;
  const n = points.length;
  const stepX = WIDTH / Math.max(1, n - 1);

  const { domainLow, domainHigh, path, areaPath, yTicks } = useMemo(() => {
    const values = points.map((p) => p.value);
    const rawHigh = Math.max(...values);
    const rawLow = Math.min(...values);
    const pad = (rawHigh - rawLow) * 0.15 || rawHigh * 0.05;
    const high = rawHigh + pad;
    const low = Math.max(0, rawLow - pad);

    const y = (v: number) => chartTop + ((high - v) / (high - low || 1)) * chartHeight;

    const coords = points.map((p, i) => [i * stepX, y(p.value)] as const);
    const path = coords.map(([x, cy], i) => `${i === 0 ? "M" : "L"}${x},${cy}`).join(" ");
    const areaPath =
      path +
      ` L${coords[coords.length - 1][0]},${chartBottom} L${coords[0][0]},${chartBottom} Z`;

    const yTicks = [0, 1, 2, 3].map((i) => high - ((high - low) * i) / 3);

    return { domainLow: low, domainHigh: high, path, areaPath, yTicks };
  }, [points, chartTop, chartBottom, chartHeight, stepX]);

  const y = (v: number) =>
    chartTop + ((domainHigh - v) / (domainHigh - domainLow || 1)) * chartHeight;

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  const maxLabels = Math.min(6, n);
  const xLabelIndices = Array.from(new Set(
    Array.from({ length: maxLabels }, (_, i) =>
      Math.round((i * (n - 1)) / Math.max(1, maxLabels - 1))
    )
  ));

  return (
    <div className="relative select-none">
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        className="w-full"
        style={{ height }}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {bands?.map((b, i) => (
          <rect
            key={i}
            x={0}
            width={WIDTH}
            y={y(b.to)}
            height={Math.max(0, y(b.from) - y(b.to))}
            fill={b.color}
            opacity={0.12}
          />
        ))}

        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={0} x2={WIDTH} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={WIDTH - 2} y={y(t) - 3} textAnchor="end" fontSize={9} fill="var(--ink-muted)">
              {formatNumber(t, decimals)}
            </text>
          </g>
        ))}

        <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
        <path
          d={path}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {points.map((p, i) => (
          <circle
            key={p.date}
            cx={i * stepX}
            cy={y(p.value)}
            r={hoverIndex === i ? 3.5 : 0}
            fill="var(--accent)"
          />
        ))}

        {hoverIndex !== null && (
          <line
            x1={hoverIndex * stepX}
            x2={hoverIndex * stepX}
            y1={chartTop}
            y2={chartBottom}
            stroke="var(--ink-secondary)"
            strokeWidth={1}
            strokeDasharray="2,2"
          />
        )}

        {xLabelIndices.map((i) => (
          <text
            key={points[i].date}
            x={Math.min(Math.max(i * stepX, 18), WIDTH - 18)}
            y={height - 6}
            textAnchor="middle"
            fontSize={9}
            fill="var(--ink-muted)"
          >
            {points[i].date.slice(5).replace("-", "/")}
          </text>
        ))}

        <rect
          x={0}
          y={0}
          width={WIDTH}
          height={height}
          fill="transparent"
          onMouseMove={(e) => {
            const rect = (e.target as SVGRectElement).getBoundingClientRect();
            const px = ((e.clientX - rect.left) / rect.width) * WIDTH;
            const idx = Math.min(n - 1, Math.max(0, Math.round(px / stepX)));
            setHoverIndex(idx);
          }}
        />
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute top-0 rounded-md border px-2 py-1 text-[11px] tabular leading-tight shadow-lg"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface-2)",
            color: "var(--ink-secondary)",
            left: `${Math.min(85, Math.max(0, (hoverIndex! / n) * 100))}%`,
          }}
        >
          <div className="text-ink-primary">{hovered.date}</div>
          <div>{formatNumber(hovered.value, decimals)}</div>
        </div>
      )}
    </div>
  );
}
