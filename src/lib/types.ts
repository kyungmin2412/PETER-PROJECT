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

export interface SectorItem {
  name: string;
  symbol: string;
  changePercent: number;
}

export interface BigTechItem {
  category: string;
  name: string;
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  changePercent1w: number;
  changePercent1m: number;
  asOf: string;
}

export interface DepositPoint {
  date: string;
  amount: number;
}

export interface CustomerDeposits {
  latest: number;
  asOf: string;
  series: DepositPoint[];
  estimated?: boolean;
}

export interface InvestorFlowItem {
  rank: number;
  name: string;
  code: string;
  netAmount: number;
}

export interface InvestorFlowData {
  asOf: string;
  foreignBuy: InvestorFlowItem[];
  foreignSell: InvestorFlowItem[];
  institutionBuy: InvestorFlowItem[];
  institutionSell: InvestorFlowItem[];
}

export interface UsMarketData {
  nasdaq: PriceSeries;
  sp500: PriceSeries;
  dow: PriceSeries;
  us10y: PriceSeries;
  wti: PriceSeries;
  sectors: SectorItem[];
  bigTech: BigTechItem[];
  aiHardware: BigTechItem[];
  renewable: BigTechItem[];
  powerInfra: BigTechItem[];
  enterprise: BigTechItem[];
  gpuColo: BigTechItem[];
}

export interface KoreaMarketData {
  kospi: PriceSeries;
  kosdaq: PriceSeries;
  usdkrw: PriceSeries;
  customerDeposits: CustomerDeposits;
  investorFlow: InvestorFlowData;
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
  us: UsMarketData;
  korea: KoreaMarketData;
  meta: DashboardMeta;
}
