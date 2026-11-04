import { describe, it, expect } from "vitest";
import { audioContainerFor } from "./audio-container";

describe("audioContainerFor", () => {
  it("iPhone recordings (audio/mp4) use m4a, not webm", () => {
    // Regression: forcing these into webm made ffmpeg exit 234 and the
    // upload fail on every iPhone.
    expect(audioContainerFor("audio/mp4").ext).toBe("m4a");
    expect(audioContainerFor("audio/mp4;codecs=mp4a.40.2").ext).toBe("m4a");
    expect(audioContainerFor("audio/x-m4a").ext).toBe("m4a");
    expect(audioContainerFor("audio/aac").ext).toBe("m4a");
  });

  it("Chrome/Android recordings stay webm", () => {
    expect(audioContainerFor("audio/webm;codecs=opus").ext).toBe("webm");
    expect(audioContainerFor("audio/webm").contentType).toBe("audio/webm");
  });

  it("maps ogg, mp3 and wav", () => {
    expect(audioContainerFor("audio/ogg;codecs=opus").ext).toBe("ogg");
    expect(audioContainerFor("audio/mpeg").ext).toBe("mp3");
    expect(audioContainerFor("audio/wav").ext).toBe("wav");
  });

  it("falls back to webm for empty or unknown types", () => {
    expect(audioContainerFor("").ext).toBe("webm");
    expect(audioContainerFor(null).ext).toBe("webm");
    expect(audioContainerFor("audio/x-unknown").ext).toBe("webm");
  });
});
