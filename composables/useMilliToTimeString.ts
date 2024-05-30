

const useMilliToTimeString = (milliseconds: number) => {
  // Calculate hours, minutes, and seconds
  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);

  // Pad the hours, minutes, and seconds with leading zeros if necessary
  const paddedHours = String(hours).padStart(2, '0');
  const paddedMinutes = String(minutes).padStart(2, '0');
  const paddedSeconds = String(seconds).padStart(2, '0');

  // Return the time string in HH:MM:SS format
  return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
}

export default useMilliToTimeString
