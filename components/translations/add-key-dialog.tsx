"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { ArrowUpRight, Braces, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createKey, messageOf } from "@/lib/api"
import { groupKeyOf, isValidKey, languages, SOURCE_LANGUAGE } from "@/lib/locale-data"
import { projectPath, targetOf, type Project } from "@/lib/projects"
import { placeholdersOf } from "@/lib/validation"

type Created = { key: string; source: string; count: number }

/**
 * A key belongs to one project and reaches every language of it at once:
 * English gets the text, the other twelve an empty value.
 */
export function AddKeyDialog({
  open,
  onOpenChange,
  project,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project
  onCreated: (key: string) => void
}) {
  const [key, setKey] = useState("")
  const [text, setText] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [created, setCreated] = useState<Created | null>(null)

  const trimmedKey = key.trim()
  const group = trimmedKey ? groupKeyOf(trimmedKey) : ""
  const placeholders = placeholdersOf(text)
  const formatError =
    trimmedKey && !isValidKey(trimmedKey) ? "Use dot-separated segments - group.section.name." : null
  const keyError = serverError ?? formatError ?? (submitted && !trimmedKey ? "Key is required." : null)
  const textError = submitted && !text.trim() ? "English text is required." : null

  const reset = () => {
    setKey("")
    setText("")
    setSubmitted(false)
    setServerError(null)
    setCreated(null)
  }

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
    if (!next) {
      reset()
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)
    setServerError(null)
    const source = text.trim()
    if (!trimmedKey || !source || formatError) {
      return
    }

    setIsSubmitting(true)
    try {
      const response = await createKey({ key: trimmedKey, source, target: targetOf(project) })
      setCreated({ key: response.key.key, source, count: response.languages.length })
      onCreated(response.key.key)
    } catch (cause: unknown) {
      setServerError(messageOf(cause))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Key added to {project.name}</DialogTitle>
              <DialogDescription>
                <code className="font-mono text-xs text-foreground">{created.key}</code> was written to{" "}
                {created.count} language files, and is missing in {created.count - 1} of them until someone
                translates it.
              </DialogDescription>
            </DialogHeader>

            <ul className="max-h-72 divide-y divide-border overflow-auto rounded-xl border border-border">
              {languages.map((language) => (
                <li key={language.code} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="w-32 shrink-0 truncate">{language.name}</span>
                  {language.code === SOURCE_LANGUAGE ? (
                    <>
                      <span className="min-w-0 flex-1 truncate">{created.source}</span>
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
                        Source
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate italic text-muted-foreground">No translation</span>
                      <Link
                        href={`${projectPath(project)}?lang=${language.code}&q=${encodeURIComponent(created.key)}`}
                        onClick={() => handleOpenChange(false)}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-accent/50"
                      >
                        Translate
                        <ArrowUpRight className="size-3.5" />
                      </Link>
                    </>
                  )}
                </li>
              ))}
            </ul>

            <DialogFooter showCloseButton>
              <Button variant="outline" onClick={reset}>
                <Plus data-icon="inline-start" />
                Add another
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="contents">
            <DialogHeader>
              <DialogTitle>Add a key to {project.name}</DialogTitle>
              <DialogDescription>
                The key is created in this project only, in every language at once.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-key">Key</Label>
              <Input
                id="add-key"
                value={key}
                onChange={(event) => {
                  setKey(event.target.value)
                  setServerError(null)
                }}
                placeholder="campus.form.actions.archive"
                className="font-mono"
                aria-invalid={Boolean(keyError)}
                autoFocus
              />
              {keyError ? (
                <p className="text-xs text-destructive">{keyError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {group ? (
                    <>
                      Group <code className="font-mono">{group}</code>
                    </>
                  ) : (
                    "The first dot-segment becomes the group this list filters by."
                  )}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-key-text">English text</Label>
              <Textarea
                id="add-key-text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Archive campus"
                className="min-h-20 resize-y"
                aria-invalid={Boolean(textError)}
              />
              {textError ? (
                <p className="text-xs text-destructive">{textError}</p>
              ) : placeholders.length > 0 ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Braces className="size-3.5" />
                  Placeholders {placeholders.join(" ")} - every translation must keep them.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Use {"{name}"} for values filled in at runtime.</p>
              )}
            </div>

            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Adding…" : "Add key"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
