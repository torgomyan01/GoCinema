'use client';

import { useState, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Autoplay } from 'swiper/modules';
import { motion } from 'framer-motion';
import { AlertCircle, Film, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import MovieCard from '@/components/movies/movie-card';
import { getMovies } from '@/app/actions/movies';
import { SITE_URL } from '@/utils/consts';

interface Movie {
  id: number;
  title: string;
  slug?: string | null;
  image?: string | null;
  duration: number;
  genre?: string | null;
  releaseDate: Date | string;
  isActive?: boolean;
}

export default function MoviesSection() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMovies = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getMovies();
        if (result.success && result.movies) {
          const activeMovies = (result.movies as Movie[]).filter(
            (movie) => movie.isActive !== false
          );
          setMovies(activeMovies);
        } else {
          setError(result.error || 'Ֆիլմերը բեռնելիս սխալ է տեղի ունեցել');
        }
      } catch (err) {
        console.error('Error loading movies:', err);
        setError('Ֆիլմերը բեռնելիս սխալ է տեղի ունեցել');
      } finally {
        setLoading(false);
      }
    };

    loadMovies();
  }, []);

  return (
    <section className="relative overflow-hidden bg-[#0b0b0b] py-16 sm:py-20 lg:py-24">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
      <div className="pointer-events-none absolute -right-24 top-20 h-96 w-96 rounded-full bg-red-600/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 bottom-10 h-96 w-96 rounded-full bg-yellow-500/10 blur-3xl" />

      <div className="relative container mx-auto px-4">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 sm:gap-6 mb-8 sm:mb-12"
        >
          <div>
            <div className="inline-flex items-center gap-2 mb-3 sm:mb-4">
              <span className="h-px w-8 bg-red-500" />
              <span className="text-xs font-black uppercase tracking-[0.2em] text-red-400 sm:text-sm sm:tracking-[0.24em]">
                Now showing
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-6xl font-black text-white tracking-tight">
              Մոտակա ֆիլմերը
            </h2>
            <p className="text-base sm:text-lg text-neutral-400 mt-2 sm:mt-3 max-w-xl">
              Թարմ ֆիլմեր, հարմար ժամեր և արագ անցում դեպի ամրագրում։
            </p>
          </div>

          <Link
            href={SITE_URL.MOVIES}
            className="group hidden md:inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/15 text-white font-bold hover:border-red-500 hover:bg-red-500 transition-all duration-300 shrink-0"
          >
            Բոլոր ֆիլմերը
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>

        {/* Body */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="rounded-3xl bg-white/8 animate-pulse h-[26rem] sm:h-[30rem] lg:h-[34rem]"
              />
            ))}
          </div>
        ) : error || movies.length === 0 ? (
          <div className="text-center py-16 rounded-3xl bg-white/5 border border-white/10">
            <AlertCircle className="w-14 h-14 text-neutral-500 mx-auto mb-4" />
            <p className="text-xl text-neutral-300">
              {error || 'Ֆիլմեր չեն գտնվել'}
            </p>
          </div>
        ) : (
          <Swiper
            modules={[Navigation, Autoplay]}
            spaceBetween={16}
            slidesPerView={1.15}
            breakpoints={{
              480: { slidesPerView: 1.35, spaceBetween: 20 },
              640: { slidesPerView: 2, spaceBetween: 24 },
              768: { slidesPerView: 2.5, spaceBetween: 24 },
              1024: { slidesPerView: 4, spaceBetween: 28 },
            }}
            navigation
            autoplay={{ delay: 3500, disableOnInteraction: false }}
            className="movies-swiper !pb-2 -mx-1 px-1! pt-2!"
          >
            {movies.map((movie, index) => (
              <SwiperSlide key={movie.id} className="!h-auto pb-4">
                <MovieCard movie={movie} index={index} />
              </SwiperSlide>
            ))}
          </Swiper>
        )}

        {/* Mobile view-all */}
        <div className="mt-10 text-center md:hidden">
          <Link
            href={SITE_URL.MOVIES}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-red-600 text-white font-bold shadow-lg shadow-red-950/40"
          >
            <Film className="w-5 h-5" />
            Բոլոր ֆիլմերը
          </Link>
        </div>
      </div>

      <style jsx global>{`
        .movies-swiper .swiper-button-next,
        .movies-swiper .swiper-button-prev {
          color: #fff;
          background: #dc2626;
          width: 40px;
          height: 40px;
          border-radius: 9999px;
          box-shadow: 0 10px 25px -5px rgba(220, 38, 38, 0.45);
          top: 38%;
        }
        .movies-swiper .swiper-button-next:after,
        .movies-swiper .swiper-button-prev:after {
          font-size: 16px;
          font-weight: 700;
        }
        @media (max-width: 767px) {
          .movies-swiper .swiper-button-next,
          .movies-swiper .swiper-button-prev {
            display: none;
          }
        }
        @media (min-width: 768px) {
          .movies-swiper .swiper-button-next,
          .movies-swiper .swiper-button-prev {
            width: 46px;
            height: 46px;
            top: 42%;
          }
          .movies-swiper .swiper-button-next:after,
          .movies-swiper .swiper-button-prev:after {
            font-size: 18px;
          }
        }
      `}</style>
    </section>
  );
}
