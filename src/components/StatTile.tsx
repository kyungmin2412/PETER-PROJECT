import { Sparkline } from "@/components/charts/Sparkline";
import { deltaGlyph, deltaTone, formatNumber, formatSigned } from "@/lib/format";
import type { PriceSeries } from "@/lib/types";

function decimalsFor(series: PriceSeries) {
  if (series.unit === "%") return 3;
  return 2;
}

export function StatTile({ series }: { series: PriceSeries }) {
  const decimals = decimalsFor(series);
  const tone = deltaTone(series.change);
  const values = series.candles.map((c) => c.close);

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-2xl border p-4"
      style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--card-shadow)" }}
    >
      <div className="min-w-0">
        <div className="truncate text-xs font-medium text-ink-secondary">
          {series.name} <span className="text-ink-muted">{series.symbol}</span>
        </div>
        <div className="mt-1 text-2xl font-semibold text-ink-primary">
          {formatNumber(series.last, decimals)}
          {series.unit && series.unit !== "%" && (
            <span className="ml-1 text-sm font-normal text-ink-muted">{series.unit}</span>
          )}
        </div>
        <div className={`tabular text-xs ${tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-ink-muted"}`}>
          {deltaGlyph(series.change)} {formatSigned(series.change, decimals)} ({formatSigned(series.changePercent, 2)}%)
        </div>
      </div>
      <Sparkline values={values} tone={tone} />
    </div>
  );
}
