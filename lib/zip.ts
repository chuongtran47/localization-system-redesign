/**
 * A minimal ZIP reader and writer - enough for locale archives and Excel
 * workbooks.
 *
 * Neither Node nor the browser ships an archive format, and a dependency for
 * a few hundred lines of header layout is a poor trade. The writer emits
 * deflated entries, a central directory and an end-of-central-directory
 * record: the subset of PKZIP every unzip tool reads. The reader works from
 * the central directory - a streaming writer (Excel is one) may put 0 in every
 * local header's sizes - and stops at the limits below, so a small file that
 * inflates to gigabytes cannot hang the tab.
 *
 * Nothing here is Node-specific: `CompressionStream`, `DecompressionStream`
 * and `Uint8Array` are the same in both runtimes, which is what lets the mock
 * run on the dev server, in the tab and in vitest. No zip64, no encryption.
 */

/**
 * Bytes backed by a plain `ArrayBuffer`. A bare `Uint8Array` allows a
 * `SharedArrayBuffer` behind it, which neither `Blob` nor `Response` accepts -
 * saying so once here keeps the casts out of everything below.
 */
export type Bytes = Uint8Array<ArrayBuffer>

export type ZipEntry = {
  /** Path inside the archive, forward slashes. */
  name: string
  data: string
}

const LOCAL_HEADER = 0x04034b50
const CENTRAL_HEADER = 0x02014b50
const END_OF_CENTRAL = 0x06054b50
/** 2.0 - the version that introduced deflate. */
const VERSION = 20
/** Bit 11: names and comments are UTF-8. */
const UTF8_FLAG = 0x0800
const DEFLATE = 8

const utf8 = new TextEncoder()
/** TextEncoder always returns an ArrayBuffer-backed array; TS 5.7 types it wider. */
const encode = (text: string) => utf8.encode(text) as Bytes

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }
  return table
})()

export function crc32(bytes: Bytes): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** The raw deflate stream a ZIP entry stores, via the platform's own codec. */
async function deflateRaw(bytes: Bytes): Promise<Bytes> {
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** ZIP stores MS-DOS time: 2-second resolution, years from 1980. */
function dosDateTime(date: Date) {
  const time =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    (Math.floor(date.getSeconds() / 2) & 0x1f)
  const day =
    ((Math.max(date.getFullYear() - 1980, 0) & 0x7f) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate()
  return { time, day }
}

function concat(parts: Bytes[]): Bytes {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}

/** A fixed-size record plus the little-endian writers its fields need. */
function record(size: number) {
  const bytes = new Uint8Array(size)
  const view = new DataView(bytes.buffer)
  return {
    bytes,
    u16: (offset: number, value: number) => view.setUint16(offset, value, true),
    u32: (offset: number, value: number) => view.setUint32(offset, value, true),
  }
}

export async function createZip(
  entries: ZipEntry[],
  now = new Date()
): Promise<Bytes> {
  const { time, day } = dosDateTime(now)
  const locals: Bytes[] = []
  const centrals: Bytes[] = []
  let offset = 0

  for (const entry of entries) {
    const name = encode(entry.name)
    const content = encode(entry.data)
    const deflated = await deflateRaw(content)
    const crc = crc32(content)

    const local = record(30)
    local.u32(0, LOCAL_HEADER)
    local.u16(4, VERSION)
    local.u16(6, UTF8_FLAG)
    local.u16(8, DEFLATE)
    local.u16(10, time)
    local.u16(12, day)
    local.u32(14, crc)
    local.u32(18, deflated.length)
    local.u32(22, content.length)
    local.u16(26, name.length)
    local.u16(28, 0)
    locals.push(local.bytes, name, deflated)

    const central = record(46)
    central.u32(0, CENTRAL_HEADER)
    central.u16(4, VERSION)
    central.u16(6, VERSION)
    central.u16(8, UTF8_FLAG)
    central.u16(10, DEFLATE)
    central.u16(12, time)
    central.u16(14, day)
    central.u32(16, crc)
    central.u32(20, deflated.length)
    central.u32(24, content.length)
    central.u16(28, name.length)
    central.u16(30, 0)
    central.u16(32, 0)
    central.u16(34, 0)
    central.u16(36, 0)
    central.u32(38, 0)
    central.u32(42, offset)
    centrals.push(central.bytes, name)

    offset += local.bytes.length + name.length + deflated.length
  }

  const directory = concat(centrals)

  const end = record(22)
  end.u32(0, END_OF_CENTRAL)
  end.u16(4, 0)
  end.u16(6, 0)
  end.u16(8, entries.length)
  end.u16(10, entries.length)
  end.u32(12, directory.length)
  end.u32(16, offset)
  end.u16(20, 0)

  return concat([...locals, directory, end.bytes])
}

/* ------------------------------------------------------------------ reading */

export class ZipError extends Error {
  /** `limit`: a well-formed archive, but past what an import reads. */
  reason: "format" | "limit"

  constructor(message: string, reason: "format" | "limit" = "format") {
    super(message)
    this.name = "ZipError"
    this.reason = reason
  }
}

export type ZipLimits = {
  /** The archive itself, in bytes. */
  maxArchiveBytes: number
  /** Entries in the central directory. */
  maxEntries: number
  /** Bytes inflated by one read, every entry together. */
  maxTotalBytes: number
}

/**
 * A sheet of a few thousand rows is a few hundred KB zipped and a few MB
 * unzipped. These leave room for ten times that and stop far short of what
 * would hang a tab.
 */
export const DEFAULT_ZIP_LIMITS: ZipLimits = {
  maxArchiveBytes: 10 * 1024 * 1024,
  maxEntries: 1000,
  maxTotalBytes: 50 * 1024 * 1024,
}

type DirectoryEntry = {
  name: string
  flags: number
  method: number
  crc: number
  compressedSize: number
  size: number
  localOffset: number
}

const STORED = 0
const ENCRYPTED = 0x0001
/** A 32-bit field at its maximum means the real value is in a zip64 record. */
const ZIP64 = 0xffffffff

const damaged = (name: string) => new ZipError(`The archive is damaged near ${name}`)
const expands = () => new ZipError("The archive expands to more than an import reads", "limit")

function directoryOf(bytes: Bytes, limits: ZipLimits): DirectoryEntry[] {
  if (bytes.length > limits.maxArchiveBytes) {
    throw new ZipError(`The archive is larger than ${limits.maxArchiveBytes} bytes`, "limit")
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  // The end record is the last 22 bytes, unless a comment of up to 64 KB follows it.
  let end = -1
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 22 - 0xffff); at -= 1) {
    if (view.getUint32(at, true) === END_OF_CENTRAL) {
      end = at
      break
    }
  }
  if (end < 0) {
    throw new ZipError("Not a zip archive")
  }

  const count = view.getUint16(end + 10, true)
  const size = view.getUint32(end + 12, true)
  const start = view.getUint32(end + 16, true)
  if (count > limits.maxEntries) {
    throw new ZipError(`The archive holds more than ${limits.maxEntries} entries`, "limit")
  }
  if (start === ZIP64 || start + size > end) {
    throw new ZipError("The archive's directory is damaged")
  }

  const decoder = new TextDecoder()
  const entries: DirectoryEntry[] = []
  let at = start
  for (let index = 0; index < count; index += 1) {
    if (at + 46 > end || view.getUint32(at, true) !== CENTRAL_HEADER) {
      throw new ZipError("The archive's directory is damaged")
    }
    const nameLength = view.getUint16(at + 28, true)
    const entry: DirectoryEntry = {
      flags: view.getUint16(at + 8, true),
      method: view.getUint16(at + 10, true),
      crc: view.getUint32(at + 16, true),
      compressedSize: view.getUint32(at + 20, true),
      size: view.getUint32(at + 24, true),
      localOffset: view.getUint32(at + 42, true),
      name: decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength)),
    }
    if (entry.compressedSize === ZIP64 || entry.size === ZIP64 || entry.localOffset === ZIP64) {
      throw new ZipError("Zip64 archives are not supported")
    }
    entries.push(entry)
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true)
  }
  return entries
}

