"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { formatSigned } from "@/lib/format";
import type { InvestorFlowData, InvestorFlowItem, InvestorFlowPeriod } from "@/lib/types";

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

const PERIODS: { key: keyof InvestorFlowData; label: string }[] = [
  { key: "daily", label: "전일" },
  { key: "weekly", label: "1주일 누적" },
  { key: "monthly", label: "1개월 누적" },
];

export function InvestorFlowGrid({ data }: { data: InvestorFlowData }) {
  const [period, setPeriod] = useState<keyof InvestorFlowData>("daily");
  const active: InvestorFlowPeriod = data[period];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
              style={
                period === p.key
                  ? { background: "var(--accent)", color: "#ffffff" }
                  : { background: "var(--surface-2)", color: "var(--ink-secondary)" }
              }
            >
              {p.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-ink-muted">{active.asOf}</span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <RankList title="외국인 순매수 상위" items={active.foreignBuy} tone="up" />
        <RankList title="외국인 순매도 상위" items={active.foreignSell} tone="down" />
        <RankList title="기관 순매수 상위" items={active.institutionBuy} tone="up" />
        <RankList title="기관 순매도 상위" items={active.institutionSell} tone="down" />
      </div>
    </div>
  );
}
