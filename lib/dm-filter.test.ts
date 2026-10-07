import { describe, expect, it } from "vitest";
import { analyzeMessage, blockReason } from "./dm-filter";

describe("dm-filter — pass cases", () => {
  it("plain chat passes", () => {
    const r = analyzeMessage("Hey, how you dey?");
    expect(r.level).toBe("pass");
  });

  it("Pidgin passes", () => {
    const r = analyzeMessage("Abeg no wahala. Wetin dey happen for your side?");
    expect(r.level).toBe("pass");
  });

  it("internal @mentions pass", () => {
    const r = analyzeMessage("@kpekpes check this out when you get time");
    expect(r.level).toBe("pass");
  });

  it("prices and naira amounts pass", () => {
    const r = analyzeMessage("The generator cost ₦250,000 last month.");
    expect(r.level).toBe("pass");
  });

  it("short numbers (prices, ages) pass", () => {
    const r = analyzeMessage("I was 15 when I finished school in 2009.");
    expect(r.level).toBe("pass");
  });

  it("random innocuous numbers pass", () => {
    const r = analyzeMessage("We were 3 people in the room.");
    expect(r.level).toBe("pass");
  });

  it("single spelled digit word passes", () => {
    const r = analyzeMessage("Just one thing — two if I'm lucky.");
    expect(r.level).toBe("pass");
  });

  it("empty string passes", () => {
    const r = analyzeMessage("");
    expect(r.level).toBe("pass");
  });

  it("whitespace-only passes", () => {
    const r = analyzeMessage("   \n\t  ");
    expect(r.level).toBe("pass");
  });
});

describe("dm-filter — numeric phones", () => {
  it("catches a bare Nigerian mobile", () => {
    const r = analyzeMessage("Call me on 08034567890");
    expect(r.level).toBe("block");
    expect(r.matches[0].kind).toBe("phone");
  });

  it("catches a spaced number", () => {
    const r = analyzeMessage("my number na 0803 456 7890");
    expect(r.level).toBe("block");
  });

  it("catches a dashed number", () => {
    const r = analyzeMessage("reach me: 0803-456-7890");
    expect(r.level).toBe("block");
  });

  it("catches a dotted number", () => {
    const r = analyzeMessage("0803.456.7890");
    expect(r.level).toBe("block");
  });

  it("catches a 0703 number", () => {
    const r = analyzeMessage("0703 123 4567");
    expect(r.level).toBe("block");
  });

  it("catches a 0909 number", () => {
    const r = analyzeMessage("09091234567");
    expect(r.level).toBe("block");
  });

  it("catches an international format", () => {
    const r = analyzeMessage("+2348012345678");
    expect(r.level).toBe("block");
  });

  it("catches an international format without plus", () => {
    const r = analyzeMessage("2348012345678");
    expect(r.level).toBe("block");
  });

  it("catches a number embedded in a sentence", () => {
    const r = analyzeMessage("you can reach me anytime on 08099887766 or later");
    expect(r.level).toBe("block");
  });

  it("catches a number in parentheses", () => {
    const r = analyzeMessage("my line (0803 456 7890) is always on");
    expect(r.level).toBe("block");
  });
});

describe("dm-filter — spelled phones", () => {
  it("catches zero-eight-zero spellout", () => {
    const r = analyzeMessage(
      "zero eight zero three four five six seven eight nine zero"
    );
    expect(r.level).toBe("block");
    expect(r.matches[0].kind).toBe("spelled_phone");
  });

  it("catches oh-eight-oh spellout", () => {
    const r = analyzeMessage(
      "oh eight oh three four five six seven eight nine zero"
    );
    expect(r.level).toBe("block");
  });

  it("catches a partial spellout mixed with digits", () => {
    const r = analyzeMessage(
      "zero eight zero three four five six 7 8 9 0"
    );
    expect(r.level).toBe("block");
  });
});

describe("dm-filter — emails", () => {
  it("catches a standard email", () => {
    const r = analyzeMessage("send me mail at john@example.com");
    expect(r.level).toBe("block");
    expect(r.matches[0].kind).toBe("email");
  });

  it("catches a gmail", () => {
    const r = analyzeMessage("john.doe@gmail.com");
    expect(r.level).toBe("block");
  });

  it("catches a spelled 'at' 'dot' email", () => {
    const r = analyzeMessage("john at gmail dot com");
    expect(r.level).toBe("block");
    expect(r.matches.some((m) => m.kind === "spelled_email")).toBe(true);
  });

  it("catches a spelled 'at' with real dot", () => {
    const r = analyzeMessage("john at gmail.com");
    expect(r.level).toBe("block");
  });

  it("catches an email embedded in Pidgin", () => {
    const r = analyzeMessage("abeg send am to kpekpes@gmail.com make I see");
    expect(r.level).toBe("block");
  });
});

describe("dm-filter — external links", () => {
  it("catches wa.me", () => {
    const r = analyzeMessage("chat me on wa.me/2348012345678");
    expect(r.level).toBe("block");
    expect(r.matches[0].kind).toBe("external_link");
  });

  it("catches t.me", () => {
    const r = analyzeMessage("join t.me/mychannel");
    expect(r.level).toBe("block");
  });

  it("catches a full instagram URL", () => {
    const r = analyzeMessage("https://instagram.com/johndoe");
    expect(r.level).toBe("block");
  });

  it("catches x.com", () => {
    const r = analyzeMessage("follow me x.com/johndoe");
    expect(r.level).toBe("block");
  });

  it("catches a bare whatsapp.com", () => {
    const r = analyzeMessage("whatsapp.com is where we talk");
    expect(r.level).toBe("block");
  });

  it("catches tiktok.com", () => {
    const r = analyzeMessage("see my tiktok.com/@johndoe");
    expect(r.level).toBe("block");
  });

  it("does not catch an unrelated domain", () => {
    const r = analyzeMessage("check nairaland.com for that gist");
    expect(r.level).toBe("pass");
  });
});

describe("dm-filter — blockReason", () => {
  it("returns a phone message for phones", () => {
    const r = analyzeMessage("08034567890");
    const reason = blockReason(r);
    expect(reason).toContain("Phone numbers");
  });

  it("returns an email message for emails", () => {
    const r = analyzeMessage("john@example.com");
    const reason = blockReason(r);
    expect(reason).toContain("Email");
  });

  it("returns a link message for links", () => {
    const r = analyzeMessage("wa.me/2348012345678");
    const reason = blockReason(r);
    expect(reason).toContain("Links");
  });

  it("returns null for pass", () => {
    const r = analyzeMessage("hello friend");
    expect(blockReason(r)).toBeNull();
  });
});