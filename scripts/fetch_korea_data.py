"""Fetch Korean market data (KOSPI/KOSDAQ, USD/KRW, customer deposits) via
Naver Finance (scraped) and yfinance, and update the objective fields in
src/data/latest.json.

Run from an environment with normal internet access (this repo's GitHub
Actions workflow, or a local machine) — this sandbox's egress policy blocks
finance.naver.com (confirmed: CONNECT returns 403 from the sandbox's own
egress proxy), so nothing that scrapes it can be exercised or verified here.
See README.md.

KOSPI/KOSDAQ previously came from pykrx, which talks to KRX's data API and
reliably failed without a KRX_ID/KRX_PW login (confirmed via live Actions
runs: KeyError on an unauthenticated response). Switched to scraping the
same finance.naver.com daily-index page fetch_customer_deposits() already
uses successfully, removing the KRX login dependency entirely. Naver's page
only exposes a daily close ("체결가"), not full OHLC, so candles are built
flat (open = high = low = close) — fine for this dashboard, since the UI
only ever renders the close values (as a sparkline).

fetch_customer_deposits() has been verified against a live GitHub Actions
run: the page's date column uses a 2-digit year ("26.08.10", not
"2026.08.10"), the header renders as a duplicated <tr> that pandas reads as
a 2-level MultiIndex, and the amount is in 억원 with no unit suffix in the
header — all now handled. fetch_naver_index_series() (KOSPI/KOSDAQ) reuses
the same date/MultiIndex handling but its own live-page behavior is
unverified — check the first Actions run's logs for [warn]/[debug] output.

Usage:
    python scripts/fetch_korea_data.py
"""
from __future__ import annotations

import re
import sys
from datetime import datetime, timezone
from io import StringIO

import pandas as pd
import requests
import yfinance as yf

from data_io import candles_from_ohlc_df, load_data, pct_change, save_data

NAVER_DEPOSIT_URL = "https://finance.naver.com/sise/sise_deposit.naver"
NAVER_INDEX_DAY_URL = "https://finance.naver.com/sise/sise_index_day.naver"

# Won-per-unit for whatever unit label Naver's column header uses, so we
# don't have to hardcode an assumed unit — read it off the header text.
UNIT_TO_WON = {"백만원": 1_000_000, "억원": 100_000_000, "천원": 1_000, "원": 1}

# 고객예탁금 has stayed roughly in this band for years; anything outside it
# after unit conversion almost certainly means the unit/column was
# misidentified, so treat it as a failed fetch rather than write bad data.
PLAUSIBLE_DEPOSIT_RANGE_TRILLION_WON = (10, 500)


def _flatten_multiindex_columns(df: pd.DataFrame) -> None:
    """Some Naver Finance pages render a visually-merged header as two
    literal <tr> header rows, which pandas reads as a 2-level MultiIndex of
    columns (confirmed live on the deposits page: columns come back as e.g.
    ('날짜', '날짜')). Flatten to plain strings in place so every later
    column lookup is unambiguous."""
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [
            " ".join(dict.fromkeys(str(level) for level in col if str(level) != "nan"))
            for col in df.columns
        ]


_NAVER_DATE_RE = re.compile(r"^(\d{2}|\d{4})\.(\d{2})\.(\d{2})$")


def _parse_naver_date(raw: str) -> str | None:
    """Naver's date columns use a 2-digit year ('26.08.10'), confirmed
    against a live run's logs; also accept a 4-digit year in case that ever
    changes or differs page-to-page."""
    m = _NAVER_DATE_RE.match(str(raw).strip())
    if not m:
        return None
    year, month, day = m.groups()
    if len(year) == 2:
        year = f"20{year}"
    return f"{year}-{month}-{day}"


def _deposit_unit_divisor(header: str) -> int:
    for unit, won in UNIT_TO_WON.items():
        if unit in header:
            return won
    return 100_000_000  # Naver's most common convention for this page: 억원


