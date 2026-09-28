import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it } from "vitest"

import type {
  ApiErrorBody,
  CoverageResponse,
  CreateKeyResponse,
  DeleteKeysResponse,
  EntriesResponse,
  ImportResponse,
} from "@/lib/api-types"
import { parseBundleFile } from "@/lib/bundle-diff"
import type { TranslationRow } from "@/lib/locale-data"
import type { Store } from "@/mock/store"
import { call, callJson, createTestStore } from "./helpers/backend"
import { readZip } from "./helpers/zip"

const SCHOOL = "web/school-portal"
const CANCEL = "user.form.actions.cancel"
const COPY = "product.producttype.grapeseed"

let store: Store

beforeEach(() => {
  store = createTestStore()
})

async function entries(target: string, lang: string) {
  const { body } = await callJson<EntriesResponse>(store, "GET", `/entries?target=${target}&lang=${lang}`)
  return body.entries
}

async function rowOf(target: string, lang: string, key: string) {
  return (await entries(target, lang)).find((row) => row.key === key)
}

function countsOf(rows: TranslationRow[]) {
  const counts: Record<string, number> = {}
  for (const row of rows) {
    counts[row.status] = (counts[row.status] ?? 0) + 1
  }
  return counts
}

describe("seed", () => {
  it("matches the reference implementation's counts for School Portal", async () => {
    expect(countsOf(await entries(SCHOOL, "en"))).toEqual({ translated: 500 })
    expect(countsOf(await entries(SCHOOL, "vi"))).toEqual({ translated: 493, missing: 6, needs_fix: 1 })
    expect(countsOf(await entries(SCHOOL, "km"))).toEqual({ translated: 494, missing: 6 })
    expect(countsOf(await entries(SCHOOL, "ja"))).toEqual({ translated: 496, missing: 3, needs_fix: 1 })
  })

  it("flags the deliberately broken rows", async () => {
    expect((await rowOf(SCHOOL, "vi", "school_teacher.message.cannotdeleteschoolteacher"))?.status).toBe("needs_fix")
    expect((await rowOf("messages/email", "vi", "visitation_scheduled.body"))?.status).toBe("needs_fix")
  })

  it("answers an empty list for a project nobody has added keys to", async () => {
    expect(await entries("mobile/student-app", "vi")).toEqual([])
  })
})

describe("keys", () => {
  it("creates a key in all 13 languages of one project only", async () => {
    const created = await callJson<CreateKeyResponse>(store, "POST", "/keys", {
      key: "home.greeting.title",
      source: "Hello",
      target: "mobile/student-app",
      createdBy: "Tester",
    })
    expect(created.status).toBe(201)
    expect(created.body.languages).toHaveLength(13)
    expect((await rowOf("mobile/student-app", "vi", "home.greeting.title"))?.status).toBe("missing")
    expect(await rowOf(SCHOOL, "vi", "home.greeting.title")).toBeUndefined()
  })

  it("refuses a duplicate in the same project and a malformed key", async () => {
    const input = { key: "home.greeting.title", source: "Hello", target: SCHOOL }
    expect((await call(store, "POST", "/keys", input)).status).toBe(201)
    expect((await call(store, "POST", "/keys", input)).status).toBe(409)
    expect((await call(store, "POST", "/keys", { ...input, key: "nogroup" })).status).toBe(400)
  })

  it("handles a key containing a slash through create and delete", async () => {
    const key = "school_admin/campus.invite.text"
    expect((await call(store, "POST", "/keys", { key, source: "Invite", target: SCHOOL })).status).toBe(201)
    const deleted = await callJson<DeleteKeysResponse>(store, "POST", "/keys/delete", {
      target: SCHOOL,
      keys: [key],
      scope: "all",
    })
    expect(deleted.body.deleted).toBe(1)
    expect(await rowOf(SCHOOL, "en", key)).toBeUndefined()
  })

  it("clears one language with scope language and keeps the key", async () => {
    const deleted = await callJson<DeleteKeysResponse>(store, "POST", "/keys/delete", {
      target: SCHOOL,
      keys: [CANCEL],
      scope: "language",
      language: "vi",
    })
    expect(deleted.body.deleted).toBe(1)
    expect((await rowOf(SCHOOL, "vi", CANCEL))?.status).toBe("missing")
    expect((await rowOf(SCHOOL, "en", CANCEL))?.target).toBe("Cancel")
  })

  it("removes the key everywhere with scope all", async () => {
    await call(store, "POST", "/keys/delete", { target: SCHOOL, keys: [CANCEL], scope: "all" })
    expect(await rowOf(SCHOOL, "en", CANCEL)).toBeUndefined()
    expect(await rowOf(SCHOOL, "vi", CANCEL)).toBeUndefined()
  })
})

