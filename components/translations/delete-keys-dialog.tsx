"use client"

import { useState } from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { deleteKeys, messageOf } from "@/lib/api"
import type { DeleteScope } from "@/lib/api-types"
import { languages, SOURCE_LANGUAGE, type LanguageCode } from "@/lib/locale-data"
import { targetOf, type Project } from "@/lib/projects"

const PREVIEW = 6

/**
 * The one confirmation for every delete in the workspace. It asks how far the
 * delete goes: clearing this language (the key stays, reads as missing here)
 * or retiring the key from every language of the project.
 */
export function DeleteKeysDialog({
  project,
  language,
  keys,
  onClose,
  onDeleted,
}: {
  project: Project
  language: LanguageCode
  keys: string[]
  onClose: () => void
  onDeleted: (keys: string[], scope: DeleteScope) => void
}) {
  const [everywhere, setEverywhere] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const count = keys.length
  const noun = count === 1 ? "key" : "keys"
  const languageName = languages.find((item) => item.code === language)?.name ?? language

  const close = () => {
    setEverywhere(false)
    onClose()
  }

  const handleDelete = async () => {
    const scope: DeleteScope = everywhere ? "all" : "language"
    setIsDeleting(true)
    try {
      const result = await deleteKeys({ target: targetOf(project), keys, scope, language })
      onDeleted(keys, scope)
      close()
      toast.success(`Deleted ${result.deleted} ${result.deleted === 1 ? "key" : "keys"}`, {
        description:
          scope === "all"
            ? `Removed from ${project.name} and its ${result.files.length} language files.`
            : `Cleared in ${languageName}. Every other language kept its translation.`,
      })
    } catch (cause: unknown) {
      toast.error("Could not delete", { description: messageOf(cause) })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog
      open={count > 0}
      onOpenChange={(next) => {
        if (!next && !isDeleting) {
          close()
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Delete {count.toLocaleString()} {noun}
          </DialogTitle>
          <DialogDescription>From {project.name}. No other project is touched.</DialogDescription>
        </DialogHeader>

        <ul className="max-h-40 overflow-auto rounded-xl border border-border bg-muted/40 p-2.5">
          {keys.slice(0, PREVIEW).map((key) => (
            <li key={key} className="truncate font-mono text-xs">
              {key}
            </li>
          ))}
          {count > PREVIEW && (
            <li className="pt-1 text-xs text-muted-foreground">and {(count - PREVIEW).toLocaleString()} more</li>
          )}
        </ul>

        <Label className="flex items-start gap-2 font-normal">
          <Checkbox
            className="mt-0.5"
            checked={everywhere}
            onCheckedChange={(checked) => setEverywhere(checked === true)}
          />
          <span className="text-sm">
            Delete in the other {languages.length - 1} languages too
            <span className="text-muted-foreground">
              {" "}
              -{" "}
              {everywhere
                ? `the ${noun} and every translation leave ${project.name} for good.`
                : `leave this off and only ${languageName} is cleared: the ${noun} stay registered and read as missing here.`}
            </span>
          </span>
        </Label>

        {!everywhere && language === SOURCE_LANGUAGE && (
          <p className="text-xs text-destructive">
            {languageName} is the source language. Clearing it leaves the {noun} with no English to translate from.
          </p>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button variant="destructive" disabled={isDeleting} onClick={handleDelete}>
            <Trash2 data-icon="inline-start" />
            {isDeleting ? "Deleting…" : everywhere ? "Delete everywhere" : `Delete in ${languageName}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
