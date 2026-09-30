/**
 * CSV the way Excel reads and writes it: UTF-8 with a byte-order mark, comma
 * separated, CRLF line ends. Knows nothing about keys - see `sheet.ts`.
 */

export class CsvError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CsvError"
  }
}

/**
 * Excel runs a cell that starts like a formula. One leading `'` is added to
 * such a cell - and to a cell that already starts with `'`, so reading strips
 * exactly one `'` and every written value comes back as it was.
 */
const NEEDS_GUARD = /^[=+\-@\t\r']/

function writeCell(value: string): string {
  const text = NEEDS_GUARD.test(value) ? `'${value}` : value
  return /[",\r\n]|^\s|\s$/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function writeCsv(rows: string[][]): string {
  return `\uFEFF${rows.map((row) => row.map(writeCell).join(",")).join("\r\n")}\r\n`
}

/** The separator the header line uses most, outside quotes - Excel writes `;` in much of Europe. */
function delimiterOf(text: string): string {
  const counts = new Map([
    [",", 0],
    [";", 0],
    ["\t", 0],
  ])
  let quoted = false
  for (const char of text) {
    if (char === '"') {
      quoted = !quoted
    } else if (!quoted && (char === "\n" || char === "\r")) {
      break
    } else if (!quoted && counts.has(char)) {
      counts.set(char, (counts.get(char) ?? 0) + 1)
    }
  }
  let best = ","
  for (const [char, count] of counts) {
    if (count > (counts.get(best) ?? 0)) {
      best = char
    }
  }
  return best
}

const unguard = (cell: string) => (cell.startsWith("'") ? cell.slice(1) : cell)

/** RFC 4180, forgiving about a missing final line end. */
export function readCsv(text: string): string[][] {
  const body = text.startsWith("\uFEFF") ? text.slice(1) : text
  const delimiter = delimiterOf(body)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  let startedQuoted = false
  let line = 1
  let quoteLine = 0

  for (let index = 0; index < body.length; index += 1) {
    const char = body[index]
    if (quoted) {
      if (char === '"') {
        if (body[index + 1] === '"') {
          cell += '"'
          index += 1
        } else {
          quoted = false
        }
      } else {
        if (char === "\n") {
          line += 1
        }
        cell += char
      }
      continue
    }
    if (char === '"' && cell === "" && !startedQuoted) {
      quoted = true
      startedQuoted = true
      quoteLine = line
      continue
    }
    if (char === delimiter) {
      row.push(unguard(cell))
      cell = ""
      startedQuoted = false
      continue
    }
    if (char === "\r" || char === "\n") {
      if (char === "\r" && body[index + 1] === "\n") {
        index += 1
      }
      row.push(unguard(cell))
      rows.push(row)
      row = []
      cell = ""
      startedQuoted = false
      line += 1
      continue
    }
    cell += char
  }

  if (quoted) {
    throw new CsvError(`The quote opened on line ${quoteLine} is never closed`)
  }
  if (cell !== "" || row.length > 0 || startedQuoted) {
    row.push(unguard(cell))
    rows.push(row)
  }
  return rows
}
