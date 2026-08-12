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
    bigTech: [
      { category: "HW", name: "애플", ticker: "AAPL", price: 304.91, change: 1.24, changePercent: 0.41, changePercent1w: 2.1, changePercent1m: 5.4, asOf: asOfUS },
      { category: "SW", name: "마이크로소프트", ticker: "MSFT", price: 503.81, change: -2.15, changePercent: -0.43, changePercent1w: 1.3, changePercent1m: 3.8, asOf: asOfUS },
      { category: "광고", name: "알파벳", ticker: "GOOGL", price: 343.80, change: 3.60, changePercent: 1.06, changePercent1w: 4.2, changePercent1m: 9.1, asOf: asOfUS },
      { category: "우주", name: "스페이스X", ticker: "SPCX", price: 133.29, change: -0.85, changePercent: -0.63, changePercent1w: -2.4, changePercent1m: 6.7, asOf: asOfUS },
      { category: "이커머스", name: "아마존", ticker: "AMZN", price: 272.27, change: 2.22, changePercent: 0.82, changePercent1w: 1.9, changePercent1m: 4.0, asOf: asOfUS },
      { category: "광고", name: "메타", ticker: "META", price: 599.12, change: -4.30, changePercent: -0.71, changePercent1w: 0.6, changePercent1m: 2.5, asOf: asOfUS },
    ],
    aiHardware: [
      { category: "엔비디아", name: "엔비디아", ticker: "NVDA", price: 217.5, change: 1.65, changePercent: 0.76, changePercent1w: -3.75, changePercent1m: -1.95, asOf: asOfUS },
      { category: "ASIC/네트워킹", name: "브로드컴", ticker: "AVGO", price: 416.08, change: -3.79, changePercent: -0.91, changePercent1w: 3.36, changePercent1m: 6.89, asOf: asOfUS },
      { category: "ASIC/네트워킹", name: "마벨테크놀로지", ticker: "MRVL", price: 212.31, change: 3.76, changePercent: 1.77, changePercent1w: -3.13, changePercent1m: 1.28, asOf: asOfUS },
      { category: "GPU", name: "AMD", ticker: "AMD", price: 474.32, change: -7.97, changePercent: -1.68, changePercent1w: -1.81, changePercent1m: 3.12, asOf: asOfUS },
      { category: "메모리", name: "마이크론테크놀로지", ticker: "MU", price: 868.52, change: -14.68, changePercent: -1.69, changePercent1w: -2.01, changePercent1m: 6.3, asOf: asOfUS },
      { category: "SSD", name: "샌디스크", ticker: "SNDK", price: 1271.05, change: 4.83, changePercent: 0.38, changePercent1w: -1.8, changePercent1m: 4.96, asOf: asOfUS },
      { category: "HDD", name: "웨스턴디지털", ticker: "WDC", price: 437.93, change: 6.31, changePercent: 1.44, changePercent1w: -3.94, changePercent1m: 9.73, asOf: asOfUS },
      { category: "네트워킹", name: "아스테라랩스", ticker: "ALAB", price: 311.99, change: 3.09, changePercent: 0.99, changePercent1w: -0.6, changePercent1m: -4.58, asOf: asOfUS },
      { category: "네트워킹", name: "크레도테크놀로지", ticker: "CRDO", price: 247.69, change: 5.03, changePercent: 2.03, changePercent1w: -0.63, changePercent1m: -5.96, asOf: asOfUS },
      { category: "네트워킹", name: "아리스타네트웍스", ticker: "ANET", price: 197.85, change: -2.79, changePercent: -1.41, changePercent1w: 4.47, changePercent1m: 5.28, asOf: asOfUS },
      { category: "광연결", name: "루멘텀홀딩스", ticker: "LITE", price: 820.59, change: 11.73, changePercent: 1.43, changePercent1w: 3.3, changePercent1m: 3.8, asOf: asOfUS },
      { category: "광연결", name: "코히런트", ticker: "COHR", price: 328.57, change: 6.87, changePercent: 2.09, changePercent1w: -0.21, changePercent1m: 4.14, asOf: asOfUS },
      { category: "구리/광", name: "세미테크", ticker: "SMTC", price: 131.18, change: 1.99, changePercent: 1.52, changePercent1w: 2.19, changePercent1m: 10.96, asOf: asOfUS },
      { category: "트랜시버", name: "어플라이드옵토일렉트로닉스", ticker: "AAOI", price: 134.33, change: 0.69, changePercent: 0.51, changePercent1w: 3.05, changePercent1m: -6.99, asOf: asOfUS },
      { category: "DCI", name: "바이아비솔루션즈", ticker: "VIAV", price: 38.4, change: -0.34, changePercent: -0.89, changePercent1w: -1.11, changePercent1m: -6.24, asOf: asOfUS },
      { category: "DCI", name: "키사이트테크놀로지스", ticker: "KEYS", price: 343.7, change: -2.99, changePercent: -0.87, changePercent1w: -2.99, changePercent1m: -1.88, asOf: asOfUS },
      { category: "전력/냉각", name: "버티브홀딩스", ticker: "VRT", price: 281.81, change: 2.09, changePercent: 0.74, changePercent1w: -0.35, changePercent1m: 0.14, asOf: asOfUS },
      { category: "서버", name: "슈퍼마이크로컴퓨터", ticker: "SMCI", price: 31.6, change: -0.3, changePercent: -0.96, changePercent1w: -1.33, changePercent1m: 12.61, asOf: asOfUS },
      { category: "번인장비", name: "에어테스트시스템즈", ticker: "AEHR", price: 117.18, change: 0.93, changePercent: 0.79, changePercent1w: 2.09, changePercent1m: -4.23, asOf: asOfUS },
      { category: "전력반도체", name: "바이코", ticker: "VICR", price: 210.88, change: 2.36, changePercent: 1.12, changePercent1w: -2.37, changePercent1m: 0.35, asOf: asOfUS },
      { category: "전력반도체", name: "나비타스세미컨덕터", ticker: "NVTS", price: 13.6, change: 0.29, changePercent: 2.16, changePercent1w: 2.4, changePercent1m: 4.25, asOf: asOfUS },
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
    sources: ["Yahoo Finance (yfinance)", "네이버금융 (finance.naver.com)"],
    disclaimer: "본 대시보드는 정보 제공 목적이며 투자 판단의 근거로 사용할 수 없습니다.",
    dataMode: "sample",
  },
};

writeFileSync(join(__dirname, "..", "src", "data", "latest.json"), JSON.stringify(data, null, 2) + "\n");
console.log("Wrote src/data/latest.json");
