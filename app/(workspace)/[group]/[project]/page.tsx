import { Suspense } from "react"
import { redirect } from "next/navigation"

import { TranslationWorkspace } from "@/components/translation-workspace"
import { DEFAULT_PROJECT_PATH, findProject } from "@/lib/projects"

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ group: string; project: string }>
}) {
  const { group, project: id } = await params
  const project = findProject(group, id)
  if (!project) {
    redirect(DEFAULT_PROJECT_PATH)
  }

  return (
    <Suspense>
      <TranslationWorkspace project={project} />
    </Suspense>
  )
}
