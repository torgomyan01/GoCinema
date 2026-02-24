'use client';

type TicketStatus = 'all' | 'reserved' | 'paid' | 'used' | 'cancelled';

interface TicketsFilterProps {
  selectedStatus: TicketStatus;
  onStatusChange: (status: TicketStatus) => void;
  statusCounts?: {
    all: number;
    reserved: number;
    paid: number;
    used: number;
    cancelled: number;
  };
}

const statusOptions: Array<{ value: TicketStatus; label: string }> = [
  { value: 'all', label: 'Բոլորը' },
  { value: 'reserved', label: 'Ամրագրված' },
  { value: 'paid', label: 'Վճարված' },
  { value: 'used', label: 'Օգտագործված' },
  { value: 'cancelled', label: 'Չեղարկված' },
];

export default function TicketsFilter({
  selectedStatus,
  onStatusChange,
  statusCounts,
}: TicketsFilterProps) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
      <div className="flex flex-wrap gap-3">
        {statusOptions.map((option) => {
          const count = statusCounts?.[option.value];
          return (
            <button
              key={option.value}
              onClick={() => onStatusChange(option.value)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedStatus === option.value
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {option.label}
              {count !== undefined && (
                <span className="ml-2 text-sm opacity-75">({count})</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
