'use client';

import { useState } from 'react';
import { Calendar, Film, Filter } from 'lucide-react';
import { motion } from 'framer-motion';

interface ScheduleFilterProps {
  selectedDate: Date | null;
  onDateChange: (date: Date | null) => void;
  selectedMovie: number | null;
  onMovieChange: (movieId: number | null) => void;
  movies: Array<{ id: number; title: string }>;
}

export default function ScheduleFilter({
  selectedDate,
  onDateChange,
  selectedMovie,
  onMovieChange,
  movies,
}: ScheduleFilterProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleTodayClick = () => {
    onDateChange(new Date());
    setShowDatePicker(false);
  };

  const handleTomorrowClick = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    onDateChange(tomorrow);
    setShowDatePicker(false);
  };

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      onDateChange(new Date(e.target.value));
    } else {
      onDateChange(null);
    }
  };

  // Check if date filter should be shown (if onDateChange is not a no-op function)
  const showDateFilter = onDateChange.toString() !== '() => {}';

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
      <div className="flex flex-col md:flex-row gap-4">
        {/* Date Filter - Only show if date filtering is enabled */}
        {showDateFilter && (
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              Ամսաթիվ
            </label>
            <div className="flex gap-2">
              <button
                onClick={handleTodayClick}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedDate &&
                  selectedDate.toDateString() === new Date().toDateString()
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Այսօր
              </button>
              <button
                onClick={handleTomorrowClick}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedDate &&
                  selectedDate.toDateString() ===
                    new Date(Date.now() + 86400000).toDateString()
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Վաղը
              </button>
              <input
                type="date"
                value={
                  selectedDate ? selectedDate.toISOString().split('T')[0] : ''
                }
                onChange={handleDateInputChange}
                min={new Date().toISOString().split('T')[0]}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        )}

        {/* Movie Filter */}
        <div className={showDateFilter ? 'flex-1' : 'w-full'}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Film className="w-4 h-4 inline mr-2" />
            Ֆիլմ
          </label>
          <select
            value={selectedMovie || ''}
            onChange={(e) =>
              onMovieChange(e.target.value ? Number(e.target.value) : null)
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Բոլոր ֆիլմերը</option>
            {movies.map((movie) => (
              <option key={movie.id} value={movie.id}>
                {movie.title}
              </option>
            ))}
          </select>
        </div>

        {/* Clear Filters */}
        {(showDateFilter ? selectedDate || selectedMovie : selectedMovie) && (
          <div className="flex items-end">
            <button
              onClick={() => {
                if (showDateFilter) {
                  onDateChange(null);
                }
                onMovieChange(null);
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              Մաքրել
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
