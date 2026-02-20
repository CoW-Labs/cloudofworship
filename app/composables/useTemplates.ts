import { useAuthStore } from "~/store/auth"
import type { Template } from "~/types"

export default function useTemplates() {
  const authStore = useAuthStore()
  const churchId = authStore.church?._id

  const fetchTemplates = async () => {
    try {
      const { data } = await useAPIFetch(`/template`, {
        method: "GET",
        key: "get-templates",
      })
      return data.value as Template[]
    } catch (error) {
      console.error("Error fetching templates:", error)
      return []
    }
  }

  const fetchTemplateById = async (templateId: string) => {
    try {
      const { data } = await useAPIFetch(`/template/${templateId}`, {
        method: "GET",
        key: `get-template-${templateId}`,
      })
      return data.value as Template
    } catch (error) {
      console.error("Error fetching template:", error)
      return null
    }
  }

  const fetchTemplatesByCategory = async (category: string) => {
    try {
      const { data } = await useAPIFetch(`/template/category/${category}`, {
        method: "GET",
        key: `get-templates-${category}`,
      })
      return data.value as Template[]
    } catch (error) {
      console.error("Error fetching templates by category:", error)
      return []
    }
  }

  const createTemplate = async (templateData: {
    slideId: string
    name: string
    description?: string
    category?: string
  }) => {
    try {
      const { data } = await useAPIFetch(`/template`, {
        method: "POST",
        body: templateData,
        key: "create-template",
      })
      return data.value as Template
    } catch (error) {
      console.error("Error creating template:", error)
      throw error
    }
  }

  const updateTemplate = async (templateId: string, updateData: Partial<Template>) => {
    try {
      const { data } = await useAPIFetch(`/template/${templateId}`, {
        method: "PUT",
        body: updateData,
        key: "update-template",
      })
      return data.value as Template
    } catch (error) {
      console.error("Error updating template:", error)
      throw error
    }
  }

  const deleteTemplate = async (templateId: string) => {
    try {
      await useAPIFetch(`/template/${templateId}`, {
        method: "DELETE",
        key: "delete-template",
      })
      return true
    } catch (error) {
      console.error("Error deleting template:", error)
      return false
    }
  }

  return {
    fetchTemplates,
    fetchTemplateById,
    fetchTemplatesByCategory,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  }
}
