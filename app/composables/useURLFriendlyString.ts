const useURLFriendlyString = (inputString: string): string => {
  let urlFriendlyString = inputString.replace(/[^\w\s-]/g, '')

  // Replace spaces with hyphens
  urlFriendlyString = urlFriendlyString.replace(/\s+/g, '-')

  // Remove consecutive hyphens
  urlFriendlyString = urlFriendlyString.replace(/-{2,}/g, '-')

  // Remove leading and trailing hyphens
  urlFriendlyString = urlFriendlyString.replace(/^-+|-+$/g, '')

  // Convert to lowercase
  urlFriendlyString = urlFriendlyString.toLowerCase()

  return urlFriendlyString
}

export default useURLFriendlyString
