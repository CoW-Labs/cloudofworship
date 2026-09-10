import { describe, expect, it } from "vitest"
import { isPdfPresentationFile } from "~/utils/presentationFile"

describe("PDF presentation detection", () => {
  it("recognizes PDFs when the browser omits the MIME type", () => {
    expect(
      isPdfPresentationFile({ name: "Sunday Service.PDF", type: "" })
    ).toBe(true)
  })

  it("does not route PowerPoint files through the local PDF path", () => {
    expect(
      isPdfPresentationFile({
        name: "Sunday Service.pptx",
        type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      })
    ).toBe(false)
  })
})
