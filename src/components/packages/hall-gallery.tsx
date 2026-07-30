'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Expand, X, Images } from 'lucide-react';

export const hallImages = [
  {
    src: '/images/hall/hall-01.webp',
    alt: 'GoCinema դահլիճի ընդհանուր տեսք',
    label: 'Դահլիճի ընդհանուր տեսք',
    span: 'md:col-span-2 md:row-span-2',
  },
  {
    src: '/images/hall/hall-02.webp',
    alt: 'GoCinema մեծ էկրան',
    label: 'Մեծ էկրան',
    span: 'md:col-span-1 md:row-span-1',
  },
  {
    src: '/images/hall/hall-03.webp',
    alt: 'GoCinema դահլիճի միջավայր',
    label: 'Կինոդահլիճի միջավայր',
    span: 'md:col-span-1 md:row-span-1',
  },
  {
    src: '/images/hall/hall-04.webp',
    alt: 'GoCinema նստատեղեր',
    label: 'Հարմարավետ նստատեղեր',
    span: 'md:col-span-1 md:row-span-1',
  },
  {
    src: '/images/hall/hall-05.webp',
    alt: 'GoCinema դահլիճի տեսք',
    label: 'Դահլիճի տեսք',
    span: 'md:col-span-1 md:row-span-1',
  },
  {
    src: '/images/hall/hall-06.webp',
    alt: 'GoCinema դահլիճի մանրամասներ',
    label: 'Դահլիճի մանրամասներ',
    span: 'md:col-span-1 md:row-span-1',
  },
  {
    src: '/images/hall/hall-07.webp',
    alt: 'GoCinema դահլիճի լուսավորություն',
    label: 'Լուսավորություն և միջավայր',
    span: 'md:col-span-1 md:row-span-1',
  },
] as const;

export default function HallGallery() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeImage = activeIndex !== null ? hallImages[activeIndex] : null;

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-lg"
      >
        <div className="border-b border-gray-100 bg-linear-to-r from-slate-900 via-purple-950 to-slate-900 px-6 py-8 text-white sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-purple-200">
                <Images className="h-3.5 w-3.5" />
                Our hall
              </div>
              <h2 className="text-2xl font-bold sm:text-3xl">Մեր դահլիճը</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/75 sm:text-base">
                Ժամանակակից կինոդահլիճ՝ մեծ էկրանով, հարմարավետ նստատեղերով և
                հատուկ միջոցառումների համար պատրաստված միջավայրով։
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
              <span className="block text-2xl font-black text-white">42</span>
              նստատեղ · 8K էկրան
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 p-4 sm:gap-4 sm:p-6 md:grid-cols-4 md:grid-rows-2 md:auto-rows-[180px]">
          {hallImages.map((image, index) => (
            <motion.button
              key={image.src}
              type="button"
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: index * 0.05 }}
              onClick={() => setActiveIndex(index)}
              className={`group relative min-h-[140px] overflow-hidden rounded-2xl bg-gray-100 text-left sm:min-h-[180px] ${image.span}`}
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent opacity-80 transition-opacity group-hover:opacity-100" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
                <span className="text-sm font-semibold text-white drop-shadow">
                  {image.label}
                </span>
                <span className="rounded-full bg-white/15 p-2 text-white backdrop-blur-sm transition group-hover:bg-white/25">
                  <Expand className="h-4 w-4" />
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.section>

      <AnimatePresence>
        {activeImage && activeIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
            onClick={() => setActiveIndex(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="relative w-full max-w-5xl overflow-hidden rounded-2xl bg-black shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setActiveIndex(null)}
                className="absolute right-4 top-4 z-10 rounded-full bg-black/50 p-2 text-white backdrop-blur-sm transition hover:bg-black/70"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="relative aspect-[16/10] w-full">
                <Image
                  src={activeImage.src}
                  alt={activeImage.alt}
                  fill
                  sizes="(max-width: 1024px) 100vw, 1024px"
                  className="object-contain"
                  priority
                />
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-white/10 px-5 py-4 text-white">
                <p className="font-medium">{activeImage.label}</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={activeIndex <= 0}
                    onClick={() => setActiveIndex((i) => Math.max(0, (i ?? 0) - 1))}
                    className="rounded-lg border border-white/15 px-3 py-1.5 text-sm disabled:opacity-40"
                  >
                    Նախորդ
                  </button>
                  <span className="text-sm text-white/60">
                    {activeIndex + 1} / {hallImages.length}
                  </span>
                  <button
                    type="button"
                    disabled={activeIndex >= hallImages.length - 1}
                    onClick={() =>
                      setActiveIndex((i) =>
                        Math.min(hallImages.length - 1, (i ?? 0) + 1)
                      )
                    }
                    className="rounded-lg border border-white/15 px-3 py-1.5 text-sm disabled:opacity-40"
                  >
                    Հաջորդ
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
