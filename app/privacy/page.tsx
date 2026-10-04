import { legalSection } from "@/lib/legal";

export default function PrivacyPage() {
  const copy = legalSection("Privacy");
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-serif text-4xl">Privacy</h1>
      <div className="mt-6 space-y-4 text-base leading-relaxed">
        {copy.split("\n\n").map((p) => (
          <p key={p.slice(0, 24)}>{p}</p>
        ))}
      </div>
    </main>
  );
}