def fetch_naver_index_series(code: str, decimals: int = 2, pages: int = 3):
    """Scrape KOSPI/KOSDAQ daily closes from Naver Finance's index-day page
    (code='KOSPI' or 'KOSDAQ'). Only a daily close is available, not full
    OHLC, so candles are built flat (open=high=low=close). Raises on
    failure so callers' existing try/except leaves prior data untouched."""
    rows_by_date: dict[str, float] = {}
    close_col = None
    first_table_sample = None
    for page in range(1, pages + 1):
        try:
            resp = requests.get(
                NAVER_INDEX_DAY_URL,
                params={"code": code, "page": page},
                headers={"User-Agent": "Mozilla/5.0"},
                timeout=15,
            )
            resp.raise_for_status()
            resp.encoding = "euc-kr"
            tables = pd.read_html(StringIO(resp.text))
        except Exception:
            if page == 1:
                raise
            break  # later pages sometimes fail/render empty; stop paginating with what we have

        table = None
        for df in tables:
            _flatten_multiindex_columns(df)
            cols = [str(c) for c in df.columns]
            if any("날짜" in c for c in cols) and any(
                any(cand in c for cand in ("체결가", "종가", "지수")) for c in cols
            ):
                table = df
                break
        if table is None:
            if page == 1:
                raise RuntimeError(f"{code}: no matching table found on page 1 (layout may have changed)")
            break  # later pages sometimes have no matching table; stop paginating

        date_col = next(c for c in table.columns if "날짜" in str(c))
        if close_col is None:
            close_col = next(
                (c for c in table.columns if any(cand in str(c) for cand in ("체결가", "종가", "지수"))),
                None,
            )
        if first_table_sample is None:
            first_table_sample = table[[date_col, close_col]].head(5).to_string()
        rows = table[[date_col, close_col]].dropna()
        for _, row in rows.iterrows():
            iso_date = _parse_naver_date(row[date_col])
            if iso_date is None:
                continue
            try:
                close = float(str(row[close_col]).replace(",", ""))
            except ValueError:
                continue
            rows_by_date[iso_date] = close

    if len(rows_by_date) < 2:
        print(
            f"[debug] {code}: close_col={close_col!r} sample rows:\n{first_table_sample}",
            file=sys.stderr,
        )
        raise RuntimeError(
            f"{code}: fewer than 2 dated rows parsed across {pages} page(s) "
            f"(close_col={close_col!r}); layout likely changed"
        )

    ordered_dates = sorted(rows_by_date)[-23:]
    candles = [
        {
            "date": d,
            "open": round(rows_by_date[d], decimals),
            "high": round(rows_by_date[d], decimals),
            "low": round(rows_by_date[d], decimals),
            "close": round(rows_by_date[d], decimals),
        }
        for d in ordered_dates
    ]
    last = candles[-1]["close"]
    prev = candles[-2]["close"]
    return candles, last, round(last - prev, decimals), pct_change(last, prev), ordered_dates[-1]


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
        _flatten_multiindex_columns(df)
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
    parsed_dates = rows[date_col].map(_parse_naver_date)
    rows = rows[parsed_dates.notna()].assign(_iso_date=parsed_dates[parsed_dates.notna()])
    if rows.empty:
        print("[warn] customer deposits: no valid dated rows parsed", file=sys.stderr)
        print(
            f"[debug] customer deposits: date_col={date_col!r} amount_col={amount_col!r} "
            f"sample rows:\n{deposit_table[[date_col, amount_col]].head(5).to_string()}",
            file=sys.stderr,
        )
        return None

    rows = rows.sort_values("_iso_date")
    series = []
    for _, row in rows.iterrows():
        try:
            raw = float(str(row[amount_col]).replace(",", ""))
        except ValueError:
            continue
        trillion_won = round(raw * divisor / 1_000_000_000_000, 1)
        series.append({"date": row["_iso_date"], "amount": trillion_won})

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
        candles, last, change, change_pct, end = fetch_naver_index_series("KOSPI")
        data["korea"]["kospi"].update(
            {"last": last, "change": change, "changePercent": change_pct, "candles": candles,
             "asOf": f"{end} 코스피 종가"}
        )
    except Exception as exc:  # noqa: BLE001
        print(f"[warn] KOSPI: {exc}", file=sys.stderr)

    try:
        candles, last, change, change_pct, end = fetch_naver_index_series("KOSDAQ")
        data["korea"]["kosdaq"].update(
            {"last": last, "change": change, "changePercent": change_pct, "candles": candles,
             "asOf": f"{end} 코스닥 종가"}
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
             "candles": candles, "asOf": f"{candles[-1]['date']} 달러/원 종가"}
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
