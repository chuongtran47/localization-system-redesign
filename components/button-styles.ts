export const outlineButton =
  "flex h-9 items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-sm font-medium transition-colors hover:bg-accent/40 disabled:pointer-events-none disabled:opacity-50"

export const primaryButton =
  "flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"

export const destructiveButton =
  "flex h-9 items-center gap-1.5 rounded-lg bg-destructive/10 px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"

export const iconButton =
  "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"

export const textButton =
  "rounded-md px-2 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-accent/50"

/** A choice among a few - format, rows, version. Pair with `pillIdle` or `pillActive`. */
export const pillButton = "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"

export const pillIdle = "border-border bg-card text-muted-foreground hover:bg-accent/40 hover:text-foreground"

export const pillActive = "border-primary bg-primary text-primary-foreground"
