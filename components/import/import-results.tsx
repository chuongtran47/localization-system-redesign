import Link from "next/link"
import { AlertTriangle } from "lucide-react"

import { primaryButton } from "@/components/button-styles"
import type { ImportResponse } from "@/lib/api-types"
import type { LanguageCode } from "@/lib/locale-data"
import { projectPath, type Project } from "@/lib/projects"

export type ImportResult = {
  id: string
  name: string
  language: LanguageCode
  response: ImportResponse | null
  error: string | null
}

export type ImportOutcome = {
  files: ImportResult[]
  /** Keys no file carried, dropped from the project - 0 unless replacing. */
  retired: number
  retireError: string | null
}

export function ImportResults({ outcome, project }: { outcome: ImportOutcome; project: Project }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="divide-y divide-border rounded-xl border border-border">
        {outcome.files.map((result) => (
          <div key={result.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate font-mono text-xs">{result.name}</span>
            {result.response ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                {result.response.created} created · {result.response.added} added · {result.response.changed} changed ·{" "}
                {result.response.removed} cleared → <span className="font-mono">{result.response.file}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertTriangle className="size-3.5 shrink-0" />
                {result.error}
              </span>
            )}
          </div>
        ))}
      </div>

      {outcome.retireError ? (
        <p className="flex items-start gap-1.5 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          The files were written, but the keys they left out could not be retired: {outcome.retireError}
        </p>
      ) : (
        outcome.retired > 0 && (
          <p className="text-sm text-muted-foreground">
            {outcome.retired} {outcome.retired === 1 ? "key" : "keys"} no file carried{" "}
            {outcome.retired === 1 ? "was" : "were"} removed from {project.name} and every one of its language files.
          </p>
        )
      )}

      <div>
        <Link href={projectPath(project)} className={`${primaryButton} w-fit`}>
          Open {project.name}
        </Link>
      </div>
    </div>
  )
}
