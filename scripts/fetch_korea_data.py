"""Fetch Korean market data (KOSPI/KOSDAQ, USD/KRW, customer deposits) via
pykrx/yfinance and update the objective fields in src/data/latest.json.

Run from an environment with normal internet access (this repo's GitHub
Actions workflow, or a local machine) — pykrx talks to KRX's data API, which
this sandbox's egress policy blocks. See README.md.

고객예탁금 (investor deposits, KOFIA) has no confirmed stable free API, so
it is intentionally NOT faked: fetch_customer_deposits() is best-effort and,
on failure, logs a warning and leaves the existing (possibly stale/sample)
value in place rather than crash the whole run. Verify the source once you
can actually hit it from a network that isn't egress-restricted.

Usage:
    python scripts/fetch_korea_data.py
"""
from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone

import yfinance as yf
from pykrx import stock

from data_io import candles_from_ohlc_df, load_data, pct_change, save_data

KOSPI_INDEX_CODE = "1001"
KOSDAQ_INDEX_CODE = "2001"


def latest_trading_date() -> str:
    """Most recent KRX business day, as YYYYMMDD."""
    today = datetime.now()
    for offset in range(10):
        candidate = today - timedelta(days=offset)
        if candidate.weekday() < 5:
            df = stock.get_index_ohlcv_by_date(
                candidate.strftime("%Y%m%d"), candidate.strftime("%Y%m%d"), KOSPI_INDEX_CODE
            )
            if not df.empty:
                return candidate.strftime("%Y%m%d")
    raise RuntimeError("could not find a recent KRX trading date")


def fetch_index_series(index_code: str, decimals: int = 2):
    end = latest_trading_date()
    start = (datetime.strptime(end, "%Y%m%d") - timedelta(days=45)).strftime("%Y%m%d")
    df = stock.get_index_ohlcv_by_date(start, end, index_code)
    df = df.rename(columns={"시가": "Open", "고가": "High", "저가": "Low", "종가": "Close"})
    df = df.tail(23)
    candles = candles_from_ohlc_df(df[["Open", "High", "Low", "Close"]], decimals)
    last = candles[-1]["close"]
    prev = candles[-2]["close"]
    return candles, last, round(last - prev, decimals), pct_change(last, prev), end


def fetch_customer_deposits() -> dict | None:
    """Best-effort: KOFIA doesn't expose a stable public JSON endpoint, so
    this is left as a manual/curated field until a reliable source is wired
    up. Returning None means "leave existing data untouched"."""
    print("[info] customer deposits auto-fetch not implemented — keeping existing data", file=sys.stderr)
    return None


def main() -> None:
    data = load_data()

    try:
        candles, last, change, change_pct, end = fetch_index_series(KOSPI_INDEX_CODE)
        data["korea"]["kospi"].update(
            {"last": last, "change": change, "changePercent": change_pct, "candles": candles,
             "asOf": f"{end[:4]}-{end[4:6]}-{end[6:]} 코스피 종가"}
        )
    except Exception as exc:  # noqa: BLE001
        print(f"[warn] KOSPI: {exc}", file=sys.stderr)

    try:
        candles, last, change, change_pct, end = fetch_index_series(KOSDAQ_INDEX_CODE, decimals=2)
        data["korea"]["kosdaq"].update(
            {"last": last, "change": change, "changePercent": change_pct, "candles": candles,
             "asOf": f"{end[:4]}-{end[4:6]}-{end[6:]} 코스닥 종가"}
        )
    except Exception as exc:  # noqa: BLE001
        print(f"[warn] KOSDAQ: {exc}", file=sys.stderr)

    try:
        hist = yf.Ticker("KRW=X").history(period="2mo", interval="1d", auto_adjust=False)
        hist = hist[["Open", "High", "Low", "Close"]].tail(23)
        candles = candles_from_ohlc_df(hist, 1)
        last = candles[-1]["close"]
        prev = candles[-2]["close"]
        data["korea"]["usdkrw"].update(
            {"last": last, "change": round(last - prev, 1), "changePercent": pct_change(last, prev),
             "candles": candles}
        )
    except Exception as exc:  # noqa: BLE001
        print(f"[warn] USD/KRW: {exc}", file=sys.stderr)

    deposits = fetch_customer_deposits()
    if deposits is not None:
        data["korea"]["customerDeposits"] = deposits

    data["generatedAt"] = datetime.now(timezone.utc).astimezone().isoformat()
    save_data(data)
    print("Updated src/data/latest.json with live Korea market data.")


if __name__ == "__main__":
    main()
