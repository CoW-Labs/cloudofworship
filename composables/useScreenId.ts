const useScreenId = (screen: any) => {
  const screenLabel = screen?.label || "Unlabeled Screen"
  return `${screenLabel.replaceAll(" ", "-").toLowerCase()}-${screen?.width}-${screen?.height
    }-${screen?.colorDepth || 0}`
}

export default useScreenId