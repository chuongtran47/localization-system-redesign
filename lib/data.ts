export type TranslationStatus = "translated" | "pending" | "missing"

export interface TranslationString {
  id: string
  key: string
  source: string
  value: string
  status: TranslationStatus
  section: string
  updatedAt: string
  updatedBy: string
}

export interface AppProject {
  id: string
  name: string
  pending: number
  group: "Web" | "Mobile" | "Content" | "Services"
}

export interface Language {
  code: string
  name: string
  flag: string
  total: number
  translated: number
}

export const languages: Language[] = [
  { code: "en", name: "English", flag: "🇺🇸", total: 332, translated: 332 },
  { code: "es", name: "Spanish", flag: "🇪🇸", total: 332, translated: 318 },
  { code: "ja", name: "Japanese", flag: "🇯🇵", total: 332, translated: 290 },
  { code: "de", name: "German", flag: "🇩🇪", total: 332, translated: 276 },
  { code: "fr", name: "French", flag: "🇫🇷", total: 332, translated: 305 },
  { code: "zh", name: "Chinese", flag: "🇨🇳", total: 332, translated: 244 },
]

export const projectGroups: AppProject["group"][] = ["Web", "Mobile", "Content", "Services"]

export const projects: AppProject[] = [
  { id: "content-portal", name: "Content Portal", pending: 2, group: "Content" },
  { id: "common-ui", name: "Common UI", pending: 1, group: "Web" },
  { id: "parent-portal", name: "Parent Portal", pending: 0, group: "Web" },
  { id: "student-app", name: "Student App", pending: 2, group: "Mobile" },
  { id: "account-portal", name: "Account Portal", pending: 7, group: "Web" },
  { id: "leaf-assets", name: "GrapeLEAF Common Assets", pending: 0, group: "Content" },
  { id: "gs-content", name: "GrapeSEED Content", pending: 14, group: "Content" },
  { id: "admin-service", name: "Admin Service", pending: 9, group: "Services" },
  { id: "school-portal", name: "School Portal", pending: 3, group: "Web" },
  { id: "report-portal", name: "Report Portal", pending: 0, group: "Web" },
  { id: "student-site", name: "Student Site", pending: 12, group: "Web" },
  { id: "training-portal", name: "Training Portal", pending: 0, group: "Web" },
  { id: "docs-mockup", name: "Documentation UI", pending: 49, group: "Content" },
  { id: "virtual-tsi", name: "Virtual TSI", pending: 2, group: "Services" },
  { id: "portal-site", name: "Portal Site", pending: 170, group: "Web" },
  { id: "global-web", name: "Global Website 2.0", pending: 0, group: "Web" },
  { id: "gs-connect", name: "GS Connect", pending: 2, group: "Mobile" },
  { id: "gs-baby-app", name: "GS Baby App", pending: 0, group: "Mobile" },
  { id: "nexus-mobile", name: "Nexus Mobile App", pending: 0, group: "Mobile" },
  { id: "grapeseed-mobile", name: "GrapeSEED Mobile App", pending: 1, group: "Mobile" },
  { id: "littleseed-mobile", name: "LittleSEED Mobile App", pending: 4, group: "Mobile" },
  { id: "nexus-receiver", name: "Window Nexus Receiver", pending: 7, group: "Services" },
  { id: "app-common-ui", name: "App Common UI", pending: 21, group: "Mobile" },
]

export const versions = [
  "All",
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

export const sections = ["home", "general", "unit", "admin", "common"]

export const translations: TranslationString[] = [
  { id: "1", key: "home.search.placeholder", source: "Search", value: "Search", status: "translated", section: "home", updatedAt: "2d ago", updatedBy: "Logan Le" },
  { id: "2", key: "home.home", source: "Home", value: "Home", status: "translated", section: "home", updatedAt: "5d ago", updatedBy: "Mira Tan" },
  { id: "3", key: "home.unit", source: "Unit", value: "Unit", status: "translated", section: "home", updatedAt: "5d ago", updatedBy: "Mira Tan" },
  { id: "4", key: "home.general", source: "General", value: "General", status: "translated", section: "home", updatedAt: "1w ago", updatedBy: "Logan Le" },
  { id: "5", key: "home.welcometext", source: "Welcome to the GrapeSEED teacher's resource page!", value: "Welcome to the GrapeSEED teacher's resource page!", status: "pending", section: "home", updatedAt: "3h ago", updatedBy: "Logan Le" },
  { id: "6", key: "home.type", source: "Type", value: "Type", status: "translated", section: "home", updatedAt: "1w ago", updatedBy: "Mira Tan" },
  { id: "7", key: "home.title", source: "Title", value: "Title", status: "translated", section: "home", updatedAt: "1w ago", updatedBy: "Mira Tan" },
  { id: "8", key: "home.regions", source: "Regions", value: "Regions", status: "translated", section: "home", updatedAt: "2w ago", updatedBy: "Aria Cole" },
  { id: "9", key: "home.versions", source: "Versions", value: "Versions", status: "translated", section: "home", updatedAt: "2w ago", updatedBy: "Aria Cole" },
  { id: "10", key: "home.contentType.maxSelection", source: "Max 5 types can be selected at a time.", value: "", status: "missing", section: "home", updatedAt: "—", updatedBy: "—" },
  { id: "11", key: "home.set", source: "Set", value: "Set", status: "translated", section: "home", updatedAt: "3w ago", updatedBy: "Logan Le" },
  { id: "12", key: "home.contentText", source: "Text", value: "Text", status: "translated", section: "home", updatedAt: "3w ago", updatedBy: "Logan Le" },
  { id: "13", key: "common.menu.connect", source: "GrapeSEED Connect", value: "GrapeSEED Connect", status: "translated", section: "common", updatedAt: "1mo ago", updatedBy: "Mira Tan" },
  { id: "14", key: "common.menu.school", source: "School Portal", value: "School Portal", status: "translated", section: "common", updatedAt: "1mo ago", updatedBy: "Mira Tan" },
  { id: "15", key: "common.menu.studentrep", source: "Student REP", value: "Student REP", status: "pending", section: "common", updatedAt: "4h ago", updatedBy: "Aria Cole" },
  { id: "16", key: "device_tester.teacher_video", source: "Teacher Video Mirroring", value: "Teacher Video Mirroring", status: "translated", section: "general", updatedAt: "1mo ago", updatedBy: "Logan Le" },
  { id: "17", key: "device_tester.student_video", source: "Student Video Mirroring", value: "Student Video Mirroring", status: "translated", section: "general", updatedAt: "1mo ago", updatedBy: "Logan Le" },
  { id: "18", key: "unit.lesson.start", source: "Start Lesson", value: "", status: "missing", section: "unit", updatedAt: "—", updatedBy: "—" },
  { id: "19", key: "unit.lesson.complete", source: "Lesson Complete", value: "Lesson Complete", status: "translated", section: "unit", updatedAt: "2w ago", updatedBy: "Aria Cole" },
  { id: "20", key: "admin.users.invite", source: "Invite a new team member", value: "Invite a new team member", status: "pending", section: "admin", updatedAt: "6h ago", updatedBy: "Logan Le" },
  { id: "21", key: "admin.roles.manage", source: "Manage Roles", value: "Manage Roles", status: "translated", section: "admin", updatedAt: "3w ago", updatedBy: "Mira Tan" },
]

export const sectionCounts: Record<string, number> = {
  home: 0,
  general: 0,
  unit: 1,
  admin: 1,
  common: 1,
}
