'use client';

import { motion } from 'framer-motion';
import {
  Armchair,
  ArrowRight,
  Clapperboard,
  Popcorn,
  QrCode,
  Smartphone,
  Sparkles,
  Ticket,
  Volume2,
} from 'lucide-react';
import Link from 'next/link';
import { SITE_URL } from '@/utils/consts';

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

const journeySteps = [
  {
    icon: Clapperboard,
    title: 'Ընտրեք սեանսը',
    text: 'Ֆիլմ, օր և նստատեղ',
  },
  {
    icon: Smartphone,
    title: 'Վճարեք օնլայն',
    text: 'Արագ և անվտանգ',
  },
  {
    icon: QrCode,
    title: 'Մտեք QR-ով',
    text: 'Տոմսը հեռախոսում',
  },
];

const stats = [
  { value: '42', label: 'նստատեղ' },
  { value: '8K', label: 'պատկեր' },
  { value: 'QR', label: 'անցում' },
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
            <div className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-red-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-8 -left-4 h-28 w-28 rounded-full bg-yellow-500/10 blur-3xl" />

            <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.06] shadow-2xl shadow-red-950/30 backdrop-blur-xl sm:rounded-[2rem]">
              {/* Էկրանի լույս */}
              <div className="relative overflow-hidden border-b border-white/10 px-5 pb-8 pt-6 sm:px-7 sm:pb-10 sm:pt-8">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(220,38,38,0.35),transparent_65%)]" />
                <div className="relative">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-red-400">
                      <span className="text-xs font-bold uppercase tracking-[0.2em]">
                        GoCinema
                      </span>
                    </div>
                    <span className="rounded-full border border-green-400/20 bg-green-400/10 px-3 py-1 text-xs font-bold text-green-300">
                      Բաց է այսօր
                    </span>
                  </div>

                  <div className="perspective-near mx-auto max-w-xs">
                    <div className="h-2 w-full rounded-t-[50%] bg-linear-to-b from-gray-300 to-gray-500 shadow-[0_0_40px_rgba(239,68,68,0.45)] transform-[rotateX(-28deg)]" />
                    <p className="mt-3 text-center text-[10px] font-semibold uppercase tracking-[0.35em] text-gray-500">
                      Էկրան
                    </p>
                  </div>

                  <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
                    {stats.map((item) => (
                      <div
                        key={item.label}
                        className="rounded-xl border border-white/10 bg-black/25 px-2 py-3 text-center backdrop-blur-sm sm:rounded-2xl sm:px-3 sm:py-4"
                      >
                        <div className="text-xl font-black text-white sm:text-2xl">
                          {item.value}
                        </div>
                        <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400 sm:text-xs">
                          {item.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Ամրագրման ճանապարհ */}
              <div className="space-y-3 p-5 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">
                  3 քայլ մինչև ֆիլմը
                </p>
                {journeySteps.map((step, index) => (
                  <div
                    key={step.title}
                    className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-3.5 sm:p-4"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600/20 text-red-400">
                      <step.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-red-400">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <h4 className="font-bold text-white">{step.title}</h4>
                      </div>
                      <p className="mt-0.5 text-sm text-gray-400">
                        {step.text}
                      </p>
                    </div>
                  </div>
                ))}

                <Link
                  href={SITE_URL.MOVIES}
                  className="group mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-6 py-4 font-bold text-white shadow-lg shadow-red-950/40 transition hover:bg-red-500"
                >
                  <Ticket className="h-5 w-5" />
                  Ամրագրել հիմա
                  <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
