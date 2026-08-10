import { Card } from "@/components/ui/Card";
import { Delta, DeltaPercent } from "@/components/ui/Delta";
import { formatNumber } from "@/lib/format";
import type { WatchlistItem } from "@/lib/types";

export function WatchlistTable({ items }: { items: WatchlistItem[] }) {
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-ink-muted">
            <th className="px-4 py-3 font-medium">종목</th>
            <th className="px-3 py-3 text-right font-medium">종가</th>
            <th className="px-3 py-3 text-right font-medium">대비</th>
            <th className="px-3 py-3 text-right font-medium">등락률</th>
            <th className="px-4 py-3 font-medium">코멘트</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.symbol} className="border-t" style={{ borderColor: "var(--grid)" }}>
              <td className="px-4 py-3">
                <div className="font-medium text-ink-primary">{item.name}</div>
                <div className="text-xs text-ink-muted">{item.symbol}</div>
              </td>
              <td className="px-3 py-3 text-right tabular text-ink-primary">
                {formatNumber(item.close, item.close > 10000 ? 0 : 2)}
              </td>
              <td className="px-3 py-3 text-right">
                <Delta value={item.change} decimals={item.close > 10000 ? 0 : 2} />
              </td>
              <td className="px-3 py-3 text-right">
                <DeltaPercent value={item.changePercent} />
              </td>
              <td className="px-4 py-3 text-xs text-ink-secondary">{item.comment}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
