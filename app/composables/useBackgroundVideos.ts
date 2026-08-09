import type { BackgroundVideo } from "~/types"

const useBackgroundVideos = async (): Promise<BackgroundVideo[]> => {
  const localMedia = useLocalMediaStorage()
  const videos = (await localMedia.listRecords()).filter(
    (record) =>
      record.category === "preset" &&
      record.kind === "video" &&
      !record.key.includes("custom")
  )

  const resolved: BackgroundVideo[] = []
  for (const video of videos) {
    const url = await localMedia.getPlaybackUrl(video.key)
    if (url) resolved.push({ id: video.key, url })
  }
  return resolved
}

export default useBackgroundVideos
