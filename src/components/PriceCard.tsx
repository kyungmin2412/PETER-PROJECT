import { Card } from "@/components/ui/Card";
import { PriceHeadline } from "@/components/ui/Delta";
import { CandleChart } from "@/components/charts/CandleChart";
import type { PriceSeries } from "@/lib/types";

function decimalsFor(series: PriceSeries) {
  if (series.unit === "%") return 3;
  if (Math.abs(series.last) < 100) return 2;
  return 2;
}

export function PriceCard({ series }: { series: PriceSeries }) {
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-ink-primary">
            {series.name} <span className="text-ink-muted">{series.symbol}</span>
            {series.unit && <span className="ml-1 text-ink-muted">· {series.unit}</span>}
          </div>
        </div>
        <span className="text-[11px] text-ink-muted">1달 · 일봉</span>
      </div>
      <div className="mt-1.5">
        <PriceHeadline
          last={series.last}
          change={series.change}
          changePercent={series.changePercent}
          decimals={decimalsFor(series)}
        />
      </div>
      <div className="mt-2">
        <CandleChart candles={series.candles} decimals={decimalsFor(series)} />
      </div>
    </Card>
  );
}
