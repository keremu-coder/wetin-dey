export type AuthErrLike =
  | { code?: string | null; status?: number | null; message?: string | null }
  | null
  | undefined;

export function isEmailNotConfirmed(err: AuthErrLike): boolean {
  if (!err) return false;
  if (err.code === "email_not_confirmed") return true;
  return /email not confirmed/i.test(err.message ?? "");
}

export function isInvalidCredentials(err: AuthErrLike): boolean {
  if (!err) return false;
  if (err.code === "invalid_credentials") return true;
  return /invalid login credentials/i.test(err.message ?? "");
}

/**
 * `probe` must attempt a sign-in for the SAME email with a random password
 * that cannot be correct, and return the resulting auth error (or null).
 * Returns true only when GoTrue answers that with invalid credentials,
 * proving it checks the password before the confirmation state.
 */
export async function passwordCheckedBeforeConfirmation(
  probe: () => Promise<AuthErrLike>
): Promise<boolean> {
  try {
    return isInvalidCredentials(await probe());
  } catch {
    return false;
  }
}

/** Safe-to-log summary of an auth error (no credentials, no email). */
export function describeAuthError(err: AuthErrLike): string {
  if (!err) return "none";
  return `code=${err.code ?? "?"} status=${err.status ?? "?"} message=${
    err.message ?? "?"
  }`;
}
