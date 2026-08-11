// A tab only needs one minute-aligned clock, regardless of how many previews
// are mounted. Keeping it at module scope avoids one formatter and timer per
// SlideContentByLayout instance.
const formattedTime = ref("")
let formatter: Intl.DateTimeFormat | null = null
let timeout: ReturnType<typeof setTimeout> | null = null
let subscribers = 0

const updateClock = () => {
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }

  const now = new Date()
  formattedTime.value = formatter.format(now)

  const millisecondsUntilNextMinute =
    60_000 - (now.getSeconds() * 1_000 + now.getMilliseconds())
  timeout = setTimeout(updateClock, millisecondsUntilNextMinute)
}

const useLiveClock = () => {
  onMounted(() => {
    subscribers += 1
    if (subscribers === 1) updateClock()
  })

  onScopeDispose(() => {
    subscribers = Math.max(0, subscribers - 1)
    if (subscribers === 0 && timeout) {
      clearTimeout(timeout)
      timeout = null
    }
  })

  return readonly(formattedTime)
}

export default useLiveClock
