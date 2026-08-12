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

fetch_investor_top10() (외국인/기관 순매수·순매도 상위) went through two failed
hand-rolled attempts against KRX's raw MDC JSON API (a bare 400, then a
400 with body "LOGOUT" even with a session cookie + X-Requested-With) before
switching to the pykrx library instead of guessing further. pykrx's
get_market_net_purchases_of_equities_by_ticker() implements KRX's actual
login flow itself (JSESSIONID cookie via a real POST login, not just a
warm-up GET) when KRX_ID/KRX_PW env vars are set — those come from this
repo's KRX_ID/KRX_PW GitHub Actions secrets. Confirmed locally that pykrx
prints "KRX 로그인 실패" and returns no usable session without them; this
sandbox can't verify past that point since data.krx.co.kr is unreachable
from here.

Usage:
    python scripts/fetch_korea_data.py
"""
from __future__ import annotations

import re
import sys
from datetime import datetime, timedelta, timezone
from io import StringIO

import pandas as pd
import requests
import yfinance as yf
from pykrx import stock as pykrx_stock

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


def _krx_prev_trading_day() -> str:
    """Previous KST calendar weekday as YYYYMMDD. Doesn't account for Korean
    public holidays — if trdDd lands on one, pykrx returns an empty frame
    for that date, which fetch_investor_top10 treats as a failure (leaves
    prior data untouched) rather than silently succeeding with an empty
    top-10."""
    d = datetime.now(timezone.utc) + timedelta(hours=9) - timedelta(days=1)
    while d.weekday() >= 5:  # Sat=5, Sun=6
        d -= timedelta(days=1)
    return d.strftime("%Y%m%d")


def _period_range(end_trd_dd: str, days_back: int) -> tuple[str, str]:
    end_dt = datetime.strptime(end_trd_dd, "%Y%m%d")
    return (end_dt - timedelta(days=days_back)).strftime("%Y%m%d"), end_trd_dd


def _pykrx_net_purchases(fromdate: str, todate: str, investor: str) -> list[dict]:
    """전 종목의 순매수거래대금 (net buy value, already signed, summed over
    [fromdate, todate]) for one investor type — sorting this list ascending/
    descending client-side gives both the buy-top and sell-top."""
    df = pykrx_stock.get_market_net_purchases_of_equities_by_ticker(fromdate, todate, "ALL", investor)
    if df is None or df.empty:
        raise RuntimeError(f"pykrx returned no rows for investor={investor!r}, range={fromdate}-{todate}")

    parsed = []
    for code, row in df.iterrows():
        try:
            amount_won = float(row["순매수거래대금"])
        except (KeyError, ValueError):
            continue
        parsed.append(
            {
                "name": str(row.get("종목명", "")),
                "code": str(code),
                "netAmount": round(amount_won / 100_000_000, 1),  # 원 -> 억원
            }
        )
    if len(parsed) < 10:
        raise RuntimeError(
            f"only {len(parsed)} rows parsed for investor={investor!r}, range={fromdate}-{todate}, "
            "expected a full market list"
        )
    return parsed


def _fetch_investor_period(fromdate: str, todate: str, as_of: str) -> dict:
    """Raises on failure — caller decides what 'leave it untouched' means."""
    result: dict = {}
    for label, investor in (("foreign", "외국인"), ("institution", "기관합계")):
        parsed = _pykrx_net_purchases(fromdate, todate, investor)
        buy_sorted = sorted(parsed, key=lambda x: x["netAmount"], reverse=True)[:10]
        sell_sorted = sorted(parsed, key=lambda x: x["netAmount"])[:10]
        result[f"{label}Buy"] = [{"rank": i + 1, **p} for i, p in enumerate(buy_sorted)]
        result[f"{label}Sell"] = [{"rank": i + 1, **p} for i, p in enumerate(sell_sorted)]
    return {
        "asOf": as_of,
        "foreignBuy": result["foreignBuy"],
        "foreignSell": result["foreignSell"],
        "institutionBuy": result["institutionBuy"],
        "institutionSell": result["institutionSell"],
    }


def fetch_investor_top10() -> dict[str, dict]:
    """전일 / 1주일 누적 / 1개월 누적 외국인·기관 순매수·순매도 상위 10종목
    (거래대금 기준), via pykrx (needs KRX_ID/KRX_PW env vars — see module
    docstring). Each period is fetched independently and only the periods
    that succeed are included in the result — main() keeps whatever a
    period already had if that period's fetch fails, rather than one bad
    period wiping out the other two."""
    trd_dd = _krx_prev_trading_day()
    end_d = datetime.strptime(trd_dd, "%Y%m%d")
    week_from, _ = _period_range(trd_dd, 6)
    month_from, _ = _period_range(trd_dd, 30)

    periods = {
        "daily": (trd_dd, trd_dd, f"{end_d:%Y-%m-%d} 종가 기준 (KRX)"),
        "weekly": (week_from, trd_dd, f"{week_from[:4]}-{week_from[4:6]}-{week_from[6:]} ~ {end_d:%Y-%m-%d} 누적 (KRX)"),
        "monthly": (month_from, trd_dd, f"{month_from[:4]}-{month_from[4:6]}-{month_from[6:]} ~ {end_d:%Y-%m-%d} 누적 (KRX)"),
    }

    results: dict[str, dict] = {}
    for period_key, (fromdate, todate, as_of) in periods.items():
        try:
            results[period_key] = _fetch_investor_period(fromdate, todate, as_of)
        except Exception as exc:  # noqa: BLE001
            print(f"[warn] investor top10 ({period_key}): {exc}", file=sys.stderr)
    return results


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

    investor_flow = fetch_investor_top10()
    data["korea"].setdefault("investorFlow", {})
    for period_key, period_data in investor_flow.items():
        data["korea"]["investorFlow"][period_key] = period_data

    data["generatedAt"] = datetime.now(timezone.utc).astimezone().isoformat()
    save_data(data)
    print("Updated src/data/latest.json with live Korea market data.")


if __name__ == "__main__":
    main()
