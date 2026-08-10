import { Card } from "@/components/ui/Card";
import { Delta } from "@/components/ui/Delta";
import { formatNumber } from "@/lib/format";
import type { TopBuyer } from "@/lib/types";

export function TopBuyersTable({ title, rows }: { title: string; rows: TopBuyer[] }) {
  return (
    <Card className="p-0">
      <div className="border-b px-4 py-3 text-sm font-semibold text-ink-primary" style={{ borderColor: "var(--grid)" }}>
        {title}
      </div>
      <table className="w-full border-collapse text-sm">
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.rank}
              className="border-t transition-colors hover:bg-[var(--surface-2)]"
              style={{ borderColor: "var(--grid)" }}
            >
              <td className="w-8 px-4 py-2.5 text-ink-muted">{row.rank}</td>
              <td className="px-2 py-2.5 text-ink-primary">{row.name}</td>
              <td className="px-2 py-2.5 text-right tabular text-ink-primary">
                {formatNumber(row.amount, 0)}
              </td>
              <td className="px-4 py-2.5 text-right">
                <Delta value={row.change} decimals={0} className="text-xs" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
