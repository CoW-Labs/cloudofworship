/**
 * Steps an intro animation through its beats on a loop: `step` is the beat on
 * show, and `durations[i]` is how long beat i holds (ms). With reduced motion
 * it holds `restStep`, one settled beat that still explains the feature.
 */
export const useIntroLoop = (durations: number[], restStep = 0) => {
  const step = ref(restStep)
  const reduceMotion =
    import.meta.client &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

  let timer: ReturnType<typeof setTimeout> | null = null
  const advance = () => {
    timer = setTimeout(() => {
      step.value = (step.value + 1) % durations.length
      advance()
    }, durations[step.value])
  }

  onMounted(() => {
    if (reduceMotion) return
    step.value = 0
    advance()
  })
  onUnmounted(() => {
    if (timer) clearTimeout(timer)
  })

  return { step, reduceMotion }
}
