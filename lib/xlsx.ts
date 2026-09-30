/**
 * The smallest Excel workbook that Excel, LibreOffice and Google Sheets open,
 * and a reader for the ones they save. One sheet, text cells only.
 *
 * Reading goes through `readZip` with its limits, and inflates only the four
 * parts a grid needs. The XML is read with a small scanner for the handful of
 * elements involved rather than `DOMParser`, so the same code runs in vitest.
 */

import { createZip, DEFAULT_ZIP_LIMITS, readZip, type Bytes, type ZipLimits } from "@/lib/zip"

export class XlsxError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "XlsxError"
  }
}

export type XlsxLayout = {
  sheetName: string
  /** Per column, in Excel's character units. */
  widths: number[]
}

const MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const PACKAGE_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
const DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
const HEADER_STYLE = 1
const BODY_STYLE = 2

/* ------------------------------------------------------------------ writing */

/** Characters XML 1.0 cannot carry at all. */
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g

function escapeText(value: string): string {
  return (
    value
      .replace(INVALID_XML, "")
      // A literal `_x000D_` would read back as a carriage return, in Excel too.
      .replace(/_x([0-9A-Fa-f]{4})_/g, "_x005F_x$1_")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      // A parser turns a bare CR into LF; the character reference survives.
      .replaceAll("\r", "&#13;")
  )
}

const escapeAttr = (value: string) => escapeText(value).replaceAll('"', "&quot;")

export function columnName(index: number): string {
  let name = ""
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name
  }
  return name
}

/** Excel's sheet-name rules: at most 31 characters, none of `[]:*?/\`. */
const sheetNameOf = (name: string) => name.replace(/[[\]:*?/\\]/g, "").trim().slice(0, 31) || "Sheet1"

// Style 1 is the bold header; style 2 is every body cell - text format ("@",
// id 49) so a typed 007 stays 007, wrapped and top-aligned for long English.
const STYLES = `${DECLARATION}<styleSheet xmlns="${MAIN}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`

const CONTENT_TYPES = `${DECLARATION}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`