/** Counts what the stream yields - the sizes in the headers are only what the file claims. */
async function inflateRaw(bytes: Bytes, budget: { left: number }): Promise<Bytes> {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader()
  const chunks: Bytes[] = []
  let total = 0
  for (;;) {
    let chunk: ReadableStreamReadResult<Uint8Array>
    try {
      chunk = await reader.read()
    } catch {
      throw new ZipError("An entry in the archive cannot be inflated")
    }
    if (chunk.done) {
      break
    }
    total += chunk.value.length
    if (total > budget.left) {
      await reader.cancel().catch(() => undefined)
      throw expands()
    }
    chunks.push(chunk.value as Bytes)
  }
  budget.left -= total
  return concat(chunks)
}

async function contentOf(bytes: Bytes, entry: DirectoryEntry, budget: { left: number }): Promise<Bytes> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const at = entry.localOffset
  if (entry.flags & ENCRYPTED) {
    throw new ZipError("The archive is encrypted")
  }
  if (at + 30 > bytes.length || view.getUint32(at, true) !== LOCAL_HEADER) {
    throw damaged(entry.name)
  }
  if (entry.size > budget.left) {
    throw expands()
  }
  const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true)
  const stored = bytes.subarray(start, start + entry.compressedSize)
  if (stored.length !== entry.compressedSize) {
    throw damaged(entry.name)
  }

  let content: Bytes
  if (entry.method === STORED) {
    if (stored.length > budget.left) {
      throw expands()
    }
    budget.left -= stored.length
    content = stored
  } else if (entry.method === DEFLATE) {
    content = await inflateRaw(stored, budget)
  } else {
    throw new ZipError(`${entry.name} uses a compression this reader does not know`)
  }
  if (content.length !== entry.size || crc32(content) !== entry.crc) {
    throw damaged(entry.name)
  }
  return content
}

/**
 * The entries of an archive by name - every file, or those `only` accepts.
 * Entries it skips are never inflated, so a workbook's images and printer
 * settings cost nothing.
 */
export async function readZip(
  bytes: Bytes,
  { only, limits = DEFAULT_ZIP_LIMITS }: { only?: (name: string) => boolean; limits?: ZipLimits } = {}
): Promise<Map<string, Bytes>> {
  const budget = { left: limits.maxTotalBytes }
  const out = new Map<string, Bytes>()
  for (const entry of directoryOf(bytes, limits)) {
    if (entry.name.endsWith("/") || (only && !only(entry.name))) {
      continue
    }
    out.set(entry.name, await contentOf(bytes, entry, budget))
  }
  return out
}
