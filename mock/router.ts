/**
 * The mock localization backend's routes, written against `Request` and
 * `Response` rather than against any one server.
 *
 * It exists so the app can be built against HTTP rather than against a pile of
 * imported JSON: every screen fetches, every edit is a request, and the data
 * lives in documents a human can open (see `store.ts`). Every route is scoped
 * to one app, because every app is its own key namespace. When the real
 * service is ready, delete `src/mock/` and point `VITE_API_URL` at it -
 * `src/lib/api.ts` is the only other file that knows a server exists.
 *
 *   GET    /entries?target=&lang=    one app's keys, with status computed
 *   GET    /templates?target=&lang=  one channel's message templates, text included
 *   POST   /keys                     create a key in one app, in every language
 *   POST   /keys/delete              delete one app's keys, in one language or all
 *   PUT    /translations/:lang?target=
 *                                    save a batch of one app's translations
 *   PUT    /import/:lang?target=     replace one app's language file wholesale
 *   POST   /export                   a .zip, one named file per language
 *   POST   /sheet                    one app in one language as .xlsx or .csv
 *   GET    /coverage                 per-language totals, every app
 *   POST   /reset                    re-seed from sample-data
 *
 * Deleting is a POST with a body rather than a `DELETE /keys?key=`: real keys
 * contain slashes - `school_admin/campus_admin.inviteadmin.text` - and a bulk
 * selection is thousands of them, so they belong in a body either way.
 *
 * Two callers reach this: `server/mock_api.ts` mounts it on the Vite dev
 * server at `/api`, and `browser_backend.ts` calls it straight from the tab
 * when the built app is served with no backend behind it. Web `Request` and
 * `Response` are the only vocabulary both of them share.
 */

import type {
  CreateKeyRequest,
  DeleteKeysRequest,
  ExportRequest,
  ImportRequest,
  SaveTranslationsRequest,
  SheetExportRequest,
} from "../lib/api-types"
import { writeCsv } from "../lib/csv"
import { safeFileName } from "../lib/file-name"
import { languages, SOURCE_LANGUAGE } from "../lib/locale-data"
import { findProjectByTarget, targetOf } from "../lib/projects"
import { isTemplateProject, sheetGridOf, sheetWidthsOf } from "../lib/sheet"
import { writeXlsx } from "../lib/xlsx"
import { HttpError, type Store } from "./store"
import { createZip, type Bytes } from "../lib/zip"

/**
 * Answers one request, and turns any failure into the `{ error }` body that
 * `src/lib/api.ts` unwraps into an `ApiError`. The path is taken relative to
 * whatever prefix the caller mounted this under.
 */
export async function handleRequest(
  store: Store,
  request: Request,
  path: string
): Promise<Response> {
  try {
    await store.ready()
    return await route(store, request, path.replace(/\/+$/, ""))
  } catch (cause) {
    const status = cause instanceof HttpError ? cause.status : 500
    const message = cause instanceof Error ? cause.message : String(cause)
    return json(status, { error: message })
  }
}

