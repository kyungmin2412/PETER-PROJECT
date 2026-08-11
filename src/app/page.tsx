import type { ReactNode } from "react";
import rawData from "@/data/latest.json";
import type { DashboardData } from "@/lib/types";
import { Header } from "@/components/Header";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PriceCard } from "@/components/PriceCard";
import { SectorGrid } from "@/components/SectorGrid";
import { DepositChart } from "@/components/DepositChart";

const data = rawData as unknown as DashboardData;

const NAV = [
  { id: "us", label: "미국 시장" },
  { id: "korea", label: "한국 시장" },
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
        <Section id="us" index={1} title="미국 시장" subtitle="Indices · Rates · Sectors">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PriceCard series={data.us.nasdaq} />
            <PriceCard series={data.us.sp500} />
            <PriceCard series={data.us.dow} />
            <PriceCard series={data.us.us10y} />
            <PriceCard series={data.us.wti} />
          </div>
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-medium text-ink-secondary">섹터별 ETF 등락률</h3>
            <SectorGrid sectors={data.us.sectors} />
          </div>
        </Section>

        <Section id="korea" index={2} title="한국 시장" subtitle="Indices · FX · Deposits">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PriceCard series={data.korea.kospi} />
            <PriceCard series={data.korea.kosdaq} />
            <PriceCard series={data.korea.usdkrw} />
          </div>
          <div className="mt-6">
            <DepositChart
              points={data.korea.customerDeposits.series}
              asOf={data.korea.customerDeposits.asOf}
            />
          </div>
        </Section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 py-8 text-xs text-ink-muted">
        <p>{data.meta.disclaimer}</p>
        <p className="mt-1">출처: {data.meta.sources.join(", ")}</p>
      </footer>
    </>
  );
}
