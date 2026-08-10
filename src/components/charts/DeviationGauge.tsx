import { formatNumber } from "@/lib/format";
import type { DeviationZone } from "@/lib/types";

interface DeviationGaugeProps {
  value: number;
  zoneLabel: string;
  zone: DeviationZone;
}

const DOMAIN: [number, number] = [55, 145];

const ZONES: { from: number; to: number; label: string; color: string }[] = [
  { from: 55, to: 70, label: "극단 침체", color: "var(--down-strong)" },
  { from: 70, to: 85, label: "침체", color: "var(--down)" },
  { from: 85, to: 105, label: "중립", color: "var(--baseline)" },
  { from: 105, to: 115, label: "과열", color: "var(--up)" },
  { from: 115, to: 145, label: "극단 과열", color: "var(--up-strong)" },
];

function pct(v: number) {
  return ((v - DOMAIN[0]) / (DOMAIN[1] - DOMAIN[0])) * 100;
}

export function DeviationGauge({ value, zoneLabel, zone }: DeviationGaugeProps) {
  const markerColor = zone.startsWith("extreme")
    ? zone === "extreme_oversold"
      ? "var(--down-strong)"
      : "var(--up-strong)"
    : zone === "oversold"
      ? "var(--down)"
      : zone === "overbought"
        ? "var(--up)"
        : "var(--ink-secondary)";

  return (
    <div>
      <div className="relative h-3 w-full overflow-visible rounded-full" style={{ background: "var(--surface-2)" }}>
        <div className="flex h-full w-full overflow-hidden rounded-full">
          {ZONES.map((z) => (
            <div
              key={z.label}
              style={{ width: `${pct(z.to) - pct(z.from)}%`, background: z.color, opacity: 0.55 }}
            />
          ))}
        </div>
        <div
          className="absolute top-1/2 h-5 w-1.5 -translate-y-1/2 rounded-full border-2"
          style={{
            left: `calc(${Math.min(100, Math.max(0, pct(value)))}% - 3px)`,
            background: markerColor,
            borderColor: "var(--page)",
          }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-ink-muted">
        {ZONES.map((z) => (
          <span key={z.label}>{z.label}</span>
        ))}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular" style={{ color: markerColor }}>
          {formatNumber(value, 1)}
        </span>
        <span className="text-sm text-ink-secondary">{zoneLabel}</span>
      </div>
    </div>
  );
}
