"""Shared helpers for reading/writing src/data/latest.json."""
from __future__ import annotations

import json
import math
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = REPO_ROOT / "src" / "data" / "latest.json"


def load_data() -> dict:
    with DATA_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_data(data: dict) -> None:
    with DATA_PATH.open("w", encoding="utf-8") as f:
        # allow_nan=False: a stray NaN/Infinity (e.g. a yfinance row with a
        # missing close) would otherwise be dumped as a bare `NaN` token,
        # which is not valid JSON and breaks the Next.js build far away from
        # where the bad value actually originated. Fail loudly here instead.
        json.dump(data, f, ensure_ascii=False, indent=2, allow_nan=False)
        f.write("\n")


def candles_from_ohlc_df(df, decimals: int = 2) -> list[dict]:
    """Convert a pandas DataFrame with Open/High/Low/Close columns (indexed by
    date) into the dashboard's Candle[] shape. Rows with a missing OHLC value
    (seen live for thinly-traded ETFs) are dropped rather than propagating a
    NaN into the saved data."""
    df = df.dropna(subset=["Open", "High", "Low", "Close"])
    candles = []
    for date, row in df.iterrows():
        candles.append(
            {
                "date": date.strftime("%Y-%m-%d"),
                "open": round(float(row["Open"]), decimals),
                "high": round(float(row["High"]), decimals),
                "low": round(float(row["Low"]), decimals),
                "close": round(float(row["Close"]), decimals),
            }
        )
    return candles


def pct_change(last: float, prev: float) -> float:
    if prev == 0 or math.isnan(last) or math.isnan(prev):
        return 0.0
    return round((last - prev) / prev * 100, 2)
