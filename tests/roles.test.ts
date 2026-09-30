import { describe, expect, it } from "vitest"

import { ALL_VERSIONS } from "@/lib/release"
import { DEFAULT_ROLE, capabilitiesOf, parseRole, roleCookie } from "@/lib/roles"
import { ALL_GROUPS, filtersFor, type WorkspaceFilters } from "@/lib/workspace-view"

describe("capabilitiesOf", () => {
  it("gives the developer every capability", () => {
    expect(capabilitiesOf("developer")).toEqual({
      manageKeys: true,
      editSource: true,
      exchangeBundles: true,
      release: true,
      manageApps: true,
      exchangeSheets: true,
    })
  })

  it("gives the translator sheets only - translating is not a capability", () => {
    expect(capabilitiesOf("translator")).toEqual({
      manageKeys: false,
      editSource: false,
      exchangeBundles: false,
      release: false,
      manageApps: false,
      exchangeSheets: true,
    })
  })
})

describe("parseRole", () => {
  it("reads a known role", () => {
    expect(parseRole("translator")).toBe("translator")
    expect(parseRole("developer")).toBe("developer")
  })

  it("falls back to the developer view for anything else", () => {
    for (const value of [undefined, null, "", "admin", "Translator", " translator"]) {
      expect(parseRole(value)).toBe(DEFAULT_ROLE)
    }
    expect(DEFAULT_ROLE).toBe("developer")
  })

  it("writes a site-wide cookie that lasts a year", () => {
    expect(roleCookie("translator")).toBe("lingua-role=translator; path=/; max-age=31536000; samesite=lax")
  })
})

describe("filtersFor", () => {
  const filters: WorkspaceFilters = { language: "vi", group: ALL_GROUPS, status: "new", version: "v7.1", q: "home" }

  it("drops the release filters without the release capability", () => {
    expect(filtersFor(filters, capabilitiesOf("translator"))).toEqual({ ...filters, status: "all", version: ALL_VERSIONS })
    expect(filtersFor({ ...filters, status: "missing" }, capabilitiesOf("translator"))).toEqual({
      ...filters,
      status: "missing",
      version: ALL_VERSIONS,
    })
  })

  it("keeps them with it", () => {
    expect(filtersFor(filters, capabilitiesOf("developer"))).toBe(filters)
  })
})
