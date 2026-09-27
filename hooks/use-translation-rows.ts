"use client"

import { useEffect, useState } from "react"

import { fetchEntries, messageOf } from "@/lib/api"
import type { LanguageCode, TranslationRow } from "@/lib/locale-data"

type Result = { token: string; rows: TranslationRow[] } | { token: string; error: string }

const EMPTY: TranslationRow[] = []

/**
 * One project's keys in one language. A null target skips the request. Old
 * rows stay on screen while a refresh is in flight; a response for a target or
 * language the screen has moved away from is ignored.
 */
export function useTranslationRows(target: string | null, language: LanguageCode, revision: number) {
  const token = target ? `${target}:${language}` : null
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => {
    if (!target) {
      return
    }
    let cancelled = false
    const current = `${target}:${language}`

    fetchEntries(target, language)
      .then((response) => {
        if (!cancelled) {
          setResult({ token: current, rows: response.entries })
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
    rows: mine && "rows" in mine ? mine.rows : EMPTY,
    isLoading: token !== null && mine === null,
    error: mine && "error" in mine ? mine.error : null,
  }
}
