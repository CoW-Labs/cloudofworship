import { Extension } from "@tiptap/core"

/**
 * Keeps a font weight written on a text style span (for example the thin half
 * of a template's heavy and thin headline). Without it the editor drops the
 * weight the first time the slide is edited, because it only keeps the styles
 * an extension knows about. It adds no toolbar control of its own.
 */
export const FontWeight = Extension.create({
  name: "fontWeight",
  // Ahead of Bold, so its shortcut below wins over Bold's own.
  priority: 1000,
  // A kept weight would outrank Bold (thin words stay thin inside <strong>),
  // so Bold clears it from the words it touches.
  addKeyboardShortcuts() {
    return {
      "Mod-b": () =>
        this.editor
          .chain()
          .toggleBold()
          .setMark("textStyle", { fontWeight: null })
          .removeEmptyTextStyle()
          .run(),
    }
  },
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontWeight: {
            default: null,
            parseHTML: (element) => element.style.fontWeight || null,
            renderHTML: (attributes) =>
              attributes.fontWeight
                ? { style: `font-weight: ${attributes.fontWeight}` }
                : {},
          },
        },
      },
    ]
  },
})
