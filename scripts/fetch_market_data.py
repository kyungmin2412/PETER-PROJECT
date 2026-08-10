"""Fetch US market data (indices, watchlist stocks, sector ETFs) via yfinance
and update the objective fields in src/data/latest.json.

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

MACRO_TICKERS = {
    "nasdaq": ("^IXIC", 2, 1.0),
    "us10y": ("^TNX", 3, 0.1),  # Yahoo quotes ^TNX as yield * 10
    "usdkrw": ("KRW=X", 2, 1.0),
    "wti": ("CL=F", 2, 1.0),
}

SECTOR_TICKERS = [
    "XLY", "XLB", "XLU", "XLI", "XLP", "XLE",
    "XLK", "XLV", "XLRE", "XLC", "XLF", "SOXX",
]


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


def update_price_series(node: dict, symbol: str, decimals: int, scale: float, as_of: str) -> bool:
    try:
        candles, last, change, change_pct = fetch_series(symbol, decimals, scale)
    except Exception as exc:  # noqa: BLE001 - log and continue with stale data
        print(f"[warn] {symbol}: {exc}", file=sys.stderr)
        return False
    node["last"] = last
    node["change"] = change
    node["changePercent"] = change_pct
    node["candles"] = candles
    node["asOf"] = as_of
    return True


def main() -> None:
    data = load_data()
    now_kst = datetime.now(timezone.utc).astimezone().isoformat()
    as_of = data.get("asOfLabel", "미국 시장 종가 기준")

    ok = True
    for key, (symbol, decimals, scale) in MACRO_TICKERS.items():
        ok &= update_price_series(data["macro"][key], symbol, decimals, scale, as_of)

    for item in data["watchlist"]:
        symbol = item["symbol"]
        try:
            hist = yf.Ticker(symbol).history(period="5d", interval="1d", auto_adjust=False)
            if len(hist) < 2:
                raise RuntimeError("insufficient history")
            last = round(float(hist["Close"].iloc[-1]), 2)
            prev = round(float(hist["Close"].iloc[-2]), 2)
            item["close"] = last
            item["change"] = round(last - prev, 2)
            item["changePercent"] = pct_change(last, prev)
        except Exception as exc:  # noqa: BLE001
            print(f"[warn] watchlist {symbol}: {exc}", file=sys.stderr)

    sector_by_symbol = {s["symbol"]: s for s in data["sectors"]}
    for symbol in SECTOR_TICKERS:
        if symbol not in sector_by_symbol:
            continue
        try:
            hist = yf.Ticker(symbol).history(period="5d", interval="1d", auto_adjust=False)
            if len(hist) < 2:
                raise RuntimeError("insufficient history")
            last = float(hist["Close"].iloc[-1])
            prev = float(hist["Close"].iloc[-2])
            sector_by_symbol[symbol]["changePercent"] = pct_change(last, prev)
        except Exception as exc:  # noqa: BLE001
            print(f"[warn] sector {symbol}: {exc}", file=sys.stderr)

    data["generatedAt"] = now_kst
    save_data(data)
    print("Updated src/data/latest.json with live US market data." if ok else
          "Updated src/data/latest.json (some tickers failed — see warnings above).")


if __name__ == "__main__":
    main()
