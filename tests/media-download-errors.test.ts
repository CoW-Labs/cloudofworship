import { describe, expect, it } from "vitest"
import {
  MediaDownloadHttpError,
  isRetryableMediaDownloadError,
} from "~/utils/mediaDownloadErrors"

describe("media download retry classification", () => {
  it.each([408, 425, 429, 500, 503])(
    "retries transient HTTP status %i",
    (status) => {
      expect(
        isRetryableMediaDownloadError(new MediaDownloadHttpError(status))
      ).toBe(true)
    }
  )

  it.each([400, 401, 403, 404, 410])(
    "does not retry permanent HTTP status %i",
    (status) => {
      expect(
        isRetryableMediaDownloadError(new MediaDownloadHttpError(status))
      ).toBe(false)
    }
  )

  it("retries browser transport failures but not storage exhaustion", () => {
    expect(isRetryableMediaDownloadError(new TypeError("Failed to fetch"))).toBe(
      true
    )
    expect(
      isRetryableMediaDownloadError(
        Object.assign(new Error("aborted"), { name: "AbortError" })
      )
    ).toBe(true)
    expect(
      isRetryableMediaDownloadError(
        Object.assign(new Error("full"), { name: "QuotaExceededError" })
      )
    ).toBe(false)
  })
})
