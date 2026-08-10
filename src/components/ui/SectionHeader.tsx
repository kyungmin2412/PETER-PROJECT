interface SectionHeaderProps {
  index: number;
  title: string;
  subtitle?: string;
}

export function SectionHeader({ index, title, subtitle }: SectionHeaderProps) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-white/10 pb-3">
      <h2 className="text-lg font-semibold text-ink-primary">
        <span className="text-ink-muted">{index}.</span> {title}
      </h2>
      {subtitle && (
        <span className="text-[11px] uppercase tracking-wider text-ink-muted">{subtitle}</span>
      )}
    </div>
  );
}
