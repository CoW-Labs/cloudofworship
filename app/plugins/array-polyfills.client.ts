// Polyfill Array.prototype.findLast and findLastIndex for browsers that don't
// support ES2023 (Safari < 15.4, Chrome < 97, Firefox < 104).
// Required because @tiptap/core v3 uses findLast in dispatchTransaction.
export default defineNuxtPlugin(() => {
  if (!Array.prototype.findLast) {
    Array.prototype.findLast = function <T>(
      predicate: (value: T, index: number, array: T[]) => boolean,
      thisArg?: any
    ): T | undefined {
      for (let i = this.length - 1; i >= 0; i--) {
        if (predicate.call(thisArg, this[i], i, this)) return this[i]
      }
      return undefined
    }
  }

  if (!Array.prototype.findLastIndex) {
    Array.prototype.findLastIndex = function <T>(
      predicate: (value: T, index: number, array: T[]) => boolean,
      thisArg?: any
    ): number {
      for (let i = this.length - 1; i >= 0; i--) {
        if (predicate.call(thisArg, this[i], i, this)) return i
      }
      return -1
    }
  }
})
