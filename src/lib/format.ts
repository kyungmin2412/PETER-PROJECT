export function formatNumber(value: number, decimals = 2): string {
  return value.toLocaleString("ko-KR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatSigned(value: number, decimals = 2): string {
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  return `${sign}${formatNumber(value, decimals)}`;
}

export function deltaGlyph(value: number | null): "▲" | "▼" | "—" {
  if (value === null || value === 0) return "—";
  return value > 0 ? "▲" : "▼";
}

export function deltaTone(value: number | null): "up" | "down" | "flat" {
  if (value === null || value === 0) return "flat";
  return value > 0 ? "up" : "down";
}
