'use client';

import { motion } from 'framer-motion';
import { CalendarDays, CreditCard, QrCode, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { SITE_URL } from '@/utils/consts';

const steps = [
  {
    icon: CalendarDays,
    number: '01',
    title: 'Ընտրեք սեանսը',
    text: 'Դիտեք ժամանակացույցը, ընտրեք ֆիլմը, օրը և ձեզ հարմար ժամը։',
  },
  {
    icon: CreditCard,
    number: '02',
    title: 'Վճարեք առցանց',
    text: 'Անվտանգ վճարեք քարտով կամ TelCell-ով՝ առանց հերթում կանգնելու։',
  },
  {
    icon: QrCode,
    number: '03',
    title: 'Ստացեք QR տոմսը',
    text: 'Վճարումից հետո QR տոմսը կհայտնվի ձեր «Իմ տոմսերը» բաժնում։',
  },
];

export default function BookingJourneySection() {
  return (
    <section className="relative overflow-hidden bg-[#f8f5ef] py-16 sm:py-20 lg:py-24">
      <div className="absolute left-0 top-0 h-full w-full bg-[radial-gradient(circle_at_top_left,rgba(220,38,38,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(234,179,8,0.12),transparent_35%)]" />

      <div className="relative container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto mb-10 max-w-3xl text-center sm:mb-14"
        >
          <div className="mb-3 inline-flex items-center gap-2 sm:mb-4">
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-red-600" />
            <span className="text-xs sm:text-sm font-bold uppercase tracking-[0.16em] sm:tracking-[0.2em] text-red-600">
              Ամրագրում
            </span>
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-red-600" />
          </div>
          <h2 className="mb-3 text-3xl font-black tracking-tight text-gray-900 sm:mb-4 sm:text-4xl md:text-5xl">
            Տոմս գնելը դարձրել ենք հեշտ
          </h2>
          <p className="text-base leading-relaxed text-gray-500 sm:text-lg">
            Երեք պարզ քայլ, և ձեր QR տոմսը պատրաստ է մուտքի համար։
          </p>
        </motion.div>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: index * 0.08 }}
              className="group relative overflow-hidden rounded-3xl border border-black/5 bg-white p-6 shadow-xl shadow-stone-300/50 transition duration-300 hover:-translate-y-1 hover:shadow-2xl sm:p-8"
            >
              <div className="absolute right-6 top-5 text-6xl font-black text-gray-100 transition group-hover:text-red-100">
                {step.number}
              </div>
              <div className="relative">
                <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-yellow-500 shadow-lg shadow-red-200">
                  <step.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="mb-3 text-2xl font-black text-gray-900">
                  {step.title}
                </h3>
                <p className="leading-relaxed text-gray-500">{step.text}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-12 text-center"
        >
          <Link
            href={SITE_URL.SCHEDULE}
            className="group inline-flex w-full items-center justify-center gap-3 rounded-full bg-red-600 px-6 py-3.5 font-bold text-white shadow-xl shadow-red-200 transition hover:bg-red-500 sm:w-auto sm:px-8 sm:py-4"
          >
            Սկսել ամրագրումը
            <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
