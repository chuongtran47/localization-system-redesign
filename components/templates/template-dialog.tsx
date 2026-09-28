"use client"

import { useState, type ReactNode } from "react"
import { Globe, Smartphone } from "lucide-react"
import { toast } from "sonner"

import { outlineButton, primaryButton } from "@/components/button-styles"
import { TemplateFieldEditor } from "@/components/templates/template-field-editor"
import { TemplatePreview } from "@/components/templates/template-preview"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { messageOf, saveTranslations } from "@/lib/api"
import { displayedValueOf, languages, SOURCE_LANGUAGE, type LanguageCode } from "@/lib/locale-data"
import { targetOf, type Project } from "@/lib/projects"
import { categoryLabel, fieldOf, templateKeyOf, type TemplateEntry, type TemplateFieldId } from "@/lib/template-data"
import { ownerProject } from "@/lib/template-view"
import { cn } from "@/lib/utils"

type PreviewMode = "target" | "source"

/** Translating one template: the fields on the left, the message as its reader gets it on the right. */
export function TemplateDialog({
  entry,
  project,
  language,
  onClose,
  onSaved,
}: {
  entry: TemplateEntry
  project: Project
  language: LanguageCode
  onClose: () => void
  onSaved: () => void
}) {
  const { template, fields } = entry
  const [edits, setEdits] = useState<Partial<Record<TemplateFieldId, string>>>({})
  const [keeps, setKeeps] = useState<ReadonlySet<TemplateFieldId>>(new Set())
  const [mode, setMode] = useState<PreviewMode>("target")
  const [isSaving, setIsSaving] = useState(false)

  const languageInfo = languages.find((item) => item.code === language) ?? languages[0]
  const isSource = language === SOURCE_LANGUAGE
  const previewMode: PreviewMode = isSource ? "target" : mode
  const owner = ownerProject(template.owner)
  // The icon follows the project the label names - `app/parent` sends from Parent Portal, a website.
  const isMobile = owner.project ? owner.project.group === "mobile" : template.owner.kind === "app"
  const OwnerIcon = isMobile ? Smartphone : Globe

  const fieldValueOf = (field: TemplateFieldId) => fields.find((item) => item.field === field)

  const valueOf = (field: TemplateFieldId) => {
    const edited = edits[field]
    if (edited !== undefined) {
      return edited
    }
    const value = fieldValueOf(field)
    if (!value) {
      return ""
    }
    return keeps.has(field) ? value.source : displayedValueOf(value)
  }

  const dirtyFields = Object.keys(edits) as TemplateFieldId[]
  const pending = dirtyFields.length + keeps.size

  const handleChange = (field: TemplateFieldId, next: string) => {
    const value = fieldValueOf(field)
    setKeeps((current) => {
      if (!current.has(field)) {
        return current
      }
      const copy = new Set(current)
      copy.delete(field)
      return copy
    })
    setEdits((current) => {
      const copy = { ...current }
      if (value && next === displayedValueOf(value)) {
        delete copy[field]
      } else {
        copy[field] = next
      }
      return copy
    })
  }

  const handleKeep = (field: TemplateFieldId) => {
    setEdits((current) => {
      const copy = { ...current }
      delete copy[field]
      return copy
    })
    setKeeps((current) => new Set(current).add(field))
  }

  // An outdated value that still holds is confirmed by writing it back.
  const handleConfirm = (field: TemplateFieldId) => {
    const value = fieldValueOf(field)
    if (value) {
      setEdits((current) => ({ ...current, [field]: value.target }))
    }
  }

  const handleDiscard = () => {
    setEdits({})
    setKeeps(new Set())
  }

  const requestClose = () => {
    if (pending > 0 && !window.confirm(`Discard ${pending} unsaved ${pending === 1 ? "field" : "fields"}?`)) {
      return
    }
    onClose()
  }

  const handleSave = async () => {
    const values: Record<string, string> = {}
    for (const field of dirtyFields) {
      values[templateKeyOf(template.id, field)] = edits[field] ?? ""
    }
    const keepKeys = [...keeps].map((field) => templateKeyOf(template.id, field))

    setIsSaving(true)
    try {
      const { saved, file } = await saveTranslations(targetOf(project), language, values, keepKeys)
      setEdits({})
      setKeeps(new Set())
      onSaved()
      toast.success(`Saved ${saved} ${saved === 1 ? "field" : "fields"} of ${template.name}`, {
        description: `Written to ${file}`,
      })
    } catch (cause: unknown) {
      toast.error("Could not save", { description: messageOf(cause) })
    } finally {
      setIsSaving(false)
    }
  }

  const previewValues: Partial<Record<TemplateFieldId, string>> = {}
  for (const field of fields) {
    previewValues[field.field] = previewMode === "source" ? field.source : valueOf(field.field)
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          requestClose()
        }
      }}
    >
      <DialogContent className="grid h-[min(50rem,calc(100dvh-2rem))] w-[min(84rem,calc(100vw-2rem))] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 p-0 sm:max-w-none">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border px-5 py-3 pr-12">
          <DialogTitle className="text-base font-semibold tracking-tight">{template.name}</DialogTitle>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {categoryLabel[template.category]}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <OwnerIcon className="size-3.5" />
            {owner.label}
          </span>
          <DialogDescription className="sr-only">{template.id}</DialogDescription>
        </header>

        <div className="grid min-h-0 grid-cols-1 lg:grid-cols-2">
          <div className="min-h-0 overflow-auto border-border lg:border-r">
            {fields.map((field) => (
              <TemplateFieldEditor
                key={field.field}
                channel={template.channel}
                field={fieldOf(template.channel, field.field)}
                value={field}
                current={valueOf(field.field)}
                isDirty={field.field in edits || keeps.has(field.field)}
                isKeepPending={keeps.has(field.field)}
                language={language}
                profile={project.profile}
                rtl={languageInfo.rtl ?? false}
                readOnly={isSource}
                onChange={handleChange}
                onKeep={handleKeep}
                onConfirm={handleConfirm}
              />
            ))}
          </div>

          <div className="min-h-0 overflow-auto bg-muted/20">
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-card/80 px-5 py-2 backdrop-blur">
              <h3 className="text-sm font-medium">Preview</h3>
              <div className="ml-auto flex gap-1">
                <ModeButton isActive={previewMode === "target"} onClick={() => setMode("target")}>
                  {languageInfo.name}
                </ModeButton>
                {!isSource && (
                  <ModeButton isActive={previewMode === "source"} onClick={() => setMode("source")}>
                    English
                  </ModeButton>
                )}
              </div>
            </div>
            <div className="p-5">
              <TemplatePreview
                channel={template.channel}
                values={previewValues}
                appName={owner.label}
                rtl={previewMode === "target" && (languageInfo.rtl ?? false)}
              />
            </div>
          </div>
        </div>

        <footer className="flex items-center gap-3 border-t border-border bg-muted/40 px-5 py-3">
          {!isSource && (
            <span className="text-sm text-muted-foreground">
              {pending > 0
                ? `${pending} unsaved ${pending === 1 ? "field" : "fields"}`
                : `${entry.translated}/${entry.total} fields translated`}
            </span>
          )}
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              className={outlineButton}
              disabled={isSaving}
              onClick={pending > 0 ? handleDiscard : onClose}
            >
              {pending > 0 ? "Discard" : "Close"}
            </button>
            {!isSource && (
              <button
                type="button"
                className={primaryButton}
                disabled={isSaving || pending === 0}
                onClick={handleSave}
              >
                {isSaving ? "Saving…" : "Save"}
              </button>
            )}
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  )
}

function ModeButton({ isActive, onClick, children }: { isActive: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        isActive
          ? "pointer-events-none border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-accent/40 hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}
