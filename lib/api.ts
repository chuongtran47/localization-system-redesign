/**
 * The only module in the app that knows a backend exists. Today that is the
 * mock in `mock/`, running in the tab; pointing the app at a real service
 * means changing `send` below and nothing else.
 */

import type {
  ApiErrorBody,
  CoverageResponse,
  CreateKeyRequest,
  CreateKeyResponse,
  DeleteKeysRequest,
  DeleteKeysResponse,
  EntriesResponse,
  ExportRequest,
  ImportMode,
  ImportRequest,
  ImportResponse,
  SaveTranslationsRequest,
  SaveTranslationsResponse,
  TemplatesResponse,
} from "@/lib/api-types"
import { currentUser } from "@/lib/current-user"
import type { LanguageCode } from "@/lib/locale-data"

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export function messageOf(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message
  }
  return String(cause)
}

async function send(path: string, init?: RequestInit): Promise<Response> {
  const request: RequestInit = {
    ...init,
    headers: init?.body ? { "content-type": "application/json", ...init.headers } : init?.headers,
  }

  let response: Response
  try {
    const { localFetch } = await import("@/mock/browser-backend")
    response = await localFetch(path, request)
  } catch (cause) {
    throw new ApiError(0, `The demo backend could not answer - ${messageOf(cause)}`)
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null
    throw new ApiError(response.status, body?.error ?? `${response.status} ${response.statusText}`)
  }

  return response
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await send(path, init)
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}

const query = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams()
  for (const [name, value] of Object.entries(params)) {
    if (value) {
      search.set(name, value)
    }
  }
  return search.toString()
}

export function fetchEntries(target: string, lang: LanguageCode) {
  return request<EntriesResponse>(`/entries?${query({ target, lang })}`)
}

export function fetchTemplates(target: string, lang: LanguageCode) {
  return request<TemplatesResponse>(`/templates?${query({ target, lang })}`)
}

export function createKey(input: CreateKeyRequest) {
  return request<CreateKeyResponse>("/keys", {
    method: "POST",
    body: JSON.stringify({ createdBy: currentUser.name, ...input } satisfies CreateKeyRequest),
  })
}

export function deleteKeys(input: DeleteKeysRequest) {
  return request<DeleteKeysResponse>("/keys/delete", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function saveTranslations(
  target: string,
  lang: LanguageCode,
  values: Record<string, string>,
  keep: string[] = []
) {
  return request<SaveTranslationsResponse>(`/translations/${lang}?${query({ target })}`, {
    method: "PUT",
    body: JSON.stringify({ values, keep, by: currentUser.name } satisfies SaveTranslationsRequest),
  })
}

export function importBundle(
  target: string,
  lang: LanguageCode,
  values: Record<string, string>,
  mode: ImportMode
) {
  return request<ImportResponse>(`/import/${lang}?${query({ target })}`, {
    method: "PUT",
    body: JSON.stringify({ values, mode, by: currentUser.name } satisfies ImportRequest),
  })
}

export function fetchCoverage() {
  return request<CoverageResponse>("/coverage")
}

export async function exportBundle(input: ExportRequest) {
  const response = await send("/export", { method: "POST", body: JSON.stringify(input) })
  const disposition = response.headers.get("content-disposition") ?? ""
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
  const plain = /filename="([^"]+)"/.exec(disposition)

  return {
    blob: await response.blob(),
    filename: encoded ? decodeURIComponent(encoded[1]) : (plain?.[1] ?? "translations.zip"),
  }
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function resetData() {
  return request<void>("/reset", { method: "POST" })
}
