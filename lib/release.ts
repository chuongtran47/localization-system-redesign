export const ALL_VERSIONS = "All"

export const versions = [
  ALL_VERSIONS,
  "v7.1",
  "v7.2",
  "v8",
  "v9",
  "v8.5",
  "v9.1",
  "v10",
  "v11",
  "v11.1",
  "v12",
  "v12.1",
  "v12.2",
  "v12.3",
]

const releases = versions.slice(1)

/**
 * Release assignment is not in the sample bundles, so each key gets one by a
 * stable hash of its name: about 30% unassigned, the rest spread over the
 * releases. Replace with the backend's field once it exists.
 */
export function releaseOf(key: string): string | null {
  let hash = 0x811c9dc5
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  hash >>>= 0
  if (hash % 10 < 3) {
    return null
  }
  return releases[Math.floor(hash / 10) % releases.length]
}
