const useClientOS = () => {
  const userAgent = window.navigator.userAgent;
  const platform = window.navigator.platform;

  if (/Win/i.test(platform) || /Windows/i.test(userAgent)) {
    return 'Windows';
  }
  if (/Mac/i.test(platform)) {
    return 'macOS';
  }
  if (/Linux/i.test(platform) && !/Android/i.test(userAgent)) {
    return 'Linux';
  }
  if (/Android/i.test(userAgent)) {
    return 'Android';
  }
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return 'iOS';
  }
  if (/CrOS/i.test(userAgent)) {
    return 'Chrome OS';
  }
  return 'Unknown OS';
}

export default useClientOS