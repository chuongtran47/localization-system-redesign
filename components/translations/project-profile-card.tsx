import type { ReactNode } from "react"
import { BellRing, KeyRound, Mail, MessageSquare, Type } from "lucide-react"

import { kindLabel, type ContentKind, type Project } from "@/lib/projects"
import { effectiveLengthBudget } from "@/lib/validation"

const kindIcon: Record<ContentKind, typeof Type> = {
  ui: Type,
  email: Mail,
  sms: MessageSquare,
  notification: BellRing,
}

/** What a project is for, so whoever adds its first key knows the register to write in. */
export function ProjectProfileCard({
  project,
  title,
  message,
  action,
}: {
  project: Project
  title: string
  message: string
  action?: ReactNode
}) {
  const { profile } = project
  const KindIcon = kindIcon[profile.kind]

  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <KeyRound className="size-4" />
          </div>
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {profile.note} {message}
        </p>

        <dl className="mt-5 grid gap-3 text-sm">
          <Field label="Content kind">
            <span className="flex items-center gap-1.5">
              <KindIcon className="size-3.5" />
              {kindLabel[profile.kind]}
            </span>
          </Field>
          <Field label="Audience">{profile.audience}</Field>
          <Field label="Tone">{profile.tone}</Field>
          <Field label="Length budget">
            Warn past {effectiveLengthBudget(profile.lengthBudget)}× the English length
            {profile.maxLength ? `, hard limit ${profile.maxLength.toLocaleString()} characters` : ""}
          </Field>
          <Field label="Profile">{profile.measured ? "Measured" : "Inferred"}</Field>
        </dl>

        {action && <div className="mt-6 flex">{action}</div>}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
