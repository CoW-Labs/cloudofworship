// Reuse single BroadcastChannel instance to prevent memory leaks
let bcInstance: BroadcastChannel | null = null;

const useBroadcastPost = (data: any) => {
  if (!bcInstance) {
    bcInstance = new BroadcastChannel("cow-live-channel");
  }
  // Stamp with wall-clock time (shared across tabs/windows on this device,
  // since BroadcastChannel is same-origin/same-device only) so a receiver can
  // drop a message that arrives out of order - e.g. a background countdown
  // tick from another tab racing a newer manual live-slide change - instead
  // of always applying whatever lands last.
  bcInstance.postMessage(JSON.stringify({ ts: Date.now(), payload: data }));
};

export default useBroadcastPost;