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

fetch_investor_top10() (외국인/기관 순매수·순매도 상위) is UNVERIFIED — it
targets KRX's own MDC JSON API rather than Naver, since Naver has no single
scrapable page for this. Both the bld code and the response field names are
best-effort guesses from general KRX API conventions, not confirmed against
a live response (this sandbox can't reach data.krx.co.kr either). On
mismatch it prints the raw response shape/sample as [debug] output instead
of guessing further — read that from the first Actions run to fix the field
mapping precisely.

Usage:
    python scripts/fetch_korea_data.py
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timedelta, timezone
from io import StringIO

import pandas as pd
import requests
import yfinance as yf

from data_io import candles_from_ohlc_df, load_data, pct_change, save_data

NAVER_DEPOSIT_URL = "https://finance.naver.com/sise/sise_deposit.naver"
NAVER_INDEX_DAY_URL = "https://finance.naver.com/sise/sise_index_day.naver"

KRX_MDC_URL = "https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd"
KRX_HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Referer": "https://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd",
}
# getJsonData.cmd specifically rejects requests that don't look like the
# page's own AJAX call — confirmed live: without this header the response
# body is the literal string "LOGOUT" (HTTP 400), even with a valid session
# cookie already attached.
KRX_AJAX_HEADERS = {**KRX_HEADERS, "X-Requested-With": "XMLHttpRequest"}
# "투자자별 순매수 상위" screen's JSON bld — see module docstring: unverified.
KRX_INVESTOR_TOP_BLD = "dbms/MDC/STAT/standard/MDCSTAT04901"
FOREIGN_INVST_TP_CD = "9000"
INSTITUTION_INVST_TP_CD = "7050"

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
    public holidays — if trdDd lands on one, KRX returns no rows for that
    date, which _krx_investor_net_list's caller treats as a failure (leaves
    prior data untouched) rather than silently succeeding with an empty
    top-10."""
    d = datetime.now(timezone.utc) + timedelta(hours=9) - timedelta(days=1)
    while d.weekday() >= 5:  # Sat=5, Sun=6
        d -= timedelta(days=1)
    return d.strftime("%Y%m%d")


def _pick_field(row: dict, candidates: tuple[str, ...]) -> str | None:
    return next((c for c in candidates if c in row), None)


def _krx_investor_net_list(session: requests.Session, invst_tp_cd: str, trd_dd: str, label: str) -> list[dict]:
    """One KRX call returns the whole market's 순매수거래대금 (net buy value,
    already signed) for a given investor type — sorting that list ascending/
    descending client-side gives both the buy-top and sell-top without
    needing to guess a separate buy/sell request parameter."""
    payload = {
        "bld": KRX_INVESTOR_TOP_BLD,
        "mktId": "ALL",
        "trdDd": trd_dd,
        "invstTpCd": invst_tp_cd,
        "money": "1",  # 거래대금 기준
    }
    resp = session.post(KRX_MDC_URL, data=payload, headers=KRX_AJAX_HEADERS, timeout=15)
    if resp.status_code >= 400:
        print(
            f"[debug] investor top10 ({label}): HTTP {resp.status_code}, body (truncated): {resp.text[:1000]!r}",
            file=sys.stderr,
        )
    resp.raise_for_status()
    body = resp.json()

    rows = None
    for key in ("output", "OutBlock_1", "block1", "list"):
        if isinstance(body.get(key), list) and body[key]:
            rows = body[key]
            break
    if rows is None:
        print(f"[debug] investor top10 ({label}): unrecognized response shape, keys={list(body.keys())}", file=sys.stderr)
        print(f"[debug] investor top10 ({label}): raw body (truncated): {json.dumps(body, ensure_ascii=False)[:2000]}", file=sys.stderr)
        raise RuntimeError(f"unrecognized KRX response shape for invstTpCd={invst_tp_cd}")

    first = rows[0]
    name_key = _pick_field(first, ("ISU_ABBRV", "ISU_NM", "HOST_ISU_ABBRV"))
    code_key = _pick_field(first, ("ISU_SRT_CD", "ISU_CD"))
    amount_key = _pick_field(first, ("NETBID_TRDVAL", "NETBID_TRDVAL1", "ACC_TRDVAL"))
    if not (name_key and amount_key):
        print(f"[debug] investor top10 ({label}): couldn't map fields, sample row keys={list(first.keys())}", file=sys.stderr)
        print(f"[debug] investor top10 ({label}): sample row: {first}", file=sys.stderr)
        raise RuntimeError(f"couldn't map response fields for invstTpCd={invst_tp_cd}")

    parsed = []
    for r in rows:
        try:
            amount_won = float(str(r[amount_key]).replace(",", ""))
        except (KeyError, ValueError):
            continue
        parsed.append(
            {
                "name": str(r[name_key]),
                "code": str(r.get(code_key, "")) if code_key else "",
                "netAmount": round(amount_won / 100_000_000, 1),  # 원 -> 억원
            }
        )
    if len(parsed) < 10:
        print(f"[debug] investor top10 ({label}): only {len(parsed)} rows parsed, expected a full market list", file=sys.stderr)
        raise RuntimeError(f"too few rows parsed for invstTpCd={invst_tp_cd}")
    return parsed


def fetch_investor_top10() -> dict | None:
    """전일 외국인/기관 순매수·순매도 상위 10종목 (거래대금 기준). Returning
    None means "leave existing data untouched", same convention as
    fetch_customer_deposits()."""
    trd_dd = _krx_prev_trading_day()
    try:
        # KRX's WAF rejects the JSON POST with a bare 400 unless the client
        # already carries a session cookie from a normal page visit first
        # (confirmed live: the very first attempt without this got exactly
        # that 400, before the request even reached JSON parsing).
        session = requests.Session()
        session.get(
            "https://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd",
            headers=KRX_HEADERS,
            timeout=15,
        )

        result: dict = {}
        for label, invst_tp_cd in (("foreign", FOREIGN_INVST_TP_CD), ("institution", INSTITUTION_INVST_TP_CD)):
            parsed = _krx_investor_net_list(session, invst_tp_cd, trd_dd, label)
            buy_sorted = sorted(parsed, key=lambda x: x["netAmount"], reverse=True)[:10]
            sell_sorted = sorted(parsed, key=lambda x: x["netAmount"])[:10]
            result[f"{label}Buy"] = [{"rank": i + 1, **p} for i, p in enumerate(buy_sorted)]
            result[f"{label}Sell"] = [{"rank": i + 1, **p} for i, p in enumerate(sell_sorted)]
    except Exception as exc:  # noqa: BLE001
        print(f"[warn] investor top10: {exc}", file=sys.stderr)
        return None

    d = datetime.strptime(trd_dd, "%Y%m%d")
    return {
        "asOf": f"{d.strftime('%Y-%m-%d')} 종가 기준 (KRX)",
        "foreignBuy": result["foreignBuy"],
        "foreignSell": result["foreignSell"],
        "institutionBuy": result["institutionBuy"],
        "institutionSell": result["institutionSell"],
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

    investor_flow = fetch_investor_top10()
    if investor_flow is not None:
        data["korea"]["investorFlow"] = investor_flow

    data["generatedAt"] = datetime.now(timezone.utc).astimezone().isoformat()
    save_data(data)
    print("Updated src/data/latest.json with live Korea market data.")


if __name__ == "__main__":
    main()
