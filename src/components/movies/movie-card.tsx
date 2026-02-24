'use client';

import { motion } from 'framer-motion';
import { Calendar, Clock, Star, Film } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { SITE_URL } from '@/utils/consts';

interface MovieCardProps {
  movie: {
    id: number;
    title: string;
    slug?: string | null;
    image?: string | null;
    duration: number;
    rating?: number | null;
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
    >
      <Link href={movieUrl}>
        <div className="group bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 h-full flex flex-col">
          {/* Image */}
          <div className="relative h-96 overflow-hidden bg-gray-200">
            {movie.image ? (
              <Image
                src={movie.image}
                alt={movie.title}
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-500"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100">
                <Film className="w-20 h-20 text-purple-300" />
              </div>
            )}

            {/* Gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            {/* Rating badge */}
            {movie.rating && (
              <div className="absolute top-4 right-4 bg-yellow-400 text-gray-900 px-3 py-1.5 rounded-full flex items-center gap-1.5 font-bold text-sm shadow-lg z-10">
                <Star className="w-4 h-4 fill-current" />
                {movie.rating.toFixed(1)}
              </div>
            )}

            {/* Genre badge */}
            {movie.genre && (
              <div className="absolute top-4 left-4 bg-purple-600 text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg z-10">
                {movie.genre.split(',')[0].trim()}
              </div>
            )}

            {/* Hover overlay content */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
              <div className="text-center text-white px-4">
                <p className="text-lg font-semibold mb-2">Դիտել մանրամասներ</p>
                <div className="w-16 h-1 bg-white mx-auto rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 flex-1 flex flex-col">
            <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-purple-600 transition-colors line-clamp-2 min-h-[3.5rem]">
              {movie.title}
            </h3>

            <div className="flex items-center gap-4 text-sm text-gray-600 mb-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-purple-500" />
                <span>{formatDuration(movie.duration)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-purple-500" />
                <span>{formatReleaseDate(movie.releaseDate)}</span>
              </div>
            </div>

            <div className="mt-auto">
              <button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all duration-300 shadow-md hover:shadow-lg">
                Ամրագրել տոմս
              </button>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
