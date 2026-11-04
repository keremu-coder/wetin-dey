import { describe, it, expect } from "vitest";
import { autocorrect, suggestCorrection } from "./autocorrect";

describe("autocorrect — typo correction", () => {
  it("fixes common English typos", () => {
    expect(autocorrect("teh")).toBe("The");
    expect(autocorrect("i recieve am")).toBe("I receive am");
  });

  it("adds missing apostrophes", () => {
    expect(autocorrect("dont worry")).toBe("Don't worry");
    expect(autocorrect("i cant come")).toBe("I can't come");
  });

  it("does not touch Pidgin words", () => {
    expect(autocorrect("wetin dey happen")).toBe("Wetin dey happen");
    expect(autocorrect("abeg no vex")).toBe("Abeg no vex");
  });

  it("skips URLs and @mentions", () => {
    expect(autocorrect("@user teh best")).toBe("@user the best");
    expect(autocorrect("check https://example.com teh site")).toBe(
      "Check https://example.com the site"
    );
  });

  it("capitalizes the first letter", () => {
    expect(autocorrect("hello")).toBe("Hello");
    expect(autocorrect("na so we see am")).toBe("Na so we see am");
  });

  it("capitalizes I as a pronoun", () => {
    expect(autocorrect("i think i can")).toBe("I think I can");
  });

  it("capitalizes after sentence-ending punctuation", () => {
    expect(autocorrect("yes. no! maybe? ok")).toBe("Yes. No! Maybe? Ok");
  });

  it("preserves empty and whitespace-only strings", () => {
    expect(autocorrect("")).toBe("");
    expect(autocorrect("   ")).toBe("   ");
  });
});

describe("suggestCorrection", () => {
  it("suggests a fix for the last word", () => {
    expect(suggestCorrection("hello teh")).toEqual({
      original: "teh",
      suggested: "the"
    });
  });

  it("returns null for whitelisted Pidgin", () => {
    expect(suggestCorrection("wetin dey")).toBeNull();
  });

  it("returns null when no typo", () => {
    expect(suggestCorrection("hello")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(suggestCorrection("")).toBeNull();
  });
});