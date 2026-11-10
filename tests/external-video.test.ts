import { describe, expect, it } from "vitest"
import {
  externalEmbedUrl,
  externalPlayerMessage,
  isExternalVideoData,
} from "../app/utils/externalVideo"

const origin = "https://app.example.com"

describe("externalEmbedUrl", () => {
  it("builds the YouTube address from watch, short and shorts links", () => {
    const options = { muted: true, loop: false, origin }
    const expected =
      "https://www.youtube.com/embed/abc123?autoplay=1&controls=1&rel=0&enablejsapi=1&origin=https://app.example.com&mute=1"
    for (const url of [
      "https://www.youtube.com/watch?v=abc123&t=4",
      "https://youtu.be/abc123?si=x",
      "https://www.youtube.com/shorts/abc123?feature=share",
    ]) {
      expect(externalEmbedUrl({ url, type: "youtube" }, options)).toBe(expected)
    }
  })

  it("adds the playlist a YouTube loop needs and unmutes on request", () => {
    const url = externalEmbedUrl(
      { url: "https://youtu.be/abc123", type: "youtube" },
      { muted: false, loop: true, origin }
    )
    expect(url).toContain("&mute=0&loop=1&playlist=abc123")
  })

  it("builds the Vimeo address", () => {
    expect(
      externalEmbedUrl(
        { url: "https://vimeo.com/987654?share=copy", type: "vimeo" },
        { muted: true, loop: true, origin }
      )
    ).toBe("https://player.vimeo.com/video/987654?autoplay=1&api=1&muted=1&loop=1")
  })

  it("has no address for other links", () => {
    expect(
      externalEmbedUrl({ url: "x", type: "other" }, { muted: true, loop: false, origin })
    ).toBe("")
  })
})

describe("externalPlayerMessage", () => {
  it("speaks YouTube's command dialect", () => {
    expect(JSON.parse(externalPlayerMessage("youtube", { kind: "pause" }))).toEqual({
      event: "command",
      func: "pauseVideo",
      args: [],
    })
    expect(
      JSON.parse(externalPlayerMessage("youtube", { kind: "seek", seconds: 12 }))
    ).toEqual({ event: "command", func: "seekTo", args: [12, true] })
    expect(
      JSON.parse(externalPlayerMessage("youtube", { kind: "mute", muted: false })).func
    ).toBe("unMute")
  })

  it("speaks Vimeo's", () => {
    expect(JSON.parse(externalPlayerMessage("vimeo", { kind: "play" }))).toEqual({
      method: "play",
    })
    expect(
      JSON.parse(externalPlayerMessage("vimeo", { kind: "seek", seconds: 3 }))
    ).toEqual({ method: "setCurrentTime", value: 3 })
    expect(
      JSON.parse(externalPlayerMessage("vimeo", { kind: "mute", muted: true }))
    ).toEqual({ method: "setVolume", value: 0 })
  })
})

describe("isExternalVideoData", () => {
  it("accepts only YouTube and Vimeo links", () => {
    expect(isExternalVideoData({ url: "", type: "youtube" })).toBe(true)
    expect(isExternalVideoData({ url: "", type: "vimeo" })).toBe(true)
    expect(isExternalVideoData({ type: "video/mp4" })).toBe(false)
    expect(isExternalVideoData(undefined)).toBe(false)
  })
})
