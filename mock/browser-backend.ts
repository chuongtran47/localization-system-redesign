/**
 * The mock backend, running in the tab: the router and store from this folder
 * over a map of documents that is persisted to IndexedDB behind the caller's
 * back. `FileStore` is synchronous and IndexedDB is not, so the map is the
 * store and the database is a copy of it. A write that fails to persist still
 * succeeds for the session; only the next reload loses it.
 */

import type { LocaleBundle } from "../lib/locale-data"
import type { FileStore, SeedSource, TemplateSeed } from "./file-store"
import { handleRequest } from "./router"
import { createStore } from "./store"

const DB_NAME = "localizer-mock"
const DB_VERSION = 1
const STORE_NAME = "files"

export type LocalFetch = (path: string, init?: RequestInit) => Promise<Response>

export type BrowserBackendOptions = {
  seeds: SeedSource
  /** Null runs in memory only. Defaults to the browser's own. */
  indexedDB?: IDBFactory | null
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url)
  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    throw new Error(`Could not load the sample data at ${url}`)
  }
  return (await response.json()) as T
}

export const publicSeeds: SeedSource = {
  locale: (code) => fetchJson<LocaleBundle>(`/sample-data/locale/${code}.json`),
  templates: () => fetchJson<TemplateSeed[]>("/sample-data/templates.json"),
}

function openDatabase(factory: IDBFactory | null): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (!factory) {
      resolve(null)
      return
    }

    let request: IDBOpenDBRequest
    try {
      request = factory.open(DB_NAME, DB_VERSION)
    } catch {
      resolve(null)
      return
    }

    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
}

function readAll(db: IDBDatabase): Promise<Map<string, string>> {
  return new Promise((resolve) => {
    const files = new Map<string, string>()
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).openCursor()

    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) {
        resolve(files)
        return
      }
      files.set(String(cursor.key), cursor.value as string)
      cursor.continue()
    }
    request.onerror = () => resolve(files)
  })
}

function browserFileStore(db: IDBDatabase | null, files: Map<string, string>): FileStore {
  const persist = (apply: (store: IDBObjectStore) => void) => {
    if (!db) {
      return
    }
    try {
      const transaction = db.transaction(STORE_NAME, "readwrite")
      transaction.onerror = () => {
        console.warn("[mock] could not persist to IndexedDB", transaction.error)
      }
      apply(transaction.objectStore(STORE_NAME))
    } catch (cause) {
      console.warn("[mock] could not persist to IndexedDB", cause)
    }
  }

  return {
    read: (path) => files.get(path) ?? null,
    write: (path, text) => {
      files.set(path, text)
      persist((store) => store.put(text, path))
    },
    clear: () => {
      files.clear()
      persist((store) => store.clear())
    },
  }
}

/** A fresh backend. Tests make one per simulated page load. */
export function createBrowserBackend({
  seeds,
  indexedDB: factory = globalThis.indexedDB ?? null,
}: BrowserBackendOptions): LocalFetch {
  let handler: Promise<(request: Request, path: string) => Promise<Response>> | undefined

  const start = async () => {
    const db = await openDatabase(factory)
    const store = createStore(browserFileStore(db, db ? await readAll(db) : new Map()), seeds)
    return (request: Request, path: string) => handleRequest(store, request, path)
  }

  return async (path, init) => {
    handler ??= start()
    const handle = await handler
    const url = new URL(path, "http://localhost")
    return handle(new Request(url, init), url.pathname)
  }
}

let shared: LocalFetch | undefined

/** The page's one backend, started on the first request. */
export const localFetch: LocalFetch = (path, init) => {
  shared ??= createBrowserBackend({ seeds: publicSeeds })
  return shared(path, init)
}
