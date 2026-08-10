"""Fetch Korean market data (KOSPI/KOSDAQ, investor flows, 60-day deviation)
via pykrx and update the objective fields in src/data/latest.json.

Run from an environment with normal internet access (this repo's GitHub
Actions workflow, or a local machine) — pykrx talks to KRX's data API, which
this sandbox's egress policy blocks. See README.md.

Two data points have no reliable free API and are intentionally NOT faked:
  - 고객예탁금 (investor deposits, KOFIA) — see fetch_deposit_trend() below.
  - V-KOSPI (KRX's volatility index) — see fetch_vkospi() below.
Both are best-effort: on failure they log a warning and leave the existing
(possibly stale/sample) value in place rather than crash the whole run.
Verify their selectors once you can actually hit the source from a network
that isn't egress-restricted, then tighten the try/except.

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


def fetch_deviation(index_code: str):
    """60-trading-day close average deviation, computed from real OHLCV
    (replaces the sample's estimated value once this runs successfully)."""
    end = latest_trading_date()
    start = (datetime.strptime(end, "%Y%m%d") - timedelta(days=120)).strftime("%Y%m%d")
    df = stock.get_index_ohlcv_by_date(start, end, index_code)
    closes = df["종가"].tail(60)
    if len(closes) < 60:
        raise RuntimeError(f"only {len(closes)} trading days available, need 60")
    ma60 = float(closes.mean())
    close = float(closes.iloc[-1])
    value = round(close / ma60 * 100, 1)
    zone = (
        "extreme_oversold" if value < 70 else
        "oversold" if value < 85 else
        "neutral" if value <= 115 else
        "overbought" if value <= 130 else
        "extreme_overbought"
    )
    return {
        "value": value,
        "close": round(close, 2),
        "ma": round(ma60, 0),
        "asOf": datetime.strptime(end, "%Y%m%d").strftime("%Y-%m-%d"),
        "zone": zone,
        "estimated": False,
    }


def fetch_net_buy(market: str) -> dict:
    end = latest_trading_date()
    df = stock.get_market_trading_value_by_investor(end, end, market)
    # pykrx rows are investor types (외국인/기관합계/개인 등), columns 순매수 in KRW.
    def net(row_label: str) -> int:
        if row_label not in df.index:
            return 0
        return int(round(df.loc[row_label, "순매수"] / 1_0000_0000))  # KRW -> 억원

    return {
        "market": "코스피" if market == "KOSPI" else "코스닥",
        "foreign": net("외국인"),
        "institution": net("기관합계"),
        "individual": net("개인"),
    }


def fetch_top_buyers(market: str, investor: str, top_n: int = 6) -> list[dict]:
    # Column names below match pykrx's documented return shape at the time of
    # writing (종목명/종가/등락률/순매수거래대금). pykrx's public API has
    # shifted column names across versions before — if this raises a KeyError,
    # run `df.columns` once with network access and fix the mapping here.
    end = latest_trading_date()
    df = stock.get_market_net_purchases_of_equities_by_ticker(end, end, market, investor)
    df = df.sort_values("순매수거래대금", ascending=False).head(top_n)
    rows = []
    for rank, (_, row) in enumerate(df.iterrows(), start=1):
        rows.append(
            {
                "rank": rank,
                "name": row.get("종목명", ""),
                "amount": int(row.get("종가", 0)),
                "change": int(row.get("등락률", 0)),
            }
        )
    return rows


def fetch_deposit_trend() -> list[dict] | None:
    """Best-effort: KOFIA doesn't expose a stable public JSON endpoint, so
    this is left as a manual/curated field until a reliable source is wired
    up. Returning None means "leave existing data untouched"."""
    print("[info] deposit trend auto-fetch not implemented — keeping existing data", file=sys.stderr)
    return None


def fetch_vkospi() -> dict | None:
    """Best-effort: no free structured API found for V-KOSPI at the time of
    writing. Returning None means "leave existing data untouched"."""
    print("[info] V-KOSPI auto-fetch not implemented — keeping existing data", file=sys.stderr)
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

    try:
        data["korea"]["netBuy"] = [fetch_net_buy("KOSPI"), fetch_net_buy("KOSDAQ")]
    except Exception as exc:  # noqa: BLE001
        print(f"[warn] investor net buy: {exc}", file=sys.stderr)

    try:
        data["korea"]["topBuyersForeign"] = fetch_top_buyers("KOSPI", "외국인")
        data["korea"]["topBuyersInstitution"] = fetch_top_buyers("KOSPI", "기관합계")
    except Exception as exc:  # noqa: BLE001
        print(f"[warn] top buyers: {exc}", file=sys.stderr)

    try:
        data["korea"]["deviation"] = fetch_deviation(KOSPI_INDEX_CODE)
    except Exception as exc:  # noqa: BLE001
        print(f"[warn] deviation: {exc}", file=sys.stderr)

    deposit = fetch_deposit_trend()
    if deposit is not None:
        data["korea"]["depositTrend"] = deposit

    vkospi = fetch_vkospi()
    if vkospi is not None:
        data["korea"]["volatility"].update(vkospi)

    data["generatedAt"] = datetime.now(timezone.utc).astimezone().isoformat()
    save_data(data)
    print("Updated src/data/latest.json with live Korea market data.")


if __name__ == "__main__":
    main()
