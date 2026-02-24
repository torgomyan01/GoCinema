import MainTemplate from '@/components/layout/main-template/main-template';
import MoviesList from '@/components/movies/movies-list';
import { Metadata } from 'next';
import { unstable_noStore } from 'next/cache';
import { getMovies } from '@/app/actions/movies';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Ֆիլմեր - GoCinema',
  description: 'Դիտեք բոլոր ընթացիկ ֆիլմերը և ամրագրեք տոմսեր',
};

export default async function MoviesPage() {
  unstable_noStore();

  // Fetch movies from database
  const moviesResult = await getMovies();
  const movies = moviesResult.success && moviesResult.movies
    ? moviesResult.movies.filter((movie: any) => movie.isActive !== false)
    : [];

  // Extract unique genres from movies
  const genresSet = new Set<string>();
  movies.forEach((movie: any) => {
    if (movie.genre) {
      // Handle comma-separated genres
      movie.genre.split(',').forEach((g: string) => {
        const trimmed = g.trim();
        if (trimmed) {
          genresSet.add(trimmed);
        }
      });
    }
  });
  const genres = Array.from(genresSet).sort();

  return (
    <MainTemplate>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pt-24 pb-20">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-4">
              Բոլոր ֆիլմերը
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Ընտրեք ձեր սիրած ֆիլմը և ամրագրեք տոմսեր
            </p>
          </div>

          {/* Movies List with Filter */}
          <MoviesList movies={movies as any} genres={genres} />
        </div>
      </div>
    </MainTemplate>
  );
}
