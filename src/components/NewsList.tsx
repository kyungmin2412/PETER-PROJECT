import { Card } from "@/components/ui/Card";
import type { NewsItem } from "@/lib/types";

export function NewsList({ items }: { items: NewsItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Card key={item.title}>
          <div className="flex gap-2">
            <span className="mt-1 text-ink-muted">▸</span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-ink-primary">{item.title}</h3>
              {item.body && (
                <p className="mt-1 text-sm leading-relaxed text-ink-secondary">{item.body}</p>
              )}
              {item.links && item.links.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  {item.links.map((link) => (
                    <a
                      key={link.label}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-accent hover:underline"
                    >
                      {link.label} ↗
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
