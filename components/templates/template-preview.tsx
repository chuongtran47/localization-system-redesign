import { ChevronLeft, Mail, MoreVertical, Reply, Star } from "lucide-react"

import type { TemplateChannel, TemplateFieldId } from "@/lib/template-data"
import { previewHtml, previewText, sampleValues } from "@/lib/template-preview"
import { cn } from "@/lib/utils"
import { smsInfo } from "@/lib/validation"

type Values = Partial<Record<TemplateFieldId, string>>

/** The message as its reader gets it. Placeholders are filled with sample values. */
export function TemplatePreview({
  channel,
  values,
  appName,
  rtl,
}: {
  channel: TemplateChannel
  values: Values
  appName: string
  rtl?: boolean
}) {
  return (
    <div dir={rtl ? "rtl" : undefined} data-preview className="flex flex-col gap-3">
      {channel === "email" && <EmailPreview values={values} />}
      {channel === "sms" && <SmsPreview values={values} appName={appName} rtl={rtl} />}
      {channel === "notification" && <NotificationPreview values={values} appName={appName} />}
    </div>
  )
}

function NotTranslated() {
  return <span className="italic text-warning-foreground dark:text-warning">Not translated</span>
}

function EmailPreview({ values }: { values: Values }) {
  const subject = values.subject ?? ""
  const body = values.body ?? ""
  const cta = values.cta ?? ""
  const footer = values.footer ?? ""

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-start gap-2">
          <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="min-w-0 truncate text-sm font-semibold">{subject ? previewText(subject) : <NotTranslated />}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
          <ChevronLeft className="size-4 text-muted-foreground" />
          <div className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
            GS
          </div>
          <div className="min-w-0 flex-1 text-xs">
            <p className="truncate font-medium">GrapeSEED Support</p>
            <p className="truncate text-muted-foreground">to {sampleValues["{email}"]}</p>
          </div>
          <Star className="size-3.5 text-muted-foreground" />
          <Reply className="size-3.5 text-muted-foreground" />
          <MoreVertical className="size-3.5 text-muted-foreground" />
        </div>

        <div className="bg-background px-5 py-5">
          {body ? (
            <div
              className="text-sm leading-relaxed [&>:first-child]:mt-0 [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:border-l [&_blockquote]:pl-3 [&_em]:italic [&_h1]:mt-4 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:font-medium [&_li]:mb-1 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_small]:text-xs [&_strong]:font-semibold [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5"
              // `previewHtml` escapes the value and rebuilds only whitelisted tags.
              dangerouslySetInnerHTML={{ __html: previewHtml(body) }}
            />
          ) : (
            <p className="text-sm">
              <NotTranslated />
            </p>
          )}

          <div className="mt-5">
            <span className="inline-flex max-w-full items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              <span className={cn("truncate", !cta && "italic")}>{cta ? previewText(cta) : "Not translated"}</span>
            </span>
          </div>

          <p className="mt-5 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
            {footer ? previewText(footer) : <NotTranslated />}
          </p>
        </div>
      </div>
    </>
  )
}

function SmsPreview({ values, appName, rtl }: { values: Values; appName: string; rtl?: boolean }) {
  const message = previewText(values.message ?? "")
  const info = smsInfo(message)

  return (
    <>
      <div className="mx-auto w-full max-w-xs rounded-[1.75rem] border-4 border-foreground/15 bg-muted/30 p-3">
        <p className="mb-3 text-center text-xs font-medium text-muted-foreground">{appName}</p>
        {message ? (
          <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-border bg-background px-3 py-2 text-sm wrap-break-word shadow-sm">
            {message}
          </div>
        ) : (
          <p className="text-center text-xs">
            <NotTranslated />
          </p>
        )}
      </div>

      <dl dir={rtl ? "ltr" : undefined} className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Encoding" value={info.encoding} />
        <Stat label="Chars" value={String(info.units)} />
        <Stat label="Segments" value={String(info.segments)} warn={info.segments > 1} />
      </dl>
    </>
  )
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={cn("font-mono text-sm tabular-nums", warn && "text-warning-foreground dark:text-warning")}>{value}</dd>
    </div>
  )
}

function NotificationPreview({ values, appName }: { values: Values; appName: string }) {
  const title = previewText(values.title ?? "")
  const body = previewText(values.body ?? "")

  return (
    <>
      <div className="mx-auto w-full max-w-xs rounded-[1.75rem] border-4 border-foreground/15 bg-linear-to-b from-primary/20 via-muted to-muted/40 p-3">
        <p className="mb-4 mt-2 text-center text-4xl font-light tabular-nums text-muted-foreground">9:41</p>
        <div className="rounded-2xl border border-border bg-background/90 p-3 shadow-sm backdrop-blur">
          <div className="flex items-center gap-2">
            <div className="flex size-5 items-center justify-center rounded bg-primary text-[9px] font-bold text-primary-foreground">
              GS
            </div>
            <span className="flex-1 truncate text-[10px] font-medium uppercase text-muted-foreground">{appName}</span>
            <span className="text-[10px] text-muted-foreground">now</span>
          </div>
          <p className="mt-1.5 line-clamp-1 text-sm font-semibold">{title || <NotTranslated />}</p>
          <p className="line-clamp-2 text-sm text-muted-foreground">{body || <NotTranslated />}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-sm font-semibold">{title || <NotTranslated />}</p>
        <p className="text-sm text-muted-foreground">{body || <NotTranslated />}</p>
      </div>
    </>
  )
}
