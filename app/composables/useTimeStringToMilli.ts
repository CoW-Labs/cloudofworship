/**
 * Parse a countdown time string into milliseconds.
 *
 * The canonical format is "HH:MM:SS" (what AddCountdown produces), but parts are
 * read right-to-left so shorter forms like "MM:SS" or "SS" also work instead of
 * silently yielding NaN — a NaN duration makes a countdown render 00:00 the
 * moment it is started.
 */
const useTimeStringToMilli = (timeString: string) => {
  const parts = (timeString || '')
    .split(':')
    .map((part) => Number(part.trim()))

  // Right-to-left: seconds, then minutes, then hours.
  const [seconds = 0, minutes = 0, hours = 0] = parts.reverse()

  if ([hours, minutes, seconds].some((value) => Number.isNaN(value))) return 0

  return (hours * 3600 + minutes * 60 + seconds) * 1000
}

export default useTimeStringToMilli
