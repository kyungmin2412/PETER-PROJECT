import { DeltaPercent } from "@/components/ui/Delta";
import type { SectorItem } from "@/lib/types";

function heatBackground(changePercent: number) {
  const magnitude = Math.min(Math.abs(changePercent) / 2, 1);
  const alpha = 0.12 + magnitude * 0.34;
  const color = changePercent >= 0 ? "230, 103, 103" : "57, 135, 229";
  return `rgba(${color}, ${alpha})`;
}

export function SectorGrid({ sectors }: { sectors: SectorItem[] }) {
  const sorted = [...sectors].sort((a, b) => b.changePercent - a.changePercent);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {sorted.map((s) => (
        <div
          key={s.symbol}
          className="rounded-lg border p-3"
          style={{ background: heatBackground(s.changePercent), borderColor: "var(--border)" }}
        >
          <div className="text-sm font-medium text-ink-primary">{s.name}</div>
          <div className="text-[11px] text-ink-muted">{s.symbol}</div>
          <div className="mt-1.5 text-base">
            <DeltaPercent value={s.changePercent} />
          </div>
        </div>
      ))}
    </div>
  );
}
