import { readFileSync } from "fs";
import path from "path";

function section(title: string, markdown: string): string {
  const parts = markdown.split(/^## /m);
  const found = parts.find((p) => p.startsWith(title));
  if (!found) return markdown.trim();
  return found.replace(title, "").trim();
}

const legal = readFileSync(path.join(process.cwd(), "docs", "LEGAL.md"), "utf8");

export function legalSection(title: string): string {
  return section(title, legal);
}
