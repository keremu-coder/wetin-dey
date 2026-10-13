import Link from "next/link";
import { EmailSigninForm } from "@/components/EmailSigninForm";
import { RecoverySigninForm } from "@/components/RecoverySigninForm";

export const dynamic = "force-dynamic";

export default function SigninPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-8 pb-24">
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-brand" />
          <span className="font-serif text-[1.6rem] font-semibold tracking-tight text-ink">
            Wetin Dey
          </span>
        </div>
        <p className="mt-2 text-[0.875rem] leading-relaxed text-muted">
          Sign back into your account.
        </p>
      </div>

      <EmailSigninForm />

      <p className="mt-4 text-center text-[0.8125rem] text-muted">
        New here?{" "}
        <Link href="/join" className="font-semibold text-brand hover:underline">
          Create an account
        </Link>
      </p>

      <details className="mt-8 rounded-2xl border border-border bg-surface p-4">
        <summary className="cursor-pointer text-[0.8125rem] font-medium text-muted hover:text-ink">
          Have a recovery code instead?
        </summary>
        <div className="mt-4">
          <RecoverySigninForm />
        </div>
      </details>

      <p className="mt-8 text-center text-[0.75rem] text-faint">
        <Link href="/" className="hover:text-brand">
          Continue without signing in →
        </Link>
      </p>
    </main>
  );
}