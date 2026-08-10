export interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface PriceSeries {
  symbol: string;
  name: string;
  unit?: string;
  last: number;
  change: number;
  changePercent: number;
  candles: Candle[];
  asOf: string;
}

export interface WatchlistItem {
  name: string;
  symbol: string;
  close: number;
  changePercent: number | null;
  change: number | null;
  comment?: string;
}

export interface SectorItem {
  name: string;
  symbol: string;
  changePercent: number;
}

export interface NewsLink {
  label: string;
  url: string;
}

export interface NewsItem {
  title: string;
  body?: string;
  links?: NewsLink[];
}

export interface InvestorNetBuy {
  market: string;
  foreign: number;
  institution: number;
  individual: number;
}

export interface TopBuyer {
  rank: number;
  name: string;
  amount: number;
  change: number;
}

export interface DepositPoint {
  date: string;
  amount: number;
}

export type DeviationZone =
  | "extreme_oversold"
  | "oversold"
  | "neutral"
  | "overbought"
  | "extreme_overbought";

export interface DeviationIndex {
  value: number;
  ma: number;
  close: number;
  asOf: string;
  zone: DeviationZone;
  estimated?: boolean;
}

export interface VolatilityPoint {
  date: string;
  value: number;
}

export interface VolatilityIndex {
  value: number;
  change: number;
  changePercent: number;
  prevClose: number;
  week52Low: number;
  week52High: number;
  oneYearChangePercent: number;
  series: VolatilityPoint[];
  asOf: string;
  stale?: boolean;
  staleNote?: string;
}

export interface KoreaMarketData {
  kospi: PriceSeries;
  kosdaq: PriceSeries;
  usdkrw: PriceSeries;
  netBuy: InvestorNetBuy[];
  depositTrend: DepositPoint[];
  depositAsOf: string;
  topBuyersForeign: TopBuyer[];
  topBuyersInstitution: TopBuyer[];
  deviation: DeviationIndex;
  volatility: VolatilityIndex;
}

export interface DashboardMeta {
  sources: string[];
  disclaimer: string;
  dataMode: "sample" | "live";
}

export interface DashboardData {
  generatedAt: string;
  asOfLabel: string;
  forUser?: string;
  macro: {
    nasdaq: PriceSeries;
    us10y: PriceSeries;
    usdkrw: PriceSeries;
    wti: PriceSeries;
  };
  watchlist: WatchlistItem[];
  sectors: SectorItem[];
  macroThemes: NewsItem[];
  stockCatalysts: NewsItem[];
  sectorLeaders: NewsItem[];
  policyWatch: NewsItem[];
  mostWatched: NewsItem[];
  korea: KoreaMarketData;
  koreaIssues: NewsItem[];
  stockNews: NewsItem[];
  meta: DashboardMeta;
}
