import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import type { LocaleBundle } from "@/lib/locale-data"
import type { FileStore, SeedSource, TemplateSeed } from "@/mock/file-store"
import { handleRequest } from "@/mock/router"
import { createStore, type Store } from "@/mock/store"

const sampleDir = fileURLToPath(new URL("../../public/sample-data/", import.meta.url))

function readJson<T>(file: string): T | null {
  const path = `${sampleDir}${file}`
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : null
}

export const nodeSeeds: SeedSource = {
  locale: async (code) => readJson<LocaleBundle>(`locale/${code}.json`),
  templates: async () => readJson<TemplateSeed[]>("templates.json"),
}

export function memoryFileStore(): FileStore {
  const files = new Map<string, string>()
  return {
    read: (path) => files.get(path) ?? null,
    write: (path, text) => {
      files.set(path, text)
    },
    clear: () => files.clear(),
  }
}

export function createTestStore(): Store {
  return createStore(memoryFileStore(), nodeSeeds)
}

export function call(store: Store, method: string, url: string, body?: unknown) {
  const request = new Request(`http://test${url}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return handleRequest(store, request, new URL(request.url).pathname)
}

export async function callJson<T>(store: Store, method: string, url: string, body?: unknown) {
  const response = await call(store, method, url, body)
  const text = await response.text()
  return { status: response.status, body: (text ? JSON.parse(text) : undefined) as T }
}
