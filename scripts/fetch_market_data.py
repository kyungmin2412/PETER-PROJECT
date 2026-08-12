"""Fetch US market data (indices, sector ETFs) via yfinance and update the
objective fields in src/data/latest.json.

Run from an environment with normal internet access (this repo's GitHub
Actions workflow, or a local machine) — it cannot run inside a network-
restricted sandbox. See README.md for the automation architecture.

Usage:
    python scripts/fetch_market_data.py
"""
from __future__ import annotations

import sys
from datetime import datetime, timezone

import yfinance as yf

from data_io import candles_from_ohlc_df, load_data, pct_change, save_data

KOREAN_WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"]


def format_as_of(date_str: str) -> str:
    """'2026-08-11' -> '2026-08-11 (화) 미국 시장 종가 · 뉴욕 16:00 EDT'."""
    d = datetime.strptime(date_str, "%Y-%m-%d")
    weekday = KOREAN_WEEKDAYS[d.weekday()]
    return f"{date_str} ({weekday}) 미국 시장 종가 · 뉴욕 16:00 EDT"


MACRO_TICKERS = {
    "nasdaq": ("^IXIC", 2, 1.0),
    "sp500": ("^GSPC", 2, 1.0),
    "dow": ("^DJI", 2, 1.0),
    "us10y": ("^TNX", 3, 1.0),  # yfinance returns the yield directly (e.g. 4.70 = 4.70%)
    "wti": ("CL=F", 2, 1.0),
}

SECTOR_TICKERS = [
    "XLY", "XLB", "XLU", "XLI", "XLP", "XLE",
    "XLK", "XLV", "XLRE", "XLC", "XLF", "SOXX",
]

# (구분, 티커, 종목명). SPCX (SpaceX) may not resolve via yfinance — it's
# fetched the same defensive way as everything else here, so a failure just
# leaves that one row's existing value in place instead of crashing the run.
BIGTECH_TICKERS = [
    ("HW", "AAPL", "애플"),
    ("SW", "MSFT", "마이크로소프트"),
    ("광고", "GOOGL", "알파벳"),
    ("우주", "SPCX", "스페이스X"),
    ("이커머스", "AMZN", "아마존"),
    ("광고", "META", "메타"),
]

AI_HW_TICKERS = [
    ("엔비디아", "NVDA", "엔비디아"),
    ("ASIC/네트워킹", "AVGO", "브로드컴"),
    ("ASIC/네트워킹", "MRVL", "마벨테크놀로지"),
    ("GPU", "AMD", "AMD"),
    ("메모리", "MU", "마이크론테크놀로지"),
    ("SSD", "SNDK", "샌디스크"),
    ("HDD", "WDC", "웨스턴디지털"),
    ("네트워킹", "ALAB", "아스테라랩스"),
    ("네트워킹", "CRDO", "크레도테크놀로지"),
    ("네트워킹", "ANET", "아리스타네트웍스"),
    ("광연결", "LITE", "루멘텀홀딩스"),
    ("광연결", "COHR", "코히런트"),
    ("구리/광", "SMTC", "세미테크"),
    ("트랜시버", "AAOI", "어플라이드옵토일렉트로닉스"),
    ("DCI", "VIAV", "바이아비솔루션즈"),
    ("DCI", "KEYS", "키사이트테크놀로지스"),
    ("전력/냉각", "VRT", "버티브홀딩스"),
    ("서버", "SMCI", "슈퍼마이크로컴퓨터"),
    ("번인장비", "AEHR", "에어테스트시스템즈"),
    ("전력반도체", "VICR", "바이코"),
    ("전력반도체", "NVTS", "나비타스세미컨덕터"),
]

RENEWABLE_TICKERS = [
    ("Utility", "FSLR", "퍼스트솔라"),
    ("Inverter", "ENPH", "엔페이즈에너지"),
    ("Installer", "RUN", "선런"),
    ("Tracker", "NXT", "넥스트래커"),
    ("Tracker", "ARRY", "어레이테크놀로지스"),
    ("EBOC", "SHLS", "숄스테크놀로지스"),
]

POWER_INFRA_TICKERS = [
    ("SOFC", "BE", "블룸에너지"),
    ("가스터빈", "SEI", "솔라리스에너지인프라"),
    ("전력기기", "ETN", "이턴"),
    ("가스터빈", "GEV", "GE버노바"),
    ("전력설치", "PWR", "퀀타서비스"),
    ("전력기기", "POWL", "파월인더스트리즈"),
    ("원자력", "CEG", "컨스텔레이션에너지"),
    ("원자력", "VST", "비스트라"),
    ("SMR", "SMR", "뉴스케일파워"),
    ("SMR", "OKLO", "오클로"),
]


