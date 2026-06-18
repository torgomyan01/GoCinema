'use client';

import { motion } from 'framer-motion';
import {
  Armchair,
  BadgeCheck,
  Popcorn,
  Volume2,
  WandSparkles,
} from 'lucide-react';
import Link from 'next/link';
import { SITE_URL } from '@/utils/consts';

const SEAT_ROWS = 7;
const SEATS_PER_ROW = 6;
const TOTAL_SEATS = SEAT_ROWS * SEATS_PER_ROW;

const highlights = [
  {
    icon: Volume2,
    title: 'Հզոր ձայն',
    text: 'Խորը, մաքուր և կինոդահլիճին հատուկ ձայնային միջավայր։',
  },
  {
    icon: Armchair,
    title: 'Հարմարավետ նստատեղեր',
    text: '42 տեղանոց դահլիճ՝ ճիշտ տեսանելիությամբ և հանգիստ նստատեղերով։',
  },
  {
    icon: Popcorn,
    title: 'Կինոբար',
    text: 'Խորտիկներ ու ըմպելիքներ, որոնք լրացնում են ֆիլմի փորձը։',
  },
];

export default function CinemaExperienceSection() {
  return (
    <section className="relative overflow-hidden bg-[#050505] py-16 text-white sm:py-20 lg:py-24">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(220,38,38,0.2),transparent_30%),radial-gradient(circle_at_80%_70%,rgba(234,179,8,0.12),transparent_28%)]" />
      <div className="absolute left-1/2 top-0 h-px w-full -translate-x-1/2 bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />

      <div className="relative container mx-auto px-4">
        <div className="grid items-center gap-8 sm:gap-10 lg:grid-cols-[1fr_0.9fr] lg:gap-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="mb-4 max-w-3xl text-3xl font-black leading-tight tracking-tight sm:mb-5 sm:text-4xl md:text-6xl">
              Ամեն ֆիլմ՝ ինչպես պրեմիերա
            </h2>
            <p className="mb-6 max-w-2xl text-base leading-relaxed text-gray-300 sm:mb-8 sm:text-lg">
              GoCinema-ում ֆիլմը պարզապես դիտում չեն։ Դա մթնոլորտ է՝ ճիշտ
              ձայնով, մեծ էկրանով, հարմարավետ դահլիճով և արագ առցանց ամրագրմամբ։
            </p>

            <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
              {highlights.map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.08 }}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm sm:p-5"
                >
                  <item.icon className="mb-4 h-7 w-7 text-red-400" />
                  <h3 className="mb-2 font-bold text-white">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-gray-400">
                    {item.text}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative"
          >
            <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-red-950/30 backdrop-blur-xl sm:rounded-[2rem] sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3 sm:mb-6">
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 sm:text-sm">
                    Այսօրվա փորձը
                  </p>
                  <h3 className="text-xl font-black sm:text-2xl">
                    Premium Hall
                  </h3>
                </div>
                <div className="rounded-full bg-green-400/15 px-3 py-1 text-sm font-bold text-green-300">
                  Բաց է
                </div>
              </div>

              <div className="mb-4 rounded-2xl bg-gradient-to-br from-red-500/20 to-yellow-500/10 p-3 sm:mb-6 sm:rounded-3xl sm:p-5">
                <div className="mb-3 h-1.5 rounded-full bg-gradient-to-r from-red-500 via-yellow-300 to-red-500 shadow-lg shadow-red-500/30 sm:mb-5 sm:h-2" />
                <div className="grid grid-cols-6 gap-x-1.5 gap-y-2 sm:gap-x-2 sm:gap-y-2.5">
                  {Array.from({ length: TOTAL_SEATS }).map((_, index) => {
                    const col = index % SEATS_PER_ROW;
                    return (
                      <div
                        key={index}
                        className={`h-5 rounded-t-lg border border-white/10 sm:h-7 sm:rounded-t-xl ${
                          col === 0 || col === SEATS_PER_ROW - 1
                            ? 'bg-red-500/80'
                            : col === 2 || col === 3
                              ? 'bg-yellow-400/70'
                              : 'bg-white/15'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {['QR տոմս հեռախոսում', 'Անվտանգ վճարում'].map((text) => (
                  <div
                    key={text}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <BadgeCheck className="h-5 w-5 text-green-300" />
                    <span className="text-sm font-semibold text-gray-200">
                      {text}
                    </span>
                  </div>
                ))}
              </div>

              <Link
                href={SITE_URL.SCHEDULE}
                className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-red-600 px-6 py-4 font-bold text-white shadow-lg shadow-red-950/40 transition hover:bg-red-500"
              >
                Ընտրել սեանս
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
