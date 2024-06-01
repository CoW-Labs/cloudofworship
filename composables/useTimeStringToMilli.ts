const useTimeStringToMilli = (timeString: string) => {
  const [hours, minutes, seconds] = timeString.split(':').map(Number);
  const milliseconds = (hours * 3600 + minutes * 60 + seconds) * 1000;

  return milliseconds;
}

export default useTimeStringToMilli
