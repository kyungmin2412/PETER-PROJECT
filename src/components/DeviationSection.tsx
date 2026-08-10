import { Card } from "@/components/ui/Card";
import { DeviationGauge } from "@/components/charts/DeviationGauge";
import { formatNumber } from "@/lib/format";
import type { DeviationIndex, DeviationZone } from "@/lib/types";

const ZONE_LABEL: Record<DeviationZone, string> = {
  extreme_oversold: "극단 침체",
  oversold: "침체",
  neutral: "중립",
  overbought: "과열",
  extreme_overbought: "극단 과열",
};

export function DeviationSection({ data }: { data: DeviationIndex }) {
  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-medium text-ink-primary">코스피 60일 이격도</div>
        <div className="text-[11px] text-ink-muted">
          {data.asOf} 기준{data.estimated ? " · 추정치" : ""}
        </div>
      </div>
      <p className="mt-1 text-xs text-ink-secondary">
        종가 {formatNumber(data.close, 2)} ÷ 60일 이동평균{data.estimated ? " 추정" : ""}{" "}
        {formatNumber(data.ma, 0)} × 100
      </p>
      <div className="mt-4">
        <DeviationGauge value={data.value} zoneLabel={ZONE_LABEL[data.zone]} zone={data.zone} />
      </div>
    </Card>
  );
}
