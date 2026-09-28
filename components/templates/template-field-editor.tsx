"use client"

import { useState } from "react"
import { AlertTriangle, ClipboardPaste, Code2, Copy, History, Info } from "lucide-react"
import { toast } from "sonner"

import { iconButton, textButton } from "@/components/button-styles"
import { StatusBadge } from "@/components/status-badge"
import { RichTextEditor } from "@/components/templates/rich-text-editor"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { copyText } from "@/lib/clipboard"
import { SOURCE_LANGUAGE, type LanguageCode } from "@/lib/locale-data"
import type { ProjectProfile } from "@/lib/projects"
import type { TemplateChannel, TemplateField, TemplateFieldValue } from "@/lib/template-data"
import { safeHtml } from "@/lib/template-preview"
import { cn } from "@/lib/utils"
import { checkTranslation, smsInfo } from "@/lib/validation"

/** One field of a template: the English above, the translation below, the checks under that. */
export function TemplateFieldEditor({
  channel,
  field,
  value,
  current,
  isDirty,
  isKeepPending,
  language,
  profile,
  rtl,
  readOnly = false,
  onChange,
  onKeep,
  onConfirm,
}: {
  channel: TemplateChannel
  field: TemplateField
  value: TemplateFieldValue
  /** The live value - the saved one until someone types. */
  current: string
  isDirty: boolean
  isKeepPending: boolean
  language: LanguageCode
  profile: ProjectProfile
  rtl?: boolean
  readOnly?: boolean
  onChange: (field: TemplateField["id"], value: string) => void
  onKeep: (field: TemplateField["id"]) => void
  onConfirm: (field: TemplateField["id"]) => void
}) {
  const [showSource, setShowSource] = useState(false)

  const issues = readOnly
    ? []
    : checkTranslation(value.source, current, {
        language,
        lengthBudget: profile.lengthBudget,
        maxLength: field.maxLength,
        format: field.format,
      })
  const hasError = issues.some((issue) => issue.level === "error")
  const isKept = isKeepPending || (value.keptSource && current === value.source)
  // A kept value that went outdated is kept again rather than confirmed.
  const isStaleKeep = value.status === "outdated" && value.keptSource
  const canKeep =
    !readOnly &&
    (value.status === "missing" || isStaleKeep) &&
    !isKeepPending &&
    value.source !== "" &&
    language !== SOURCE_LANGUAGE
  const showOutdated = !readOnly && value.status === "outdated" && !isDirty

  const handleCopy = async () => {
    if (await copyText(value.source)) {
      toast.success(`${field.label} copied to the clipboard`)
    } else {
      toast.error("Could not copy", { description: "The browser blocked clipboard access for this page." })
    }
  }

  const shared = {
    value: current,
    dir: rtl ? ("rtl" as const) : undefined,
    placeholder: field.format === "html" ? "Add translation…" : value.source,
    "aria-label": `${field.label} translation`,
    onChange: (event: { target: { value: string } }) => onChange(field.id, event.target.value),
  }

  return (
    <section
      className={cn(
        "border-b border-l-2 border-border border-l-transparent px-5 py-4",
        isDirty && "border-l-primary bg-accent/30",
        hasError && "border-l-destructive"
      )}
    >
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">{field.label}</h3>
        {!readOnly && <StatusBadge status={value.status} />}
        {!readOnly && isKept && <span className="text-[11px] text-muted-foreground">Kept as English</span>}
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          {canKeep && (
            <button type="button" className={textButton} onClick={() => onKeep(field.id)}>
              Keep English
            </button>
          )}
          {field.control === "rich" && (
            <button
              type="button"
              aria-pressed={showSource}
              onClick={() => setShowSource((on) => !on)}
              className={cn(
                "flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors",
                showSource ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Code2 className="size-3.5" />
              HTML
            </button>
          )}
          <button
            type="button"
            className={iconButton}
            aria-label={`Copy the English ${field.label.toLowerCase()}`}
            title="Copy"
            onClick={handleCopy}
          >
            <Copy className="size-3.5" />
          </button>
          {!readOnly && (
            <button
              type="button"
              className={iconButton}
              aria-label={`Paste the English into the ${field.label.toLowerCase()}`}
              title="Paste"
              onClick={() => onChange(field.id, value.source)}
            >
              <ClipboardPaste className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {field.format === "html" && !showSource ? (
        <div
          className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground [&_a]:underline [&_li]:mb-0.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-4"
          // Whitelisted and rebuilt by `safeHtml` - see `lib/template-preview.ts`.
          dangerouslySetInnerHTML={{ __html: safeHtml(value.source) }}
        />
      ) : (
        <p
          className={cn(
            "mt-2 whitespace-pre-wrap rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground",
            field.format === "html" && "font-mono"
          )}
        >
          {value.source}
        </p>
      )}

      {!readOnly && (
        <div className="mt-2">
          {field.control === "line" && <Input {...shared} />}
          {field.control === "paragraph" && <Textarea {...shared} className="min-h-20 resize-y" />}
          {field.control === "rich" &&
            (showSource ? (
              <Textarea {...shared} className="min-h-52 resize-y font-mono text-xs" />
            ) : (
              <RichTextEditor
                value={current}
                rtl={rtl}
                ariaLabel={`${field.label} translation`}
                onChange={(next) => onChange(field.id, next)}
              />
            ))}
        </div>
      )}

      <div className="mt-1.5 flex flex-col gap-1">
        {showOutdated && (
          <div className="flex items-center gap-2 text-xs text-info">
            <History className="size-3.5 shrink-0" />
            English changed
            {!isStaleKeep && (
              <button type="button" className={textButton} onClick={() => onConfirm(field.id)}>
                Still correct
              </button>
            )}
          </div>
        )}
        <Meter channel={channel} field={field} current={readOnly ? value.source : current} />
        {issues.map((issue) => (
          <p
            key={issue.id}
            className={cn(
              "flex items-center gap-1.5 text-xs",
              issue.level === "error" ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {issue.level === "error" ? (
              <AlertTriangle className="size-3.5 shrink-0" />
            ) : (
              <Info className="size-3.5 shrink-0" />
            )}
            {issue.message}
          </p>
        ))}
      </div>
    </section>
  )
}

function Meter({ channel, field, current }: { channel: TemplateChannel; field: TemplateField; current: string }) {
  if (channel === "sms") {
    const info = smsInfo(current)
    return (
      <p
        className={cn(
          "font-mono text-xs tabular-nums",
          info.remaining <= 10 ? "text-warning-foreground dark:text-warning" : "text-muted-foreground"
        )}
      >
        {info.encoding} · {info.units} chars · {info.segments} {info.segments === 1 ? "segment" : "segments"}
      </p>
    )
  }

  const limit = field.budget ?? field.maxLength
  if (!limit) {
    return null
  }
  const over = current.length > limit
  return (
    <p
      className={cn(
        "font-mono text-xs tabular-nums",
        over ? "text-warning-foreground dark:text-warning" : "text-muted-foreground"
      )}
    >
      {current.length.toLocaleString()}/{limit.toLocaleString()}
    </p>
  )
}
