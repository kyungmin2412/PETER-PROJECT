"""Shared helpers for reading/writing src/data/latest.json.

The fetch scripts only overwrite the *objective* (quantitative) subtrees —
prices, candles, sector performance, investor flows, deviation, volatility.
Editorial subtrees (macroThemes, stockCatalysts, sectorLeaders, policyWatch,
mostWatched, koreaIssues, stockNews, and each watchlist item's `comment`)
require human or LLM curation and are preserved as-is.
"""
from __future__ import annotations

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = REPO_ROOT / "src" / "data" / "latest.json"


def load_data() -> dict:
    with DATA_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_data(data: dict) -> None:
    with DATA_PATH.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def candles_from_ohlc_df(df, decimals: int = 2) -> list[dict]:
    """Convert a pandas DataFrame with Open/High/Low/Close columns (indexed by
    date) into the dashboard's Candle[] shape."""
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
    if prev == 0:
        return 0.0
    return round((last - prev) / prev * 100, 2)
