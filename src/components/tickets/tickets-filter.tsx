'use client';

import type { TicketsViewFilter } from './ticket-types';

interface TicketsFilterProps {
  selectedFilter: TicketsViewFilter;
  onFilterChange: (filter: TicketsViewFilter) => void;
  counts?: {
    upcoming: number;
    past: number;
    cancelled: number;
  };
}

const filterOptions: Array<{ value: TicketsViewFilter; label: string }> = [
  { value: 'upcoming', label: 'Առաջիկա' },
  { value: 'past', label: 'Անցյալ' },
  { value: 'cancelled', label: 'Չեղարկված' },
];

export default function TicketsFilter({
  selectedFilter,
  onFilterChange,
  counts,
}: TicketsFilterProps) {
  return (
    <div className="mb-6 rounded-xl border border-gray-100 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-wrap gap-2">
        {filterOptions.map((option) => {
          const count = counts?.[option.value];
          const active = selectedFilter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onFilterChange(option.value)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                active
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {option.label}
              {count !== undefined && (
                <span className="ml-1.5 text-xs opacity-80">({count})</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
