const useBroadcastMessage = (callback: any) => {
  const bc = new BroadcastChannel("cow-live-channel");
  bc.onmessage = (event) => {
    callback(event.data);
  };
};

export default useBroadcastMessage;