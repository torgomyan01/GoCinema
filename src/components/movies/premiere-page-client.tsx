'use client';

import { motion } from 'framer-motion';
import { Calendar, Clock, Film, Star, Sparkles } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { SITE_URL } from '@/utils/consts';

interface Premiere {
  id: number;
  premiereDate: Date | string;
  description?: string | null;
  isActive: boolean;
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
}

interface PremierePageClientProps {
  premieres: Premiere[];
}

export default function PremierePageClient({ premieres }: PremierePageClientProps) {
  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const weekdays = [
      'կիրակի', 'երկուշաբթի', 'երեքշաբթի', 'չորեքշաբթի',
      'հինգշաբթի', 'ուրբաթ', 'շաբաթ',
    ];
    const months = [
      'հունվար', 'փետրվար', 'մարտ', 'ապրիլ', 'մայիս', 'հունիս', 'հուլիս',
      'օգոստոս', 'սեպտեմբեր', 'հոկտեմբեր', 'նոյեմբեր', 'դեկտեմբեր',
    ];
    return `${weekdays[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

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

  const getDaysUntilPremiere = (date: Date | string) => {
    const premiereDate = typeof date === 'string' ? new Date(date) : date;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    premiereDate.setHours(0, 0, 0, 0);
    const diffTime = premiereDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pt-24 pb-20">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center justify-center mb-4"
          >
            <div className="p-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl shadow-lg">
              <Sparkles className="w-12 h-12 text-white" />
            </div>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-6xl font-bold text-gray-900 mb-4"
          >
            Պրեմիերաներ
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl text-gray-600 max-w-2xl mx-auto"
          >
            Նոր ֆիլմերի պրեմիերաներ, որոնք շուտով կցուցադրվեն GoCinema-ում
          </motion.p>
        </div>

        {/* Premieres List */}
        {premieres.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <Film className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              Պրեմիերաներ դեռ չկան:
            </p>
          </motion.div>
        ) : (
          <div className="max-w-6xl mx-auto space-y-8">
            {premieres.map((premiere, index) => {
              const daysUntil = getDaysUntilPremiere(premiere.premiereDate);
              const movieUrl = SITE_URL.MOVIE_DETAIL(premiere.movie.slug || premiere.movie.id);

              return (
                <motion.div
                  key={premiere.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 hover:shadow-xl transition-shadow"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
                    {/* Movie Image */}
                    <div className="relative h-64 md:h-full min-h-[300px] rounded-lg overflow-hidden bg-gray-200">
                      {premiere.movie.image ? (
                        <Image
                          src={premiere.movie.image}
                          alt={premiere.movie.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-400 to-pink-400">
                          <Film className="w-16 h-16 text-white opacity-50" />
                        </div>
                      )}
                      {/* Premiere Badge */}
                      <div className="absolute top-4 right-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-full font-semibold text-sm flex items-center gap-2 shadow-lg">
                        <Sparkles className="w-4 h-4" />
                        Պրեմիերա
                      </div>
                    </div>

                    {/* Movie Info */}
                    <div className="md:col-span-2 flex flex-col justify-between">
                      <div>
                        <Link href={movieUrl}>
                          <h2 className="text-3xl font-bold text-gray-900 mb-3 hover:text-purple-600 transition-colors">
                            {premiere.movie.title}
                          </h2>
                        </Link>

                        {/* Movie Details */}
                        <div className="flex flex-wrap gap-4 mb-4 text-gray-600">
                          {premiere.movie.genre && (
                            <div className="flex items-center gap-2">
                              <Film className="w-4 h-4" />
                              <span>{premiere.movie.genre.split(',')[0].trim()}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>{formatDuration(premiere.movie.duration)}</span>
                          </div>
                          {premiere.movie.rating && (
                            <div className="flex items-center gap-2">
                              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                              <span>{premiere.movie.rating.toFixed(1)}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>{formatReleaseDate(premiere.movie.releaseDate)}</span>
                          </div>
                        </div>

                        {/* Premiere Date */}
                        <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                          <div className="flex items-center gap-2 text-purple-700 font-semibold mb-1">
                            <Calendar className="w-5 h-5" />
                            Պրեմիերայի ամսաթիվ
                          </div>
                          <div className="text-2xl font-bold text-gray-900">
                            {formatDate(premiere.premiereDate)}
                          </div>
                          {daysUntil > 0 && (
                            <div className="text-sm text-gray-600 mt-2">
                              {daysUntil === 1
                                ? 'Վաղը'
                                : daysUntil <= 7
                                  ? `${daysUntil} օր հետո`
                                  : `${Math.ceil(daysUntil / 7)} շաբաթ հետո`}
                            </div>
                          )}
                        </div>

                        {/* Description */}
                        {premiere.description && (
                          <p className="text-gray-700 mb-4 leading-relaxed">
                            {premiere.description}
                          </p>
                        )}
                      </div>

                      {/* Action Button */}
                      <Link href={movieUrl}>
                        <button className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl">
                          Իմանալ ավելին
                        </button>
                      </Link>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
