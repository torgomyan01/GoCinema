'use client';

import { motion } from 'framer-motion';
import {
  Film,
  Popcorn,
  Users,
  Star,
  Clock,
  MapPin,
  Ticket,
  Phone,
  Mail,
} from 'lucide-react';
import Link from 'next/link';

const stats = [
  {
    icon: Film,
    label: 'Ֆիլմեր ամսական',
    value: '20+',
    description: 'Պրեմիերաներ, հիթեր և այլ կինոներ',
  },
  {
    icon: Users,
    label: 'Հաճախորդներ ամսական',
    value: '4 000+',
    description: 'Ընտանիքներ, ընկեր ընկերներ և կինոմոլորակներ',
  },
  {
    icon: Star,
    label: 'Միջին գնահատական',
    value: '4.9/5',
    description: 'Հիմնվելով հաճախորդների արձագանքների վրա',
  },
];

const values = [
  {
    icon: Popcorn,
    title: 'Կինոփորձ, ոչ միայն ֆիլմ',
    description:
      'Մեզ համար կարևոր է, որ ձեր յուրաքանչյուր այցը GoCinema լինի փոքրիկ տոն՝ հարմարավետ դահլիճներ, համեղ կինոբար և մտերմիկ մթնոլորտ։',
  },
  {
    icon: Ticket,
    title: 'Հասանելի գներ',
    description:
      'Ցանկանում ենք, որ որակյալ կինոն հասանելի լինի բոլորի համար։ Մենք առաջարկում ենք ճկուն գնային քաղաքականություն և հատուկ առաջարկներ։',
  },
  {
    icon: Users,
    title: 'Ջերմ սպասարկում',
    description:
      'Մեր թիմը միշտ պատրաստ է օգնել ձեզ՝ ընտրել ֆիլմ, նստատեղ կամ ուղեկցել ամբողջ այցի ընթացքում։',
  },
];

