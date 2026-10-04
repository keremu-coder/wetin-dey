import { legalSection } from "@/lib/legal";

export default function DisclaimerPage() {
  const copy = legalSection("Disclaimer");
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-serif text-4xl">Disclaimer</h1>
      <div className="mt-6 space-y-4 text-base leading-relaxed">
        {copy.split("\n\n").map((p) => (
          <p key={p.slice(0, 24)}>{p}</p>
        ))}
      </div>
    </main>
  );
}
