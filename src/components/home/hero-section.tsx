'use client';

import { motion, type Transition } from 'framer-motion';
import { Play, Calendar, Users, Film, Ticket, Star, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { SITE_URL } from '@/utils/consts';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: 'easeOut' } as Transition,
});

const STATS = [
  {
    icon: Users,
    value: '80',
    label: 'Հարմարավետ նստատեղ',
    sub: 'Գլխավոր դահլիճում',
    color: 'from-purple-500 to-pink-500',
    glow: 'group-hover:shadow-purple-500/40',
  },
  {
    icon: Film,
    value: '100+',
    label: 'Ընթացիկ ֆիլմ',
    sub: 'Ամեն օր նոր ցուցադրություններ',
    color: 'from-blue-500 to-cyan-500',
    glow: 'group-hover:shadow-blue-500/40',
  },
  {
    icon: Ticket,
    value: '24/7',
    label: 'Առցանց ամրագրում',
    sub: 'Ամեն ժամ, ամեն օր',
    color: 'from-violet-500 to-purple-600',
    glow: 'group-hover:shadow-violet-500/40',
  },
];

export default function HeroSection() {
  return (
    <section className="relative min-h-[1600px] lg:min-h-[95vh] flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <motion.div
          initial={{ scale: 1.06, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          className="absolute inset-0"
        >
          <Image
            src="/images/hero-background.png"
            alt="Cinema background"
            fill
            priority
            className="object-cover"
            quality={85}
          />
        </motion.div>

        {/* Overlays — pure CSS, zero JS cost */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/60 to-black/80 z-10" />
        <div className="absolute inset-0 bg-gradient-to-br from-purple-950/40 via-transparent to-pink-950/30 z-10" />

        {/* Static decorative orbs — CSS only */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none z-10" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-pink-600/15 rounded-full blur-3xl pointer-events-none z-10" />
      </div>

      {/* Content */}
      <div className="relative z-20 container mx-auto px-4 text-center">

        {/* Title block */}
        <motion.div
          className="flex flex-col items-center gap-5 mb-8"
          {...fadeUp(0.1)}
        >
          {/* Stars */}
          <div className="flex items-center gap-1.5">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + i * 0.07, duration: 0.35, ease: 'backOut' }}
              >
                <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
              </motion.div>
            ))}
          </div>

          <motion.h1
            className="text-6xl md:text-8xl lg:text-9xl font-extrabold leading-none"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease: 'easeOut' }}
          >
            <span className="hero-title-gradient">GoCinema</span>
          </motion.h1>

          {/* Thin accent line */}
          <motion.div
            className="h-px w-32 bg-gradient-to-r from-transparent via-purple-400 to-transparent"
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.55 }}
          />
        </motion.div>

        {/* Subtitle */}
        <motion.p
          className="text-xl md:text-2xl lg:text-3xl text-gray-200 mb-12 max-w-2xl mx-auto font-light leading-relaxed tracking-wide"
          {...fadeUp(0.45)}
        >
          Ձեր կինոփորձը սկսվում է այստեղ
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16"
          {...fadeUp(0.6)}
        >
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
            <Link
              href={SITE_URL.MOVIES}
              className="group relative px-9 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-2xl font-bold text-lg flex items-center gap-3 shadow-lg shadow-purple-700/30 hover:shadow-purple-500/50 transition-shadow duration-300 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <Play className="w-5 h-5 relative z-10" />
              <span className="relative z-10">Դիտել ֆիլմեր</span>
              <ArrowRight className="w-4 h-4 relative z-10 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
            </Link>
          </motion.div>

          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
            <Link
              href={SITE_URL.SCHEDULE}
              className="group px-9 py-4 bg-white/10 text-white rounded-2xl font-bold text-lg flex items-center gap-3 border border-white/25 hover:bg-white/18 hover:border-white/40 transition-all duration-200"
            >
              <Calendar className="w-5 h-5" />
              <span>Ժամանակացույց</span>
              <ArrowRight className="w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
            </Link>
          </motion.div>
        </motion.div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              className="group relative bg-white/8 backdrop-blur-md rounded-2xl p-7 border border-white/15 hover:border-white/30 transition-all duration-300 overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.75 + i * 0.1, ease: 'easeOut' }}
              whileHover={{ y: -6 }}
            >
              {/* Hover glow */}
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300 rounded-2xl`} />

              <div className="relative z-10 flex flex-col items-center text-center">
                {/* Icon */}
                <div className={`mb-5 p-3.5 bg-gradient-to-br ${stat.color} rounded-xl shadow-lg ${stat.glow} transition-shadow duration-300`}>
                  <stat.icon className="w-8 h-8 text-white" />
                </div>

                {/* Value */}
                <div className="text-5xl font-extrabold text-white mb-2 tracking-tight">
                  {stat.value}
                </div>

                {/* Label */}
                <div className="text-gray-100 font-semibold text-base mb-1">
                  {stat.label}
                </div>
                <div className="text-gray-400 text-sm">{stat.sub}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.3 }}
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="w-5 h-9 border border-white/40 rounded-full flex justify-center pt-1.5"
        >
          <div className="w-1 h-2.5 bg-white/60 rounded-full" />
        </motion.div>
        <span className="text-white/40 text-xs tracking-widest uppercase">Scroll</span>
      </motion.div>

      <style jsx>{`
        .hero-title-gradient {
          background: linear-gradient(135deg, #c084fc 0%, #f472b6 50%, #a855f7 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>
    </section>
  );
}
