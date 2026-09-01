import { describe, expect, it } from "vitest"
import {
  mediaCloudFailureReason,
  unavailableMediaCopy,
} from "../app/utils/mediaCloudSync"
import type { MediaCloudSyncRecord } from "../app/types"

const record = (
  overrides: Partial<MediaCloudSyncRecord>
): MediaCloudSyncRecord => ({
  key: "image-1",
  groupId: "image-1",
  status: "local-only",
  createdAt: "2026-08-30T00:00:00.000Z",
  updatedAt: "2026-08-30T00:00:00.000Z",
  ...overrides,
})

describe("media cloud sync reporting", () => {
  it("distinguishes media created offline from an unknown missing copy", () => {
    expect(
      unavailableMediaCopy(
        record({ status: "local-only", reason: "offline" }),
        "Image"
      ).title
    ).toBe("Image was added offline")
    expect(unavailableMediaCopy(null, "Image").title).toBe(
      "Image is unavailable"
    )
  })

  it("reports uploaded media as a download problem", () => {
    const copy = unavailableMediaCopy(
      record({
        status: "uploaded",
        remoteUrl: "https://cdn.example.com/image.png",
      }),
      "Image"
    )
    expect(copy.title).toBe("Image could not be downloaded")
    expect(copy.description).toContain("cloud copy exists")
  })

  it("distinguishes quota failures from ordinary upload failures", () => {
    expect(mediaCloudFailureReason(new Error("Storage limit reached"))).toBe(
      "quota"
    )
    expect(mediaCloudFailureReason(new Error("Network request failed"))).toBe(
      "upload-error"
    )
  })

  it.each([
    {
      name: "pending upload",
      state: record({ status: "pending" }),
      title: "Video is waiting to upload",
      description: "Keep the device that added it open and online",
    },
    {
      name: "offline media",
      state: record({ status: "local-only", reason: "offline" }),
      title: "Video was added offline",
      description: "No cloud copy was created",
    },
    {
      name: "quota failure",
      state: record({ status: "failed", reason: "quota" }),
      title: "Cloud storage was full",
      description: "Free cloud storage there",
    },
    {
      name: "disabled upload",
      state: record({ status: "local-only", reason: "disabled" }),
      title: "Cloud upload was turned off",
      description: "Enable cloud uploads",
    },
    {
      name: "ordinary upload failure",
      state: record({ status: "failed", reason: "upload-error" }),
      title: "Video upload failed",
      description: "Retry from the device that added it",
    },
    {
      name: "download failure",
      state: record({
        status: "uploaded",
        remoteUrl: "https://cdn.example.com/video.mp4",
      }),
      title: "Video could not be downloaded",
      description: "A cloud copy exists",
    },
  ])("returns actionable copy for $name", ({ state, title, description }) => {
    const copy = unavailableMediaCopy(state, "Video")

    expect(copy.title).toBe(title)
    expect(copy.description).toContain(description)
  })

  it("uses a safe generic message when no sync history exists", () => {
    const copy = unavailableMediaCopy(undefined, "Media")

    expect(copy.title).toBe("Media is unavailable")
    expect(copy.description).toContain("no recoverable cloud copy")
  })
})
