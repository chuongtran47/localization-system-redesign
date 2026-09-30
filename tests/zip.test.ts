import { describe, expect, it } from "vitest"

import { createZip, DEFAULT_ZIP_LIMITS, readZip, ZipError, type Bytes } from "@/lib/zip"
import { storedZip } from "./helpers/zip-builder"

const text = (bytes: Bytes | undefined) => new TextDecoder().decode(bytes)

/** The central directory claims `size` bytes for the first entry - a lying header. */
function lieAboutSize(zip: Bytes, size: number): Bytes {
  const copy = new Uint8Array(zip) as Bytes
  const view = new DataView(copy.buffer)
  for (let at = copy.length - 4; at >= 0; at -= 1) {
    if (view.getUint32(at, true) === 0x02014b50) {
      view.setUint32(at + 24, size, true)
      break
    }
  }
  return copy
}

describe("readZip", () => {
  it("reads back what createZip wrote", async () => {
    const zip = await createZip([
      { name: "a.txt", data: "Xin chào" },
      { name: "dir/b.xml", data: "<x/>" },
    ])
    const entries = await readZip(zip)
    expect([...entries.keys()]).toEqual(["a.txt", "dir/b.xml"])
    expect(text(entries.get("a.txt"))).toBe("Xin chào")
  })

  it("reads stored entries and entries whose sizes live in a data descriptor", async () => {
    const entries = await readZip(
      storedZip([
        { name: "plain.txt", data: "plain" },
        { name: "streamed.txt", data: "streamed", dataDescriptor: true },
      ])
    )
    expect(text(entries.get("plain.txt"))).toBe("plain")
    expect(text(entries.get("streamed.txt"))).toBe("streamed")
  })

  it("inflates only the entries asked for", async () => {
    const zip = await createZip([
      { name: "small.xml", data: "<a/>" },
      { name: "huge.xml", data: "x".repeat(200_000) },
    ])
    const entries = await readZip(zip, {
      only: (name) => name === "small.xml",
      limits: { ...DEFAULT_ZIP_LIMITS, maxTotalBytes: 1000 },
    })
    expect([...entries.keys()]).toEqual(["small.xml"])
  })

  it("stops an archive that expands past the limit, whatever its headers claim", async () => {
    const zip = await createZip([{ name: "bomb.txt", data: "0".repeat(1_000_000) }])
    const limits = { ...DEFAULT_ZIP_LIMITS, maxTotalBytes: 100_000 }
    await expect(readZip(zip, { limits })).rejects.toThrow(ZipError)
    await expect(readZip(lieAboutSize(zip, 10), { limits })).rejects.toThrow(/expands/)
  })

  it("refuses too many entries and too large an archive", async () => {
    const zip = await createZip(Array.from({ length: 5 }, (_, index) => ({ name: `${index}.txt`, data: "x" })))
    await expect(readZip(zip, { limits: { ...DEFAULT_ZIP_LIMITS, maxEntries: 3 } })).rejects.toThrow(/entries/)
    await expect(readZip(zip, { limits: { ...DEFAULT_ZIP_LIMITS, maxArchiveBytes: 100 } })).rejects.toThrow(/larger/)
  })

  it("refuses bytes that are not a zip, and a damaged entry", async () => {
    await expect(readZip(new TextEncoder().encode("not a zip at all") as Bytes)).rejects.toThrow(/Not a zip/)
    const zip = await createZip([{ name: "a.txt", data: "hello hello hello hello" }])
    const damaged = new Uint8Array(zip) as Bytes
    damaged[40] ^= 0xff
    await expect(readZip(damaged)).rejects.toThrow(ZipError)
  })
})
