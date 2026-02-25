'use client';

import { motion } from 'framer-motion';
import {
  FileText,
  Ticket,
  CreditCard,
  User,
  Shield,
  AlertCircle,
  CheckCircle,
  XCircle,
  Calendar,
  Clock,
  Mail,
  Phone,
  MapPin,
  ShoppingBag,
  Truck,
  Info,
  Building2,
  Gavel,
} from 'lucide-react';
import Link from 'next/link';

const formatArmenianDate = (date: Date) => {
  const months = [
    'հունվար',
    'փետրվար',
    'մարտ',
    'ապրիլ',
    'մայիս',
    'հունիս',
    'հուլիս',
    'օգոստոս',
    'սեպտեմբեր',
    'հոկտեմբեր',
    'նոյեմբեր',
    'դեկտեմբեր',
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()} թ.`;
};

const sections = [
  {
    id: 1,
    icon: Building2,
    title: 'Ծառայություն մատուցողի տվյալներ',
    highlight: true,
    content: [
      'Կազմակերպություն. «ԳոՍինեմա» (GoCinema)',
      'Գտնվելու վայր. ք. Մարտունի, Հայաստանի Հանրապետություն',
      'Կայք. gocinema.am',
      'Էլ. փոստ. info@gocinema.am',
      'Հեռախոս. +374 77 769 668',
      'Աշխատանքային ժամեր. ամեն օր 10:00–22:00',
      'Ծառայության տեսակ. կինոթատրոնային ծառայություններ, տոմսերի առցանց վաճառք, կինոբարի ապրանքների վաճառք',
    ],
  },
  {
    id: 2,
    icon: FileText,
    title: 'Ընդհանուր դրույթներ',
    highlight: false,
    content: [
      'Սույն Օգտագործման պայմաններն ու ծառայությունների մատուցման կանոնները (այսուհետ՝ «Պայմաններ») կազմված են ՀՀ Քաղաքացիական օրենսգրքի, ՀՀ «Էլեկտրոնային առևտրի մասին» և ՀՀ «Սպառողների իրավունքների պաշտպանության մասին» օրենքների պահանջներին համապատասխան:',
      'Կայքն օգտագործելով, ծառայություն պատվիրելով կամ տոմս ամրագրելով՝ դուք հաստատում եք, որ ծանոթ եք սույն Պայմաններին և ամբողջությամբ ընդունում եք դրանք:',
      'Եթե դուք չեք համաձայնում Պայմաններից որևէ կետի հետ, խնդրում ենք չօգտագործել մեր ծառայությունները:',
      'Մենք պահպանում ենք իրավունքը ցանկացած ժամանակ փոփոխել սույն Պայմանները՝ կայքում հրապարակելու միջոցով ծանուցելով:',
    ],
  },
  {
    id: 3,
    icon: ShoppingBag,
    title: 'Ծառայությունների և ապրանքների նկարագրություն',
    highlight: false,
    content: [
      'ԿԻՆՈՏՈՄՍԵՐ — GoCinema-ն վաճառում է կինոյի ցուցադրությունների տոմսեր: Տոմսը հաստատում է ամրագրված նստատեղի իրավունքը կոնկրետ ֆիլմի, ամսաթվի, ժամի և դահլիճի համար:',
      'ԿԻՆՈԲԱՐ — GoCinema-ն վաճառում է կինոբարի ապրանքներ (պոպ-կոռն, ըմպելիքներ, նախուտեստներ): Ապրանքները կարող են ամրագրվել տոմսի հետ միաժամանակ:',
      'ԳՆԱԳՈՅԱՑՈՒՄ — Բոլոր գները նշված են հայկական դրամով (֏) ներառյալ ԱԱՀ: Գները կարող են տարբերվել կախված ֆիլմից, ժամից, նստատեղի կատեգորիայից:',
      'ՀԱՍԱՆԵԼԻՈՒԹՅՈՒՆ — Տոմսերի քանակը սահմանափակ է: Ամրագրումը հաստատվում է վճարման ավարտից հետո:',
    ],
  },
  {
    id: 4,
    icon: Truck,
    title: 'Ծառայության մատուցման կարգ և պայմաններ',
    highlight: false,
    content: [
      'ԱՄՐԱԳՐՈՒՄ — Տոմսը ամրագրվում է կայքի միջոցով: Ամրագրումը ակտիվ է վճարման ավարտից հետո:',
      'ՏՈՄՍԻ ՍՏԱՑՈՒՄ — Վճարումից հետո QR կոդը հասանելի է ձեր «Իմ տոմսերը» բաժնում: Ֆիզիկական տոմս չի տրամադրվում — QR կոդը բավական է:',
      'ԾԱՌԱՅՈՒԹՅԱՆ ՄԱՏՈՒՑՄԱՆ ՎԱՅՐ — ք. Մարտունի, GoCinema կինոթատրոն: Ծառայությունը մատուցվում է բացառապես կինոթատրոնի ֆիզիկական տարածքում:',
      'ԾԱՌԱՅՈՒԹՅԱՆ ՄԱՏՈՒՑՄԱՆ ԺԱՄԿԵՏ — Ծառայությունը մատուցվում է ամրագրված ֆիլմի ցուցադրության ժամին: Ուշ ժամանման (10+ րոպե) դեպքում մուտքը կարող է մերժվել:',
      'ԿԻՆՈԲԱՐԻ ԱՊՐԱՆՔՆԵՐ — Ամրագրված ապրանքները կարող են ստացվել կինոբարի դրամարկղում ֆիլմի ցուցադրության ժամին: Ապրանքները պատրաստվում/տրամադրվում են կինոթատրոնի տարածքում:',
      'ԱՌԱՔՈՒՄ — GoCinema-ն ֆիզիկական ապրանքների առաքում ՉԻ ԿԱՏԱՐՈՒՄ: Ծառայությունը և ապրանքները ստացվում են բացառապես կինոթատրոնի տարածքում:',
    ],
  },
  {
    id: 5,
    icon: CreditCard,
    title: 'Վճարման պայմաններ',
    highlight: false,
    content: [
      'ԸՆԴՈՒՆՎՈՂ ՎՃԱՐՄԱՆ ՁԵՎԵՐ — Visa, Mastercard, Arca բանկային քարտեր, ինչպես նաև կայքում ցուցադրված այլ վճարային մեթոդներ:',
      'ՎՃԱՐՄԱՆ ԱՆՎՏԱՆԳՈՒԹՅՈՒՆ — Վճարումները մշակվում են SSL/TLS գաղտնագրումով: Քարտի տվյալները չեն պահվում GoCinema-ի սերվերներում:',
      'ՎՃԱՐՄԱՆ ՀԱՍՏԱՏՈՒՄ — Հաջող վճարումից հետո QR կոդը ակտիվանում է անմիջապես: Հաստատման ծանուցում կստանաք:',
      'ՁԱԽՈՂՎԱԾ ՎՃԱՐՈՒՄ — Ձախողված վճարման դեպքում ամրագրումը չի ավարտվի: Նստատեղը կազատվի:',
      'ԱՐԺՈՒՅԹ — Բոլոր վճարումները կատարվում են ՀՀ դրամով (֏):',
      'ՍՏՈՒԳԱԹԵՐԹ/ՀԱՇԻՎ-ԱՊՐԱՆՔԱԳԻՐ — Հարցման դեպքում կտրամադրվի վճարման հաստատող փաստաթուղթ: Դիմեք info@gocinema.am:',
    ],
  },
  {
    id: 6,
    icon: XCircle,
    title: 'Չեղարկում և Վերադարձ',
    highlight: false,
    content: [
      'Վճարված կինոտոմսերը ՉԵՆ ՎԵՐԱԴԱՐՁՎՈՒՄ — ֆիլմի ցուցադրությունը ծառայություն է, ոչ ֆիզիկական ապրանք:',
      'Ֆիլմ «դուր չի եկել», ուշ եք ժամանել, կամ չեք ներկայացել («no-show») — վերադարձ չի կատարվում:',
      'Բացառություն. GoCinema-ն ինքն է չեղարկել ցուցադրությունը — ամբողջ գումարը ավտոմատ վերադարձվում է 5 աշխ. օրվա ընթացքում:',
      'Բացառություն. GoCinema-ն փոխել է ցուցադրության ժամը/ամսաթիվը, և դուք չեք կարողանում ներկայանալ — վերադարձ կատարվում է հայտ ներկայացնելուց հետո:',
      'Բացառություն. Կրկնակի վճարման (duplicate charge) դեպքում — կրկնակի գումարը վերադարձվում է 3 աշխ. օրվա ընթացքում:',
      'Ամբողջական Չեղարկման և Վերադարձի Քաղաքականությունը հասանելի է /refund էջում:',
    ],
  },
  {
    id: 7,
    icon: User,
    title: 'Հաշվի ստեղծում և օգտատիրոջ պարտավորություններ',
    highlight: false,
    content: [
      'Հաշիվ ստեղծելու համար անհրաժեշտ է տրամադրել ճշգրիտ անձնական տվյալներ (անուն, հեռախոսահամար):',
      'Մեկ հեռախոսահամար կարող է օգտագործվել միայն մեկ հաշվի համար:',
      'Դուք պատասխանատու եք ձեր հաշվի անվտանգության, ներառյալ գաղտնաբառի գաղտնիության, համար:',
      'Ձեր հաշվի միջոցով կատարված բոլոր գործողությունները համարվում են ձեր կողմից կատարված:',
      'Կասկածելի գործողությունների դեպքում անմիջապես կապ հաստատեք մեզ հետ:',
      'GoCinema-ն իրավունք ունի կասեցնել կամ ջնջել հաշիվը Պայմանների խախտման դեպքում:',
    ],
  },
  {
    id: 8,
    icon: Shield,
    title: 'GoCinema-ի պատասխանատվության սահմանափակում',
    highlight: false,
    content: [
      'GoCinema-ն ծառայություն մատուցող կազմակերպություն է և չի կրում պատասխանատվություն ֆիլմի բովանդակության, ժանրի կամ տարիքային սահմանափակումների համար:',
      'GoCinema-ն չի պատասխանատու ֆիլմի ստեղծողների կողմից ցուցադրությունը հետ կանչելու դեպքում — նման դեպքում կատարվում է ամբողջական վերադարձ:',
      'GoCinema-ն չի պատասխանատու ֆորս-մաժոր հանգամանքների (բնական աղետ, պատերազմ, կառավարության արգելք) դեպքում:',
      'GoCinema-ն չի պատասխանատու ինտերնետ կապի, բանկային կամ վճարային համակարգի խնդիրների համար:',
      'GoCinema-ի առավելագույն պատասխանատվությունը սահմանափակվում է ձեր կողմից վճարված գումարի չափով:',
    ],
  },
  {
    id: 9,
    icon: AlertCircle,
    title: 'Արգելված գործողություններ',
    highlight: false,
    content: [
      'Տոմսերի վերավաճառք կամ փոխանցում երրորդ անձանց՝ առանց GoCinema-ի գրավոր թույլտվության:',
      'QR կոդի կրկնօրինակում, կեղծում կամ ոչ լիազոր օգտագործում:',
      'Կայքի, ամրագրման կամ վճարային համակարգի ոչ լիազոր մուտք կամ շահագործում:',
      'Կեղծ կամ ոչ ճշգրիտ տվյալների տրամադրում գրանցման կամ ամրագրման ժամանակ:',
      'Ծառայությունների ավտոմատ ամրագրում (bot-ների կամ script-ների օգտագործում):',
      'Կինոթատրոնի տարածքում ֆիլմի ոչ լիազոր ձայնագրում կամ նկարահանում:',
    ],
  },
  {
    id: 10,
    icon: Calendar,
    title: 'Ցուցադրությունների փոփոխություն և չեղարկում GoCinema-ի կողմից',
    highlight: false,
    content: [
      'GoCinema-ն պահպանում է իրավունքը փոփոխել ֆիլմի ցուցադրության ժամը, ամսաթիվը կամ դահլիճը:',
      'Ցուցադրության ժամի/ամսաթվի փոփոխության դեպքում ամրագրված հաճախորդները կտեղեկացվեն հնարավոր կարճ ժամկետում:',
      'Ցուցադրության ամբողջական չեղարկման դեպքում բոլոր ամրագրված տոմսերի գումարը ավտոմատ կվերադարձվի 5 աշխ. օրվա ընթացքում:',
      'Ֆիլմի ցուցադրությունից 30 րոպե անց ֆիլմի ընդհատման դեպքում կատարվում է մասնակի կամ ամբողջական փոխհատուցում՝ անհատական քննարկման կարգով:',
    ],
  },
  {
    id: 11,
    icon: CheckCircle,
    title: 'Ինտելեկտուալ սեփականություն',
    highlight: false,
    content: [
      'Կայքի բոլոր բովանդակությունը (տեքստ, պատկեր, լոգո, ինտերֆեյս) GoCinema-ի սեփականությունն է:',
      'Ֆիլմերի անվանումները, պոստերները և նկարագրությունները պատկանում են համապատասխան ֆիլմի ստեղծողներին:',
      'Արգելվում է կայքի բովանդակությունը պատճենել, վերարտադրել կամ տարածել առանց գրավոր թույլտվության:',
    ],
  },
  {
    id: 12,
    icon: Gavel,
    title: 'Կիրառելի իրավունք և վեճերի լուծում',
    highlight: false,
    content: [
      'Սույն Պայմանները կարգավորվում են ՀՀ օրենսդրությամբ:',
      'Ցանկացած վեճ նախ պետք է լուծվի բանակցությունների միջոցով՝ կապ հաստատելով GoCinema-ի հաճախորդների աջակցության հետ:',
      'Եթե 14 աշխ. օրվա ընթացքում լուծում չի ձեռք բերվել, կողմերն իրավունք ունեն դիմել ՀՀ Սպառողների պաշտպանության պետական տեսչություն կամ ՀՀ դատարաններ:',
      'Վեճերի լուծման ենթակա դատարանը ՀՀ Մարտունու ընդհանուր իրավասության դատարանն է:',
    ],
  },
  {
    id: 13,
    icon: Clock,
    title: 'Ծանուցումների կարգ',
    highlight: false,
    content: [
      'GoCinema-ն ծանուցումներ ուղարկում է ձեր հաշվի հեռախոսահամարին կամ կայքի ծանուցման համակարգի միջոցով:',
      'Ձեր կողմից GoCinema-ին ուղղված ծանուցումները պետք է ուղարկվեն info@gocinema.am հասցեին կամ +374 77 769 668 հեռախոսով:',
      'Ծանուցումը համարվում է ստացված. էլ. փոստի դեպքում — ուղարկելուց 24 ժամ հետո, հեռախոսի դեպքում — անմիջապես:',
    ],
  },
];

export default function TermsPageClient() {
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
            <div className="p-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl shadow-lg">
              <FileText className="w-12 h-12 text-white" />
            </div>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl md:text-5xl font-bold text-gray-900 mb-3"
          >
            Օգտագործման պայմաններ
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="text-base text-gray-500 mb-1"
          >
            Ծառայությունների մատուցման կանոններ և պայմաններ (Terms &amp;
            Conditions)
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-sm text-gray-400"
          >
            Վերջին թարմացում. {formatArmenianDate(new Date())}
          </motion.p>
        </div>

        {/* Introduction */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="max-w-4xl mx-auto mb-10"
        >
          <div className="bg-white rounded-xl shadow-lg p-8 border-l-4 border-purple-600 space-y-4">
            <p className="text-gray-700 text-lg leading-relaxed">
              Բարի գալուստ GoCinema: Սույն փաստաթուղթը սահմանում է GoCinema
              կինոթատրոնի ծառայությունների մատուցման, տոմսերի վաճառքի, կինոբարի
              ապրանքների վաճառքի պայմաններն ու կանոնները:
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-sm font-medium border border-purple-200">
                <Gavel className="w-3.5 h-3.5" />
                ՀՀ Քաղ. օրենսգիրք
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium border border-blue-200">
                <Shield className="w-3.5 h-3.5" />
                ՀՀ «Սպառողների պաշտպանության մասին» օրենք
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-sm font-medium border border-green-200">
                <Info className="w-3.5 h-3.5" />
                ՀՀ «Էլեկտրոնային առևտրի մասին» օրենք
              </span>
            </div>
          </div>
        </motion.div>

        {/* Quick nav */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="max-w-4xl mx-auto mb-10"
        >
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Բովանդակություն
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-sm">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#section-${s.id}`}
                  className="flex items-center gap-2 text-gray-600 hover:text-purple-600 transition-colors py-0.5"
                >
                  <span className="w-5 h-5 bg-purple-50 text-purple-600 rounded text-xs flex items-center justify-center font-semibold shrink-0">
                    {s.id}
                  </span>
                  {s.title}
                </a>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Sections */}
        <div className="max-w-5xl mx-auto space-y-6">
          {sections.map((section, index) => {
            const Icon = section.icon;
            return (
              <motion.div
                key={section.id}
                id={`section-${section.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 + index * 0.05 }}
                className={`bg-white rounded-2xl shadow-md border overflow-hidden ${
                  section.highlight
                    ? 'border-purple-300 ring-1 ring-purple-200'
                    : 'border-gray-200'
                }`}
              >
                <div
                  className={`px-6 py-5 flex items-center gap-3 ${
                    section.highlight
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600'
                      : 'bg-gradient-to-r from-slate-700 to-slate-900'
                  }`}
                >
                  <div className="p-2 bg-white/15 rounded-lg shrink-0">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <span className="text-white/60 text-xs font-medium">
                      {section.id}.
                    </span>
                    <h2 className="text-lg font-bold text-white leading-tight">
                      {section.title}
                    </h2>
                  </div>
                </div>
                <div className="p-6">
                  <ul className="space-y-3">
                    {section.content.map((item, itemIndex) => (
                      <li key={itemIndex} className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-2 shrink-0" />
                        <span className="text-gray-700 text-sm leading-relaxed">
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            );
          })}

          {/* Contact Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.9 }}
            className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-8 text-white shadow-xl"
          >
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-3 flex items-center justify-center gap-3">
                <Mail className="w-6 h-6" />
                Հարցեր ունե՞ք
              </h2>
              <p className="text-white/85 mb-6 text-sm">
                Եթե ունեք հարցեր սույն Պայմանների վերաբերյալ, կապ հաստատեք մեզ
                հետ:
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
                <a
                  href="mailto:info@gocinema.am"
                  className="flex items-center gap-2 hover:text-white/80 transition-colors"
                >
                  <Mail className="w-5 h-5" />
                  info@gocinema.am
                </a>
                <a
                  href="tel:+37477769668"
                  className="flex items-center gap-2 hover:text-white/80 transition-colors"
                >
                  <Phone className="w-5 h-5" />
                  +374 77 769 668
                </a>
                <div className="flex items-center gap-2 text-white/80">
                  <MapPin className="w-5 h-5" />
                  ք. Մարտունի, Հայաստան
                </div>
              </div>
              <div className="pt-5 border-t border-white/20 flex flex-wrap gap-3 justify-center">
                <Link
                  href="/refund"
                  className="px-4 py-2 bg-white/15 hover:bg-white/25 rounded-lg text-sm font-medium transition-colors"
                >
                  Վերադարձի քաղաքականություն
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

          {/* Related links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.95 }}
            className="bg-gray-50 rounded-xl p-6 border border-gray-200"
          >
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">
              Կապված փաստաթղթեր
            </h3>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link
                href="/refund"
                className="flex items-center gap-1.5 text-red-600 hover:text-red-700 hover:underline font-medium"
              >
                <XCircle className="w-4 h-4" />
                Չեղարկման և Վերադարձի Քաղաքականություն
              </Link>
              <Link
                href="/privacy"
                className="flex items-center gap-1.5 text-purple-600 hover:text-purple-700 hover:underline"
              >
                <Shield className="w-4 h-4" />
                Անձնական տվյալների մշակման քաղաքականություն
              </Link>
              <Link
                href="/rules"
                className="flex items-center gap-1.5 text-purple-600 hover:text-purple-700 hover:underline"
              >
                <FileText className="w-4 h-4" />
                Կինոթատրոնի կանոններ
              </Link>
              <Link
                href="/faq"
                className="flex items-center gap-1.5 text-purple-600 hover:text-purple-700 hover:underline"
              >
                <Info className="w-4 h-4" />
                Հաճախ տրվող հարցեր
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
