const useBackgroundVideos = async (id?: string) => {
  const db = useIndexedDB()
  if (id) {
    const video = await db.cached.get(id)
    return video?.data
  } else {
    const allVideos = await db.cached.toArray()
    return allVideos.map(video => video?.data)
  }
}

export default useBackgroundVideos
