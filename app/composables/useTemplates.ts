import type { Template, TemplateCategory, TemplateDesign, TemplateLook } from "~/types"
import { useTemplateStore } from "~/store/template"
import { useAuthStore } from "~/store/auth"
import { isUsableTemplate, looksOfDesign } from "~/utils/templates/apply"

export interface NewTemplate {
  name: string
  description?: string
  category: TemplateCategory
  design: TemplateDesign
}

/**
 * Starter templates ship in the app and are imported on first use, so a church
 * that never opens the gallery never loads them. A church's own templates come
 * from the API once per session.
 */
export default function useTemplates() {
  const store = useTemplateStore()
  const auth = useAuthStore()
  const identity = () => `${auth.user?._id ?? ""}:${auth.user?.churchId ?? ""}:${store.generation}`

  const loadStarters = async (): Promise<Template[]> => {
    // The old store kept every template, with its whole slide, in this key.
    try {
      localStorage.removeItem("template")
    } catch {}
    const { starterTemplates } = await import("~/utils/templates/starters")
    return starterTemplates
  }

  const loadChurchTemplates = async (force = false): Promise<Template[]> => {
    if (store.loaded && !force) return store.church
    const owner = identity()
    store.loading = true
    store.error = false
    try {
      const { data, error } = await useAPIFetch<Template[]>("/template", {
        method: "GET",
        key: "get-church-templates",
      })
      if (owner !== identity()) return []
      if (error.value) throw error.value
      // Older API records point at a slide and have no design; skip them.
      store.setChurchTemplates(
        (data.value ?? [])
          .filter(isUsableTemplate)
          .map((t) => ({ ...t, source: "church" as const }))
      )
    } catch (error) {
      console.error("Error loading templates:", error)
      if (owner === identity()) store.error = true
    } finally {
      if (owner === identity()) store.loading = false
    }
    return store.church
  }

  const createTemplate = async (input: NewTemplate): Promise<Template> => {
    const owner = identity()
    const looks: TemplateLook[] = looksOfDesign(input.design)
    const { data, error } = await useAPIFetch<Template>("/template", {
      method: "POST",
      body: { ...input, looks },
      key: "create-template",
    })
    if (error.value || !isUsableTemplate(data.value))
      throw error.value ?? new Error("No template")
    const template = { ...data.value, source: "church" as const }
    if (owner === identity()) store.addTemplate(template)
    return template
  }

  const deleteTemplate = async (templateId: string) => {
    const owner = identity()
    const { error } = await useAPIFetch(`/template/${templateId}`, {
      method: "DELETE",
      key: "delete-template",
    })
    if (error.value) return false
    if (owner === identity()) store.removeTemplate(templateId)
    return true
  }

  return { loadStarters, loadChurchTemplates, createTemplate, deleteTemplate }
}
