import { describe, it, expect } from "vitest";
import {
  decideSession,
  isMissingEpochColumn,
  pruneEpochCache
} from "./session-epoch";

describe("decideSession", () => {
  it("accepts a first-time visitor (no row yet) with an epoch-1 cookie", () => {
    // Regression: this used to return null, so no new visitor could ever
    // get a sessions row and every API call answered 401.
    expect(decideSession(1, { kind: "missing" }, null)).toBe(true);
  });

  it("rejects a missing row when the cookie carries a bumped epoch", () => {
    expect(decideSession(2, { kind: "missing" }, null)).toBe(false);
  });

  it("accepts a matching epoch and rejects a stale one (revocation)", () => {
    expect(decideSession(3, { kind: "ok", epoch: 3 }, null)).toBe(true);
    expect(decideSession(1, { kind: "ok", epoch: 2 }, null)).toBe(false);
  });

  it("treats a not-yet-migrated column like epoch 1", () => {
    expect(decideSession(1, { kind: "no-column" }, null)).toBe(true);
    expect(decideSession(2, { kind: "no-column" }, null)).toBe(false);
  });

  it("fails closed on a DB error with nothing cached", () => {
    expect(decideSession(1, { kind: "error" }, null)).toBe(false);
  });

  it("survives a DB blip using a previously verified epoch", () => {
    expect(decideSession(2, { kind: "error" }, 2)).toBe(true);
    expect(decideSession(1, { kind: "error" }, 2)).toBe(false);
  });
});

describe("isMissingEpochColumn", () => {
  it("detects the Postgres undefined_column code", () => {
    expect(isMissingEpochColumn({ code: "42703" })).toBe(true);
  });
  it("detects a message naming the column", () => {
    expect(
      isMissingEpochColumn({
        message: "column sessions.session_epoch does not exist"
      })
    ).toBe(true);
  });
  it("ignores unrelated errors", () => {
    expect(isMissingEpochColumn({ code: "57014", message: "timeout" })).toBe(false);
  });
});

describe("pruneEpochCache", () => {
  it("does nothing under the limit", () => {
    const m = new Map([["a", { epoch: 1, expiresAt: 0 }]]);
    expect(pruneEpochCache(m, 100, 10)).toBe(0);
    expect(m.size).toBe(1);
  });
  it("drops expired entries first, then the oldest, down to the limit", () => {
    const m = new Map<string, { epoch: number; expiresAt: number }>();
    for (let i = 0; i < 6; i++) m.set(`k${i}`, { epoch: 1, expiresAt: 1000 + i });
    m.set("expired", { epoch: 1, expiresAt: 5 });
    pruneEpochCache(m, 100, 3);
    expect(m.size).toBe(3);
    expect(m.has("expired")).toBe(false);
    expect(m.has("k5")).toBe(true); // newest survives
  });
});
