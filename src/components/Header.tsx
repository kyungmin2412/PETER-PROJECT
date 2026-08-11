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
    <header style={{ background: "var(--surface)" }}>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
          >
            Investment Dashboard
          </span>
          {dataMode === "sample" && (
            <span
              className="rounded-full px-2.5 py-1 text-xs font-medium text-ink-muted"
              style={{ background: "var(--surface-2)" }}
            >
              샘플 데이터
            </span>
          )}
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink-primary">
          투자 대시보드
        </h1>
        <p className="mt-2 text-sm text-ink-secondary">{asOfLabel}</p>
        <p className="mt-1 text-xs text-ink-muted">
          발행 {generatedLabel} KST{forUser ? ` · For. ${forUser}` : ""}
        </p>
      </div>
    </header>
  );
}
