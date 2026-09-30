import { describe, expect, it } from "vitest"

import { columnName, readXlsx, writeXlsx, XlsxError } from "@/lib/xlsx"
import { createZip, readZip, ZipError, type Bytes } from "@/lib/zip"

const MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const decode = (bytes: Bytes | undefined) => new TextDecoder().decode(bytes)

const tricky = [
  "Xin chào",
  "مرحبا",
  "a & b < c > d",
  '"quoted"',
  "it's",
  "line one\nline two",
  "cr\r\nlf",
  "_x000D_ literal",
  "=SUM(A1)",
  "007",
  "<p>Hi <strong>{name}</strong></p>",
  "😀",
  "  spaced  ",
]

describe("writeXlsx and readXlsx", () => {
  it("names columns past Z", () => {
    expect([0, 25, 26, 27, 701, 702].map(columnName)).toEqual(["A", "Z", "AA", "AB", "ZZ", "AAA"])
  })

  it("reads back what it wrote, empty cells included", async () => {
    const rows = [
      ["Key", "English", "Vietnamese (vi)", "Status"],
      ...tricky.map((value, index) => [`k.${index}`, value, index % 2 ? "" : value, "Missing"]),
    ]
    const bytes = await writeXlsx(rows, { sheetName: "School Portal · vi", widths: [40, 60, 60, 14] })
    expect(await readXlsx(bytes)).toEqual(rows)
  })

  it("stores body cells as text, so Excel keeps what a translator types", async () => {
    const parts = await readZip(await writeXlsx([["Key"], ["007"]], { sheetName: "S", widths: [10] }))
    expect(decode(parts.get("xl/styles.xml"))).toContain('numFmtId="49"')
    expect(decode(parts.get("xl/worksheets/sheet1.xml"))).toContain('<c r="A2" s="2" t="inlineStr">')
  })

  it("writes and reads a sheet of 5,000 rows within the default limits", async () => {
    const rows = [["Key", "English"], ...Array.from({ length: 5000 }, (_, index) => [`key.${index}`, `English ${index}`])]
    const grid = await readXlsx(await writeXlsx(rows, { sheetName: "Big", widths: [40, 60] }))
    expect(grid).toHaveLength(5001)
    expect(grid[5000]).toEqual(["key.4999", "English 4999"])
  })

  it("reads a workbook laid out the way Excel saves one", async () => {
    const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${MAIN}" xmlns:r="${REL}"><bookViews><workbookView/></bookViews><sheets><sheet name="Strings" sheetId="3" r:id="rId7"/><sheet name="Other" sheetId="1" r:id="rId1"/></sheets></workbook>`
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId7" Type="${REL}/worksheet" Target="/xl/worksheets/sheet2.xml"/><Relationship Id="rId9" Type="${REL}/sharedStrings" Target="sharedStrings.xml"/></Relationships>`
    const shared = `<sst xmlns="${MAIN}" count="6" uniqueCount="6"><si><t>Key</t></si><si><t>English</t></si><si><t>Vietnamese (vi)</t></si><si><r><rPr><b/></rPr><t>Trang</t></r><r><t xml:space="preserve"> chủ</t></r><rPh sb="0" eb="1"><t>ト</t></rPh></si><si><t>line_x000D_
break &amp; more</t></si><si><t/></si></sst>`
    const sheet2 = `<worksheet xmlns="${MAIN}"><sheetData><row r="1" spans="1:3"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>nav.home</t></is></c><c r="B2" t="str"><f>"Ho"&amp;"me"</f><v>Home</v></c><c r="C2" t="s"><v>3</v></c></row><row r="4"><c r="A4" t="inlineStr"><is><t>nav.count</t></is></c><c r="C4"><v>42</v></c></row><row><c t="inlineStr"><is><t>nav.flag</t></is></c><c t="b"><v>1</v></c><c t="e"><v>#N/A</v></c></row><row r="6"><c r="A6" t="inlineStr"><is><t>nav.break</t></is></c><c r="B6" s="3"/><c r="C6" t="s"><v>4</v></c></row></sheetData></worksheet>`
    const sheet1 = `<worksheet xmlns="${MAIN}"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>wrong sheet</t></is></c></row></sheetData></worksheet>`

    const zip = await createZip([
      { name: "[Content_Types].xml", data: "<Types/>" },
      { name: "xl/workbook.xml", data: workbook },
      { name: "xl/_rels/workbook.xml.rels", data: rels },
      { name: "xl/sharedStrings.xml", data: shared },
      { name: "xl/worksheets/sheet1.xml", data: sheet1 },
      { name: "xl/worksheets/sheet2.xml", data: sheet2 },
      { name: "xl/media/image1.png", data: "not read" },
    ])

    expect(await readXlsx(zip)).toEqual([
      ["Key", "English", "Vietnamese (vi)"],
      ["nav.home", "Home", "Trang chủ"],
      [],
      ["nav.count", "", "42"],
      ["nav.flag", "TRUE", ""],
      ["nav.break", "", "line\r\nbreak & more"],
    ])
  })

  it("says what is wrong with a file that is not a workbook", async () => {
    await expect(readXlsx(new TextEncoder().encode("plain text") as Bytes)).rejects.toThrow(ZipError)
    await expect(readXlsx(await createZip([{ name: "readme.txt", data: "hi" }]))).rejects.toThrow(XlsxError)
    const noSheets = await createZip([
      { name: "xl/workbook.xml", data: `<workbook xmlns="${MAIN}"><sheets/></workbook>` },
      { name: "xl/_rels/workbook.xml.rels", data: "<Relationships/>" },
    ])
    await expect(readXlsx(noSheets)).rejects.toThrow(/no sheets/)
  })
})

describe("readXlsx on hostile input", () => {
  const sheetZip = (sheet: string) =>
    createZip([
      {
        name: "xl/workbook.xml",
        data: `<workbook xmlns="${MAIN}" xmlns:r="${REL}"><sheets><sheet name="S" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      },
      {
        name: "xl/_rels/workbook.xml.rels",
        data: `<Relationships><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
      },
      { name: "xl/worksheets/sheet1.xml", data: sheet },
    ])

  it("stops at once on tags that never close, instead of rescanning the rest of the file for each", async () => {
    const bomb = await sheetZip(`<worksheet><sheetData>${"<row>".repeat(100_000)}</sheetData></worksheet>`)
    const started = Date.now()
    await expect(readXlsx(bomb)).rejects.toThrow(XlsxError)
    expect(Date.now() - started).toBeLessThan(2000)
  })

  it("reads a character reference outside Unicode as nothing, rather than failing", async () => {
    const grid = await readXlsx(
      await sheetZip(`<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>a&#99999999;b</t></is></c></row></sheetData></worksheet>`)
    )
    expect(grid).toEqual([["ab"]])
  })

  it("refuses rows and columns past Excel's own limits", async () => {
    await expect(
      readXlsx(await sheetZip(`<worksheet><sheetData><row r="1048577"><c r="A1048577"><v>1</v></c></row></sheetData></worksheet>`))
    ).rejects.toThrow(XlsxError)
    await expect(
      readXlsx(await sheetZip(`<worksheet><sheetData><row r="1"><c r="XFE1"><v>1</v></c></row></sheetData></worksheet>`))
    ).rejects.toThrow(XlsxError)
  })
})
