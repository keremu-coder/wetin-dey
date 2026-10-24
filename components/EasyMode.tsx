"use client";
import { useEffect, useState } from "react";
const KEY = "wd_easy";
function apply(on: boolean) { try { const root = document.documentElement; if (on) root.setAttribute("data-easy", "1"); else root.removeAttribute("data-easy"); } catch {} }
export function EasyModeInit() { useEffect(() => { try { apply(localStorage.getItem(KEY) === "1"); } catch {} }, []); return null; }
export function EasyModeToggle() {
  const [on, setOn] = useState(false);
  useEffect(() => { try { setOn(localStorage.getItem(KEY) === "1"); } catch {} }, []);
  function flip() { const next = !on; setOn(next); try { localStorage.setItem(KEY, next ? "1" : "0"); } catch {} apply(next); }
  return (<button type="button" onClick={flip} aria-pressed={on} className="flex w-full items-center justify-between gap-3 text-left"><span><span className="block text-[0.9375rem] font-semibold text-ink">Easy mode</span><span className="block text-[0.75rem] text-muted">Bigger text everywhere</span></span><span className={"rounded-full px-4 py-2 text-[0.8125rem] font-semibold " + (on ? "bg-brand text-white" : "bg-ink/10 text-ink")}>{on ? "On" : "Off"}</span></button>);
}