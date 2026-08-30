'use client';

import { motion } from 'framer-motion';
import {
  Film,
  MonitorPlay,
  Volume2,
  Armchair,
  Popcorn,
  Clock,
  Users,
  Phone,
  CheckCircle2,
  CalendarHeart,
  Package,
} from 'lucide-react';
import Link from 'next/link';
import { SITE_URL } from '@/utils/consts';
import { packages } from '@/data/packages';
import HallGallery from '@/components/packages/hall-gallery';

const amenities = [
  {
    icon: MonitorPlay,
    title: '8K պրոյեկտոր',
    text: 'Հստակ ու վառ պատկեր մեծ էկրանին',
  },
  {
    icon: Volume2,
    title: 'Հզոր ձայն',
    text: 'Կինոդահլիճին հատուկ ձայնային միջավայր',
  },
  {
    icon: Armchair,
    title: 'Հարմարավետ դահլիճ',
    text: 'Ճիշտ տեսանելիությամբ նստատեղեր',
  },
  {
    icon: Popcorn,
    title: 'Կինոբար',
    text: 'Խորտիկներ ու ըմպելիքներ ձեր միջոցառմանը',
  },
];

const steps = [
  {
    icon: Phone,
    title: 'Կապ հաստատեք',
    text: 'Զանգահարեք կամ գրեք մեզ՝ նշելով ձեր նախընտրած փաթեթը։',
  },
  {
    icon: CalendarHeart,
    title: 'Համաձայնեցրեք օրն ու ֆիլմը',
    text: 'Ընտրում ենք ազատ ժամը, ֆիլմը կամ տեսանյութը և լրացուցիչ ծառայությունները։',
  },
  {
    icon: Package,
    title: 'Վայելեք միջոցառումը',
    text: 'Մենք պատրաստում ենք դահլիճը, դուք վայելում եք ձեր հատուկ օրը։',
  },
];

export default function PackagesPageClient() {
  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 to-white pt-24 pb-20">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center justify-center mb-4"
          >
            <div className="p-4 bg-linear-to-br from-purple-500 to-pink-500 rounded-2xl shadow-lg">
              <Package className="w-12 h-12 text-white" />
            </div>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl md:text-5xl font-bold text-gray-900 mb-3"
          >
            Փաթեթներ և Դահլիճի Վարձակալություն
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto"
          >
            GoCinema-ն ոչ միայն ֆիլմեր է ցուցադրում։ Մեր դահլիճը կարող է դառնալ
            ձեր հատուկ միջոցառման վայրը՝ ծնունդ, կորպորատիվ հանդիպում թե
            ռոմանտիկ անակնկալ։
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.28 }}
            className="mt-5"
          >
            <Link
              href={SITE_URL.PACKAGES_SLIDE}
              className="inline-flex items-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              21:9 սլայդ նկարելու համար
            </Link>
          </motion.div>
        </div>

        <div className="max-w-6xl mx-auto space-y-12">
          <HallGallery />

          {/* Packages */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {packages.map((pkg, index) => {
              const Icon = pkg.icon;
              return (
                <motion.div
                  key={pkg.id}
                  id={pkg.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.15 + index * 0.1 }}
                  className="flex flex-col bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow"
                >
                  <div
                    className={`bg-linear-to-br ${pkg.gradient} p-6 text-white`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 rounded-xl bg-white/15 backdrop-blur-sm">
                        <Icon className="w-7 h-7" />
                      </div>
                      <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-semibold">
                        {pkg.badge}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold leading-tight">
                      {pkg.title}
                    </h2>
                    <p className="text-sm text-white/80 mt-1">{pkg.subtitle}</p>
                  </div>

                  <div className="flex flex-col flex-1 p-6">
                    <p className="text-sm text-gray-600 leading-relaxed mb-5">
                      {pkg.description}
                    </p>
                    <ul className="space-y-2.5 mb-6">
                      {pkg.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-2 text-sm text-gray-700"
                        >
                          <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={`${SITE_URL.CONTACTS}?subject=${encodeURIComponent(
                        `Հետաքրքրված եմ «${pkg.title}» փաթեթով`
                      )}`}
                      className="mt-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors"
                    >
                      Հայտ ուղարկել
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Amenities */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8"
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                Ինչ է ներառում մեր տարածքը
              </h2>
              <p className="text-gray-600 text-sm">
                Յուրաքանչյուր փաթեթ օգտվում է մեր ժամանակակից տեխնիկայից և
                հարմարություններից։
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {amenities.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="rounded-xl border border-gray-100 p-6 bg-linear-to-b from-slate-50 to-white"
                  >
                    <div className="p-3 rounded-xl bg-purple-50 text-purple-600 mb-3 inline-flex">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 mb-1">
                      {item.title}
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {item.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* How it works */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8"
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                Ինչպես է աշխատում
              </h2>
              <p className="text-gray-600 text-sm">
                Ընդամենը երեք քայլ՝ ձեր միջոցառումը կազմակերպելու համար։
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="relative">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-purple-600 text-white text-sm font-bold shrink-0">
                        {index + 1}
                      </div>
                      <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {step.title}
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {step.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="bg-linear-to-br from-slate-900 via-slate-800 to-purple-900 rounded-2xl shadow-xl p-8 md:p-10 text-white"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="max-w-xl">
                <h2 className="text-2xl md:text-3xl font-bold mb-3 flex items-center gap-3">
                  <Film className="w-7 h-7 text-purple-300" />
                  Պատրա՞ստ եք ամրագրել ձեր օրը
                </h2>
                <p className="text-white/85 text-sm md:text-base leading-relaxed">
                  Կապվեք մեզ հետ՝ ձեր նախընտրած փաթեթը, ամսաթիվը և մանրամասները
                  քննարկելու համար։ Մենք կօգնենք ստեղծել անմոռանալի միջոցառում։
                </p>
                <div className="flex flex-wrap items-center gap-4 mt-5 text-sm text-white/80">
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Ամեն օր՝ 13:00 – 24:00
                  </span>
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Մինչև 42 հյուր
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-3 shrink-0">
                <Link
                  href={SITE_URL.CONTACTS}
                  className="px-6 py-3 bg-white text-purple-700 rounded-lg text-sm font-semibold shadow-md hover:bg-gray-100 transition-colors text-center"
                >
                  Կապ մեզ հետ
                </Link>
                <a
                  href="tel:+37477769668"
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-semibold text-white transition-colors border border-white/25 text-center flex items-center justify-center gap-2"
                >
                  <Phone className="w-4 h-4" />
                  +374 77 769 668
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
