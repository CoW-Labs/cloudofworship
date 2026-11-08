import { describe, expect, it } from "vitest"
import {
  CAMERA_SHARE_HEIGHT,
  cameraShareEncoding,
  chooseCameraSource,
  findCameraHost,
  type CameraHost,
} from "~/utils/cameraShare"

const host = (overrides: Partial<CameraHost>): CameraHost => ({
  socketId: "socket-a",
  userId: "user-a",
  userName: "Ada",
  cameras: [],
  paused: false,
  projecting: false,
  seenAt: 1,
  ...overrides,
})

describe("findCameraHost", () => {
  const made = { deviceId: "id-on-a", deviceLabel: "FaceTime HD Camera" }

  it("finds the computer the slide was made on by its device id", () => {
    const a = host({ cameras: [{ deviceId: "id-on-a", label: "FaceTime HD Camera" }] })
    const b = host({
      socketId: "socket-b",
      cameras: [{ deviceId: "id-on-b", label: "FaceTime HD Camera" }],
      projecting: true,
      seenAt: 9,
    })
    expect(findCameraHost([b, a], made)).toMatchObject({ host: a, match: "exact" })
  })

  it("prefers the computer with the live window among same-named cameras", () => {
    const a = host({ cameras: [{ deviceId: "x", label: "FaceTime HD Camera" }], seenAt: 9 })
    const b = host({
      socketId: "socket-b",
      cameras: [{ deviceId: "y", label: "FaceTime HD Camera" }],
      projecting: true,
    })
    expect(findCameraHost([a, b], made)).toMatchObject({ host: b, match: "label" })
  })

  it("follows a computer that reconnected, not its old socket", () => {
    const cameras = [{ deviceId: "id-on-a", label: "FaceTime HD Camera" }]
    const old = host({ cameras, seenAt: 1 })
    const reconnected = host({ socketId: "socket-a2", cameras, seenAt: 2 })
    expect(findCameraHost([old, reconnected], made)?.host.socketId).toBe("socket-a2")
  })

  it("never picks this computer's own socket", () => {
    const self = host({ cameras: [{ deviceId: "id-on-a", label: "FaceTime HD Camera" }] })
    expect(findCameraHost([self], made, "socket-a")).toBeNull()
  })

  it("finds nothing for a slide with no camera chosen", () => {
    const a = host({ cameras: [{ deviceId: "x", label: "Cam" }] })
    expect(findCameraHost([a], { deviceId: "", deviceLabel: "" })).toBeNull()
  })
})

describe("chooseCameraSource", () => {
  const exact = { host: host({}), match: "exact" as const, camera: { deviceId: "a", label: "Cam" } }
  const label = { ...exact, match: "label" as const }

  it("keeps this computer's own copy of the camera", () => {
    expect(chooseCameraSource("exact", exact)).toBe("local")
    expect(chooseCameraSource("label", label)).toBe("local")
  })

  it("uses the teammate's camera when theirs is the slide's own", () => {
    expect(chooseCameraSource("label", exact)).toBe("remote")
  })

  it("uses the teammate's camera rather than asking for permission here", () => {
    expect(chooseCameraSource("unknown", label)).toBe("remote")
    expect(chooseCameraSource("none", label)).toBe("remote")
  })

  it("stays local with no teammate to ask", () => {
    expect(chooseCameraSource("none", null)).toBe("local")
  })
})

describe("cameraShareEncoding", () => {
  it("scales a 1080p camera to preview size", () => {
    expect(cameraShareEncoding(1080).scaleResolutionDownBy).toBe(1080 / CAMERA_SHARE_HEIGHT)
  })

  it("never scales a small camera up", () => {
    expect(cameraShareEncoding(360).scaleResolutionDownBy).toBe(1)
  })
})
