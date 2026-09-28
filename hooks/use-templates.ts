"use client"

import { useEffect, useState } from "react"

import { fetchTemplates, messageOf } from "@/lib/api"
import type { LanguageCode } from "@/lib/locale-data"
import type { TemplateEntry } from "@/lib/template-data"

type Result = { token: string; templates: TemplateEntry[] } | { token: string; error: string }

const EMPTY: TemplateEntry[] = []

/** One channel's templates in one language. A refresh keeps the old list until the new one lands. */
export function useTemplates(target: string, language: LanguageCode, revision: number) {
  const token = `${target}:${language}`
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => {
    let cancelled = false
    const current = `${target}:${language}`

    fetchTemplates(target, language)
      .then((response) => {
        if (!cancelled) {
          setResult({ token: current, templates: response.templates })
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setResult({ token: current, error: messageOf(cause) })
        }
      })

    return () => {
      cancelled = true
    }
  }, [target, language, revision])

  const mine = result && result.token === token ? result : null

  return {
    templates: mine && "templates" in mine ? mine.templates : EMPTY,
    isLoading: mine === null,
    error: mine && "error" in mine ? mine.error : null,
  }
}
