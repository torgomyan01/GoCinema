'use client';

import Link from 'next/link';
import {
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Clapperboard,
  Megaphone,
  Sparkles,
  Type,
} from 'lucide-react';
import { SMM_TOOLS } from '@/config/smm-tools';

const TOOL_ICONS: Record<string, typeof CalendarClock> = {
  schedule: CalendarClock,
  movie: Clapperboard,
  today: CalendarDays,
  premiere: Sparkles,
  caption: Type,
};

export default function AdminSmmClient() {
  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-lg bg-fuchsia-100 p-2">
          <Megaphone className="h-6 w-6 text-fuchsia-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SMM</h1>
          <p className="text-sm text-gray-600">
            Նկարների գեներացիա և այլ գործիքներ սոցիալական ցանցերի համար
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SMM_TOOLS.map((tool) => {
          const Icon = TOOL_ICONS[tool.id] ?? Megaphone;
          return (
            <Link
              key={tool.id}
              href={tool.href}
              className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-fuchsia-200 hover:shadow-md"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="rounded-xl bg-fuchsia-50 p-2.5 text-fuchsia-700">
                  <Icon className="h-6 w-6" />
                </div>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600">
                  {tool.badge}
                </span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
                {tool.title}
              </h2>
              <p className="mt-1 flex-1 text-sm text-gray-600">
                {tool.description}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-fuchsia-700">
                Բացել
                <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
