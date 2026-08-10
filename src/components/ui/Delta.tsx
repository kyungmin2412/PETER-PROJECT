import { deltaGlyph, deltaTone, formatNumber, formatSigned } from "@/lib/format";

const TONE_CLASS: Record<string, string> = {
  up: "text-up",
  down: "text-down",
  flat: "text-ink-muted",
};

interface DeltaProps {
  value: number | null;
  decimals?: number;
  className?: string;
}

export function Delta({ value, decimals = 2, className = "" }: DeltaProps) {
  const tone = deltaTone(value);
  return (
    <span className={`tabular ${TONE_CLASS[tone]} ${className}`}>
      {deltaGlyph(value)} {value === null ? "—" : formatSigned(value, decimals)}
    </span>
  );
}

interface DeltaPercentProps {
  value: number | null;
  className?: string;
}

export function DeltaPercent({ value, className = "" }: DeltaPercentProps) {
  const tone = deltaTone(value);
  return (
    <span className={`tabular ${TONE_CLASS[tone]} ${className}`}>
      {value === null ? "—" : `${formatSigned(value, 2)}%`}
    </span>
  );
}

interface PriceHeadlineProps {
  last: number;
  change: number;
  changePercent: number;
  decimals?: number;
}

export function PriceHeadline({ last, change, changePercent, decimals = 2 }: PriceHeadlineProps) {
  const tone = deltaTone(change);
  return (
    <div className={`flex flex-wrap items-baseline gap-x-2 tabular ${TONE_CLASS[tone]}`}>
      <span className="text-xl font-semibold">
        {deltaGlyph(change)} {formatNumber(last, decimals)}
      </span>
      <span className="text-sm">
        {formatSigned(change, decimals)} ({formatSigned(changePercent, 2)}%)
      </span>
    </div>
  );
}
