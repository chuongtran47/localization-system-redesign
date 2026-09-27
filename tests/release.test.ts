import { describe, expect, it } from "vitest"

import { ALL_VERSIONS, releaseOf, versions } from "@/lib/release"

describe("releaseOf", () => {
  const keys = Array.from({ length: 2000 }, (_, index) => `group.key${index}`)

  it("is deterministic", () => {
    expect(keys.map(releaseOf)).toEqual(keys.map(releaseOf))
  })

  it("leaves roughly a third unassigned and uses every release", () => {
    const assigned = keys.map(releaseOf)
    const unassigned = assigned.filter((value) => value === null).length / keys.length
    expect(unassigned).toBeGreaterThan(0.2)
    expect(unassigned).toBeLessThan(0.4)
    expect(new Set(assigned.filter(Boolean))).toEqual(new Set(versions.filter((v) => v !== ALL_VERSIONS)))
  })
})
