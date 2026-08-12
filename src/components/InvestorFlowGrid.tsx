import { Card } from "@/components/ui/Card";
import { formatSigned } from "@/lib/format";
import type { InvestorFlowData, InvestorFlowItem } from "@/lib/types";

function RankList({
  title,
  items,
  tone,
}: {
  title: string;
  items: InvestorFlowItem[];
  tone: "up" | "down";
}) {
  const toneClass = tone === "up" ? "text-up" : "text-down";
  return (
    <Card className="!p-0 overflow-hidden">
      <div className="border-b px-4 py-2.5 text-sm font-medium text-ink-secondary" style={{ borderColor: "var(--border)" }}>
        {title}
      </div>
      <ol>
        {items.map((item) => (
          <li
            key={item.code || item.rank}
            className="flex items-center justify-between gap-2 border-b px-4 py-2 text-sm last:border-b-0"
            style={{ borderColor: "var(--border)" }}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="w-4 shrink-0 text-right text-[11px] text-ink-muted tabular">{item.rank}</span>
              <span className="truncate text-ink-primary">{item.name}</span>
            </span>
            <span className={`shrink-0 tabular text-xs font-medium ${toneClass}`}>
              {formatSigned(item.netAmount, 0)}억
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function InvestorFlowGrid({ data }: { data: InvestorFlowData }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <RankList title="외국인 순매수 상위" items={data.foreignBuy} tone="up" />
      <RankList title="외국인 순매도 상위" items={data.foreignSell} tone="down" />
      <RankList title="기관 순매수 상위" items={data.institutionBuy} tone="up" />
      <RankList title="기관 순매도 상위" items={data.institutionSell} tone="down" />
    </div>
  );
}
