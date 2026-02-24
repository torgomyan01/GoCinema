import { Metadata } from 'next';
import { unstable_noStore } from 'next/cache';
import { notFound } from 'next/navigation';
import MainTemplate from '@/components/layout/main-template/main-template';
import MovieDetailPageClient from '@/components/movies/movie-detail-page-client';
import { getMovieById, getMovieBySlug } from '@/app/actions/movies';

interface MovieDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: MovieDetailPageProps): Promise<Metadata> {
  unstable_noStore();
  const { id } = await params;
  
  const movieId = parseInt(id, 10);
  const result = isNaN(movieId)
    ? await getMovieBySlug(id)
    : await getMovieById(movieId);

  if (!result.success || !result.movie) {
    return {
      title: 'Ֆիլմը չի գտնվել | GoCinema',
    };
  }

  return {
    title: `${result.movie.title} | GoCinema`,
    description: result.movie.description || `${result.movie.title} - ${result.movie.genre}`,
  };
}

export default async function MovieDetailPage({
  params,
}: MovieDetailPageProps) {
  unstable_noStore();
  const { id } = await params;
  
  const movieId = parseInt(id, 10);
  const result = isNaN(movieId)
    ? await getMovieBySlug(id)
    : await getMovieById(movieId);

  if (!result.success || !result.movie) {
    notFound();
  }

  return (
    <MainTemplate>
      <MovieDetailPageClient movie={result.movie} />
    </MainTemplate>
  );
}
