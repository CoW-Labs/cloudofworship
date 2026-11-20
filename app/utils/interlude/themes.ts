/**
 * Curated colour themes for interludes.
 *
 * A theme is two or three hand-picked colours. The engine recolours an
 * animation from them while keeping that animation's own light and shade, so
 * one theme suits every animation and its text stays readable. Only each
 * colour's hue and saturation count, which is why they are written as clear,
 * saturated colours rather than the pale or deep tones the animation shows.
 *
 * The first colour sets the ground and the text, the second the bands and
 * labels, and the optional third the glow and accents. Everything past those
 * three roles repeats in order.
 */
export interface InterludeTheme {
  id: string
  name: string
  colors: [string, string] | [string, string, string]
}

export const interludeThemes: InterludeTheme[] = [
  { id: "cloud-purple", name: "Cloud Purple", colors: ["#a855f7", "#f5b73b"] },
  { id: "sunrise", name: "Sunrise", colors: ["#ff7a45", "#e8457c", "#f6b93b"] },
  { id: "deep-water", name: "Deep Water", colors: ["#1f6feb", "#14b8a6", "#7dd3fc"] },
  { id: "vineyard", name: "Vineyard", colors: ["#a3246b", "#7c3aed", "#f0a3c8"] },
  { id: "olive-grove", name: "Olive Grove", colors: ["#6b8e23", "#d9a441", "#a8c256"] },
  { id: "meadow", name: "Meadow", colors: ["#2f9e5b", "#f2c230", "#5bbcd6"] },
  { id: "christmas", name: "Christmas", colors: ["#1e7b4f", "#c0273b", "#e2b13c"] },
]

export const getInterludeTheme = (id?: string | null) =>
  id ? interludeThemes.find((theme) => theme.id === id) ?? null : null
