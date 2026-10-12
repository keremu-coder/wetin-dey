import Link from "next/link";
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
          Enter your recovery code to sign back into your identity.
        </p>
      </div>

      <RecoverySigninForm />

      <div className="mt-8 rounded-2xl border border-border bg-surface p-4">
        <p className="text-[0.75rem] leading-relaxed text-muted">
          <strong className="text-ink">Don&apos;t have a code?</strong> Every
          new session gets one automatically. Check{" "}
          <Link
            href="/settings/account"
            className="text-brand underline"
          >
            Settings → Account
          </Link>{" "}
          on the device you were last signed in on. If you&apos;ve already
          cleared that device, you can{" "}
          <Link href="/" className="text-brand underline">
            start fresh
          </Link>{" "}
          — but you&apos;ll have a new handle and lose access to any old posts.
        </p>
      </div>

      <p className="mt-8 text-center text-[0.75rem] text-faint">
        <Link href="/" className="hover:text-brand">
          Continue without signing in →
        </Link>
      </p>
    </main>
  );
}