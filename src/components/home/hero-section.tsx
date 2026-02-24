'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import {
  Play,
  Calendar,
  Clock,
  Users,
  Film,
  Ticket,
  Sparkles,
  Star,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { SITE_URL } from '@/utils/consts';

interface Particle {
  id: number;
  initialX: number;
  initialY: number;
  targetY: number;
  duration: number;
  delay: number;
}

export default function HeroSection() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Generate particles only on client side
    const generateParticles = () => {
      const width = typeof window !== 'undefined' ? window.innerWidth : 1920;
      const height = typeof window !== 'undefined' ? window.innerHeight : 1080;

      const newParticles: Particle[] = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        initialX: Math.random() * width,
        initialY: Math.random() * height,
        targetY: Math.random() * height,
        duration: Math.random() * 3 + 2,
        delay: Math.random() * 2,
      }));

      setParticles(newParticles);
    };

    generateParticles();
  }, []);
  return (
    <section className="relative min-h-[1600px] lg:min-h-[95vh] flex items-center justify-center overflow-hidden">
      {/* Background Image with Parallax Effect */}
      <div className="absolute inset-0 z-0">
        <motion.div
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          className="absolute inset-0"
        >
          <Image
            src="/images/hero-background.png"
            alt="Cinema background"
            fill
            priority
            className="object-cover"
            quality={90}
          />
        </motion.div>
        {/* Enhanced Dark overlay with gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/70 to-black/60 z-10" />
        {/* Animated gradient overlay */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-transparent to-pink-900/30 z-10"
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%'],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            repeatType: 'reverse',
          }}
        />
        {/* Floating particles effect */}
        {isMounted && (
          <div className="absolute inset-0 z-10 overflow-hidden">
            {particles.map((particle) => (
              <motion.div
                key={particle.id}
                className="absolute w-2 h-2 bg-white/20 rounded-full"
                initial={{
                  x: particle.initialX,
                  y: particle.initialY,
                  opacity: 0,
                }}
                animate={{
                  y: [particle.initialY, particle.targetY],
                  opacity: [0, 0.5, 0],
                }}
                transition={{
                  duration: particle.duration,
                  repeat: Infinity,
                  delay: particle.delay,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="relative z-20 container mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: 'easeOut' }}
        >
          {/* Logo and Title */}
          <motion.div
            className="flex flex-col items-center justify-center gap-6 mb-8"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <motion.div
              whileHover={{ scale: 1.1, rotate: [0, -5, 5, -5, 0] }}
              transition={{ duration: 0.5 }}
            >
              <Image
                src="/images/logo.png"
                alt="GoCinema logo"
                width={180}
                height={180}
                className="drop-shadow-2xl"
              />
            </motion.div>
            <motion.h1
              className="text-6xl md:text-8xl lg:text-9xl font-extrabold text-white mb-4"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-[shimmer_3s_ease-in-out_infinite]">
                GoCinema
              </span>
            </motion.h1>
            <motion.div
              className="flex items-center gap-2 text-yellow-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.8 + i * 0.1 }}
                >
                  <Star className="w-6 h-6 fill-yellow-400" />
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* Subtitle */}
          <motion.p
            className="text-2xl md:text-3xl lg:text-4xl text-gray-100 mb-12 max-w-3xl mx-auto font-light leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            <span className="bg-gradient-to-r from-white via-gray-200 to-white bg-clip-text text-transparent">
              Ձեր կինոփորձը սկսվում է այստեղ
            </span>
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
          >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                href={SITE_URL.MOVIES}
                className="group relative px-10 py-5 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 text-white rounded-2xl font-bold text-xl hover:from-purple-700 hover:via-pink-700 hover:to-purple-700 transition-all duration-300 flex items-center gap-3 shadow-2xl hover:shadow-purple-500/50 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                <Play className="w-6 h-6 relative z-10 group-hover:scale-110 transition-transform" />
                <span className="relative z-10">Դիտել ֆիլմեր</span>
                <ArrowRight className="w-5 h-5 relative z-10 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </Link>
            </motion.div>

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                href={SITE_URL.SCHEDULE}
                className="group px-10 py-5 bg-white/10 backdrop-blur-xl text-white rounded-2xl font-bold text-xl hover:bg-white/20 transition-all duration-300 flex items-center gap-3 border-2 border-white/30 hover:border-white/50 shadow-xl hover:shadow-white/20"
              >
                <Calendar className="w-6 h-6 group-hover:scale-110 transition-transform" />
                <span>Ժամանակացույց</span>
                <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </Link>
            </motion.div>
          </motion.div>

          {/* Enhanced Stats */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1 }}
          >
            {/* Stat Card 1 */}
            <motion.div
              className="group relative bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 hover:border-white/40 transition-all duration-500 overflow-hidden"
              whileHover={{ scale: 1.08, y: -10 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.2 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/30 to-pink-500/30 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl group-hover:bg-purple-500/40 transition-all duration-500" />
              <div className="relative z-10">
                <motion.div
                  className="flex items-center justify-center mb-6"
                  whileHover={{ rotate: [0, -10, 10, -10, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="p-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl shadow-2xl group-hover:shadow-purple-500/50 transition-all duration-300">
                    <Users className="w-10 h-10 text-white" />
                  </div>
                </motion.div>
                <motion.div
                  className="text-6xl font-extrabold mb-3 bg-gradient-to-r from-purple-300 via-pink-300 to-purple-300 bg-clip-text text-transparent bg-[length:200%_auto] animate-[shimmer_3s_ease-in-out_infinite]"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 1.3, type: 'spring', stiffness: 200 }}
                >
                  80
                </motion.div>
                <div className="text-gray-100 font-semibold text-xl mb-2">
                  Հարմարավետ նստատեղեր
                </div>
                <div className="text-gray-300 text-sm">Գլխավոր դահլիճում</div>
              </div>
            </motion.div>

            {/* Stat Card 2 */}
            <motion.div
              className="group relative bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 hover:border-white/40 transition-all duration-500 overflow-hidden"
              whileHover={{ scale: 1.08, y: -10 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.3 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 to-cyan-500/30 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl group-hover:bg-blue-500/40 transition-all duration-500" />
              <div className="relative z-10">
                <motion.div
                  className="flex items-center justify-center mb-6"
                  whileHover={{ rotate: [0, -10, 10, -10, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="p-4 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl shadow-2xl group-hover:shadow-blue-500/50 transition-all duration-300">
                    <Film className="w-10 h-10 text-white" />
                  </div>
                </motion.div>
                <motion.div
                  className="text-6xl font-extrabold mb-3 bg-gradient-to-r from-blue-300 via-cyan-300 to-blue-300 bg-clip-text text-transparent bg-[length:200%_auto] animate-[shimmer_3s_ease-in-out_infinite] flex items-center justify-center gap-2"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 1.4, type: 'spring', stiffness: 200 }}
                >
                  <span>100</span>
                  <motion.div
                    animate={{ rotate: [0, 360] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                  >
                    <Sparkles className="w-8 h-8 text-yellow-400 fill-yellow-400" />
                  </motion.div>
                </motion.div>
                <div className="text-gray-100 font-semibold text-xl mb-2">
                  Ընթացիկ ֆիլմեր
                </div>
                <div className="text-gray-300 text-sm">
                  Ամեն օր նոր ցուցադրություններ
                </div>
              </div>
            </motion.div>

            {/* Stat Card 3 */}
            <motion.div
              className="group relative bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 hover:border-white/40 transition-all duration-500 overflow-hidden"
              whileHover={{ scale: 1.08, y: -10 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.4 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/30 to-emerald-500/30 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/20 rounded-full blur-3xl group-hover:bg-green-500/40 transition-all duration-500" />
              <div className="relative z-10">
                <motion.div
                  className="flex items-center justify-center mb-6"
                  whileHover={{ rotate: [0, -10, 10, -10, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="p-4 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl shadow-2xl group-hover:shadow-green-500/50 transition-all duration-300">
                    <Ticket className="w-10 h-10 text-white" />
                  </div>
                </motion.div>
                <motion.div
                  className="text-6xl font-extrabold mb-3 bg-gradient-to-r from-green-300 via-emerald-300 to-green-300 bg-clip-text text-transparent bg-[length:200%_auto] animate-[shimmer_3s_ease-in-out_infinite]"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 1.5, type: 'spring', stiffness: 200 }}
                >
                  24/7
                </motion.div>
                <div className="text-gray-100 font-semibold text-xl mb-2">
                  Առցանց ամրագրում
                </div>
                <div className="text-gray-300 text-sm">Ամեն ժամ, ամեն օր</div>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>

      {/* Enhanced Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6 }}
      >
        <motion.div
          animate={{ y: [0, 12, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          className="flex flex-col items-center gap-2 cursor-pointer"
        >
          <div className="w-6 h-10 border-2 border-white/60 rounded-full flex justify-center backdrop-blur-sm bg-white/5">
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="w-1.5 h-3 bg-white/80 rounded-full mt-2"
            />
          </div>
          <span className="text-white/60 text-xs font-medium">Scroll</span>
        </motion.div>
      </motion.div>

      {/* Add shimmer animation */}
      <style jsx>{`
        @keyframes shimmer {
          0% {
            background-position: -200% center;
          }
          100% {
            background-position: 200% center;
          }
        }
      `}</style>
    </section>
  );
}
