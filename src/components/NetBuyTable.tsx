import { Card } from "@/components/ui/Card";
import { Delta } from "@/components/ui/Delta";
import type { InvestorNetBuy } from "@/lib/types";

function Cell({ value }: { value: number }) {
  return (
    <td className="px-3 py-3 text-right">
      <Delta value={value} decimals={0} className="text-sm" /> <span className="text-ink-muted text-xs">억원</span>
    </td>
  );
}

export function NetBuyTable({ rows }: { rows: InvestorNetBuy[] }) {
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[420px] border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs font-medium text-ink-muted">
            <th className="px-4 py-3 font-medium">시장</th>
            <th className="px-3 py-3 text-right font-medium">외국인</th>
            <th className="px-3 py-3 text-right font-medium">기관</th>
            <th className="px-3 py-3 text-right font-medium">개인</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.market} className="border-t" style={{ borderColor: "var(--grid)" }}>
              <td className="px-4 py-3 font-medium text-ink-primary">{row.market}</td>
              <Cell value={row.foreign} />
              <Cell value={row.institution} />
              <Cell value={row.individual} />
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
