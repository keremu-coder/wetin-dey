import type { LabelHTMLAttributes } from "react";
import { cn } from "./cn";

export function Label(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label {...props} className={cn("mb-1 block text-sm font-medium", props.className)} />;
}
