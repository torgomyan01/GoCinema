'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
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
    <section className="py-20 bg-gradient-to-b from-white to-slate-50">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg">
              <HelpCircle className="w-10 h-10 text-white" />
            </div>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Հաճախակի հարցեր
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
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
                  className="w-full p-6 flex items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-inset rounded-[10px]"
                >
                  <h3 className="text-lg font-semibold text-gray-900 pr-4 flex-1">
                    {faq.question}
                  </h3>
                  <div className="shrink-0">
                    {openFAQId === faq.id ? (
                      <ChevronUp className="w-5 h-5 text-purple-600" />
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
                      <div className="px-6 pb-6 pt-2 border-t border-gray-100">
                        <p className="text-gray-700 leading-relaxed whitespace-pre-line">
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
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl"
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
