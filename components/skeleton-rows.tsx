export function SkeletonRows() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0">
          <div className="size-4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/4 animate-pulse rounded bg-muted" />
          <div className="h-8 flex-1 animate-pulse rounded-md bg-muted" />
        </div>
      ))}
    </div>
  )
}
