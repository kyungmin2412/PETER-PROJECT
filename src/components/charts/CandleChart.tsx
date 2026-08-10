"use client";

import { useMemo, useState } from "react";
import type { Candle } from "@/lib/types";
import { formatNumber } from "@/lib/format";

interface CandleChartProps {
  candles: Candle[];
  decimals?: number;
  height?: number;
}

const WIDTH = 320;

export function CandleChart({ candles, decimals = 2, height = 132 }: CandleChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { yTicks, domainLow, domainHigh, xLabels } = useMemo(() => {
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const rawHigh = Math.max(...highs);
    const rawLow = Math.min(...lows);
    const pad = (rawHigh - rawLow) * 0.08 || rawHigh * 0.01;
    const high = rawHigh + pad;
    const low = rawLow - pad;
    const ticks = [0, 1, 2, 3].map((i) => high - ((high - low) * i) / 3);

    const step = Math.max(1, Math.floor(candles.length / 5));
    const labels = candles
      .map((c, i) => ({ i, c }))
      .filter(({ i }) => i % step === 0 || i === candles.length - 1);

    return { yTicks: ticks, domainLow: low, domainHigh: high, xLabels: labels };
  }, [candles]);

  const chartTop = 6;
  const chartBottom = height - 20;
  const chartHeight = chartBottom - chartTop;

  const y = (v: number) =>
    chartTop + ((domainHigh - v) / (domainHigh - domainLow)) * chartHeight;

  const n = candles.length;
  const slot = WIDTH / n;
  const bodyWidth = Math.max(1.5, slot * 0.55);

  const hovered = hoverIndex !== null ? candles[hoverIndex] : null;

  return (
    <div className="relative select-none">
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        className="w-full"
        style={{ height }}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={0}
              x2={WIDTH}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--grid)"
              strokeWidth={1}
            />
            <text
              x={WIDTH - 2}
              y={y(t) - 3}
              textAnchor="end"
              fontSize={8.5}
              fill="var(--ink-muted)"
            >
              {formatNumber(t, decimals)}
            </text>
          </g>
        ))}

        {candles.map((c, i) => {
          const cx = slot * i + slot / 2;
          const up = c.close >= c.open;
          const color = up ? "var(--up)" : "var(--down)";
          const bodyTop = y(Math.max(c.open, c.close));
          const bodyBottom = y(Math.min(c.open, c.close));
          const bodyH = Math.max(1, bodyBottom - bodyTop);
          return (
            <g key={c.date}>
              <line
                x1={cx}
                x2={cx}
                y1={y(c.high)}
                y2={y(c.low)}
                stroke={color}
                strokeWidth={1}
              />
              <rect
                x={cx - bodyWidth / 2}
                y={bodyTop}
                width={bodyWidth}
                height={bodyH}
                rx={1.2}
                fill={color}
              />
            </g>
          );
        })}

        {hoverIndex !== null && (
          <line
            x1={slot * hoverIndex + slot / 2}
            x2={slot * hoverIndex + slot / 2}
            y1={chartTop}
            y2={chartBottom}
            stroke="var(--ink-secondary)"
            strokeWidth={1}
            strokeDasharray="2,2"
          />
        )}

        {xLabels.map(({ i, c }) => (
          <text
            key={c.date}
            x={Math.min(Math.max(slot * i + slot / 2, 14), WIDTH - 14)}
            y={height - 6}
            textAnchor="middle"
            fontSize={8.5}
            fill="var(--ink-muted)"
          >
            {c.date.slice(5).replace("-", "/")}
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
            const idx = Math.min(n - 1, Math.max(0, Math.floor(px / slot)));
            setHoverIndex(idx);
          }}
        />
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute top-0 rounded-md border px-2 py-1 text-[10px] tabular leading-tight shadow-lg"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface-2)",
            color: "var(--ink-secondary)",
            left: `${Math.min(78, Math.max(0, (hoverIndex! / n) * 100))}%`,
          }}
        >
          <div className="text-ink-primary">{hovered.date}</div>
          <div>O {formatNumber(hovered.open, decimals)}</div>
          <div>H {formatNumber(hovered.high, decimals)}</div>
          <div>L {formatNumber(hovered.low, decimals)}</div>
          <div>C {formatNumber(hovered.close, decimals)}</div>
        </div>
      )}
    </div>
  );
}
