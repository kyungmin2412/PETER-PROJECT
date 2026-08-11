// Generates src/data/latest.json with placeholder candle series.
// Real data replaces this file via scripts/fetch_market_data.py + fetch_korea_data.py.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h;
}

function tradingDates(startISO, endISO) {
  const dates = [];
  const d = new Date(startISO + "T00:00:00Z");
  const end = new Date(endISO + "T00:00:00Z");
  while (d <= end) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) {
      dates.push(d.toISOString().slice(0, 10));
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

function genCandles({ symbol, dates, last, change, domain, decimals }) {
  const rng = mulberry32(hashSeed(symbol));
  const n = dates.length;
  const prevLast = last - change;
  const [lo, hi] = domain;
  const span = hi - lo;
  // Random walk anchored so close[n-2] = prevLast, close[n-1] = last.
  const closes = new Array(n);
  const mid = lo + span * 0.5;
  closes[0] = mid + (rng() - 0.5) * span * 0.3;
  for (let i = 1; i < n - 1; i++) {
    const target = prevLast;
    const remaining = n - 1 - i;
    const pull = (target - closes[i - 1]) / Math.max(remaining, 1);
    const noise = (rng() - 0.5) * span * 0.12;
    let next = closes[i - 1] + pull * 0.55 + noise;
    next = Math.min(hi, Math.max(lo, next));
    closes[i] = next;
  }
  closes[n - 2] = prevLast;
  closes[n - 1] = last;
  const round = (v) => Number(v.toFixed(decimals));
  const candles = [];
  for (let i = 0; i < n; i++) {
    const prevClose = i === 0 ? closes[0] - (rng() - 0.5) * span * 0.05 : closes[i - 1];
    const open = round(prevClose + (rng() - 0.5) * span * 0.03);
    const close = round(closes[i]);
    const hiWick = round(Math.max(open, close) + rng() * span * 0.025);
    const loWick = round(Math.min(open, close) - rng() * span * 0.025);
    candles.push({
      date: dates[i],
      open,
      high: Math.max(hiWick, open, close),
      low: Math.min(loWick, open, close),
      close,
    });
  }
  return candles;
}

const dates = tradingDates("2026-07-08", "2026-08-07");

function series({ symbol, name, unit, last, change, changePercent, domain, decimals, asOf }) {
  return {
    symbol,
    name,
    unit,
    last,
    change,
    changePercent,
    asOf,
    candles: genCandles({ symbol, dates, last, change, domain, decimals }),
  };
}

const asOfUS = "2026-08-07 (금) 미국 시장 종가 · 뉴욕 16:00 EDT";
const asOfKR = "2026-08-07 (금) 한국 시장 종가";

const data = {
  generatedAt: "2026-08-09T06:10:00+09:00",
  asOfLabel: asOfUS,
  forUser: "Peterk",
  us: {
    nasdaq: series({
      symbol: "IXIC",
      name: "나스닥종합지수",
      last: 26690.62,
      change: 342.26,
      changePercent: 1.3,
      domain: [24400, 26800],
      decimals: 2,
      asOf: asOfUS,
    }),
    sp500: series({
      symbol: "SPX",
      name: "S&P500",
      last: 6420.18,
      change: 48.32,
      changePercent: 0.76,
      domain: [6100, 6480],
      decimals: 2,
      asOf: asOfUS,
    }),
    dow: series({
      symbol: "DJI",
      name: "다우존스",
      last: 44890.55,
      change: -62.14,
      changePercent: -0.14,
      domain: [43200, 45400],
      decimals: 2,
      asOf: asOfUS,
    }),
    us10y: series({
      symbol: "US10Y",
      name: "미국 10년물 국채금리",
      unit: "%",
      last: 4.658,
      change: -0.012,
      changePercent: -0.26,
      domain: [4.48, 4.78],
      decimals: 3,
      asOf: asOfUS,
    }),
    wti: series({
      symbol: "CL",
      name: "WTI유",
      unit: "$/bbl",
      last: 77.08,
      change: -0.21,
      changePercent: -0.27,
      domain: [71.5, 88.0],
      decimals: 2,
      asOf: asOfUS,
    }),
    sectors: [
      { name: "임의소비재", symbol: "XLY", changePercent: 1.49 },
      { name: "소재", symbol: "XLB", changePercent: 1.32 },
      { name: "유틸리티", symbol: "XLU", changePercent: 0.53 },
      { name: "산업재", symbol: "XLI", changePercent: 0.23 },
      { name: "필수소비재", symbol: "XLP", changePercent: 0.01 },
      { name: "에너지", symbol: "XLE", changePercent: -1.13 },
      { name: "정보기술", symbol: "XLK", changePercent: 1.42 },
      { name: "헬스케어", symbol: "XLV", changePercent: 0.75 },
      { name: "부동산", symbol: "XLRE", changePercent: 0.38 },
      { name: "통신서비스", symbol: "XLC", changePercent: 0.06 },
      { name: "금융", symbol: "XLF", changePercent: -0.36 },
      { name: "반도체", symbol: "SOXX", changePercent: 2.02 },
    ],
  },
  korea: {
    kospi: series({
      symbol: "KOSPI",
      name: "코스피",
      last: 6258.77,
      change: -37.61,
      changePercent: -0.6,
      domain: [5900, 8000],
      decimals: 2,
      asOf: asOfKR,
    }),
    kosdaq: series({
      symbol: "KOSDAQ",
      name: "코스닥",
      last: 798.81,
      change: -2.86,
      changePercent: -0.36,
      domain: [710, 890],
      decimals: 2,
      asOf: asOfKR,
    }),
    usdkrw: series({
      symbol: "USDKRW",
      name: "달러/원",
      last: 1407.04,
      change: -15.85,
      changePercent: -1.11,
      domain: [1405, 1510],
      decimals: 2,
      asOf: asOfUS,
    }),
    customerDeposits: {
      latest: 102.8,
      asOf: "2026.08.05 집계 (협회 공표 1~2영업일 지연)",
      series: [
        { date: "2026-06-16", amount: 134.5 },
        { date: "2026-06-23", amount: 136.8 },
        { date: "2026-06-26", amount: 128.4 },
        { date: "2026-07-08", amount: 119.2 },
        { date: "2026-07-21", amount: 111.6 },
        { date: "2026-07-31", amount: 104.1 },
        { date: "2026-08-05", amount: 102.8 },
      ],
    },
  },
  meta: {
    sources: ["Yahoo Finance (yfinance)", "한국거래소(KRX) / pykrx", "금융투자협회(KOFIA)"],
    disclaimer: "본 대시보드는 정보 제공 목적이며 투자 판단의 근거로 사용할 수 없습니다.",
    dataMode: "sample",
  },
};

writeFileSync(join(__dirname, "..", "src", "data", "latest.json"), JSON.stringify(data, null, 2) + "\n");
console.log("Wrote src/data/latest.json");
