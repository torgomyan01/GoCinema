'use client';

import { motion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Package,
  Sparkles,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { packages } from '@/data/packages';
import { SITE_URL } from '@/utils/consts';

export default function PackagesSection() {
  return (
    <section className="relative overflow-hidden bg-[#080808] py-16 text-white sm:py-20 lg:py-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(168,85,247,0.18),transparent_32%),radial-gradient(circle_at_85%_75%,rgba(236,72,153,0.14),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
      <div className="pointer-events-none absolute -left-20 top-1/3 h-72 w-72 rounded-full bg-purple-600/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-pink-600/10 blur-3xl" />

      <div className="relative container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-10 flex flex-col gap-6 lg:mb-14 lg:flex-row lg:items-end lg:justify-between"
        >
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2">
              <span className="h-px w-8 bg-purple-500" />
              <span className="text-xs font-black uppercase tracking-[0.2em] text-purple-400 sm:text-sm">
                Private events
              </span>
            </div>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">
              Մեր փաթեթները
            </h2>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-neutral-400 sm:text-lg">
              GoCinema-ն ոչ միայն ֆիլմեր է ցուցադրում։ Մեր դահլիճը կարող է դառնալ
              ձեր հատուկ միջոցառման վայրը՝ ծնունդ, կորպորատիվ հանդիպում թե
              ռոմանտիկ անակնկալ։
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-400">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
              <Clock className="h-4 w-4 text-purple-400" />
              13:00 – 24:00
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
              <Users className="h-4 w-4 text-purple-400" />
              Մինչև 42 հյուր
            </span>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {packages.map((pkg, index) => {
            const Icon = pkg.icon;
            const isFeatured = pkg.id === 'private-party';

            return (
              <motion.article
                key={pkg.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={`group relative flex flex-col overflow-hidden rounded-3xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${
                  isFeatured
                    ? 'border-purple-500/40 bg-gradient-to-b from-purple-500/10 to-white/[0.03] shadow-[0_0_40px_rgba(168,85,247,0.15)]'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                }`}
              >
                {isFeatured && (
                  <div className="absolute right-4 top-4 z-10 inline-flex items-center gap-1 rounded-full bg-purple-500/20 px-3 py-1 text-xs font-semibold text-purple-200 backdrop-blur-sm">
                    <Sparkles className="h-3.5 w-3.5" />
                    {pkg.badge}
                  </div>
                )}

                <div
                  className={`relative overflow-hidden bg-gradient-to-br ${pkg.gradient} p-6`}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_45%)]" />
                  <div className="relative flex items-start justify-between gap-4">
                    <div
                      className={`rounded-2xl p-3 backdrop-blur-sm ${pkg.iconBg}`}
                    >
                      <Icon className="h-7 w-7" />
                    </div>
                    {!isFeatured && (
                      <span className="rounded-full bg-black/20 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur-sm">
                        {pkg.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="relative mt-5 text-2xl font-bold leading-tight">
                    {pkg.title}
                  </h3>
                  <p className="relative mt-1 text-sm text-white/80">
                    {pkg.subtitle}
                  </p>
                </div>

                <div className="flex flex-1 flex-col p-6">
                  <p className="mb-5 text-sm leading-relaxed text-neutral-400">
                    {pkg.description}
                  </p>

                  <ul className="mb-6 space-y-2.5">
                    {pkg.features.slice(0, 3).map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2.5 text-sm text-neutral-300"
                      >
                        <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${pkg.accent}`} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={`${SITE_URL.CONTACTS}?subject=${encodeURIComponent(
                      `Հետաքրքրված եմ «${pkg.title}» փաթեթով`
                    )}`}
                    className={`mt-auto inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition ${
                      isFeatured
                        ? 'bg-white text-purple-700 hover:bg-purple-50'
                        : 'border border-white/15 bg-white/5 text-white hover:bg-white/10'
                    }`}
                  >
                    Հայտ ուղարկել
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </motion.article>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-10 flex flex-col items-center justify-between gap-5 rounded-3xl border border-white/10 bg-gradient-to-r from-purple-950/80 via-slate-900/80 to-pink-950/80 p-6 sm:flex-row sm:p-8"
        >
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-white/10 p-3">
              <Package className="h-6 w-6 text-purple-300" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white sm:text-2xl">
                Ցանկանու՞մ եք տեսնել բոլոր մանրամասները
              </h3>
              <p className="mt-1 max-w-xl text-sm text-neutral-400 sm:text-base">
                Դահլիճի հարմարությունները, քայլ առ քայլ գործընթացը և ամբողջական
                փաթեթների նկարագրությունը։
              </p>
            </div>
          </div>

          <Link
            href={SITE_URL.PACKAGES}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-purple-700 transition hover:bg-purple-50"
          >
            Բոլոր փաթեթները
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
