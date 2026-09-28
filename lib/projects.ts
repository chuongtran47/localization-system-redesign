export type ProjectGroup = "web" | "mobile" | "content" | "services" | "messages"

export type ContentKind = "ui" | "email" | "sms" | "notification"

export type ProjectProfile = {
  kind: ContentKind
  /** Who reads the strings in the shipped product. */
  audience: string
  /** Register the copy has to keep. */
  tone: string
  note: string
  /** Ratio over the English length past which a row warns. */
  lengthBudget: number
  /** Hard ceiling on a value, where one is known. */
  maxLength?: number
  /** False while the profile is inferred rather than measured. */
  measured: boolean
}

export type Project = {
  id: string
  name: string
  group: ProjectGroup
  profile: ProjectProfile
}

export const projectGroups: { id: ProjectGroup; label: string }[] = [
  { id: "web", label: "Web" },
  { id: "mobile", label: "Mobile" },
  { id: "content", label: "Content" },
  { id: "services", label: "Services" },
  { id: "messages", label: "Messages" },
]

export const groupLabel = Object.fromEntries(
  projectGroups.map((group) => [group.id, group.label])
) as Record<ProjectGroup, string>

export const kindLabel: Record<ContentKind, string> = {
  ui: "UI strings",
  email: "Email templates",
  sms: "SMS templates",
  notification: "Notification templates",
}

const NOT_IMPORTED = "No source bundle imported yet."

const inferred: Record<Exclude<ProjectGroup, "messages">, ProjectProfile> = {
  web: {
    kind: "ui",
    audience: "Teachers, school staff and administrators on the web portals",
    tone: "Administrative and clear. Keep product terms consistent with School Portal.",
    note: NOT_IMPORTED,
    lengthBudget: 1.5,
    measured: false,
  },
  mobile: {
    kind: "ui",
    audience: "Students, parents and teachers on a phone",
    tone: "Plain and short. A phone-width label has nowhere to overflow.",
    note: NOT_IMPORTED,
    lengthBudget: 1.3,
    measured: false,
  },
  content: {
    kind: "ui",
    audience: "Learners and teachers reading curriculum content",
    tone: "Instructional. Match the curriculum vocabulary.",
    note: NOT_IMPORTED,
    lengthBudget: 1.5,
    measured: false,
  },
  services: {
    kind: "ui",
    audience: "Staff and devices integrating with GrapeSEED services",
    tone: "Precise and technical. Error text is read under pressure.",
    note: NOT_IMPORTED,
    lengthBudget: 1.5,
    measured: false,
  },
}

const app = (id: string, name: string, group: Exclude<ProjectGroup, "messages">): Project => ({
  id,
  name,
  group,
  profile: inferred[group],
})

export const projects: Project[] = [
  app("content-portal", "Content Portal", "content"),
  app("common-ui", "Common UI", "web"),
  app("parent-portal", "Parent Portal", "web"),
  app("student-app", "Student App", "mobile"),
  app("account-portal", "Account Portal", "web"),
  app("leaf-assets", "GrapeLEAF Common Assets", "content"),
  app("gs-content", "GrapeSEED Content", "content"),
  app("admin-service", "Admin Service", "services"),
  {
    id: "school-portal",
    name: "School Portal",
    group: "web",
    profile: {
      kind: "ui",
      audience: "School and campus administrators, regional coaches, staff",
      tone: "Administrative. Domain terms stay consistent - unit plan, visitation, campus, license.",
      note: "500 keys across 46 groups, imported from the sample bundle.",
      lengthBudget: 1.5,
      measured: true,
    },
  },
  app("report-portal", "Report Portal", "web"),
  app("student-site", "Student Site", "web"),
  app("training-portal", "Training Portal", "web"),
  app("docs-mockup", "Documentation UI", "content"),
  app("virtual-tsi", "Virtual TSI", "services"),
  app("portal-site", "Portal Site", "web"),
  app("global-web", "Global Website 2.0", "web"),
  app("gs-connect", "GS Connect", "mobile"),
  app("gs-baby-app", "GS Baby App", "mobile"),
  app("nexus-mobile", "Nexus Mobile App", "mobile"),
  app("grapeseed-mobile", "GrapeSEED Mobile App", "mobile"),
  app("littleseed-mobile", "LittleSEED Mobile App", "mobile"),
  app("nexus-receiver", "Window Nexus Receiver", "services"),
  app("app-common-ui", "App Common UI", "mobile"),
  {
    id: "email",
    name: "Email",
    group: "messages",
    profile: {
      kind: "email",
      audience: "Coaches, teachers, parents, students and administrators - one template per audience",
      tone: "Set by the template's category. An invite to a coach and an invite to a parent are different copy.",
      note: "Ten templates, six fields each. Keep every tag, every link and every {placeholder} the English has.",
      lengthBudget: 2,
      maxLength: 4000,
      measured: false,
    },
  },
  {
    id: "sms",
    name: "SMS",
    group: "messages",
    profile: {
      kind: "sms",
      audience: "The same people, on a phone",
      tone: "Terse. Every character costs - say it in one segment if you can.",
      note: "Five templates of one field. Nine of the twelve languages bill at 70 characters, not 160.",
      lengthBudget: 1.1,
      measured: false,
    },
  },
  {
    id: "notification",
    name: "Notification",
    group: "messages",
    profile: {
      kind: "notification",
      audience: "Existing users, on a lock screen",
      tone: "Factual and short. The reader is scanning, not reading.",
      note: "Six templates of a title and a body. The OS truncates the title around 65 characters.",
      lengthBudget: 1.4,
      measured: false,
    },
  },
]

/** `web/school-portal` - the mock's key namespace, and the route without its slash. */
export const targetOf = (project: Project) => `${project.group}/${project.id}`

export const projectPath = (project: Project) => `/${targetOf(project)}`

export function findProject(group: string, id: string): Project | null {
  return projects.find((project) => project.group === group && project.id === id) ?? null
}

export function findProjectByPath(pathname: string): Project | null {
  const [, group, id] = pathname.split("/")
  return group && id ? findProject(group, id) : null
}

/** `web/school-portal` → School Portal. */
export function findProjectByTarget(target: string): Project | null {
  const [group, id] = target.split("/")
  return group && id ? findProject(group, id) : null
}

export const DEFAULT_PROJECT_PATH = "/web/school-portal"
