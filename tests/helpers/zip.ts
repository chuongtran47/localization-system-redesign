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

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Every entry's name and text; throws if a CRC in a local header is wrong. */
export async function readZip(bytes: Uint8Array): Promise<Record<string, string>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const decoder = new TextDecoder()
  const out: Record<string, string> = {}
  let offset = 0

  while (view.getUint32(offset, true) === 0x04034b50) {
    const method = view.getUint16(offset + 8, true)
    const crc = view.getUint32(offset + 14, true)
    const compressedSize = view.getUint32(offset + 18, true)
    const nameLength = view.getUint16(offset + 26, true)
    const extraLength = view.getUint16(offset + 28, true)
    const name = decoder.decode(bytes.subarray(offset + 30, offset + 30 + nameLength))
    const start = offset + 30 + nameLength + extraLength
    const stored = bytes.subarray(start, start + compressedSize)
    const content = method === 8 ? await inflateRaw(stored) : stored
    if (crc32(content) !== crc) {
      throw new Error(`CRC mismatch in ${name}`)
    }
    out[name] = decoder.decode(content)
    offset = start + compressedSize
  }

  return out
}
