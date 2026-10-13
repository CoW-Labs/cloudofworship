// Bible translations and preset background videos come from media storage,
// never from the app build. Keys keep the layout they had on CloudFront
// (`open/bible-versions/…`, `open/bg-videos/…`), so moving providers only
// changes this origin.
const MEDIA_BASE = "https://media.cloudofworship.com/open"

export const bibleVersionAssetUrl = (versionId: string) =>
  `${MEDIA_BASE}/bible-versions/${versionId.toLowerCase()}.json`

export const backgroundVideoAssetUrl = (id: number) =>
  `${MEDIA_BASE}/bg-videos/video-bg-${id}.mp4?v=v1`
