"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { Bold, Heading, Italic, Link2, Link2Off, List, ListOrdered, Underline } from "lucide-react"

import { iconButton } from "@/components/button-styles"
import { cleanHtml } from "@/lib/template-preview"
import { cn } from "@/lib/utils"

/**
 * A mail body edited as formatting rather than as angle brackets. Built on
 * `contenteditable` and `execCommand`; the value leaves through `cleanHtml`,
 * so what is stored never depends on which browser typed it.
 */
export function RichTextEditor({
  value,
  rtl,
  ariaLabel,
  onChange,
}: {
  value: string
  rtl?: boolean
  ariaLabel: string
  onChange: (value: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  // The last value this editor produced. The DOM is rewritten only when the
  // value changed elsewhere (a paste of the English, another template), or the
  // caret would jump to the start on every keystroke.
  const emitted = useRef<string | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!element || value === emitted.current) {
      return
    }
    element.innerHTML = value
    emitted.current = value
  }, [value])

  useEffect(() => {
    document.execCommand("defaultParagraphSeparator", false, "p")
  }, [])

  const emit = () => {
    const element = ref.current
    if (!element) {
      return
    }
    const next = cleanHtml(element.innerHTML)
    emitted.current = next
    onChange(next)
  }

  const run = (command: string, argument?: string) => {
    ref.current?.focus()
    document.execCommand(command, false, argument)
    emit()
  }

  const heading = () => {
    const current = document.queryCommandValue("formatBlock").toLowerCase()
    run("formatBlock", current === "h1" ? "<p>" : "<h1>")
  }

  const link = () => {
    const url = window.prompt("Link address")
    if (url) {
      run("createLink", url)
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-input bg-background">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 px-1 py-1">
        <Tool label="Bold" onClick={() => run("bold")}>
          <Bold className="size-3.5" />
        </Tool>
        <Tool label="Italic" onClick={() => run("italic")}>
          <Italic className="size-3.5" />
        </Tool>
        <Tool label="Underline" onClick={() => run("underline")}>
          <Underline className="size-3.5" />
        </Tool>
        <span className="mx-1 h-4 w-px bg-border" />
        <Tool label="Heading" onClick={heading}>
          <Heading className="size-3.5" />
        </Tool>
        <Tool label="Bulleted list" onClick={() => run("insertUnorderedList")}>
          <List className="size-3.5" />
        </Tool>
        <Tool label="Numbered list" onClick={() => run("insertOrderedList")}>
          <ListOrdered className="size-3.5" />
        </Tool>
        <span className="mx-1 h-4 w-px bg-border" />
        <Tool label="Add link" onClick={link}>
          <Link2 className="size-3.5" />
        </Tool>
        <Tool label="Remove link" onClick={() => run("unlink")}>
          <Link2Off className="size-3.5" />
        </Tool>
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        dir={rtl ? "rtl" : undefined}
        onInput={emit}
        onBlur={emit}
        onPaste={(event) => {
          event.preventDefault()
          document.execCommand("insertText", false, event.clipboardData.getData("text/plain"))
          emit()
        }}
        className={cn(
          "min-h-52 overflow-auto px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
          "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
          "[&_li]:mb-1 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5",
          "[&_h1]:mb-3 [&_h1]:text-base [&_h1]:font-semibold",
          "[&_p]:mb-3 [&_p:last-child]:mb-0",
          "[&_strong]:font-semibold [&_em]:italic",
          "[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5",
          "empty:before:text-muted-foreground empty:before:content-['Add_translation…']"
        )}
      />
    </div>
  )
}

function Tool({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // The selection has to survive the click, and focusing a button clears it.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={iconButton}
    >
      {children}
    </button>
  )
}
