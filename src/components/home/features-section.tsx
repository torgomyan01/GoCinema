'use client';

import { motion } from 'framer-motion';
import {
  CreditCard,
  Shield,
  Clock,
  Headphones,
  Armchair,
  Volume2,
} from 'lucide-react';

const features = [
  {
    icon: Clock,
    title: 'Արագ ամրագրում',
    description: 'Ընտրեք տեղ ու ստացեք QR տոմս մի քանի րոպեում։',
  },
  {
    icon: CreditCard,
    title: 'Անվտանգ վճարում',
    description: 'Բանկային քարտ, TelCell և այլ եղանակներ՝ պաշտպանված։',
  },
  {
    icon: Armchair,
    title: 'Հարմարավետ դահլիճ',
    description: '80 պրեմիում նստատեղ՝ իդեալական տեսանելիությամբ։',
  },
  {
    icon: Volume2,
    title: 'Dolby ձայն ու 4K',
    description: 'Կինոթատրոնային որակ, որը զգում ես ամբողջ մարմնով։',
  },
  {
    icon: Shield,
    title: '100% երաշխիք',
    description: 'Ձեր վճարման և տվյալների անվտանգությունը՝ առաջնահերթ։',
  },
  {
    icon: Headphones,
    title: '24/7 աջակցություն',
    description: 'Մեր թիմը միշտ պատրաստ է օգնել ձեզ ցանկացած հարցում։',
  },
];

export default function FeaturesSection() {
  return (
    <section className="relative py-16 sm:py-20 lg:py-24 bg-[#0b0b0b] overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[40rem] h-[40rem] bg-red-700/15 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 w-[30rem] h-[30rem] bg-yellow-700/10 rounded-full blur-3xl" />

      <div className="relative container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10 sm:mb-16"
        >
          <div className="inline-flex items-center gap-2 mb-3 sm:mb-4 justify-center">
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-red-500" />
            <span className="text-xs sm:text-sm font-bold uppercase tracking-[0.16em] sm:tracking-[0.2em] text-red-400">
              Ինչու՞ մենք
            </span>
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-red-500" />
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mb-3 sm:mb-4">
            GoCinema-ի փորձը
          </h2>
          <p className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto px-2">
            Ամեն մանրուք մտածված է, որպեսզի ձեր այցը դառնա կատարյալ։
          </p>
        </motion.div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              whileHover={{ y: -6 }}
              className="group relative rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-5 sm:p-7 overflow-hidden transition-colors duration-300 hover:border-white/25"
            >
              {/* Hover gradient sheen */}
              <div className="absolute inset-0 bg-gradient-to-br from-red-600/0 to-yellow-600/0 group-hover:from-red-600/10 group-hover:to-yellow-600/10 transition-all duration-300" />

              <div className="relative">
                <div className="inline-flex items-center justify-center w-14 h-14 mb-5 rounded-2xl bg-gradient-to-br from-red-600 to-yellow-500 shadow-lg shadow-red-900/40 group-hover:scale-110 transition-transform duration-300">
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
