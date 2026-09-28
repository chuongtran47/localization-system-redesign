import { describe, expect, it } from "vitest"

import { DEFAULT_PROJECT_PATH, findProjectByPath, findProjectByTarget, projectPath, projects } from "@/lib/projects"

describe("projects", () => {
  it("finds a project by its target", () => {
    expect(findProjectByTarget("web/school-portal")?.name).toBe("School Portal")
    expect(findProjectByTarget("web/nope")).toBeNull()
    expect(findProjectByTarget("")).toBeNull()
  })

  it("has 23 applications and 3 message channels with unique paths", () => {
    expect(projects.filter((p) => p.group !== "messages")).toHaveLength(23)
    expect(projects.filter((p) => p.group === "messages").map((p) => p.id)).toEqual(["email", "sms", "notification"])
    expect(new Set(projects.map(projectPath)).size).toBe(projects.length)
  })

  it("opens on School Portal, the project with measured data", () => {
    const project = findProjectByPath(DEFAULT_PROJECT_PATH)
    expect(project?.name).toBe("School Portal")
    expect(project?.profile.measured).toBe(true)
  })

  it("finds nothing for an unknown path", () => {
    expect(findProjectByPath("/web/nope")).toBeNull()
    expect(findProjectByPath("/")).toBeNull()
  })
})
