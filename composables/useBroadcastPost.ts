// Reuse single BroadcastChannel instance to prevent memory leaks
let bcInstance: BroadcastChannel | null = null;

const useBroadcastPost = (data: any) => {
  if (!bcInstance) {
    bcInstance = new BroadcastChannel("cow-live-channel");
  }
  bcInstance.postMessage(data);
};

export default useBroadcastPost;