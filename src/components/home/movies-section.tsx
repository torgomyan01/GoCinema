'use client';

import { useState, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Autoplay } from 'swiper/modules';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import MovieCard from '@/components/movies/movie-card';
import { getMovies } from '@/app/actions/movies';

interface Movie {
  id: number;
  title: string;
  slug?: string | null;
  image?: string | null;
  duration: number;
  rating?: number | null;
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
          // Filter only active movies
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

  if (loading) {
    return (
      <section className="py-20 bg-gradient-to-b from-slate-50 to-white">
        <div className="container mx-auto px-4">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Բեռնվում է...</p>
          </div>
        </div>
      </section>
    );
  }

  if (error || movies.length === 0) {
    return (
      <section className="py-20 bg-gradient-to-b from-slate-50 to-white">
        <div className="container mx-auto px-4">
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-xl text-gray-600">
              {error || 'Ֆիլմեր չեն գտնվել'}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Ընթացիկ ֆիլմեր
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Ընտրեք ձեր սիրած ֆիլմը և ամրագրեք տոմսեր
          </p>
        </motion.div>

        <Swiper
          modules={[Navigation, Autoplay]}
          spaceBetween={30}
          slidesPerView={1}
          breakpoints={{
            640: {
              slidesPerView: 2,
            },
            768: {
              slidesPerView: 3,
            },
            1024: {
              slidesPerView: 4,
            },
          }}
          navigation
          autoplay={{
            delay: 3000,
            disableOnInteraction: false,
          }}
          className="movies-swiper"
        >
          {movies.map((movie, index) => (
            <SwiperSlide key={movie.id}>
              <MovieCard movie={movie} index={index} />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      <style jsx global>{`
        .movies-swiper .swiper-button-next,
        .movies-swiper .swiper-button-prev {
          color: #9333ea;
          background: white;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .movies-swiper .swiper-button-next:after,
        .movies-swiper .swiper-button-prev:after {
          font-size: 20px;
        }
      `}</style>
    </section>
  );
}
