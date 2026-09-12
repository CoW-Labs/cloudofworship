import { describe, expect, it } from "vitest";
import { resolveLiveOutputDestination } from "~/utils/liveOutputRouting";

describe("live output routing", () => {
  it("uses the local output when no remote target was selected", () => {
    expect(resolveLiveOutputDestination(false, false)).toBe("local");
  });

  it("routes to an available selected host", () => {
    expect(resolveLiveOutputDestination(true, true)).toBe("remote");
  });

  it("blocks instead of falling back locally when the selected host is unavailable", () => {
    expect(resolveLiveOutputDestination(true, false)).toBe("unavailable");
  });
});
