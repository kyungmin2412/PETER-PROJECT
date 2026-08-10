import { Card } from "@/components/ui/Card";
import { LineChart } from "@/components/charts/LineChart";
import { formatNumber } from "@/lib/format";
import type { DepositPoint } from "@/lib/types";

interface DepositChartProps {
  points: DepositPoint[];
  asOf: string;
}

export function DepositChart({ points, asOf }: DepositChartProps) {
  const latest = points[points.length - 1];
  const peak = points.reduce((max, p) => (p.amount > max.amount ? p : max), points[0]);
  const changeFromPeak = ((latest.amount - peak.amount) / peak.amount) * 100;

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-ink-primary">고객예탁금</div>
          <div className="text-[11px] text-ink-muted">{asOf}</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold tabular text-ink-primary">
            {formatNumber(latest.amount, 1)}조원
          </div>
          <div className="text-xs text-ink-muted">
            고점 {formatNumber(peak.amount, 1)}조 대비 {formatNumber(changeFromPeak, 1)}%
          </div>
        </div>
      </div>
      <div className="mt-3">
        <LineChart
          points={points.map((p) => ({ date: p.date, value: p.amount }))}
          decimals={1}
        />
      </div>
    </Card>
  );
}