export async function writeXlsx(rows: string[][], layout: XlsxLayout): Promise<Bytes> {
  const cols = layout.widths
    .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join("")
  const sheetData = rows
    .map((row, r) => {
      const style = r === 0 ? HEADER_STYLE : BODY_STYLE
      const cells = row
        .map((value, c) => {
          const ref = `${columnName(c)}${r + 1}`
          return value === ""
            ? `<c r="${ref}" s="${style}"/>`
            : `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeText(value)}</t></is></c>`
        })
        .join("")
      return `<row r="${r + 1}">${cells}</row>`
    })
    .join("")

  const sheet = `${DECLARATION}<worksheet xmlns="${MAIN}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols ? `<cols>${cols}</cols>` : ""}<sheetData>${sheetData}</sheetData></worksheet>`

  return createZip([
    { name: "[Content_Types].xml", data: CONTENT_TYPES },
    {
      name: "_rels/.rels",
      data: `${DECLARATION}<Relationships xmlns="${PACKAGE_REL}"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      data: `${DECLARATION}<workbook xmlns="${MAIN}" xmlns:r="${REL}"><sheets><sheet name="${escapeAttr(sheetNameOf(layout.sheetName))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: `${DECLARATION}<Relationships xmlns="${PACKAGE_REL}"><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${REL}/styles" Target="styles.xml"/></Relationships>`,
    },
    { name: "xl/styles.xml", data: STYLES },
    { name: "xl/worksheets/sheet1.xml", data: sheet },
  ])
}

/* ------------------------------------------------------------------ reading */

/** Excel's own grid: 1,048,576 rows by 16,384 columns (XFD). */
const MAX_ROWS = 1_048_576
const MAX_COLUMNS = 16_384
/** Cells one grid may hold - thousands of rows of a few columns fit many times over. */
const MAX_CELLS = 5_000_000

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }

/** A character reference outside Unicode reads as nothing rather than throwing. */
function codePoint(value: number): string {
  return Number.isInteger(value) && value >= 0 && value <= 0x10ffff ? String.fromCodePoint(value) : ""
}

/** XML text to characters: line ends, entities, then OOXML's `_xHHHH_` escapes. */
function decodeXml(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/&(?:#(\d+)|#x([0-9a-fA-F]+)|(amp|lt|gt|quot|apos));/g, (_, dec, hex, name) =>
      dec ? codePoint(Number(dec)) : hex ? codePoint(parseInt(hex, 16)) : NAMED[name]
    )
    .replace(/_x([0-9A-Fa-f]{4})_/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

/**
 * A tag's attributes, read in one pass. A regex over a tag written to defeat
 * it - a long run with no `=` - backtracks for every starting position.
 */
function attributesOf(text: string): Map<string, string> {
  const out = new Map<string, string>()
  let at = 0
  while (at < text.length) {
    const equals = text.indexOf("=", at)
    if (equals < 0) {
      break
    }
    let valueStart = equals + 1
    while (valueStart < text.length && " \t\r\n".includes(text.charAt(valueStart))) {
      valueStart += 1
    }
    const quote = text.charAt(valueStart)
    if (quote !== '"' && quote !== "'") {
      break
    }
    const valueEnd = text.indexOf(quote, valueStart + 1)
    if (valueEnd < 0) {
      break
    }
    const name = text.slice(at, equals).trim().split(/\s+/).pop() ?? ""
    out.set(name, decodeXml(text.slice(valueStart + 1, valueEnd)))
    at = valueEnd + 1
  }
  return out
}

type Element = { attrs: Map<string, string>; inner: string; start: number; end: number }

/**
 * Each `<name …>…</name>` or `<name …/>` in document order, found with
 * `indexOf` from where the previous one ended - one pass over the text,
 * whatever it holds. A lazy regex rescans the rest of the file for every tag
 * that never closes, which a few kilobytes of hostile XML turn into minutes.
 */
function* elements(xml: string, name: string): Generator<Element> {
  const open = `<${name}`
  const close = `</${name}>`
  let at = 0
  for (;;) {
    const start = xml.indexOf(open, at)
    if (start < 0) {
      return
    }
    // `<row` is not `<rows`, and `<c` is not `<cols`.
    const next = xml.charAt(start + open.length)
    if (next !== ">" && next !== "/" && !" \t\r\n".includes(next)) {
      at = start + open.length
      continue
    }
    const tagEnd = xml.indexOf(">", start)
    if (tagEnd < 0) {
      throw new XlsxError(`A <${name}> tag is never closed`)
    }
    if (xml.charAt(tagEnd - 1) === "/") {
      yield { attrs: attributesOf(xml.slice(start + open.length, tagEnd - 1)), inner: "", start, end: tagEnd + 1 }
      at = tagEnd + 1
      continue
    }
    const closeAt = xml.indexOf(close, tagEnd + 1)
    if (closeAt < 0) {
      throw new XlsxError(`A <${name}> element is never closed`)
    }
    yield {
      attrs: attributesOf(xml.slice(start + open.length, tagEnd)),
      inner: xml.slice(tagEnd + 1, closeAt),
      start,
      end: closeAt + close.length,
    }
    at = closeAt + close.length
  }
}

const first = (xml: string, name: string): Element | undefined => elements(xml, name).next().value ?? undefined

/** Every `<t>` of a string item or inline string, without the phonetic guides inside `<rPh>`. */
function textOf(xml: string): string {
  const guides = [...elements(xml, "rPh")]
  let guide = 0
  let text = ""
  for (const t of elements(xml, "t")) {
    while (guide < guides.length && guides[guide].end <= t.start) {
      guide += 1
    }
    if (guide < guides.length && t.start > guides[guide].start) {
      continue
    }
    text += decodeXml(t.inner)
  }
  return text
}

function sharedStringsOf(xml: string): string[] {
  return Array.from(elements(xml, "si"), (item) => textOf(item.inner))
}

/** `AB12` → 27. Past three letters it is past column XFD, and says so. */
function columnIndex(ref: string): number {
  const letters = /^[A-Za-z]*/.exec(ref)?.[0].toUpperCase() ?? ""
  if (letters.length === 0 || letters.length > 3) {
    return Number.POSITIVE_INFINITY
  }
  return [...letters].reduce((sum, char) => sum * 26 + (char.charCodeAt(0) - 64), 0) - 1
}

function cellValue(type: string | undefined, inner: string, shared: string[]): string {
  const v = first(inner, "v")
  const value = v ? decodeXml(v.inner) : ""
  switch (type) {
    case "s":
      return shared[Number(value)] ?? ""
    case "inlineStr": {
      const inline = first(inner, "is")
      return inline ? textOf(inline.inner) : ""
    }
    case "b":
      return value === "1" ? "TRUE" : "FALSE"
    case "e":
      return ""
    default:
      return value
  }
}

function gridOf(xml: string, shared: string[]): string[][] {
  const rows: string[][] = []
  let nextRow = 0
  let held = 0
  for (const row of elements(xml, "row")) {
    const r = row.attrs.get("r")
    const rowIndex = r === undefined ? nextRow : Number(r) - 1
    if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= MAX_ROWS) {
      throw new XlsxError("A row lies outside the sheet")
    }
    nextRow = rowIndex + 1
    const cells: string[] = []
    let nextColumn = 0
    for (const cell of elements(row.inner, "c")) {
      const ref = cell.attrs.get("r")
      const column = ref === undefined ? nextColumn : columnIndex(ref)
      if (column < 0 || column >= MAX_COLUMNS) {
        throw new XlsxError("A cell lies outside the sheet")
      }
      nextColumn = column + 1
      cells[column] = cellValue(cell.attrs.get("t"), cell.inner, shared)
    }
    held += cells.length
    if (held > MAX_CELLS) {
      throw new XlsxError("The sheet holds more cells than an import reads")
    }
    rows[rowIndex] = Array.from(cells, (value) => value ?? "")
  }
  return Array.from(rows, (row) => row ?? [])
}

const partPath = (target: string | undefined) =>
  !target ? null : target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`

/** The first sheet as a grid of strings. Row 1 is `grid[0]`; a missing row is `[]`. */
export async function readXlsx(bytes: Bytes, limits: ZipLimits = DEFAULT_ZIP_LIMITS): Promise<string[][]> {
  const read = async (wanted: (string | null)[]) => {
    const entries = await readZip(bytes, { limits, only: (name) => wanted.includes(name) })
    return (name: string | null) => {
      const data = name ? entries.get(name) : undefined
      return data ? new TextDecoder().decode(data) : null
    }
  }

  const meta = await read(["xl/workbook.xml", "xl/_rels/workbook.xml.rels"])
  const workbook = meta("xl/workbook.xml")
  const rels = meta("xl/_rels/workbook.xml.rels")
  if (!workbook || !rels) {
    throw new XlsxError("This is not an Excel workbook")
  }

  const sheet = first(workbook, "sheet")
  const id = sheet ? [...sheet.attrs].find(([name]) => name.endsWith(":id"))?.[1] : undefined
  if (!id) {
    throw new XlsxError("The workbook has no sheets")
  }

  const relations = Array.from(elements(rels, "Relationship"), (relation) => ({
    id: relation.attrs.get("Id"),
    type: relation.attrs.get("Type") ?? "",
    target: relation.attrs.get("Target"),
  }))
  const sheetPath = partPath(relations.find((relation) => relation.id === id)?.target)
  const sharedPath = partPath(relations.find((relation) => relation.type.endsWith("/sharedStrings"))?.target)

  const parts = await read([sheetPath, sharedPath])
  const sheetXml = parts(sheetPath)
  if (!sheetXml) {
    throw new XlsxError("The workbook's first sheet is missing")
  }
  return gridOf(sheetXml, sharedStringsOf(parts(sharedPath) ?? ""))
}
