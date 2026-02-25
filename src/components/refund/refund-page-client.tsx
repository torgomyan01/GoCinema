'use client';

import { motion } from 'framer-motion';
import {
  XCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  Phone,
  Mail,
  FileText,
  Info,
  Ban,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import Link from 'next/link';

const formatArmenianDate = (date: Date) => {
  const months = [
    'հունվար', 'փետրվար', 'մարտ', 'ապրիլ', 'մայիս', 'հունիս',
    'հուլիս', 'օգոստոս', 'սեպտեմբեր', 'հոկտեմբեր', 'նոյեմբեր', 'դեկտեմբեր',
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()} թ.`;
};

export default function RefundPageClient() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pt-24 pb-20">
      <div className="container mx-auto px-4">

        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center justify-center mb-4"
          >
            <div className="p-4 bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl shadow-lg">
              <RefreshCw className="w-12 h-12 text-white" />
            </div>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl md:text-5xl font-bold text-gray-900 mb-3"
          >
            Չեղարկման և Վերադարձի Քաղաքականություն
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-sm text-gray-400"
          >
            Վերջին թարմացում. {formatArmenianDate(new Date())}
          </motion.p>
        </div>

        <div className="max-w-4xl mx-auto space-y-6">

          {/* MAIN RULE — highlighted box */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="bg-red-50 border-2 border-red-300 rounded-2xl p-7"
          >
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-red-100 rounded-xl shrink-0">
                <Ban className="w-7 h-7 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-red-700 mb-3">
                  Ընդհանուր կանոն — Տոմսերը ենթակա չեն վերադարձի
                </h2>
                <p className="text-red-800 leading-relaxed mb-3">
                  GoCinema-ի կողմից վաճառված կինոտոմսերը, ըստ ՀՀ «Սպառողների
                  իրավունքների պաշտպանության մասին» օրենքի 25-րդ հոդվածի,
                  դասվում են <strong>ծառայությունների</strong> կատեգորիայի։
                  Ծառայությունների մատուցման սկսվելուց (ֆիլմի ցուցադրության
                  մեկնարկից) հետո, ինչպես նաև ամրագրման ավարտից հետո, տոմսերը
                  <strong> ենթակա չեն վերադարձի կամ փոխանակման</strong>։
                </p>
                <p className="text-red-700 text-sm">
                  Ամրագրելով տոմս՝ դուք հաստատում եք, որ ծանոթ եք սույն
                  կանոնին և համաձայնում եք դրան։
                </p>
              </div>
            </div>
          </motion.div>

          {/* Section 1 — No refund cases */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-gray-700 to-gray-900 px-6 py-5 flex items-center gap-3">
              <div className="p-2 bg-white/15 rounded-lg">
                <XCircle className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-white">
                Վերադարձ ՉԻ ԿԱՏԱՐՎՈՒՄ հետևյալ դեպքերում
              </h2>
            </div>
            <div className="p-6">
              <ul className="space-y-3">
                {[
                  'Ֆիլմի ցուցադրությունը սկսվել է (անկախ՝ դուք ներկա եղե՞լ եք, թե ոչ)։',
                  'Ամրագրումը կատարվել է, սակայն դուք չեք ներկայացել կինոթատրոն («no-show»)։',
                  'Ուշ ժամանումի պատճառով մուտք չի թույլատրվել (ֆիլմի մեկնարկից 10 րոպե անց)։',
                  'Ֆիլմը ձեզ «դուր չի եկել» կամ «ակնկալիքները չի արդարացրել»։',
                  'Սխալ ամսաթիվ, ժամ կամ ֆիլմ եք ամրագրել ձեր սեփական անուշադրությամբ։',
                  'Ամրագրումը կատարվել է 24 ժամ կամ ավելի առաջ, և ֆիլմի ցուցադրությունը տեղի է ունեցել։',
                  'Տոմսը կորցրել կամ ջնջել եք (QR կոդը հասանելի է ձեր հաշվի «Իմ տոմսերը» բաժնում)։',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    <span className="text-gray-700 text-sm leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>

          {/* Section 2 — Exceptions (refund IS possible) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-5 flex items-center gap-3">
              <div className="p-2 bg-white/15 rounded-lg">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-white">
                Բացառություններ — Վերադարձ ՀՆԱՐԱՎՈՐ Է
              </h2>
            </div>
            <div className="p-6">
              <ul className="space-y-3">
                {[
                  {
                    text: 'GoCinema-ն չեղարկել է ֆիլմի ցուցադրությունը — ամբողջ գումարը վերադարձվում է ավտոմատ 5 աշխատանքային օրվա ընթացքում։',
                    strong: true,
                  },
                  {
                    text: 'GoCinema-ն փոխել է ֆիլմի ցուցադրության ժամը կամ ամսաթիվը, և դուք չեք կարողանում ներկայանալ — վերադարձ կատարվում է հարցում ներկայացնելուց հետո 5 աշխատանքային օրվա ընթացքում։',
                    strong: true,
                  },
                  {
                    text: 'Տեխնիկական խափանման պատճառով ֆիլմի ցուցադրությունը ընդհատվել է 15 րոպեից ավելի — մասնակի կամ ամբողջական փոխհատուցում կատարվում է անհատական քննարկման կարգով։',
                    strong: false,
                  },
                  {
                    text: 'Կրկնակի վճարում (duplicate charge) — ամբողջ կրկնակի գումարը վերադարձվում է 3 աշխատանքային օրվա ընթացքում։',
                    strong: false,
                  },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    <span className={`text-sm leading-relaxed ${item.strong ? 'text-gray-800 font-medium' : 'text-gray-700'}`}>
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>

          {/* Section 3 — Cancellation procedure */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.55 }}
            className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-5 flex items-center gap-3">
              <div className="p-2 bg-white/15 rounded-lg">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-white">
                Վերադարձի ընթացակարգ
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    step: '1',
                    title: 'Կապ հաստատեք',
                    desc: 'Ուղարկեք հայտ info@gocinema.am կամ զանգահարեք +374 77 769 668',
                    color: 'bg-purple-50 border-purple-200',
                    num: 'bg-purple-600',
                  },
                  {
                    step: '2',
                    title: 'Ներկայացրեք տվյալներ',
                    desc: 'Տոմսի համար, ամրագրման ամսաթիվ, վճարման հաստատում',
                    color: 'bg-blue-50 border-blue-200',
                    num: 'bg-blue-600',
                  },
                  {
                    step: '3',
                    title: 'Ստացեք պատասխան',
                    desc: '1–2 աշխատանքային օրվա ընթացքում կստանաք պատասխան',
                    color: 'bg-green-50 border-green-200',
                    num: 'bg-green-600',
                  },
                ].map((s) => (
                  <div key={s.step} className={`rounded-xl border p-4 ${s.color}`}>
                    <div className={`w-8 h-8 ${s.num} text-white rounded-full flex items-center justify-center font-bold text-sm mb-3`}>
                      {s.step}
                    </div>
                    <h3 className="font-semibold text-gray-800 mb-1 text-sm">{s.title}</h3>
                    <p className="text-gray-600 text-xs leading-relaxed">{s.desc}</p>
                  </div>
                ))}
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-amber-800 text-sm leading-relaxed">
                  <strong>Կարևոր.</strong> Վերադարձի հայտը պետք է ներկայացվի
                  ֆիլմի ցուցադրության ամսաթվից ոչ ուշ, քան{' '}
                  <strong>7 օրացուցային օրվա ընթացքում</strong>։ Ավելի ուշ
                  ներկայացված հայտերը չեն դիտարկվի։
                </p>
              </div>
            </div>
          </motion.div>

          {/* Section 4 — Refund timeline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.65 }}
            className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-5 flex items-center gap-3">
              <div className="p-2 bg-white/15 rounded-lg">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-white">
                Վերադարձի ժամկետներ
              </h2>
            </div>
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 pr-4 font-semibold text-gray-700">Դեպք</th>
                      <th className="text-left py-2 font-semibold text-gray-700">Ժամկետ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      ['Ցուցադրության ավտոմատ չեղարկում', '5 աշխ. օր'],
                      ['Ժամի/ամսաթվի փոփոխություն', '5 աշխ. օր'],
                      ['Կրկնակի վճարում', '3 աշխ. օր'],
                      ['Տեխնիկական խափանում (15+ րոպե)', '7–10 աշխ. օր'],
                      ['Բանկային քարտ', '5–10 աշխ. օր (կախված բանկից)'],
                    ].map(([label, period], i) => (
                      <tr key={i}>
                        <td className="py-2.5 pr-4 text-gray-700">{label}</td>
                        <td className="py-2.5 font-medium text-purple-700">{period}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>

          {/* Section 5 — Dispute */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.75 }}
            className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-5 flex items-center gap-3">
              <div className="p-2 bg-white/15 rounded-lg">
                <Info className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-white">
                Բողոքարկում և վեճերի լուծում
              </h2>
            </div>
            <div className="p-6 space-y-3">
              {[
                'Ցանկացած վեճ նախ պետք է լուծվի GoCinema-ի հաճախորդների աջակցության հետ կապ հաստատելու միջոցով։',
                'Եթե 14 աշխատանքային օրվա ընթացքում լուծում չի ձեռք բերվել, դուք կարող եք դիմել ՀՀ Սպառողների պաշտպանության պետական տեսչություն։',
                'Բանկային chargeback (վճարման վիճարկում) ներկայացնելուց առաջ պարտադիր կապ հաստատեք մեզ հետ — մենք ձգտում ենք լուծել բոլոր հարցերը կամ-ոք։',
                'GoCinema-ն պատրաստ է ներկայացնել բոլոր անհրաժեշտ փաստաթղթերը ՀՀ դատական կամ վարչական մարմիններին։',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full mt-2 shrink-0" />
                  <span className="text-gray-700 text-sm leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Section 6 — Products (snacks etc.) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.82 }}
            className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-slate-600 to-slate-800 px-6 py-5 flex items-center gap-3">
              <div className="p-2 bg-white/15 rounded-lg">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-white">
                Կինոբար — Ապրանքների վերադարձ
              </h2>
            </div>
            <div className="p-6 space-y-3">
              {[
                'Կինոբարի ապրանքները (պոպ-կոռն, ըմպելիքներ, նախուտեստներ) ենթակա չեն վերադարձի կամ փոխանակման բացման կամ մասնակի օգտագործման դեպքում։',
                'Ապրանքի որակի հետ կապված հիմնավոր բողոքի դեպքում (ժամկետանց, արտաքին թերություն) կատարվում է ամբողջական փոխարինում կամ գումարի վերադարձ — անմիջապես, կինոթատրոնի ադմինիստրատորի մոտ։',
                'Ապրանքի ձեռքբերումից հետո 30 րոպեն անց բողոքները չեն ընդունվի։',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-slate-500 rounded-full mt-2 shrink-0" />
                  <span className="text-gray-700 text-sm leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Contact CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.9 }}
            className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-8 text-white shadow-xl"
          >
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-3">
                Ունե՞ք հարց կամ բողոք
              </h2>
              <p className="text-white/85 mb-6 text-sm">
                Մեր աջակցության թիմը կօգնի ձեզ ամեն հարցում։
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
                <a
                  href="mailto:info@gocinema.am"
                  className="flex items-center gap-2 text-white hover:text-white/80 transition-colors"
                >
                  <Mail className="w-5 h-5" />
                  info@gocinema.am
                </a>
                <a
                  href="tel:+37477769668"
                  className="flex items-center gap-2 text-white hover:text-white/80 transition-colors"
                >
                  <Phone className="w-5 h-5" />
                  +374 77 769 668
                </a>
              </div>
              <div className="flex flex-wrap gap-3 justify-center pt-5 border-t border-white/20">
                <Link
                  href="/terms"
                  className="px-4 py-2 bg-white/15 hover:bg-white/25 rounded-lg text-sm font-medium transition-colors"
                >
                  Օգտագործման պայմաններ
                </Link>
                <Link
                  href="/privacy"
                  className="px-4 py-2 bg-white/15 hover:bg-white/25 rounded-lg text-sm font-medium transition-colors"
                >
                  Գաղտնիության քաղաքականություն
                </Link>
                <Link
                  href="/contacts"
                  className="px-4 py-2 bg-white text-purple-700 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
                >
                  Կապ մեզ հետ
                </Link>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
