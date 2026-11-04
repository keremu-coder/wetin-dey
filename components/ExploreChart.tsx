"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

export function ExploreChart({
  byVolume,
  byNaira,
  byWeek
}: {
  byVolume: { agency: string; count: number }[];
  byNaira: { agency: string; naira: number }[];
  byWeek: { week: string; count: number }[];
}) {
  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-3 font-serif text-2xl">Agencies wey people report pass</h2>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byVolume} layout="vertical" margin={{ left: 16, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="agency" width={140} />
              <Tooltip />
              <Bar dataKey="count" fill="#1f7a4d" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-2 flex flex-wrap gap-2 text-sm">
          {byVolume.map((r) => (
            <li key={r.agency}>
              <Link className="underline" href={`/?agency=${encodeURIComponent(r.agency)}`}>
                {r.agency} ({r.count})
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 font-serif text-2xl">Agencies wey demand money pass</h2>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byNaira} layout="vertical" margin={{ left: 16, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="agency" width={140} />
              <Tooltip />
              <Bar dataKey="naira" fill="#1f7a4d" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-2 flex flex-wrap gap-2 text-sm">
          {byNaira.map((r) => (
            <li key={r.agency}>
              <Link className="underline" href={`/?agency=${encodeURIComponent(r.agency)}`}>
                {r.agency} (₦{r.naira.toLocaleString("en-NG")})
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 font-serif text-2xl">Reports per week (last 12 weeks)</h2>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={byWeek}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#1f7a4d" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
