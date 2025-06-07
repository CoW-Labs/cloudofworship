import type { Media } from "~/types"

const useBackgroundVideos = async (id?: string): Promise<Media[]> => {
  const db = useIndexedDB()
  // if (id) {
  //   const video = await db.cached.get(id)
  //   return video?.data
  // } else {
  let allVideos = await db.cached.toArray()
  allVideos = allVideos?.filter(video => video.content?.includes('video') && !video?.id?.includes('custom'))
  // console.log(allVideos)
  return allVideos
  // }
}

export default useBackgroundVideos
