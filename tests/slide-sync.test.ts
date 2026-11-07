import { describe, expect, it } from "vitest"
import type { Slide } from "~/types"
import {
  isMediaVideoSlide,
  slideUpdatePath,
  toSlideUpdatePayload,
} from "~/utils/slideSync"

const slide = (overrides: Partial<Slide> = {}): Slide =>
  ({
    _id: "server-slide",
    id: "local-slide",
    scheduleId: "schedule-one",
    churchId: "church-one",
    userId: "user-one",
    index: 0,
    name: "Slide",
    type: "text",
    layout: "full_text",
    contents: ["Hello"],
    backgroundType: "color",
    backgroundVideoKey: "stale-video-key",
    ...overrides,
  }) as Slide

describe("slide sync helpers", () => {
  it("builds a schedule-scoped update path", () => {
    expect(slideUpdatePath("church-one", "schedule-one", "server-slide")).toBe(
      "/church/church-one/schedules/schedule-one/slides/server-slide"
    )
  })

  it("removes route-owned fields and clears stale video keys", async () => {
    const payload = await toSlideUpdatePayload(slide())

    expect(payload).not.toHaveProperty("_id")
    expect(payload).not.toHaveProperty("id")
    expect(payload).not.toHaveProperty("churchId")
    expect(payload).not.toHaveProperty("type")
    expect(payload).toMatchObject({
      scheduleId: "schedule-one",
      contents: ["Hello"],
      backgroundVideoKey: null,
    })
  })

  it("preserves video background keys on non-media slides", async () => {
    const motion = slide({
      backgroundType: "video",
      backgroundVideoKey: "video-key",
    })

    expect(isMediaVideoSlide(motion)).toBe(false)
    expect(await toSlideUpdatePayload(motion)).toMatchObject({
      backgroundVideoKey: "video-key",
    })
  })

  it("saves only the settings of a media video slide", async () => {
    const slideStyle = { repeatMedia: true, isMediaMuted: true }
    const video = slide({
      type: "media",
      backgroundType: "video",
      background: "https://cdn.example/clip.mp4",
      backgroundVideoKey: "video-key",
      slideStyle,
    })

    expect(isMediaVideoSlide(video)).toBe(true)
    // The upload flow owns the video's URL and key; a settings save must not
    // send them, or it could overwrite them mid-upload.
    expect(await toSlideUpdatePayload(video)).toEqual({
      name: "Slide",
      slideStyle,
    })
  })
})
