// Short public handle for a schedule, issued by the API (see the API's
// schedule/code.js, which owns the alphabet). It stands in for the ObjectId
// wherever a link or a spoken/typed reference is shared; everything inside the
// app stays keyed by `_id`.
//
// The alphabet has no 0/O, 1/I/L or vowels: codes get read off a projector and
// typed on a phone.
export const SCHEDULE_CODE_ALPHABET = "23456789BCDFGHJKMNPQRSTVWXYZ"
export const SCHEDULE_CODE_LENGTH = 6

/** What a person typed or pasted, tidied: uppercase letters and digits only. */
export const normalizeScheduleCode = (value: unknown): string =>
  String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")

export const isScheduleCode = (value: unknown): boolean => {
  const code = normalizeScheduleCode(value)
  return (
    code.length === SCHEDULE_CODE_LENGTH &&
    [...code].every((char) => SCHEDULE_CODE_ALPHABET.includes(char))
  )
}

/** Links shared before codes existed carry the schedule's ObjectId. */
export const isScheduleObjectId = (value: unknown): boolean =>
  /^[0-9a-f]{24}$/i.test(String(value ?? ""))
