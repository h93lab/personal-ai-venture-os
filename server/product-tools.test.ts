import { describe, expect, it } from "vitest";
import { maskGithubToken } from "./routers";

describe("GitHub connection security", () => {
  it("masks a stored token before it can reach the UI", () => {
    expect(maskGithubToken("ghp_1234567890abcdef")).toBe("ghp_••••cdef");
    expect(maskGithubToken(undefined)).toBeNull();
  });
});
