const useYoutubeStreamBroadcastMessage = (callback: (data: string) => void) => {
  const bc = new BroadcastChannel("cow-youtube-stream-channel");
  const handler = (event: MessageEvent) => { callback(event.data); };
  bc.addEventListener("message", handler);
  return () => { bc.removeEventListener("message", handler); bc.close(); };
};
export default useYoutubeStreamBroadcastMessage;
