// Generates src/data/latest.json with placeholder candle series anchored to the
// sample values from the "US Market Daily" reference PDF (2026-08-07 US close).
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
  macro: {
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
  },
  watchlist: [
    { name: "마이크론", symbol: "MU", close: 877.57, change: -3.9, changePercent: -0.44, comment: "폐장후 880.00 · 씨티 TP 1,150 하향" },
    { name: "SK하이닉스(ADR)", symbol: "SKHY", close: 137.91, change: -5.62, changePercent: -3.92, comment: "38조원 신규 팹 승인 → 공급 우려" },
    { name: "샌디스크", symbol: "SNDK", close: 1212.21, change: -46.37, changePercent: -3.68, comment: "실적 서프라이즈에도 가이던스 실망" },
    { name: "키옥시아(도쿄)", symbol: "285A.T", close: 47730, change: -1010, changePercent: -2.07, comment: "8/7 도쿄 종가 · 엔화" },
    { name: "엔비디아", symbol: "NVDA", close: 223.96, change: 4.97, changePercent: 2.27, comment: "SpaceX AI 인프라 전량 채택 · 주간 +11%" },
    { name: "알파벳 A", symbol: "GOOGL", close: 354.3, change: -3.45, changePercent: -0.96, comment: "250억달러 회사채 발행 보도" },
    { name: "아마존닷컴", symbol: "AMZN", close: 274.48, change: 2.22, changePercent: 0.82, comment: "AWS 연환산 169B · 캐펙스 220B 상향" },
    { name: "마이크로소프트", symbol: "MSFT", close: 499.99, change: 0.13, changePercent: 0.03, comment: "Azure 성장, 실적 후 +16% 유지" },
    { name: "TSMC(ADR)", symbol: "TSM", close: 420.04, change: 1.84, changePercent: 0.44, comment: "연 캐펙스 600~640억달러로 상향" },
    { name: "인텔", symbol: "INTC", close: 101.65, change: 1.84, changePercent: 1.84, comment: "반도체 관세 수혜 기대, 낙폭 회복" },
    { name: "애플", symbol: "AAPL", close: 313.33, change: 0.92, changePercent: 0.29, comment: "인도 매출 100억달러 · 메모리 원가 부담" },
    { name: "테슬라", symbol: "TSLA", close: 328.58, change: 8.95, changePercent: 2.8, comment: "SpaceX와 Terafab 168억달러 반도체 팹" },
    { name: "일라이릴리", symbol: "LLY", close: 1185.71, change: 6.23, changePercent: 0.52, comment: "2분기 서프라이즈, 사상 최고권" },
    { name: "코인베이스", symbol: "COIN", close: 148.0, change: null, changePercent: null, comment: "예측시장 소송 패소 · 52주 저점권 *" },
  ],
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
    { name: "반도체(참고)", symbol: "SOXX", changePercent: 2.02 },
  ],
  macroThemes: [
    {
      title: "① 고용 쇼크와 연준",
      body: "7월 비농업고용이 2.3만 명 감소(예상 +8만), 직전 2개월도 10만 명 이상 하향 수정. 실업률은 4.1%로 내렸지만 경제활동참가율이 61.4%로 5년래 최저까지 떨어진 결과라 질은 나쁨. 9월 인상 확률이 58%→42%로 후퇴하며 위험자산 랠리. 다만 워시 의장은 인플레 지표가 뜨거우면 9월 인상도 가능하다는 입장(FT). 다음 주 CPI(수)·PPI(목)·소매판매(금)가 분기점.",
      links: [
        { label: "CNBC", url: "https://www.cnbc.com" },
        { label: "Yahoo", url: "https://finance.yahoo.com" },
        { label: "WaPo", url: "https://www.washingtonpost.com" },
      ],
    },
    {
      title: "② 호르무즈 해협",
      body: "이란-오만 재개 협상이 교착. 이란은 미국·이스라엘 선박 배제와 통행료를 요구하고 미국은 전쟁 이전 상태 복귀를 주장. ADNOC은 통항 선박 3척 피격을 보고. WTI는 금요일 반등했으나 주간 -7%. 재개 시 중동 물량이 대거 복귀해 유가 추가 하락 여지.",
      links: [
        { label: "TradingEconomics", url: "https://tradingeconomics.com" },
        { label: "Oilprice", url: "https://oilprice.com" },
      ],
    },
    {
      title: "③ AI 캐펙스 자금조달 경쟁",
      body: "알파벳 250억달러 회사채, 아마존 2026 캐펙스 220B 상향, 테슬라 250억달러+ 상향. 금리 하락이 조달 창구를 열어준 것이 이번 주 성장주 랠리의 실질 동력이며, 동시에 채권시장이 AI 사이클의 새로운 병목이 됐다는 뜻이기도 함.",
      links: [
        { label: "Alphabet 채권", url: "https://abc.xyz" },
        { label: "美10년물", url: "https://fred.stlouisfed.org" },
      ],
    },
  ],
  stockCatalysts: [
    {
      title: "메모리 3인방이 이번 주 최대 변수",
      body: "씨티가 마이크론 목표가를 18% 낮춘 1,150달러로 하향하며 \"메모리 가격은 내년 정점\"을 제시. 샌디스크는 4분기 매출 89.6억달러(+370% YoY, 컨센 +6.8% 상회)에도 가이던스가 눈높이에 못 미쳐 -3.68%. 제프리스 3,000→1,750, 미즈호 2,200→1,900로 목표가가 급락한 반면 RBC는 1,000→1,300 상향으로 시각이 갈림. 8/13 샌디스크 인베스터데이가 1차 분기점.",
      links: [{ label: "MU 뉴스", url: "#" }, { label: "MU 분석", url: "#" }, { label: "SNDK", url: "#" }],
    },
    {
      title: "SK하이닉스 ADR -3.92%",
      body: "38조원 규모 신규 팹 승인이 호재가 아니라 공급 확대 우려로 해석됨. 메모리 업사이클의 지속성을 시장이 의심하기 시작했다는 신호.",
      links: [{ label: "CNBC 반도체", url: "#" }],
    },
    {
      title: "엔비디아 +2.27%, 주간 +11%",
      body: "머스크가 SpaceX AI 인프라를 엔비디아로만 구성한다고 발표한 것이 주중 최대 촉매. Lancium에 최대 30억달러 투자도 공시. 8/26 실적이 반도체 섹터 전체의 방향타.",
      links: [{ label: "NVDA", url: "#" }, { label: "Yahoo", url: "#" }],
    },
    {
      title: "테슬라 +2.80%",
      body: "SpaceX와 텍사스 Terafab 반도체 공장에 초기 168억달러 투자 발표. 다만 2분기 영업이익은 57% 급감(마진 1.4%)했고 제프리스는 목표가를 400→350달러로 낮춤. 자금 조달 구조가 미공개인 점이 리스크.",
      links: [{ label: "Terafab 분석", url: "#" }, { label: "Investing", url: "#" }],
    },
    {
      title: "알파벳 -0.96%",
      body: "250억달러 회사채 발행 보도로 AI 캐펙스 부담 부각. 딥마인드 핵심 인력 이탈과 하사비스 역할 개편, 영국 반독점 소송도 동시 진행. 2분기 펀더멘털(매출 +24%, 클라우드 +82%) 훼손은 아님.",
      links: [{ label: "GOOGL 뉴스", url: "#" }, { label: "Yahoo", url: "#" }],
    },
    {
      title: "아마존 +0.82%",
      body: "8/10 라스베이거스에서 Zoox 유료 로보택시 개시. 뉴저지주 반독점 소송과 베조스의 40억달러 매도 신고는 부담.",
      links: [{ label: "AMZN 뉴스", url: "#" }],
    },
    {
      title: "애플 +0.29%",
      body: "인도 매출 100억달러 돌파. 다만 메모리 원가 상승으로 4분기 가이던스는 보수적. OpenAI는 애플의 영업비밀 소송에 기각을 신청.",
      links: [{ label: "AAPL 뉴스", url: "#" }],
    },
    {
      title: "코인베이스",
      body: "미시간 연방법원이 예측시장 관련 주(州) 규제 차단 요청을 기각. 신성장 축으로 밀던 예측시장 확장에 제동이 걸렸고, 크립토 약세까지 겹쳐 52주 저점권.",
      links: [{ label: "TheStreet", url: "#" }],
    },
    {
      title: "TSMC·인텔",
      body: "TSMC는 연 캐펙스를 600~640억달러로 상향한 상태이며 폴리실리콘 관세의 원가 영향을 점검할 필요. 인텔은 SpaceX 발표 직후 급락했다가 금요일 +1.84% 회복.",
      links: [{ label: "관세 원문", url: "#" }],
    },
  ],
  sectorLeaders: [
    { title: "임의소비재 +1.49% (1위)", body: "아마존 +0.82%, 테슬라 +2.80%. 고용 둔화가 오히려 금리 기대를 낮추며 소비주에 유리하게 작동." },
    { title: "정보기술 +1.42%", body: "엔비디아 +2.27%가 최대 기여. 애플 +0.29%, MSFT +0.03%로 메가캡은 오히려 조용했고 지수 상승은 반도체가 거의 혼자 만든 것." },
    { title: "소재 +1.32%", body: "폴리실리콘 관세 수혜 기대. 미국 내 생산은 코닝 헴록과 와커 두 곳뿐이라 수혜가 집중되는 구조." },
    { title: "헬스케어 +0.75%", body: "일라이릴리 +0.52%. 2분기 서프라이즈와 가이던스 상향으로 사상 최고권 유지 중." },
    { title: "유틸리티 +0.53% / 부동산 +0.38%", body: "전자는 AI 데이터센터 전력 수요, 후자는 10년물 금리 하락 수혜. 성격이 다른 두 상승." },
    { title: "금융 -0.36%", body: "금리 하락이 곧 예대마진 축소. XLF는 7월 27일 사상 최고를 찍은 뒤 조정 국면." },
    { title: "에너지 -1.13% (최하위)", body: "셰브론·엑슨. 호르무즈 재개 기대에 따른 유가 주간 -7%가 그대로 반영. 11개 섹터 중 유일한 뚜렷한 약세." },
  ],
  policyWatch: [
    {
      title: "폴리실리콘 15% 관세 + 최저수입가격 (8/6 서명, 12/4 발효)",
      body: "원료 21달러/kg, 잉곳·웨이퍼 100달러/kg, 셀 0.22달러/W, 모듈 0.38달러/W. 섹션 232 국가안보 조사 결과물. 태양광뿐 아니라 반도체용 웨이퍼 원가에도 직결되므로 국내 반도체 소재·장비주 관점에서 반드시 추적할 사안. 수혜는 코닝 헴록·와커에 집중.",
      links: [{ label: "Bloomberg Law", url: "#" }, { label: "SupplyChainDive", url: "#" }, { label: "Quartz", url: "#" }],
    },
    {
      title: "60개국 대상 10~12.5% 관세 (7/24 발효)",
      body: "기존 10% 임시 관세를 대체하며 섹션 301 근거로 전환. 시장 반응은 예상됐던 만큼 제한적이었음.",
      links: [{ label: "CNBC", url: "#" }],
    },
    {
      title: "반도체 25% 관세는 1월부터 좁은 범위로 이미 시행 중",
      body: "여기에 폴리실리콘이 얹히는 구조.",
      links: [{ label: "Globe and Mail", url: "#" }],
    },
    {
      title: "법적 리스크",
      body: "대법원이 IEEPA를 근거로 한 기존 관세의 위법성을 심리 중. 판결에 따라 관세 체계 전반이 흔들릴 수 있어 관세 수혜주 베팅에는 양방향 리스크가 있음.",
      links: [{ label: "배경", url: "#" }],
    },
    {
      title: "이란",
      body: "호르무즈 재개 협상을 중재하며 \"곧 끝날 것\"이라는 입장. 동시에 러시아 제재법안에 이란 관세 추가를 요구 중.",
      links: [{ label: "CNBC", url: "#" }],
    },
  ],
  mostWatched: [
    {
      title: "팔란티어 172.01달러 +10.32%, 주간 +35%",
      body: "2분기 미국 상업 매출이 약 150% 급증했고 BofA가 목표가를 상향. 칼프 CEO의 \"AI 주권 수요가 폭발했다\"는 표현이 셀사이드 밸류에이션 상향의 근거로 인용됨. 거래량은 3개월 평균 대비 +75%. 이번 주 시장의 주인공.",
      links: [{ label: "Motley Fool", url: "#" }, { label: "24/7 Wall St", url: "#" }],
    },
    {
      title: "SpaceX +12%",
      body: "수요일 상장 후 사상 최저를 찍은 뒤 급반등. 6월 상장 이후로는 여전히 -16%.",
      links: [{ label: "Forbes", url: "#" }],
    },
    {
      title: "웨스턴디지털 -17%",
      body: "8월 6일 실적 실망. 샌디스크와 함께 스토리지 전반의 눈높이가 낮아지는 중.",
      links: [{ label: "SNDK 뉴스", url: "#" }],
    },
    {
      title: "마이클 버리, 오라클·네비우스 숏 재개",
      body: "AI 인프라 밸류에이션에 대한 대표적 반대 베팅으로 회자되는 중.",
      links: [{ label: "관련 뉴스", url: "#" }],
    },
    {
      title: "소프트웨어 동반 강세",
      body: "스노우플레이크 +3.93%, 데이터독 +2.02%, 클라우드플레어 +8%. 금리 하락 수혜가 가장 직접적으로 나타나는 구간.",
      links: [{ label: "Yahoo", url: "#" }],
    },
    {
      title: "금 광산주 급등",
      body: "RING +7.79%, GDX +7.11%. 실질금리 하락과 달러 약세가 동시에 작용.",
    },
  ],
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
      symbol: "USDKRW-SEOUL",
      name: "달러/원 (서울외환시장)",
      last: 1416.1,
      change: -7.7,
      changePercent: -0.54,
      domain: [1405, 1510],
      decimals: 1,
      asOf: "8/7 서울외환시장 주간거래 종가(15:30) 기준",
    }),
    netBuy: [
      { market: "코스피", foreign: -8633, institution: 5790, individual: 2670 },
      { market: "코스닥", foreign: -2540, institution: -1030, individual: 3406 },
    ],
    depositAsOf: "2026.08.05 집계 (협회 공표 1~2영업일 지연)",
    depositTrend: [
      { date: "2026-06-16", amount: 134.5 },
      { date: "2026-06-23", amount: 136.8 },
      { date: "2026-06-26", amount: 128.4 },
      { date: "2026-07-08", amount: 119.2 },
      { date: "2026-07-21", amount: 111.6 },
      { date: "2026-07-31", amount: 104.1 },
      { date: "2026-08-05", amount: 102.8 },
    ],
    topBuyersForeign: [
      { rank: 1, name: "SK스퀘어", amount: 939000, change: -31000 },
      { rank: 2, name: "TIGER 미국나스닥100", amount: 184660, change: -585 },
      { rank: 3, name: "SK이노베이션", amount: 120300, change: 11700 },
      { rank: 4, name: "KODEX 레버리지", amount: 90690, change: -1510 },
      { rank: 5, name: "셀트리온", amount: 199300, change: 4300 },
      { rank: 6, name: "삼성물산", amount: 336500, change: 2500 },
    ],
    topBuyersInstitution: [
      { rank: 1, name: "삼성전기", amount: 1278000, change: 49000 },
      { rank: 2, name: "LG에너지솔루션", amount: 360000, change: 15000 },
      { rank: 3, name: "삼성SDI", amount: 459000, change: 32000 },
      { rank: 4, name: "SK하이닉스", amount: 1422000, change: -73000 },
      { rank: 5, name: "한화솔루션", amount: 33900, change: 3500 },
      { rank: 6, name: "SK이노베이션", amount: 120300, change: 11700 },
    ],
    deviation: {
      value: 81.3,
      close: 6258.77,
      ma: 7700,
      asOf: "2026-08-07",
      zone: "extreme_oversold",
      estimated: true,
    },
    volatility: {
      value: 75.59,
      change: -1.58,
      changePercent: -2.05,
      prevClose: 77.17,
      week52Low: 18.03,
      week52High: 97.99,
      oneYearChangePercent: 263.6,
      asOf: "2026-08-07 (07/08 이후 시세 고정 · Investing.com)",
      stale: true,
      staleNote:
        "Investing.com 페이지가 \"닫음·07/08\"로 표기돼 시세가 고정돼 있습니다. 75.59는 보도 내용과 교차검증한 현재 레벨 추정치이며 8월 7일 정확한 종가는 아닙니다.",
      series: [
        { date: "2025-09-01", value: 22.4 },
        { date: "2025-11-01", value: 26.1 },
        { date: "2026-02-01", value: 29.8 },
        { date: "2026-04-01", value: 38.5 },
        { date: "2026-06-01", value: 61.2 },
        { date: "2026-06-29", value: 97.99 },
        { date: "2026-07-15", value: 88.4 },
        { date: "2026-07-31", value: 77.17 },
        { date: "2026-08-07", value: 75.59 },
      ],
    },
  },
  koreaIssues: [
    {
      title: "코스피 7주 연속 하락 — 2022년 12월 이후 최장",
      body: "주간으로 6,595.45→6,258.77, -336.68p(-5.10%). 8월 7일 당일은 1.09% 상승 출발해 장중 6,415.60까지 갔다가 6,264.00까지 밀린 전강후약. 전날(8/6)은 구글 AI 인력 이탈과 샌디스크 가이던스 하회 여파로 -4.58% 급락했던 자리.",
      links: [{ label: "주간 브리핑", url: "#" }, { label: "8/7 장중", url: "#" }],
    },
    {
      title: "코스피 -5.10% vs 코스닥 +10.98%, 극단적 디커플링",
      body: "코스닥은 719.76→798.81로 5주 만에 상승 전환. 대형주(반도체)에서 빠진 자금이 중소형 성장주로 통째로 이동한 한 주. 지수만 보면 시장이 무너진 것처럼 보이지만, 실제로는 주도 섹터가 교체되는 국면.",
      links: [{ label: "이투데이", url: "#" }],
    },
    {
      title: "수급 — 외국인 8,633억 순매도가 전부를 설명",
      body: "전기·전자·IT·금융에 매도 집중. 기관 5,790억, 개인 2,670억 순매수로 방어했으나 역부족. 환율이 7.7원 내려 안정됐는데도 외국인이 팔았다는 점이 핵심 — 환차손 회피가 아니라 반도체 업황 자체에 대한 판단.",
      links: [{ label: "Businesskorea", url: "#" }, { label: "뉴스핌", url: "#" }],
    },
    {
      title: "고객예탁금 두 달 만에 25% 증발",
      body: "6월 23일 약 137조원 정점에서 8월 5일 약 103조원까지 감소. 대기 매수 여력 자체가 줄었다는 뜻으로, 반등이 나와도 탄력을 제한하는 구조적 요인. 지수 반등 시 이 지표가 같이 돌아서는지 반드시 확인 필요.",
    },
    {
      title: "정책 — 단일종목 레버리지 ETF 규제",
      body: "5월 말 출시된 삼성전자·SK하이닉스 단일종목 레버리지 ETF가 반도체 쏠림과 종가 하방압력의 주범으로 지목되며 상장폐지 요구까지 제기. 대신증권은 \"청산 압력이 의미 있게 완화되는 구간은 3~4주 후\"로 전망.",
      links: [{ label: "머니투데이", url: "#" }],
    },
    {
      title: "금리·환율은 오히려 우호적",
      body: "미 10년물이 주간 4.745%→4.642%로 10.3bp 하락했고 원·달러는 35.20원 급락해 1,407.74원. 국고채 3년물만 3.757%→3.761%로 소폭 상승. 매크로 조건은 개선됐는데 지수가 빠졌다는 것은 하락 원인이 매크로가 아니라 반도체 섹터 내부에 있다는 방증.",
      links: [{ label: "주간 브리핑", url: "#" }],
    },
    {
      title: "밸류에이션 — 12개월 선행 PER 5.1배, 사상 최저",
      body: "블룸버그는 \"매도세 이후 한국 증시가 저평가된 것으로 보인다\"고 평가. 골드만삭스는 12개월 목표 12,000(8/7 종가 대비 +90%)을 재차 제시. 다만 템플턴·아르케비움 등 외국 운용사들은 \"며칠간의 안정만으로는 부족하다\"며 가격 결정 기능 정상화 증거를 요구 중.",
      links: [{ label: "허프포스트", url: "#" }],
    },
    {
      title: "이익 추정치는 아직 안 꺾임",
      body: "2026년 코스피 영업이익 컨센서스는 약 967조원으로 고점(970조) 대비 3조원 하락에 그침. 대신증권은 \"반도체를 둘러싼 부정적 내러티브가 형성된 시기일 뿐 펀더멘털 훼손이 현실화한 것은 아니다\"라는 입장.",
      links: [{ label: "머니투데이", url: "#" }],
    },
  ],
  stockNews: [
    {
      title: "[급락] SK하이닉스 -4.88% (1,422,000원), 이틀 연속",
      body: "전날 -10.37%에 이은 연속 급락. 당일 +3.14%(1,542,000원)로 출발해 -5.75%(1,409,000원)까지 밀리는 9%p 변동. 직접 원인은 38조원 신규 팹 승인이 호재가 아닌 공급 확대 우려로 해석된 것. ADR(-3.92%)보다 국내 낙폭이 컸다는 점은 국내 수급이 더 취약함을 시사. 기관 순매수 4위에 올랐음에도 하락.",
      links: [{ label: "청년일보", url: "#" }, { label: "CNBC", url: "#" }],
    },
    {
      title: "[주주환원] 삼성전자 +0.22% (231,000원)",
      body: "장중 239,500원까지 올랐다 상승분 대부분 반납. SK하이닉스와 희비가 갈린 하루. 별도로 삼성전자·SK하이닉스가 배당·자사주 세부안 공개를 예고하며 주주환원 확대 카드를 꺼낸 점은 중기 관점의 재료.",
      links: [{ label: "중앙이코노미", url: "#" }, { label: "Investing", url: "#" }],
    },
    {
      title: "[실적·목표가] 한화에어로스페이스 — 2분기 어닝 서프라이즈, 목표가 214만원 상향",
      body: "2분기 영업이익 1조3,655억원으로 컨센서스 1조원을 3,600억원 이상 상회. 한화오션·한화시스템 등 종속사 서프라이즈가 동반됐고 지상방산도 수출 데이터 부진에도 기대 이상. 다올투자증권이 목표주가를 214만원으로 상향하며 하반기 수주 모멘텀을 강조.",
      links: [{ label: "파이낸셜뉴스", url: "#" }, { label: "Investing", url: "#" }],
    },
    {
      title: "[실적·공시] 두산에너빌리티 — 2분기 어닝 서프라이즈",
      body: "원전·가스터빈 호조가 실적을 견인. 그룹 차원에서는 두산의 SK실트론 경영권 인수가 \"싸게 잘 샀다\"는 평가와 함께 기업가치 재평가 기대를 받는 중. 원전 테마 전반(현대건설 포함)에 우호적.",
      links: [{ label: "Investing", url: "#" }, { label: "파이낸셜뉴스", url: "#" }],
    },
    {
      title: "[급등] 2차전지 — 기관 순매수 상위 독식",
      body: "삼성SDI +7.49%(459,000원), LG에너지솔루션 +4.35%(360,000원). 기관 순매수 1~3위가 삼성전기·LG엔솔·삼성SDI로, 반도체에서 빠진 기관 자금이 그대로 2차전지로 이동한 구도가 수급 데이터에 명확히 찍힘. 다만 에코프로비엠은 유럽 고객사 공백으로 3분기 이익 감소가 불가피하다는 지적도 병존.",
      links: [{ label: "파이낸셜뉴스", url: "#" }],
    },
    {
      title: "[급락] 소부장이 대형주보다 더 맞음",
      body: "원익IPS -4.64%, 주성엔지니어링 -4.20%, 리노공업 -1.79%. 메모리 대형주보다 장비주 낙폭이 큰 것은 사이클 후반부의 전형적 패턴. 여기에 트럼프 폴리실리콘 관세(12/4 발효)가 웨이퍼·소재 원가에 얹히는 구조라 국내 소재주는 업황 둔화와 원가 상승의 이중 압박.",
      links: [{ label: "아주경제", url: "#" }, { label: "관세 원문", url: "#" }],
    },
    {
      title: "[급등] 바이오가 코스닥을 끌어올림",
      body: "알테오젠 +3.29%, HLB +5.97%, 에이비엘바이오 +3.96%, 에코프로비엠 +4.39%. 반면 레인보우로보틱스 -5.01%로 로봇은 차익 실현. 코스닥 주간 +10.98%의 실체는 제약·바이오·2차전지 순환매.",
      links: [{ label: "이투데이", url: "#" }],
    },
    {
      title: "[수급 특이] 외국인·기관 동시 매수 종목 — SK이노베이션",
      body: "120,300원으로 +11,700원(+10.8%) 급등하며 외국인 순매수 3위·기관 순매수 6위에 동시 등재. 같은 날 한화솔루션도 33,900원으로 +3,500원(+11.5%) 급등해 기관 순매수 5위. 두 종목 모두 태양광·에너지 라인이라는 공통점이 있어, 트럼프 폴리실리콘 관세와의 연결 가능성을 확인할 필요.",
    },
    {
      title: "[수급] 외국인 순매수 1위 SK스퀘어 -3.20%",
      body: "939,000원으로 하락했음에도 외국인 순매수 1위. 주가 하락 중 외국인이 담았다는 뜻으로, SK하이닉스 지분 가치 대비 저평가 인식이 작용한 것으로 보임. 삼성물산(+0.75%)도 외국인 순매수 6위.",
    },
    {
      title: "[급등·확인됨] 한화솔루션 +11.51% (33,900원), 거래량 1,992만주",
      body: "삼성전자 다음으로 많은 거래량이 터짐. 같은 날 트럼프가 폴리실리콘 15% 관세에 서명(12/4 발효)한 것과 시점이 정확히 일치하며, 국내 태양광 셀·모듈 업체의 대미 수출 반사이익 기대가 반영된 것으로 보임. 기관 순매수 5위.",
      links: [{ label: "관세 원문", url: "#" }],
    },
    {
      title: "[급락] NAVER -7.08%, 롯데쇼핑 -12.93%",
      body: "반도체 밖에서도 낙폭이 큰 종목이 나옴. 반면 LG전자 +5.59%, 삼성전기 +3.99%로 IT 하드웨어 일부는 강세. 지수 하락이 전업종 동반 하락이 아니라 종목별 차별화 장세였다는 점을 보여줌.",
    },
  ],
  meta: {
    sources: [
      "Investing.com",
      "한국거래소(KRX)",
      "네이버 증시자금동향",
      "뉴스핌",
      "아주경제",
      "Businesskorea",
      "이투데이",
      "청년일보",
      "중앙이코노미",
      "파이낸셜뉴스",
      "머니투데이",
    ],
    disclaimer: "본 자료는 정보 제공 목적의 자동 생성 리포트이며 투자 권유가 아닙니다. 최종 투자 판단과 그 책임은 투자자 본인에게 있습니다.",
    dataMode: "sample",
  },
};

writeFileSync(join(__dirname, "..", "src", "data", "latest.json"), JSON.stringify(data, null, 2) + "\n");
console.log("Wrote src/data/latest.json");
