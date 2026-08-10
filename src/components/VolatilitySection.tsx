import { Card } from "@/components/ui/Card";
import { Delta, DeltaPercent } from "@/components/ui/Delta";
import { LineChart } from "@/components/charts/LineChart";
import { formatNumber } from "@/lib/format";
import type { VolatilityIndex } from "@/lib/types";

export function VolatilitySection({ data }: { data: VolatilityIndex }) {
  const rangePct = ((data.value - data.week52Low) / (data.week52High - data.week52Low)) * 100;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-ink-primary">코스피 변동성지수 V-KOSPI</div>
          <div className="text-[11px] text-ink-muted">{data.asOf}</div>
        </div>
        <div className="text-right">
          <div className="flex items-baseline gap-2 justify-end">
            <span className="text-2xl font-semibold tabular text-ink-primary">
              {formatNumber(data.value, 2)}
            </span>
            <Delta value={data.change} decimals={2} />
            <DeltaPercent value={data.changePercent} />
          </div>
          <div className="text-xs text-ink-muted">전일 종가 {formatNumber(data.prevClose, 2)}</div>
        </div>
      </div>

      <div className="mt-3">
        <LineChart points={data.series} decimals={1} height={180} />
      </div>

      <div className="mt-3">
        <div className="h-1.5 w-full rounded-full" style={{ background: "var(--surface-2)" }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(100, Math.max(0, rangePct))}%`,
              background: "var(--accent)",
            }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-ink-muted">
          <span>52주 저 {formatNumber(data.week52Low, 2)}</span>
          <span>1년 변동률 +{formatNumber(data.oneYearChangePercent, 1)}%</span>
          <span>52주 고 {formatNumber(data.week52High, 2)}</span>
        </div>
      </div>

      {data.stale && data.staleNote && (
        <div
          className="mt-3 rounded-md border px-3 py-2 text-xs text-ink-secondary"
          style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
        >
          ⚠ {data.staleNote}
        </div>
      )}
    </Card>
  );
}
