import { defineStore } from "pinia"
import type { Template } from "~/types"

/**
 * A church's own templates, held in memory only. Nothing here is persisted:
 * the old store wrote every template, with its whole slide, to localStorage on
 * each change, and that is serialised again on every write. Starters are not
 * here either; they ship in the app and load when the gallery opens.
 */
export const useTemplateStore = defineStore("template", {
  state: () => ({
    church: [] as Template[],
    loaded: false,
    loading: false,
    error: false,
    generation: 0,
  }),

  actions: {
    setChurchTemplates(templates: Template[]) {
      this.church = templates
      this.loaded = true
      this.error = false
    },

    addTemplate(template: Template) {
      this.church = [template, ...this.church]
    },

    updateTemplate(templateId: string, updated: Partial<Template>) {
      this.church = this.church.map((template) =>
        template._id === templateId ? { ...template, ...updated } : template
      )
    },

    removeTemplate(templateId: string) {
      this.church = this.church.filter((template) => template._id !== templateId)
    },

    clear() {
      this.generation++
      this.church = []
      this.loaded = false
      this.loading = false
      this.error = false
    },
  },
})
