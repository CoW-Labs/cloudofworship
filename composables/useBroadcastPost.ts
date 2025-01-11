const useBroadcastPost = (data: any) => {
  const bc = new BroadcastChannel("cow-live-channel");
  bc.postMessage(data);
};

export default useBroadcastPost;