export default function AboutPageClient() {
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
              <Film className="w-12 h-12 text-white" />
            </div>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl md:text-5xl font-bold text-gray-900 mb-3"
          >
            Մեր մասին
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto"
          >
            GoCinema-ն ժամանակակից կինոթատրոն է Մարտունիում, որտեղ յուրաքանչյուր
            դիտում դառնում է հիշվող պատմություն՝ սեր կինոյի, հարմարավետության և
            տեխնոլոգիաների ճիշտ համադրությամբ։
          </motion.p>
        </div>

        <div className="max-w-6xl mx-auto space-y-10">
          {/* Intro & Mission */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8"
          >
            <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Ովքե՞ր ենք մենք
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                GoCinema-ն ծնվել է մեկ պարզ գաղափարից՝ բերել մեծ էկրանների
                կախարդանքը Մարտունի և շրջակա համայնքներ։ Մենք հավատում ենք, որ
                որակյալ կինոդիտումը պետք է լինի հասանելի, հարմարավետ և
                տեխնոլոգիապես արդի։
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Մեր դահլիճները հագեցած են ժամանակակից աուդիո-վիզուալ տեխնիկայով,
                իսկ նստատեղերը նախագծված են այնպես, որ դուք մոռանաք ամեն ինչ և
                լսեք միայն ֆիլմի ձայնը։
              </p>
              <p className="text-gray-700 leading-relaxed">
                Մենք աշխատում ենք ոչ միայն լավագույն կինոն ցուցադրելու, այլև
                համայնք ստեղծելու ուղղությամբ, որտեղ մարդիկ հանդիպում են,
                կիսվում զգացմունքներով և ստեղծում հիշողություններ։
              </p>
            </div>

            <div className="bg-linear-to-br from-slate-900 via-slate-800 to-purple-900 rounded-2xl shadow-xl p-8 text-white">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
                <Star className="w-6 h-6 text-yellow-300" />
                Մեր առաքելությունը
              </h2>
              <p className="text-white/85 leading-relaxed mb-6">
                Մեր նպատակն է դարձնել յուրաքանչյուր կինոդիտում փոքրիկ արկած՝
                ապահովելով բարձրակարգ տեխնիկական որակ, անմիջական սպասարկում և
                ջերմ մթնոլորտ։
              </p>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-300 mt-2 shrink-0" />
                  <span>
                    Ընտրել լավագույն միջազգային և հայկական պրեմիերաները,
                    կինոհիթերը և ընտանեկան ֆիլմերը։
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-300 mt-2 shrink-0" />
                  <span>
                    Ստեղծել անվտանգ և հարմարավետ տարածք ընտանիքների, ընկերների և
                    գործընկերների համար։
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-300 mt-2 shrink-0" />
                  <span>
                    Զարգացնել տարածաշրջանի ժամանցային էկոհամակարգը և աջակցել
                    մշակութային կյանքի ակտիվացմանը։
                  </span>
                </li>
              </ul>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-6"
          >
            {stats.map((item, index) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 flex flex-col items-start"
                >
                  <div className="p-3 rounded-xl bg-purple-50 text-purple-600 mb-4">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {item.value}
                  </div>
                  <div className="text-sm font-semibold text-gray-600 mb-1">
                    {item.label}
                  </div>
                  <p className="text-xs text-gray-500">{item.description}</p>
                </div>
              );
            })}
          </motion.div>

          {/* Values */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  Մեր արժեքները
                </h2>
                <p className="text-gray-600 text-sm">
                  Սրանք են այն սկզբունքները, որոնցով առաջնորդվում ենք ամեն օր։
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {values.map((value) => {
                const Icon = value.icon;
                return (
                  <div
                    key={value.title}
                    className="rounded-xl border border-gray-100 p-6 bg-gradient-to-b from-slate-50 to-white"
                  >
                    <div className="p-3 rounded-xl bg-purple-50 text-purple-600 mb-3 inline-flex">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {value.title}
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {value.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Location & Hours */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.55 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8"
          >
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Որտե՞ղ ենք գտնվում
              </h2>
              <div className="space-y-4 text-sm text-gray-700">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold mb-1">Հասցե</div>
                    <p>ք. Մարտունի, Երեվանյան 74/7</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold mb-1">Աշխատանքային ժամեր</div>
                    <p>Ամեն օր՝ 10:00 – 22:00</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold mb-1">Հեռախոս</div>
                    <a
                      href="tel:+37477769668"
                      className="text-purple-600 hover:text-purple-700 transition-colors"
                    >
                      +374 77 769 668
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold mb-1">Էլ. հասցե</div>
                    <a
                      href="mailto:info@gocinema.am"
                      className="text-purple-600 hover:text-purple-700 transition-colors"
                    >
                      info@gocinema.am
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-linear-to-br from-purple-600 to-pink-600 rounded-2xl shadow-xl p-8 text-white flex flex-col justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-3">
                  Կիսվե՛ք ձեր կինոփորձով
                </h2>
                <p className="text-white/85 text-sm mb-4">
                  Ձեր արձագանքները օգնում են մեզ ավելի լավը դառնալ։ Կիսվեք ձեր
                  առաջարկներով, նկատառումներով կամ նոր գաղափարներով։
                </p>
                <p className="text-white/80 text-xs mb-6">
                  Մենք լսում ենք յուրաքանչյուր կարծիք և փորձում ենք կայուն
                  բարելավել GoCinema-ի փորձը։
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/contacts"
                  className="px-5 py-2.5 bg-white text-purple-700 rounded-lg text-sm font-semibold shadow-md hover:bg-gray-100 transition-colors"
                >
                  Կապ մեզ հետ
                </Link>
                <Link
                  href="/movies"
                  className="px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-semibold text-white transition-colors border border-white/25"
                >
                  Դիտել այժմ ցուցադրվող ֆիլմերը
                </Link>
              </div>
            </div>
          </motion.div>

          {/* Google Maps */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.65 }}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">
                  Քարտեզ՝ ինչպես հասնել GoCinema
                </h2>
              </div>
            </div>
            <div className="w-full h-64 md:h-80 rounded-2xl overflow-hidden border border-gray-200">
              <iframe
                title="GoCinema Location"
                src="https://www.google.com/maps?q=40.140321,45.298917&hl=ru&z=16&output=embed"
                className="w-full h-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
