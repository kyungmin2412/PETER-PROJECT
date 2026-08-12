import { Card } from "@/components/ui/Card";
import { DeltaPercent } from "@/components/ui/Delta";
import { formatNumber } from "@/lib/format";
import type { BigTechItem } from "@/lib/types";

export function BigTechTable({ items }: { items: BigTechItem[] }) {
  return (
    <Card className="!p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b text-left text-[11px] text-ink-muted" style={{ borderColor: "var(--border)" }}>
              <th className="px-3 py-2.5 font-medium">종목</th>
              <th className="px-1.5 py-2.5 text-right font-medium">주가</th>
              <th className="px-1.5 py-2.5 text-right font-medium">전일</th>
              <th className="px-1.5 py-2.5 text-right font-medium">1주</th>
              <th className="px-3 py-2.5 text-right font-medium">1개월</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr
                key={`${item.ticker}-${i}`}
                className={i !== items.length - 1 ? "border-b" : ""}
                style={{ borderColor: "var(--border)" }}
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="whitespace-nowrap rounded px-1 py-0.5 text-[10px] font-medium text-ink-muted"
                      style={{ background: "var(--surface-2)" }}
                    >
                      {item.category}
                    </span>
                    <div>
                      <div className="font-medium leading-tight text-ink-primary">{item.name}</div>
                      <div className="text-[10.5px] leading-tight text-ink-muted">{item.ticker}</div>
                    </div>
                  </div>
                </td>
                <td className="px-1.5 py-2.5 text-right tabular text-ink-primary">
                  {formatNumber(item.price, 2)}
                </td>
                <td className="px-1.5 py-2.5 text-right">
                  <DeltaPercent value={item.changePercent} />
                </td>
                <td className="px-1.5 py-2.5 text-right">
                  <DeltaPercent value={item.changePercent1w} />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <DeltaPercent value={item.changePercent1m} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
