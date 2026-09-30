import { describe, expect, it } from "vitest"

import { CsvError, readCsv, writeCsv } from "@/lib/csv"

const values = [
  "Xin chào",
  "مرحبا",
  'say "hi"',
  "a,b",
  "line one\nline two",
  "  spaced  ",
  "=SUM(A1)",
  "-5",
  "+1",
  "@x",
  "\t=x",
  "'=SUM(A1)",
  "'Tis",
  "''",
  "plain",
  "",
]

describe("csv", () => {
  it("reads back every value it wrote", () => {
    const rows = [["Key", "Value"], ...values.map((value, index) => [`k.${index}`, value])]
    expect(readCsv(writeCsv(rows))).toEqual(rows)
  })

  it("writes a BOM, CRLF line ends, and keeps a formula from running in Excel", () => {
    expect(writeCsv([["=SUM(A1)", "ok"]])).toBe("\uFEFF'=SUM(A1),ok\r\n")
  })

  it("reads the semicolon and tab files Excel writes in other locales", () => {
    expect(readCsv("Key;English\r\nnav.home;Home")).toEqual([
      ["Key", "English"],
      ["nav.home", "Home"],
    ])
    expect(readCsv("Key\tEnglish\nnav.home\tHome\n")).toEqual([
      ["Key", "English"],
      ["nav.home", "Home"],
    ])
  })

  it("reports a quote that is never closed", () => {
    expect(() => readCsv('Key,English\n"open,x')).toThrow(CsvError)
  })
})
