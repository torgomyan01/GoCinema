'use client';

import { useState, useMemo } from 'react';
import MovieCard from './movie-card';
import MoviesFilter from './movies-filter';

interface Movie {
  id: number;
  title: string;
  slug?: string | null;
  image?: string | null;
  duration: number;
  rating?: number | null;
  genre?: string | null;
  releaseDate: Date | string;
}

interface MoviesListProps {
  movies: Movie[];
  genres: string[];
}

export default function MoviesList({ movies, genres }: MoviesListProps) {
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMovies = useMemo(() => {
    return movies.filter((movie) => {
      // Check if movie genre matches selected genre
      // Handle comma-separated genres
      const movieGenres = movie.genre
        ? movie.genre.split(',').map((g: string) => g.trim())
        : [];
      const matchesGenre =
        selectedGenre === null ||
        movieGenres.some((g: string) => g === selectedGenre);

      // Check if movie title matches search query
      const matchesSearch =
        searchQuery === '' ||
        movie.title.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesGenre && matchesSearch;
    });
  }, [movies, selectedGenre, searchQuery]);

  return (
    <>
      <MoviesFilter
        genres={genres}
        selectedGenre={selectedGenre}
        onGenreChange={setSelectedGenre}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Movies Grid */}
      {filteredMovies.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredMovies.map((movie, index) => (
            <MovieCard key={movie.id} movie={movie} index={index} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-xl text-gray-600 mb-4">Ֆիլմեր չեն գտնվել</p>
          <p className="text-gray-500">Փորձեք փոխել որոնման պարամետրերը</p>
        </div>
      )}
    </>
  );
}
