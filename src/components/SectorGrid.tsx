import { DeltaPercent } from "@/components/ui/Delta";
import type { SectorItem } from "@/lib/types";

function heatBackground(changePercent: number) {
  const magnitude = Math.min(Math.abs(changePercent) / 2, 1);
  const alpha = 0.06 + magnitude * 0.16;
  const color = changePercent >= 0 ? "240, 68, 82" : "49, 130, 246";
  return `rgba(${color}, ${alpha})`;
}

export function SectorGrid({ sectors }: { sectors: SectorItem[] }) {
  const sorted = [...sectors].sort((a, b) => b.changePercent - a.changePercent);
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
      {sorted.map((s) => (
        <div
          key={s.symbol}
          className="rounded-2xl p-4 transition-transform hover:-translate-y-0.5"
          style={{ background: heatBackground(s.changePercent) }}
        >
          <div className="text-sm font-medium text-ink-primary">{s.name}</div>
          <div className="text-xs text-ink-muted">{s.symbol}</div>
          <div className="mt-2 text-base font-semibold">
            <DeltaPercent value={s.changePercent} />
          </div>
        </div>
      ))}
    </div>
  );
}
