'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Clapperboard,
  Film,
  TicketCheck,
  Wallet,
  ChevronRight,
  CalendarClock,
} from 'lucide-react';
import { SITE_URL } from '@/utils/consts';
import {
  getMyProducedMovies,
  type ProducerMovieListItem,
} from '@/app/actions/producer';

function formatAmd(value: number): string {
  return `${Math.round(value).toLocaleString('hy-AM')} ֏`;
}

export default function ProducerMoviesClient() {
  const [movies, setMovies] = useState<ProducerMovieListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const result = await getMyProducedMovies();
      if (result.success) {
        setMovies(result.movies);
      } else {
        setError(result.error || 'Ֆիլմերը բեռնելիս սխալ է տեղի ունեցել');
      }
      setIsLoading(false);
    };
    void load();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-16">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 text-white shadow-lg">
            <Clapperboard className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              Իմ ֆիլմերը
            </h1>
            <p className="text-sm text-gray-500">
              Ընտրեք ֆիլմը՝ մանրամասն հաշվետվությունը դիտելու համար
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-purple-600" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : movies.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-20 text-center">
            <Film className="mx-auto mb-4 h-14 w-14 text-gray-300" />
            <p className="text-gray-600">
              Ձեզ դեռ ֆիլմ կցված չէ։
            </p>
            <p className="mt-1 text-sm text-gray-400">
              Դիմեք ադմինիստրացիային՝ ձեր ֆիլմերը ձեզ կցելու համար։
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {movies.map((movie, index) => (
              <motion.div
                key={movie.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link
                  href={SITE_URL.PRODUCER_MOVIE(movie.id)}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:border-purple-300 hover:shadow-lg"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
                    {movie.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={movie.image}
                        alt={movie.title}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-300">
                        <Film className="h-12 w-12" />
                      </div>
                    )}
                    {!movie.isActive && (
                      <span className="absolute left-3 top-3 rounded-full bg-gray-900/80 px-2.5 py-1 text-xs font-semibold text-white">
                        Արխիվացված
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="mb-3 line-clamp-1 text-lg font-bold text-gray-900">
                      {movie.title}
                    </h3>

                    <div className="mb-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-purple-50 p-3">
                        <div className="flex items-center gap-1.5 text-xs text-purple-600">
                          <TicketCheck className="h-3.5 w-3.5" />
                          Վաճառված
                        </div>
                        <p className="mt-1 text-lg font-bold text-gray-900">
                          {movie.soldTotal}
                        </p>
                      </div>
                      <div className="rounded-xl bg-emerald-50 p-3">
                        <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                          <Wallet className="h-3.5 w-3.5" />
                          Հասույթ
                        </div>
                        <p className="mt-1 text-lg font-bold text-gray-900">
                          {formatAmd(movie.revenueTotal)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-3">
                      <span className="flex items-center gap-1.5 text-xs text-gray-500">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {movie.screeningsCount} ցուցադրություն
                        {movie.upcomingCount > 0 && (
                          <span className="text-purple-600">
                            ({movie.upcomingCount} առջևում)
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-1 text-sm font-semibold text-purple-600 group-hover:gap-2 transition-all">
                        Հաշվետվություն
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
