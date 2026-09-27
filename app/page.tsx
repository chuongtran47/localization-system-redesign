import { redirect } from "next/navigation"

import { DEFAULT_PROJECT_PATH } from "@/lib/projects"

export default function Page() {
  redirect(DEFAULT_PROJECT_PATH)
}