async function route(
  store: Store,
  request: Request,
  path: string
): Promise<Response> {
  const query = new URL(request.url).searchParams
  const method = request.method.toUpperCase()

  if (method === "POST" && path === "/keys") {
    const input = await body<CreateKeyRequest>(request)
    return json(201, store.createKey({ ...input, createdBy: author(input.createdBy) }))
  }

  if (method === "POST" && path === "/keys/delete") {
    const input = await body<DeleteKeysRequest>(request)

    if (!input.target) {
      throw new HttpError(400, `Missing "target"`)
    }
    if (!Array.isArray(input.keys) || input.keys.length === 0) {
      throw new HttpError(400, "Pick at least one key to delete.")
    }
    if (input.scope !== "language" && input.scope !== "all") {
      throw new HttpError(400, `Expected "scope" to be "language" or "all"`)
    }
    if (input.scope === "language" && !input.language) {
      throw new HttpError(400, `Missing "language"`)
    }

    return json(
      200,
      store.deleteKeys({
        target: input.target,
        keys: input.keys,
        scope: input.scope,
        language: input.language,
      })
    )
  }

  if (method === "GET" && path === "/templates") {
    return json(
      200,
      store.templates(
        required(query.get("target"), "target"),
        required(query.get("lang"), "lang")
      )
    )
  }

  if (method === "GET" && path === "/entries") {
    return json(
      200,
      store.entries(
        required(query.get("target"), "target"),
        required(query.get("lang"), "lang")
      )
    )
  }

  const translations = /^\/translations\/([A-Za-z-]+)$/.exec(path)
  if (method === "PUT" && translations) {
    const input = await body<SaveTranslationsRequest>(request)
    if (!input.values || typeof input.values !== "object") {
      throw new HttpError(400, "Expected { values: { key: text } }")
    }
    if (
      input.keep !== undefined &&
      (!Array.isArray(input.keep) ||
        input.keep.some((key) => typeof key !== "string"))
    ) {
      throw new HttpError(400, `Expected "keep" to be a list of keys`)
    }
    if (
      input.sources !== undefined &&
      (typeof input.sources !== "object" ||
        input.sources === null ||
        Array.isArray(input.sources) ||
        Object.values(input.sources).some((value) => typeof value !== "string"))
    ) {
      throw new HttpError(400, `Expected "sources" to be an object of key: English text`)
    }
    return json(
      200,
      store.saveTranslations(
        required(query.get("target"), "target"),
        translations[1],
        input.values,
        input.keep ?? [],
        author(input.by),
        input.sources
      )
    )
  }

  const imported = /^\/import\/([A-Za-z-]+)$/.exec(path)
  if (method === "PUT" && imported) {
    const input = await body<ImportRequest>(request)

    if (!input.values || typeof input.values !== "object") {
      throw new HttpError(400, "Expected { values: { key: text } }")
    }
    // A file that reached here has been read and previewed in the browser, so
    // a value that is not text is a caller bug rather than a bad upload - but
    // the store writes straight to disk, so it is checked here all the same.
    for (const [key, value] of Object.entries(input.values)) {
      if (typeof value !== "string") {
        throw new HttpError(400, `"${key}" is not text.`)
      }
    }
    if (input.mode !== "replace" && input.mode !== "merge") {
      throw new HttpError(400, `Expected "mode" to be "replace" or "merge"`)
    }

    return json(
      200,
      store.importBundle(
        required(query.get("target"), "target"),
        imported[1],
        input.values,
        input.mode,
        author(input.by)
      )
    )
  }

  if (method === "POST" && path === "/export") {
    const input = await body<ExportRequest>(request)

    if (!input.target) {
      throw new HttpError(400, `Missing "target"`)
    }
    if (!Array.isArray(input.files) || input.files.length === 0) {
      throw new HttpError(400, "Pick at least one language to export.")
    }

    const files = store.exportFiles(
      input.target,
      input.files,
      input.includeUntranslated !== false
    )
    const name = safeFileName(
      input.name ?? "",
      `${input.target.replaceAll("/", "-")}-translations`
    )

    return zip(`${name}.zip`, await createZip(files))
  }

  if (method === "POST" && path === "/sheet") {
    const input = await body<SheetExportRequest>(request)
    const project = findProjectByTarget(input.target ?? "")
    if (!project) {
      throw new HttpError(404, `Unknown project "${input.target}"`)
    }
    if (!languages.some((item) => item.code === input.language)) {
      throw new HttpError(400, `Unknown language "${input.language}"`)
    }
    if (input.language === SOURCE_LANGUAGE) {
      throw new HttpError(400, "Sheets carry translations; pick a language other than English")
    }
    if (input.rows !== "todo" && input.rows !== "all") {
      throw new HttpError(400, `Expected "rows" to be "todo" or "all"`)
    }
    if (input.format !== "xlsx" && input.format !== "csv") {
      throw new HttpError(400, `Expected "format" to be "xlsx" or "csv"`)
    }

    const target = targetOf(project)
    const grid = sheetGridOf({
      project,
      language: input.language,
      rows: store.entries(target, input.language).entries,
      templates: isTemplateProject(project) ? store.templates(target, input.language).templates : undefined,
      scope: input.rows,
    })
    const name = safeFileName(input.name ?? "", `${project.id}.${input.language}`)

    if (input.format === "csv") {
      return attachment(`${name}.csv`, "text/csv; charset=utf-8", new TextEncoder().encode(writeCsv(grid)) as Bytes)
    }
    return attachment(
      `${name}.xlsx`,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      await writeXlsx(grid, { sheetName: `${project.name} · ${input.language}`, widths: sheetWidthsOf(project) })
    )
  }

  if (method === "GET" && path === "/coverage") {
    return json(200, store.coverage())
  }

  if (method === "POST" && path === "/reset") {
    await store.reset()
    return empty()
  }

  throw new HttpError(404, `No route for ${method} ${path}`)
}

/**
 * The name the audit trail records. The mock has no session, so it believes
 * what the browser sent and names the gap when nothing was sent - a real
 * service takes the author from the token instead and ignores this field.
 */
function author(value: string | undefined): string {
  return value?.trim() || "Unknown"
}

function required(value: string | null, name: string): string {
  if (!value) {
    throw new HttpError(400, `Missing "${name}" parameter`)
  }
  return value
}

async function body<T>(request: Request): Promise<T> {
  const raw = await request.text()
  if (!raw) {
    throw new HttpError(400, "Expected a JSON body")
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    throw new HttpError(400, "Body is not valid JSON")
  }
}

function json(status: number, value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  })
}

function empty(): Response {
  return new Response(null, { status: 204 })
}

function zip(filename: string, data: Bytes): Response {
  return attachment(filename, "application/zip", data)
}

function attachment(filename: string, contentType: string, data: Bytes): Response {
  return new Response(data, {
    status: 200,
    headers: {
      "content-type": contentType,
      // The browser reads the download name from here, so the name typed into
      // the export dialog survives the round trip.
      //
      // Two forms, per RFC 6266: header values are latin1, and Node throws on
      // anything outside it, so a Vietnamese name can only travel
      // percent-encoded in `filename*`. `filename` carries an ASCII fallback
      // for clients that do not read the starred form.
      "content-disposition": [
        "attachment",
        `filename="${filename.replaceAll(/[^ -~]/g, "_")}"`,
        `filename*=UTF-8''${encodeURIComponent(filename)}`,
      ].join("; "),
    },
  })
}
