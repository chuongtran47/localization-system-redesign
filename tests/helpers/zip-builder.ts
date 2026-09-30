import { crc32, type Bytes } from "@/lib/zip"

/**
 * Stored (uncompressed) entries, optionally with their sizes in a data
 * descriptor instead of the local header - the way streaming writers, Excel
 * among them, lay a file out. `createZip` only writes deflated entries with
 * the sizes up front, so this is how the reader's other paths are exercised.
 */
export function storedZip(entries: { name: string; data: string; dataDescriptor?: boolean }[]): Bytes {
  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    const data = encoder.encode(entry.data) as Bytes
    const crc = crc32(data)
    const deferred = entry.dataDescriptor === true
    const flags = 0x0800 | (deferred ? 0x0008 : 0)

    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)
    local.setUint16(6, flags, true)
    local.setUint32(14, deferred ? 0 : crc, true)
    local.setUint32(18, deferred ? 0 : data.length, true)
    local.setUint32(22, deferred ? 0 : data.length, true)
    local.setUint16(26, name.length, true)
    parts.push(new Uint8Array(local.buffer), name, data)
    let size = 30 + name.length + data.length

    if (deferred) {
      const descriptor = new DataView(new ArrayBuffer(16))
      descriptor.setUint32(0, 0x08074b50, true)
      descriptor.setUint32(4, crc, true)
      descriptor.setUint32(8, data.length, true)
      descriptor.setUint32(12, data.length, true)
      parts.push(new Uint8Array(descriptor.buffer))
      size += 16
    }

    const record = new DataView(new ArrayBuffer(46))
    record.setUint32(0, 0x02014b50, true)
    record.setUint16(4, 20, true)
    record.setUint16(6, 20, true)
    record.setUint16(8, flags, true)
    record.setUint32(16, crc, true)
    record.setUint32(20, data.length, true)
    record.setUint32(24, data.length, true)
    record.setUint16(28, name.length, true)
    record.setUint32(42, offset, true)
    central.push(new Uint8Array(record.buffer), name)
    offset += size
  }

  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, entries.length, true)
  end.setUint16(10, entries.length, true)
  end.setUint32(12, central.reduce((sum, part) => sum + part.length, 0), true)
  end.setUint32(16, offset, true)

  const all = [...parts, ...central, new Uint8Array(end.buffer)]
  const out = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0))
  let at = 0
  for (const part of all) {
    out.set(part, at)
    at += part.length
  }
  return out
}
