import { defineStore } from "pinia"
import type { Template } from "~/types"

export const useTemplateStore = defineStore("template", {
  state: () => ({
    templates: [] as Template[],
    loading: false,
    selectedCategory: "general" as string,
  }),

  getters: {
    allTemplates: (state) => state.templates,
    
    templatesByCategory: (state) => (category: string) => {
      return state.templates.filter((template) => template.category === category)
    },
  },

  actions: {
    setTemplates(templates: Template[]) {
      this.templates = templates
    },

    addTemplate(template: Template) {
      this.templates.unshift(template)
    },

    updateTemplate(templateId: string, updatedData: Partial<Template>) {
      const index = this.templates.findIndex((t) => t._id === templateId)
      if (index !== -1) {
        this.templates[index] = { ...this.templates[index], ...updatedData }
      }
    },

    removeTemplate(templateId: string) {
      this.templates = this.templates.filter((t) => t._id !== templateId)
    },

    setLoading(loading: boolean) {
      this.loading = loading
    },

    setSelectedCategory(category: string) {
      this.selectedCategory = category
    },

    clearTemplates() {
      this.templates = []
    },
  },

  persist: {
    storage: piniaPluginPersistedstate.localStorage(),
  },
})
