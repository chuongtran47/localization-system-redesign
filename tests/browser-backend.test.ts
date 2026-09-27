import { IDBFactory } from "fake-indexeddb"
import { describe, expect, it } from "vitest"

import type { EntriesResponse } from "@/lib/api-types"
import type { SeedSource } from "@/mock/file-store"
import { createBrowserBackend, type LocalFetch } from "@/mock/browser-backend"
import { nodeSeeds } from "./helpers/backend"

const SCHOOL = "web/school-portal"

const failingSeeds: SeedSource = {
  locale: () => Promise.reject(new Error("seed should not run")),
  templates: () => Promise.reject(new Error("seed should not run")),
}

async function send(backend: LocalFetch, method: string, path: string, body?: unknown) {
  const response = await backend(path, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : undefined }
}

async function englishKeys(backend: LocalFetch) {
  const { body } = await send(backend, "GET", `/entries?target=${SCHOOL}&lang=en`)
  return (body as EntriesResponse).entries.map((row) => row.key)
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

describe("browser backend", () => {
  it("keeps writes across a reload, and reset returns to the seed", async () => {
    const idb = new IDBFactory()
    const first = createBrowserBackend({ seeds: nodeSeeds, indexedDB: idb })
    const created = await send(first, "POST", "/keys", { key: "home.greeting.title", source: "Hello", target: SCHOOL })
    expect(created.status).toBe(201)
    await settle()

    const reloaded = createBrowserBackend({ seeds: failingSeeds, indexedDB: idb })
    expect(await englishKeys(reloaded)).toContain("home.greeting.title")

    const resetter = createBrowserBackend({ seeds: nodeSeeds, indexedDB: idb })
    expect((await send(resetter, "POST", "/reset")).status).toBe(204)
    await settle()

    const afterReset = createBrowserBackend({ seeds: failingSeeds, indexedDB: idb })
    const keys = await englishKeys(afterReset)
    expect(keys).toHaveLength(500)
    expect(keys).not.toContain("home.greeting.title")
  })

  it("still works in memory when IndexedDB is unavailable", async () => {
    const blocked = {
      open: () => {
        throw new Error("blocked")
      },
    } as unknown as IDBFactory
    const backend = createBrowserBackend({ seeds: nodeSeeds, indexedDB: blocked })
    expect(await englishKeys(backend)).toHaveLength(500)
  })

  it("recovers when the seed download fails the first time", async () => {
    let attempts = 0
    const flaky: SeedSource = {
      locale: (code) => {
        attempts += 1
        return attempts === 1 ? Promise.reject(new Error("offline")) : nodeSeeds.locale(code)
      },
      templates: () => nodeSeeds.templates(),
    }
    const backend = createBrowserBackend({ seeds: flaky, indexedDB: new IDBFactory() })

    const failed = await send(backend, "GET", `/entries?target=${SCHOOL}&lang=en`)
    expect(failed.status).toBe(500)
    expect(failed.body.error).toContain("offline")

    expect(await englishKeys(backend)).toHaveLength(500)
  })
})
