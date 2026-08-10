interface SectionHeaderProps {
  index: number;
  title: string;
  subtitle?: string;
}

export function SectionHeader({ index, title, subtitle }: SectionHeaderProps) {
  return (
    <div
      className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b pb-3"
      style={{ borderColor: "var(--border)" }}
    >
      <h2 className="flex items-center gap-2 text-xl font-bold text-ink-primary">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
          style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
        >
          {index}
        </span>
        {title}
      </h2>
      {subtitle && <span className="text-xs text-ink-muted">{subtitle}</span>}
    </div>
  );
}
