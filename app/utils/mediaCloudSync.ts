import type {
  MediaCloudSyncReason,
  MediaCloudSyncRecord,
} from "~/types"

export const mediaCloudFailureReason = (
  error: unknown
): MediaCloudSyncReason =>
  /quota|storage limit|storage full/i.test(String(error))
    ? "quota"
    : "upload-error"

export const unavailableMediaCopy = (
  record?: MediaCloudSyncRecord | null,
  label = "Media"
) => {
  if (record?.status === "pending") {
    return {
      title: `${label} is waiting to upload`,
      description:
        "Keep the device that added it open and online until the cloud upload finishes, then try again.",
    }
  }

  if (record?.reason === "offline") {
    return {
      title: `${label} was added offline`,
      description:
        "No cloud copy was created. Reconnect the device that added it and upload or replace the file before taking this slide live.",
    }
  }

  if (record?.reason === "quota") {
    return {
      title: "Cloud storage was full",
      description:
        "This file remained only on the device that added it. Free cloud storage there, then upload or replace the file.",
    }
  }

  if (record?.reason === "disabled") {
    return {
      title: "Cloud upload was turned off",
      description:
        "This file remained only on the device that added it. Enable cloud uploads and upload or replace the file.",
    }
  }

  if (record?.status === "failed") {
    return {
      title: `${label} upload failed`,
      description:
        "The cloud copy was not created. Retry from the device that added it, or replace the file.",
    }
  }

  if (record?.status === "uploaded") {
    return {
      title: `${label} could not be downloaded`,
      description:
        "A cloud copy exists, but this device could not open it. Check the connection and try again.",
    }
  }

  return {
    title: `${label} is unavailable`,
    description:
      "This device has no local copy and the slide has no recoverable cloud copy. Re-add the file before taking it live.",
  }
}
