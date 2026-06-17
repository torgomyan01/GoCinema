'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { SITE_URL } from '@/utils/consts';

interface FAQ {
  id: number;
  question: string;
  answer: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface FAQSectionProps {
  faqs: FAQ[];
}

export default function FAQSection({ faqs }: FAQSectionProps) {
  const [openFAQId, setOpenFAQId] = useState<number | null>(null);

  const toggleFAQ = (id: number) => {
    setOpenFAQId(openFAQId === id ? null : id);
  };

  // Show only first 6 FAQs on home page
  const displayedFAQs = faqs.slice(0, 6);

  if (displayedFAQs.length === 0) {
    return null;
  }

  return (
    <section className="py-16 sm:py-20 lg:py-24 bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8 sm:mb-12"
        >
          <div className="inline-flex items-center gap-2 mb-3 sm:mb-4 justify-center">
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-red-600" />
            <span className="text-xs sm:text-sm font-bold uppercase tracking-[0.16em] sm:tracking-[0.2em] text-red-600">
              Օգնություն
            </span>
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-red-600" />
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 tracking-tight mb-2 sm:mb-3">
            Հաճախակի հարցեր
          </h2>
          <p className="text-base sm:text-lg text-gray-500 max-w-2xl mx-auto px-2">
            Գտեք պատասխանները ձեր հարցերին
          </p>
        </motion.div>

        <div className="max-w-4xl mx-auto">
          <div className="space-y-4 mb-8">
            {displayedFAQs.map((faq, index) => (
              <motion.div
                key={faq.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
              >
                <button
                  onClick={() => toggleFAQ(faq.id)}
                  className="w-full p-4 sm:p-6 flex items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-inset rounded-[10px]"
                >
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 pr-3 sm:pr-4 flex-1">
                    {faq.question}
                  </h3>
                  <div className="shrink-0">
                    {openFAQId === faq.id ? (
                    <ChevronUp className="w-5 h-5 text-red-600" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </button>
                <AnimatePresence>
                  {openFAQId === faq.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-2 border-t border-gray-100 sm:px-6 sm:pb-6">
                        <p className="text-sm sm:text-base text-gray-700 leading-relaxed whitespace-pre-line">
                          {faq.answer}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>

          {/* View All Link */}
          {faqs.length > displayedFAQs.length && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-center"
            >
              <Link
                href={SITE_URL.FAQ}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-800 text-white rounded-full font-bold hover:from-red-500 hover:to-red-700 transition-all shadow-lg hover:shadow-xl"
              >
                Տեսնել բոլոր հարցերը
                <ArrowRight className="w-5 h-5" />
              </Link>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}
