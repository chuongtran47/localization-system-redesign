"use client"

import { useEffect, useState } from "react"

import { fetchEntries, messageOf } from "@/lib/api"
import type { LanguageCode, TranslationRow } from "@/lib/locale-data"

type Held = { key: string; rows: Map<LanguageCode, TranslationRow[]> }

const EMPTY: ReadonlyMap<LanguageCode, TranslationRow[]> = new Map()

/**
 * One project's keys in several languages at once - what an import needs to
 * diff each file against its own language. Languages already held are not
 * fetched again; a new project or a new `revision` starts over.
 */
export function useTargetBundles(target: string | null, codes: LanguageCode[], revision: number) {
  const key = target ? `${target}@${revision}` : ""
  const [held, setHeld] = useState<Held>(() => ({ key, rows: new Map() }))
  const [error, setError] = useState<{ key: string; message: string } | null>(null)

  // Reset during render: what was read about another project, or before a
  // refresh, is not an answer about this one.
  if (held.key !== key) {
    setHeld({ key, rows: new Map() })
  }

  const wanted = codes.join(",")

  useEffect(() => {
    if (!target || held.key !== key) {
      return
    }
    const missing = codes.filter((code) => !held.rows.has(code))
    if (missing.length === 0) {
      return
    }

    let cancelled = false
    Promise.all(missing.map((code) => fetchEntries(target, code).then((response) => [code, response.entries] as const)))
      .then((loaded) => {
        if (cancelled) {
          return
        }
        setHeld((current) => {
          if (current.key !== key) {
            return current
          }
          const rows = new Map(current.rows)
          for (const [code, entries] of loaded) {
            rows.set(code, entries)
          }
          return { key, rows }
        })
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError({ key, message: messageOf(cause) })
        }
      })

    return () => {
      cancelled = true
    }
    // `wanted` stands in for `codes`, which the caller rebuilds on every render.
  }, [target, key, wanted, held]) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = held.key === key ? held.rows : EMPTY
  const currentError = error?.key === key ? error.message : null

  return {
    rows,
    isLoading: target !== null && currentError === null && codes.some((code) => !rows.has(code)),
    error: currentError,
  }
}
