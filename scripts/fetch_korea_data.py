"""Fetch Korean market data (KOSPI/KOSDAQ, USD/KRW, customer deposits) via
pykrx/yfinance/Naver Finance and update the objective fields in
src/data/latest.json.

Run from an environment with normal internet access (this repo's GitHub
Actions workflow, or a local machine) — pykrx talks to KRX's data API and
fetch_customer_deposits() scrapes finance.naver.com, both of which this
sandbox's egress policy blocks (confirmed: CONNECT to finance.naver.com
returns 403 from the sandbox's own egress proxy). See README.md.

fetch_customer_deposits() was written and validated against finance.naver.com's
known page structure from training data, not a live fetch in this sandbox —
it could not be run and inspected here. It's deliberately defensive (matches
table columns by header text/unit label rather than fixed positions, and
sanity-checks the result before writing) so a structure drift degrades to a
warning instead of writing bad data, but the very first scheduled Actions run
should still have its logs checked to confirm it actually parses correctly.

Usage:
    python scripts/fetch_korea_data.py
"""
from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from io import StringIO

import pandas as pd
import requests
import yfinance as yf
from pykrx import stock

from data_io import candles_from_ohlc_df, load_data, pct_change, save_data

KOSPI_INDEX_CODE = "1001"
KOSDAQ_INDEX_CODE = "2001"

NAVER_DEPOSIT_URL = "https://finance.naver.com/sise/sise_deposit.naver"

# Won-per-unit for whatever unit label Naver's column header uses, so we
# don't have to hardcode an assumed unit — read it off the header text.
UNIT_TO_WON = {"백만원": 1_000_000, "억원": 100_000_000, "천원": 1_000, "원": 1}

# 고객예탁금 has stayed roughly in this band for years; anything outside it
# after unit conversion almost certainly means the unit/column was
# misidentified, so treat it as a failed fetch rather than write bad data.
PLAUSIBLE_DEPOSIT_RANGE_TRILLION_WON = (10, 500)


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


def _deposit_unit_divisor(header: str) -> int:
    for unit, won in UNIT_TO_WON.items():
        if unit in header:
            return won
    return 100_000_000  # Naver's most common convention for this page: 억원


def fetch_customer_deposits() -> dict | None:
    """Best-effort scrape of 고객예탁금 from Naver Finance's 증시자금동향 page.

    Matches the deposit column by header text ("고객예탁금", excluding the
    "실질고객예탁금" variant) rather than a fixed column index, and reads the
    unit (억원/백만원/etc.) from the header itself instead of assuming one.
    Returning None means "leave existing data untouched" — used both when the
    page is unreachable and when the parsed result fails the plausibility
    check, so a silent structure change never overwrites good data with junk.
    """
    try:
        resp = requests.get(
            NAVER_DEPOSIT_URL,
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=15,
        )
        resp.raise_for_status()
        resp.encoding = "euc-kr"  # legacy Naver finance pages are EUC-KR
        tables = pd.read_html(StringIO(resp.text))
    except Exception as exc:  # noqa: BLE001
        print(f"[warn] customer deposits: fetch failed: {exc}", file=sys.stderr)
        return None

    deposit_table = None
    for df in tables:
        cols = [str(c) for c in df.columns]
        if any("날짜" in c for c in cols) and any("고객예탁금" in c for c in cols):
            deposit_table = df
            break
    if deposit_table is None:
        print("[warn] customer deposits: no matching table found on page (layout may have changed)", file=sys.stderr)
        return None

    try:
        date_col = next(c for c in deposit_table.columns if "날짜" in str(c))
        amount_col = next(
            c for c in deposit_table.columns if "고객예탁금" in str(c) and "실질" not in str(c)
        )
    except StopIteration:
        print("[warn] customer deposits: expected columns not found", file=sys.stderr)
        return None

    divisor = _deposit_unit_divisor(str(amount_col))

    rows = deposit_table[[date_col, amount_col]].dropna()
    rows = rows[rows[date_col].astype(str).str.match(r"^\d{4}\.\d{2}\.\d{2}$")]
    if rows.empty:
        print("[warn] customer deposits: no valid dated rows parsed", file=sys.stderr)
        print(
            f"[debug] customer deposits: date_col={date_col!r} amount_col={amount_col!r} "
            f"sample rows:\n{deposit_table[[date_col, amount_col]].head(5).to_string()}",
            file=sys.stderr,
        )
        return None

    rows = rows.sort_values(date_col)
    series = []
    for _, row in rows.iterrows():
        try:
            raw = float(str(row[amount_col]).replace(",", ""))
        except ValueError:
            continue
        trillion_won = round(raw * divisor / 1_000_000_000_000, 1)
        series.append({"date": str(row[date_col]).replace(".", "-"), "amount": trillion_won})

    if not series:
        print("[warn] customer deposits: no numeric amounts parsed", file=sys.stderr)
        return None

    latest = series[-1]
    lo, hi = PLAUSIBLE_DEPOSIT_RANGE_TRILLION_WON
    if not (lo <= latest["amount"] <= hi):
        print(
            f"[warn] customer deposits: parsed {latest['amount']}조원 is outside the plausible "
            f"range [{lo}, {hi}] — likely a unit/column mismatch, discarding",
            file=sys.stderr,
        )
        return None

    return {
        "latest": latest["amount"],
        "asOf": f"{latest['date']} 집계 (네이버금융)",
        "series": series[-30:],
    }


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
