const useScreenId = (screen: any) => {
  const screenLabel = screen?.label || screen?.name || "Unlabeled Screen"
  // Added multiple variants: width and size.width to cater for Tauri implementation too
  return `${screenLabel.replaceAll(" ", "-").toLowerCase()}-${(screen?.width || screen?.size.width)}-${(screen?.height || screen?.size.height)}-${(screen?.colorDepth || 0)}`
}

export default useScreenId