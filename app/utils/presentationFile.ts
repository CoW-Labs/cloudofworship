export const isPdfPresentationFile = (
  file: Pick<File, "name" | "type">
) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
