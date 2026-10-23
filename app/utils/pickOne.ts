/** A random item from the list, for copy that should vary between visits. */
export const pickOne = <T>(items: readonly T[]): T =>
  items[Math.floor(Math.random() * items.length)] as T
