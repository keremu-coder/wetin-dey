import { describe, expect, it } from "vitest";
import { normalizeMediaUrl, imageContentType } from "./media-url";

describe("normalizeMediaUrl", () => {
  it("keeps proxy paths and strips query", () => {
    expect(normalizeMediaUrl("/api/avatar/abc12345/x.jpg?v=2")).toBe("/api/avatar/abc12345/x.jpg");
    expect(normalizeMediaUrl("/api/status-photo/abc12345/x.jpg")).toBe("/api/status-photo/abc12345/x.jpg");
  });
  it("maps legacy public avatar URLs to the proxy", () => {
    expect(
      normalizeMediaUrl("https://p.supabase.co/storage/v1/object/public/user-avatars/abc12345/x.jpg")
    ).toBe("/api/avatar/abc12345/x.jpg");
  });
  it("maps legacy public status URLs to the status proxy", () => {
    expect(
      normalizeMediaUrl("https://p.supabase.co/storage/v1/object/public/user-avatars/status/abc12345/y.jpg?t=1")
    ).toBe("/api/status-photo/abc12345/y.jpg");
  });
  it("passes through unrelated and empty values", () => {
    expect(normalizeMediaUrl(null)).toBeNull();
    expect(normalizeMediaUrl("  ")).toBeNull();
    expect(normalizeMediaUrl("blob:abc")).toBe("blob:abc");
  });
  it("content types", () => {
    expect(imageContentType("a.PNG")).toBe("image/png");
    expect(imageContentType("a.jpg")).toBe("image/jpeg");
  });
});