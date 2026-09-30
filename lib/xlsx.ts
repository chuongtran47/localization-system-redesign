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

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }

/** XML text to characters: line ends, entities, then OOXML's `_xHHHH_` escapes. */
function decodeXml(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/&(?:#(\d+)|#x([0-9a-fA-F]+)|(amp|lt|gt|quot|apos));/g, (_, dec, hex, name) =>
      dec ? String.fromCodePoint(Number(dec)) : hex ? String.fromCodePoint(parseInt(hex, 16)) : NAMED[name]
    )
    .replace(/_x([0-9A-Fa-f]{4})_/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

function attr(attrs: string, name: string): string | undefined {
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(attrs)
  return match ? decodeXml(match[1] ?? match[2]) : undefined
}

/** Every `<t>` of a string item or inline string, without the phonetic guides of `<rPh>`. */
function textOf(xml: string): string {
  return [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<t\b[^>]*?(?:\/>|>([\s\S]*?)<\/t>)/g)]
    .map((match) => decodeXml(match[1] ?? ""))
    .join("")
}

function sharedStringsOf(xml: string): string[] {
  return [...xml.matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g)].map((match) => textOf(match[1] ?? ""))
}

function columnIndex(ref: string): number {
  const letters = /^[A-Za-z]+/.exec(ref)?.[0].toUpperCase() ?? "A"
  return [...letters].reduce((sum, char) => sum * 26 + (char.charCodeAt(0) - 64), 0) - 1
}

function cellValue(type: string | undefined, inner: string, shared: string[]): string {
  const raw = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(inner)?.[1]
  const value = raw === undefined ? "" : decodeXml(raw)
  switch (type) {
    case "s":
      return shared[Number(value)] ?? ""
    case "inlineStr":
      return textOf(/<is\b[^>]*>([\s\S]*?)<\/is>/.exec(inner)?.[1] ?? "")
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
  for (const row of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const r = attr(row[1], "r")
    const rowIndex = r ? Number(r) - 1 : nextRow
    nextRow = rowIndex + 1
    const cells: string[] = []
    let nextColumn = 0
    for (const cell of (row[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attr(cell[1], "r")
      const column = ref ? columnIndex(ref) : nextColumn
      nextColumn = column + 1
      cells[column] = cellValue(attr(cell[1], "t"), cell[2] ?? "", shared)
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

  const sheetTag = /<sheet\b([^>]*)\/?>/.exec(workbook)
  const id = sheetTag ? /(?:^|\s)[A-Za-z_][\w.-]*:id\s*=\s*"([^"]*)"/.exec(sheetTag[1])?.[1] : undefined
  if (!id) {
    throw new XlsxError("The workbook has no sheets")
  }

  const relations = [...rels.matchAll(/<Relationship\b([^>]*)\/?>/g)].map((match) => ({
    id: attr(match[1], "Id"),
    type: attr(match[1], "Type") ?? "",
    target: attr(match[1], "Target"),
  }))
  const sheetPath = partPath(relations.find((relation) => relation.id === id)?.target)
  const sharedPath = partPath(relations.find((relation) => relation.type.endsWith("/sharedStrings"))?.target)

  const parts = await read([sheetPath, sharedPath])
  const sheet = parts(sheetPath)
  if (!sheet) {
    throw new XlsxError("The workbook's first sheet is missing")
  }
  return gridOf(sheet, sharedStringsOf(parts(sharedPath) ?? ""))
}