def fetch_bigtech_item(symbol: str, decimals: int = 2):
    """1일/1주/1개월 등락률. 1주 = 최근 5거래일 전 종가 대비, 1개월 = 최근
    21거래일 전 종가 대비 (거래일 기준, 달력일이 아님)."""
    hist = yf.Ticker(symbol).history(period="3mo", interval="1d", auto_adjust=False)
    closes = hist["Close"].dropna()
    if len(closes) < 22:
        raise RuntimeError(f"insufficient history ({len(closes)} rows, need >= 22)")
    last = float(closes.iloc[-1])
    prev = float(closes.iloc[-2])
    week_ago = float(closes.iloc[-6])
    month_ago = float(closes.iloc[-22])
    last_date = closes.index[-1].strftime("%Y-%m-%d")
    return (
        round(last, decimals),
        round(last - prev, decimals),
        pct_change(last, prev),
        pct_change(last, week_ago),
        pct_change(last, month_ago),
        last_date,
    )


def update_watchlist(items: list[dict], tickers: list[tuple[str, str, str]], label: str) -> None:
    """Fetch each (구분, 티커, 종목명) into `items` in place: update existing
    entries, append new ones, and leave a ticker's entry untouched (with a
    warning) if that one fetch fails."""
    by_ticker = {item["ticker"]: item for item in items}
    for category, symbol, name in tickers:
        try:
            price, change, change_pct, change_pct_1w, change_pct_1m, last_date = fetch_bigtech_item(symbol)
        except Exception as exc:  # noqa: BLE001
            print(f"[warn] {label} {symbol}: {exc}", file=sys.stderr)
            continue
        item = by_ticker.get(symbol)
        if item is None:
            item = {"category": category, "name": name, "ticker": symbol}
            items.append(item)
            by_ticker[symbol] = item
        item.update(
            {
                "category": category,
                "name": name,
                "price": price,
                "change": change,
                "changePercent": change_pct,
                "changePercent1w": change_pct_1w,
                "changePercent1m": change_pct_1m,
                "asOf": format_as_of(last_date),
            }
        )


def fetch_series(symbol: str, decimals: int, scale: float):
    hist = yf.Ticker(symbol).history(period="2mo", interval="1d", auto_adjust=False)
    if hist.empty or len(hist) < 2:
        raise RuntimeError(f"no history returned for {symbol}")
    hist = hist * scale if scale != 1.0 else hist
    hist = hist[["Open", "High", "Low", "Close"]].tail(23)
    candles = candles_from_ohlc_df(hist, decimals)
    last = candles[-1]["close"]
    prev = candles[-2]["close"]
    return candles, last, round(last - prev, decimals), pct_change(last, prev)


def main() -> None:
    data = load_data()
    now_kst = datetime.now(timezone.utc).astimezone().isoformat()

    # Fetch everything first so the as-of label can be derived from the
    # actual latest trading day fetched, rather than reusing whatever label
    # happened to already be stored (which never advanced — a real bug: the
    # displayed date was frozen at the original sample's "2026-08-07" even
    # after live prices were fetched for later trading days).
    ok = True
    results: dict[str, tuple] = {}
    for key, (symbol, decimals, scale) in MACRO_TICKERS.items():
        try:
            results[key] = fetch_series(symbol, decimals, scale)
        except Exception as exc:  # noqa: BLE001 - log and continue with stale data
            print(f"[warn] {symbol}: {exc}", file=sys.stderr)
            ok = False

    if "nasdaq" in results:
        latest_date = results["nasdaq"][0][-1]["date"]
        as_of = format_as_of(latest_date)
        data["asOfLabel"] = as_of
    else:
        as_of = data.get("asOfLabel", "미국 시장 종가 기준")

    for key in MACRO_TICKERS:
        if key not in results:
            continue
        candles, last, change, change_pct = results[key]
        node = data["us"][key]
        node["last"] = last
        node["change"] = change
        node["changePercent"] = change_pct
        node["candles"] = candles
        node["asOf"] = as_of

    sector_by_symbol = {s["symbol"]: s for s in data["us"]["sectors"]}
    for symbol in SECTOR_TICKERS:
        if symbol not in sector_by_symbol:
            continue
        try:
            hist = yf.Ticker(symbol).history(period="5d", interval="1d", auto_adjust=False)
            closes = hist["Close"].dropna()
            if len(closes) < 2:
                raise RuntimeError("insufficient history")
            last = float(closes.iloc[-1])
            prev = float(closes.iloc[-2])
            sector_by_symbol[symbol]["changePercent"] = pct_change(last, prev)
        except Exception as exc:  # noqa: BLE001
            print(f"[warn] sector {symbol}: {exc}", file=sys.stderr)

    update_watchlist(data["us"]["bigTech"], BIGTECH_TICKERS, "bigtech")
    update_watchlist(data["us"]["aiHardware"], AI_HW_TICKERS, "ai-hw")
    update_watchlist(data["us"]["renewable"], RENEWABLE_TICKERS, "renewable")
    update_watchlist(data["us"]["powerInfra"], POWER_INFRA_TICKERS, "power-infra")

    data["generatedAt"] = now_kst
    data["meta"]["dataMode"] = "live"
    save_data(data)
    print("Updated src/data/latest.json with live US market data." if ok else
          "Updated src/data/latest.json (some tickers failed — see warnings above).")


if __name__ == "__main__":
    main()
