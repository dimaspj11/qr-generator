import type { ReactNode } from "react";

export function ToolNotes({ children }: { children: ReactNode }) {
  return (
    <section className="mx-auto mt-4 w-full max-w-xl rounded-control border border-border bg-background p-4" aria-label="Keterangan">
      <h2 className="text-sm font-medium text-foreground">Keterangan</h2>
      <div className="mt-2 space-y-2 text-sm text-pretty text-muted">{children}</div>
    </section>
  );
}
