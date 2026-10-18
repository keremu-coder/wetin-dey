import { describe, it, expect } from "vitest";
import {
  describeAuthError,
  isEmailNotConfirmed,
  isInvalidCredentials,
  passwordCheckedBeforeConfirmation
} from "./signin-auth";

describe("isEmailNotConfirmed", () => {
  it("matches the GoTrue error code", () => {
    expect(isEmailNotConfirmed({ code: "email_not_confirmed" })).toBe(true);
  });
  it("matches the message when no code is present (older clients)", () => {
    expect(isEmailNotConfirmed({ message: "Email not confirmed" })).toBe(true);
  });
  it("does not match other errors or no error", () => {
    expect(isEmailNotConfirmed({ code: "invalid_credentials" })).toBe(false);
    expect(isEmailNotConfirmed({ message: "Invalid login credentials" })).toBe(false);
    expect(isEmailNotConfirmed(null)).toBe(false);
    expect(isEmailNotConfirmed(undefined)).toBe(false);
  });
});

describe("isInvalidCredentials", () => {
  it("matches code or message", () => {
    expect(isInvalidCredentials({ code: "invalid_credentials" })).toBe(true);
    expect(isInvalidCredentials({ message: "Invalid login credentials" })).toBe(true);
  });
  it("does not match email_not_confirmed", () => {
    expect(isInvalidCredentials({ code: "email_not_confirmed" })).toBe(false);
  });
});

describe("passwordCheckedBeforeConfirmation", () => {
  it("trusts the ordering when a wrong password is rejected as invalid credentials", async () => {
    const ok = await passwordCheckedBeforeConfirmation(async () => ({
      code: "invalid_credentials"
    }));
    expect(ok).toBe(true);
  });

  it("fails closed if a wrong password ALSO says email not confirmed", async () => {
    const ok = await passwordCheckedBeforeConfirmation(async () => ({
      code: "email_not_confirmed"
    }));
    expect(ok).toBe(false);
  });

  it("fails closed if the probe unexpectedly succeeds", async () => {
    expect(await passwordCheckedBeforeConfirmation(async () => null)).toBe(false);
  });

  it("fails closed if the probe throws (network error, rate limit)", async () => {
    const ok = await passwordCheckedBeforeConfirmation(async () => {
      throw new Error("boom");
    });
    expect(ok).toBe(false);
  });
});

describe("describeAuthError", () => {
  it("never includes more than code, status and message", () => {
    expect(
      describeAuthError({ code: "email_not_confirmed", status: 400, message: "Email not confirmed" })
    ).toBe("code=email_not_confirmed status=400 message=Email not confirmed");
    expect(describeAuthError(null)).toBe("none");
  });
});
