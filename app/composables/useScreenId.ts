const useScreenId = (screen: any) => {
  const screenLabel = screen?.label || screen?.name || "unlabeled-screen"
  
  // Handle both browser screens and Tauri monitors
  const width = screen?.width || screen?.size?.width || 0
  const height = screen?.height || screen?.size?.height || 0
  const colorDepth = screen?.colorDepth || 24 // Default to 24 for Tauri
  
  return `${screenLabel.replaceAll(" ", "-").toLowerCase()}-${width}-${height}-${colorDepth}`
}

export default useScreenId