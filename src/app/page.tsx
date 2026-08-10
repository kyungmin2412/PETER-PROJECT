import type { ReactNode } from "react";
import rawData from "@/data/latest.json";
import type { DashboardData } from "@/lib/types";
import { Header } from "@/components/Header";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PriceCard } from "@/components/PriceCard";
import { WatchlistTable } from "@/components/WatchlistTable";
import { SectorGrid } from "@/components/SectorGrid";
import { NewsList } from "@/components/NewsList";
import { NetBuyTable } from "@/components/NetBuyTable";
import { DepositChart } from "@/components/DepositChart";
import { TopBuyersTable } from "@/components/TopBuyersTable";
import { DeviationSection } from "@/components/DeviationSection";
import { VolatilitySection } from "@/components/VolatilitySection";

const data = rawData as unknown as DashboardData;

const NAV = [
  { id: "macro", label: "매크로" },
  { id: "watchlist", label: "관심종목" },
  { id: "sectors", label: "섹터" },
  { id: "macro-themes", label: "매크로 이슈" },
  { id: "stock-catalysts", label: "종목 영향" },
  { id: "sector-leaders", label: "섹터 동향" },
  { id: "policy", label: "정책" },
  { id: "most-watched", label: "인기종목" },
  { id: "korea", label: "한국 시장" },
  { id: "deviation", label: "이격도" },
  { id: "volatility", label: "V-KOSPI" },
  { id: "korea-issues", label: "한국 이슈" },
  { id: "stock-news", label: "종목 뉴스" },
];

function Section({
  id,
  index,
  title,
  subtitle,
  children,
}: {
  id: string;
  index: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 py-8">
      <SectionHeader index={index} title={title} subtitle={subtitle} />
      {children}
    </section>
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
        className="sticky top-0 z-10 overflow-x-auto backdrop-blur"
        style={{ background: "var(--nav-bg)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="mx-auto flex max-w-6xl gap-1.5 px-4 py-3 text-sm">
          {NAV.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="whitespace-nowrap rounded-full px-3 py-1.5 font-medium text-ink-secondary transition-colors hover:bg-[var(--surface-2)] hover:text-ink-primary"
            >
              {item.label}
            </a>
          ))}
        </div>
      </nav>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4">
        <Section id="macro" index={1} title="매크로 지표" subtitle="Macro · Daily Candle">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PriceCard series={data.macro.nasdaq} />
            <PriceCard series={data.macro.us10y} />
            <PriceCard series={data.macro.usdkrw} />
            <PriceCard series={data.macro.wti} />
          </div>
        </Section>

        <Section id="watchlist" index={2} title="주요 종목" subtitle="Watchlist · US Close">
          <WatchlistTable items={data.watchlist} />
        </Section>

        <Section id="sectors" index={3} title="섹터별 등락" subtitle="S&P 500 GICS · SPDR ETF">
          <SectorGrid sectors={data.sectors} />
        </Section>

        <Section id="macro-themes" index={4} title="매크로 핵심 이슈 TOP 3" subtitle="Top Macro Themes">
          <NewsList items={data.macroThemes} />
        </Section>

        <Section id="stock-catalysts" index={5} title="보유·관심 종목 영향 이슈" subtitle="Stock Catalysts">
          <NewsList items={data.stockCatalysts} />
        </Section>

        <Section id="sector-leaders" index={6} title="섹터별 시총 상위 종목 동향" subtitle="Sector Leaders">
          <NewsList items={data.sectorLeaders} />
        </Section>

        <Section id="policy" index={7} title="트럼프·정책 동향" subtitle="Policy Watch">
          <NewsList items={data.policyWatch} />
        </Section>

        <Section id="most-watched" index={8} title="인기 종목 뉴스" subtitle="Most-Watched">
          <NewsList items={data.mostWatched} />
        </Section>

        <Section id="korea" index={9} title="한국 시장" subtitle="직전 거래일 종가 기준">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <PriceCard series={data.korea.kospi} />
            <PriceCard series={data.korea.kosdaq} />
            <PriceCard series={data.korea.usdkrw} />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <NetBuyTable rows={data.korea.netBuy} />
            <DepositChart points={data.korea.depositTrend} asOf={data.korea.depositAsOf} />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TopBuyersTable title="외국인 순매수 TOP 6" rows={data.korea.topBuyersForeign} />
            <TopBuyersTable title="기관 순매수 TOP 6" rows={data.korea.topBuyersInstitution} />
          </div>
        </Section>

        <Section id="deviation" index={10} title="코스피 60일 이격도" subtitle="추정치">
          <DeviationSection data={data.korea.deviation} />
        </Section>

        <Section id="volatility" index={11} title="코스피 변동성지수" subtitle="V-KOSPI (KSVKOSPI)">
          <VolatilitySection data={data.korea.volatility} />
        </Section>

        <Section id="korea-issues" index={12} title="한국 시장 이슈" subtitle="Market · Flow · Policy">
          <NewsList items={data.koreaIssues} />
        </Section>

        <Section id="stock-news" index={13} title="관심종목 주요 뉴스" subtitle="Catalysts · 실적 · 공시 · 목표가">
          <NewsList items={data.stockNews} />
        </Section>
      </main>

      <footer className="border-t py-8" style={{ borderColor: "var(--border)" }}>
        <div className="mx-auto max-w-6xl px-4 text-xs text-ink-muted">
          <p>출처 {data.meta.sources.join(" · ")}</p>
          <p className="mt-2">면책 {data.meta.disclaimer}</p>
        </div>
      </footer>
    </>
  );
}
