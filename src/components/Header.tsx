interface HeaderProps {
  asOfLabel: string;
  generatedAt: string;
  forUser?: string;
  dataMode: "sample" | "live";
}

export function Header({ asOfLabel, generatedAt, forUser, dataMode }: HeaderProps) {
  const generated = new Date(generatedAt);
  const generatedLabel = Number.isNaN(generated.getTime())
    ? generatedAt
    : generated.toLocaleString("ko-KR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Seoul",
      });

  return (
    <header className="border-b" style={{ borderColor: "var(--border)" }}>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="text-[11px] uppercase tracking-[0.2em] text-ink-muted">
          US Market Daily
        </div>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h1 className="text-2xl font-bold text-ink-primary">미국 시장 데일리</h1>
          {dataMode === "sample" && (
            <span
              className="rounded-full border px-2.5 py-0.5 text-[11px] font-medium text-ink-secondary"
              style={{ borderColor: "var(--border)" }}
            >
              샘플 데이터
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-ink-secondary">{asOfLabel}</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          발행 {generatedLabel} KST{forUser ? ` · For. ${forUser}` : ""}
        </p>
      </div>
    </header>
  );
}
