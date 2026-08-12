import type { ReactNode } from "react";
import rawData from "@/data/latest.json";
import type { DashboardData } from "@/lib/types";
import { Header } from "@/components/Header";
import { StatTile } from "@/components/StatTile";
import { SectorGrid } from "@/components/SectorGrid";
import { BigTechTable } from "@/components/BigTechTable";
import { InvestorFlowGrid } from "@/components/InvestorFlowGrid";
import { DepositChart } from "@/components/DepositChart";

const data = rawData as unknown as DashboardData;

function MarketPanel({
  id,
  flag,
  title,
  subtitle,
  children,
}: {
  id: string;
  flag: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-16 px-4 py-6 lg:px-6 lg:py-8">
      <div className="mb-5 flex items-baseline justify-between gap-2 border-b pb-3" style={{ borderColor: "var(--border)" }}>
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink-primary">
          <span aria-hidden>{flag}</span>
          {title}
        </h2>
        <span className="text-[11px] text-ink-muted">{subtitle}</span>
      </div>
      {children}
    </div>
  );
}

export default function Home() {
  return (
    <>
      <Header
        asOfLabel={data.asOfLabel}
        generatedAt={data.generatedAt}
        forUser={data.forUser}
        dataMode={data.meta.dataMode}
      />

      <nav
        className="sticky top-0 z-10 flex gap-2 border-b px-4 py-2 backdrop-blur lg:hidden"
        style={{ background: "var(--nav-bg)", borderColor: "var(--border)" }}
      >
        <a href="#us" className="flex-1 rounded-full px-3 py-2 text-center text-sm font-medium text-ink-secondary transition-colors hover:bg-[var(--surface-2)] hover:text-ink-primary">
          🇺🇸 미국 시장
        </a>
        <a href="#korea" className="flex-1 rounded-full px-3 py-2 text-center text-sm font-medium text-ink-secondary transition-colors hover:bg-[var(--surface-2)] hover:text-ink-primary">
          🇰🇷 한국 시장
        </a>
      </nav>

      <main className="mx-auto grid w-full max-w-6xl flex-1 lg:grid-cols-2 lg:divide-x" style={{ borderColor: "var(--border)" }}>
        <MarketPanel id="us" flag="🇺🇸" title="미국 시장" subtitle={data.us.nasdaq.asOf}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatTile series={data.us.nasdaq} />
            <StatTile series={data.us.sp500} />
            <StatTile series={data.us.dow} />
            <StatTile series={data.us.us10y} />
            <StatTile series={data.us.wti} />
          </div>
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-medium text-ink-secondary">섹터별 ETF 등락률</h3>
            <SectorGrid sectors={data.us.sectors} />
          </div>
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-medium text-ink-secondary">빅테크</h3>
            <BigTechTable items={data.us.bigTech} />
          </div>
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-medium text-ink-secondary">AI HW</h3>
            <BigTechTable items={data.us.aiHardware} />
          </div>
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-medium text-ink-secondary">신재생</h3>
            <BigTechTable items={data.us.renewable} />
          </div>
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-medium text-ink-secondary">전력기기/인프라</h3>
            <BigTechTable items={data.us.powerInfra} />
          </div>
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-medium text-ink-secondary">Enterprise</h3>
            <BigTechTable items={data.us.enterprise} />
          </div>
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-medium text-ink-secondary">GPU/Colo</h3>
            <BigTechTable items={data.us.gpuColo} />
          </div>
        </MarketPanel>

        <MarketPanel id="korea" flag="🇰🇷" title="한국 시장" subtitle={data.korea.kospi.asOf}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatTile series={data.korea.kospi} />
            <StatTile series={data.korea.kosdaq} />
            <StatTile series={data.korea.usdkrw} />
          </div>
          <div className="mt-6">
            <DepositChart
              points={data.korea.customerDeposits.series}
              asOf={data.korea.customerDeposits.asOf}
            />
          </div>
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-medium text-ink-secondary">외국인/기관 순매수·순매도 상위 (거래대금순)</h3>
            <InvestorFlowGrid data={data.korea.investorFlow} />
          </div>
        </MarketPanel>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 py-8 text-xs text-ink-muted">
        <p>{data.meta.disclaimer}</p>
        <p className="mt-1">출처: {data.meta.sources.join(", ")}</p>
      </footer>
    </>
  );
}
