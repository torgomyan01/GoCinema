'use client';

import { motion } from 'framer-motion';
import { Calendar, Clock, Star, Film, Ticket, Eye } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { SITE_URL } from '@/utils/consts';
import { ageRatingClasses } from '@/lib/age-rating';

interface MovieCardProps {
  movie: {
    id: number;
    title: string;
    slug?: string | null;
    image?: string | null;
    duration: number;
    rating?: number | null;
    ageRating?: string | null;
    genre?: string | null;
    releaseDate: Date | string;
  };
  index?: number;
}

export default function MovieCard({ movie, index = 0 }: MovieCardProps) {
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}ժ ${mins}ր`;
    }
    return `${mins}ր`;
  };

  const formatReleaseDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.getFullYear().toString();
  };

  const movieUrl = SITE_URL.MOVIE_DETAIL(movie.slug || movie.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      className="h-full"
    >
      <Link href={movieUrl} className="block h-full">
        <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-gray-100 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:ring-purple-200">
          {/* Poster */}
          <div className="relative aspect-2/3 overflow-hidden bg-gray-100">
            {movie.image ? (
              <Image
                src={movie.image}
                alt={movie.title}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-110"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-purple-100 to-pink-100">
                <Film className="h-20 w-20 text-purple-300" />
              </div>
            )}

            {/* Permanent bottom gradient for title legibility */}
            <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent" />

            {/* Hover darken */}
            <div className="absolute inset-0 bg-black/30 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            {/* Top badges */}
            <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
              <div className="flex flex-col items-start gap-2">
                {movie.genre && (
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white shadow-lg ring-1 ring-white/25 backdrop-blur-md">
                    {movie.genre.split(',')[0].trim()}
                  </span>
                )}
                {movie.ageRating && (
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold shadow-lg ${ageRatingClasses(
                      movie.ageRating
                    )}`}
                  >
                    {movie.ageRating}
                  </span>
                )}
              </div>

              {movie.rating ? (
                <span className="flex items-center gap-1 rounded-full bg-yellow-400/95 px-2.5 py-1 text-sm font-bold text-gray-900 shadow-lg">
                  <Star className="h-3.5 w-3.5 fill-current" />
                  {movie.rating.toFixed(1)}
                </span>
              ) : null}
            </div>

            {/* Hover CTA */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <span className="flex translate-y-2 items-center gap-2 rounded-full bg-white/95 px-5 py-2.5 text-sm font-semibold text-gray-900 shadow-xl backdrop-blur-md transition-transform duration-300 group-hover:translate-y-0">
                <Eye className="h-4 w-4" />
                Դիտել մանրամասներ
              </span>
            </div>

            {/* Title + meta over poster */}
            <div className="absolute inset-x-0 bottom-0 p-4">
              <h3 className="line-clamp-2 text-lg font-bold leading-tight text-white drop-shadow-md">
                {movie.title}
              </h3>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-white/85">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDuration(movie.duration)}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatReleaseDate(movie.releaseDate)}
                </span>
              </div>
            </div>
          </div>

          {/* Booking button */}
          <div className="p-3">
            <span className="flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-purple-600 to-pink-600 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-300 group-hover:shadow-lg group-hover:brightness-110">
              <Ticket className="h-4 w-4" />
              Ամրագրել տոմս
            </span>
          </div>
        </article>
      </Link>
    </motion.div>
  );
}
