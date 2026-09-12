export type LiveOutputDestination = "local" | "remote" | "unavailable";

/**
 * Keep routing intent separate from host availability. A selected host may be
 * temporarily absent while its laptop reconnects; that must block the action,
 * never reinterpret a remote-control tap as a local projection request.
 */
export const resolveLiveOutputDestination = (
  hasRemoteTarget: boolean,
  remoteTargetAvailable: boolean
): LiveOutputDestination => {
  if (!hasRemoteTarget) return "local";
  return remoteTargetAvailable ? "remote" : "unavailable";
};