describe("saving", () => {
  it("makes a translation outdated when its English changes, and confirming clears it", async () => {
    await call(store, "PUT", `/translations/en?target=${SCHOOL}`, { values: { [CANCEL]: "Cancel now" }, by: "T" })
    expect((await rowOf(SCHOOL, "vi", CANCEL))?.status).toBe("outdated")
    await call(store, "PUT", `/translations/vi?target=${SCHOOL}`, { values: { [CANCEL]: "Hủy" }, by: "T" })
    expect((await rowOf(SCHOOL, "vi", CANCEL))?.status).toBe("translated")
  })

  it("refuses keep for English and for a key that is also edited", async () => {
    const english = await callJson<ApiErrorBody>(store, "PUT", `/translations/en?target=${SCHOOL}`, {
      values: {},
      keep: [CANCEL],
    })
    expect(english.status).toBe(400)
    expect(english.body.error).toBe("English cannot be kept as English.")

    const both = await call(store, "PUT", `/translations/vi?target=${SCHOOL}`, {
      values: { [COPY]: "GrapeSEED" },
      keep: [COPY],
    })
    expect(both.status).toBe(400)
  })

  it("keeps a copy on purpose, and a later ordinary write takes the keep back", async () => {
    expect((await call(store, "PUT", `/translations/vi?target=${SCHOOL}`, { values: {}, keep: [COPY] })).status).toBe(200)
    let row = await rowOf(SCHOOL, "vi", COPY)
    expect(row).toMatchObject({ status: "translated", keptSource: true })

    await call(store, "PUT", `/translations/vi?target=${SCHOOL}`, { values: { [COPY]: "GrapeSEED" } })
    row = await rowOf(SCHOOL, "vi", COPY)
    expect(row).toMatchObject({ status: "missing", keptSource: false })
  })
})

describe("export", () => {
  it("builds a readable zip and drops missing keys when asked", async () => {
    const response = await call(store, "POST", "/export", {
      target: SCHOOL,
      files: [
        { language: "vi", name: "vi.json" },
        { language: "en", name: "en-US.json" },
      ],
      name: "school",
      includeUntranslated: false,
    })
    expect(response.status).toBe(200)
    expect(response.headers.get("content-disposition")).toContain('filename="school.zip"')

    const files = await readZip(new Uint8Array(await response.arrayBuffer()))
    expect(Object.keys(files).sort()).toEqual(["en-US.json", "vi.json"])
    const vi = JSON.parse(files["vi.json"]) as Record<string, string>
    expect(Object.keys(vi)).toHaveLength(494)
    expect(vi).not.toHaveProperty(COPY)
    expect(Object.keys(JSON.parse(files["en-US.json"]))).toHaveLength(500)
  })

  it("refuses two files with the same name and a project with no keys", async () => {
    const same = await call(store, "POST", "/export", {
      target: SCHOOL,
      files: [
        { language: "vi", name: "a.json" },
        { language: "ja", name: "A.json" },
      ],
      name: "x",
      includeUntranslated: true,
    })
    expect(same.status).toBe(400)

    const empty = await call(store, "POST", "/export", {
      target: "mobile/student-app",
      files: [{ language: "vi", name: "vi.json" }],
      name: "x",
      includeUntranslated: true,
    })
    expect(empty.status).toBe(404)
  })
})

describe("coverage and reset", () => {
  it("reports counts per project and language", async () => {
    const { body } = await callJson<CoverageResponse>(store, "GET", "/coverage")
    const school = body.targets.find((entry) => entry.target === SCHOOL)
    expect(school?.languages.find((entry) => entry.code === "vi")).toEqual({
      code: "vi",
      total: 500,
      translated: 493,
      missing: 6,
      outdated: 0,
      needsFix: 1,
    })
    expect(school?.languages.find((entry) => entry.code === "en")).toMatchObject({ total: 500, translated: 500 })
    expect(body.targets.map((entry) => entry.target)).toContain("messages/email")
  })

  it("returns to the seed on reset", async () => {
    await call(store, "POST", "/keys", { key: "home.greeting.title", source: "Hello", target: SCHOOL })
    expect((await call(store, "POST", "/reset")).status).toBe(204)
    expect(await entries(SCHOOL, "en")).toHaveLength(500)
  })
})

describe("import", () => {
  const fixture = parseBundleFile(readFileSync(new URL("./fixtures/import.vi.json", import.meta.url), "utf8"))

  it("merges a file, registers a new key and skips an invalid name", async () => {
    const { status, body } = await callJson<ImportResponse>(store, "PUT", `/import/vi?target=${SCHOOL}`, {
      values: fixture,
      mode: "merge",
      by: "T",
    })
    expect(status).toBe(200)
    expect(body).toMatchObject({ created: 1, added: 0, changed: 1, removed: 0, unchanged: 499, invalid: ["bad key.x"] })
    expect((await rowOf(SCHOOL, "vi", "home.brand.fresh"))?.target).toBe("Mới")
    expect((await rowOf(SCHOOL, "en", "home.brand.fresh"))?.status).toBe("missing")
  })

  it("replace clears every key the file leaves out", async () => {
    const { body } = await callJson<ImportResponse>(store, "PUT", `/import/vi?target=${SCHOOL}`, {
      values: { [CANCEL]: "Hủy bỏ" },
      mode: "replace",
    })
    expect(body).toMatchObject({ created: 0, changed: 1, removed: 499, unchanged: 0 })
  })

  it("fills a project that had no keys", async () => {
    const { status, body } = await callJson<ImportResponse>(store, "PUT", "/import/vi?target=mobile/student-app", {
      values: fixture,
      mode: "merge",
    })
    expect(status).toBe(200)
    expect(body).toMatchObject({ created: 2, invalid: ["bad key.x"] })
    expect((await entries("mobile/student-app", "vi")).map((r) => r.key).sort()).toEqual([
      "home.brand.fresh",
      "user.form.actions.cancel",
    ])
  })

  it("answers 404 when neither the project nor the file has a usable key", async () => {
    const response = await call(store, "PUT", "/import/vi?target=mobile/student-app", {
      values: { "bad key.x": "x" },
      mode: "merge",
    })
    expect(response.status).toBe(404)
  })
})
