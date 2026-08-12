interface HeaderProps {
  asOfLabel: string;
  generatedAt: string;
  forUser?: string;
  dataMode: "sample" | "live";
}

export function Header({ generatedAt, forUser, dataMode }: HeaderProps) {
  const generated = new Date(generatedAt);
  const generatedLabel = Number.isNaN(generated.getTime())
    ? generatedAt
    : generated.toLocaleString("ko-KR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Seoul",
      });

  return (
    <header className="border-b" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold tracking-tight text-ink-primary">투자 대시보드</h1>
          {dataMode === "sample" && (
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-medium text-ink-muted"
              style={{ background: "var(--surface-2)" }}
            >
              샘플 데이터
            </span>
          )}
        </div>
        <p className="text-xs text-ink-muted">
          발행 {generatedLabel} KST{forUser ? ` · For. ${forUser}` : ""}
        </p>
      </div>
    </header>
  );
}
