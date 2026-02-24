'use client';

import { useState } from 'react';
import { Search, Filter, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MoviesFilterProps {
  genres: string[];
  selectedGenre: string | null;
  onGenreChange: (genre: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export default function MoviesFilter({
  genres,
  selectedGenre,
  onGenreChange,
  searchQuery,
  onSearchChange,
}: MoviesFilterProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Փնտրել ֆիլմ..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Genre Filter */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => onGenreChange(null)}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            selectedGenre === null
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Բոլորը
        </button>
        {genres.map((genre) => (
          <button
            key={genre}
            onClick={() => onGenreChange(genre)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              selectedGenre === genre
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {genre}
          </button>
        ))}
      </div>
    </div>
  );
}
