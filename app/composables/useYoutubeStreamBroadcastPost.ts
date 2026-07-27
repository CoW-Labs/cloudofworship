let bcInstance: BroadcastChannel | null = null;
const useYoutubeStreamBroadcastPost = (data: any) => {
  if (!bcInstance) { bcInstance = new BroadcastChannel("cow-youtube-stream-channel"); }
  bcInstance.postMessage(data);
};
export default useYoutubeStreamBroadcastPost;
