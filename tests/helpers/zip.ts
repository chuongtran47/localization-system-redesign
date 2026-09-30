import { readZip as readEntries, type Bytes } from "@/lib/zip"

/** Every entry's name and text - how the router tests read an export back. */
export async function readZip(bytes: Uint8Array): Promise<Record<string, string>> {
  const decoder = new TextDecoder()
  const entries = await readEntries(new Uint8Array(bytes) as Bytes)
  return Object.fromEntries([...entries].map(([name, data]) => [name, decoder.decode(data)]))
}
