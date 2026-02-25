'use client';

import { motion } from 'framer-motion';
import {
  Shield,
  Lock,
  Eye,
  Database,
  UserCheck,
  FileText,
  Mail,
  Phone,
  Calendar,
} from 'lucide-react';
import Link from 'next/link';

// Deterministic Armenian date formatter to avoid hydration mismatches
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
  const day = date.getDate();
  const monthName = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${monthName} ${year} թ.`;
};

const sections = [
  {
    id: 1,
    icon: FileText,
    title: 'Ընդհանուր տեղեկություններ',
    content: [
      'GoCinema-ն («ԳոՍինեմա», գտնվելու վայր՝ ք. Մարտունի, Հայաստան) պարտավորվում է պաշտպանել մեր օգտատերերի անձնական տվյալները:',
      'Սույն Անձնական տվյալների մշակման քաղաքականությունը (այսուհետ՝ «Քաղաքականություն») կազմված է ՀՀ «Անձնական տվյալների պաշտպանության մասին» 2015 թ. օրենքի պահանջներին համապատասխան:',
      'Քաղաքականությունը նկարագրում է, թե ինչ անձնական տվյալներ ենք մենք հավաքագրում, ինչ նպատակով, ինչ ժամկետով և ինչ կերպ ենք դրանք պաշտպանում:',
      'Կայքն օգտագործելով՝ դուք հաստատում եք, որ ծանոթ եք սույն Քաղաքականությանը և տալիս եք ձեր համաձայնությունը ձեր անձնական տվյալների մշակմանը:',
      'Մենք պահպանում ենք իրավունքը ցանկացած ժամանակ փոփոխել սույն Քաղաքականությունը՝ ծանուցելով ձեզ կայքի միջոցով:',
    ],
  },
  {
    id: 2,
    icon: Database,
    title: 'Հավաքագրվող տվյալներ',
    content: [
      'Անձնական տվյալներ. անուն, էլեկտրոնային հասցե, հեռախոսահամար, ծննդյան ամսաթիվ:',
      'Վճարման տվյալներ. բանկային քարտի տվյալներ (վճարումների համար, պահվում են անվտանգ կերպով):',
      'Օգտագործման տվյալներ. IP հասցե, բրաուզերի տեսակ, օգտագործման պատմություն:',
      'Տոմսերի տվյալներ. ամրագրված տոմսեր, նստատեղեր, ցուցադրություններ:',
      'Հաղորդակցության տվյալներ. ձեր ուղարկած հաղորդագրություններ և հարցեր:',
    ],
  },
  {
    id: 3,
    icon: Eye,
    title: 'Տվյալների օգտագործում',
    content: [
      'Տոմսերի ամրագրում և կառավարում:',
      'Վճարումների մշակում:',
      'Հաճախորդների աջակցություն և հաղորդակցություն:',
      'Կայքի բարելավում և անվտանգության ապահովում:',
      'Օրինական պահանջների կատարում:',
      'Մարքեթինգային նյութերի ուղարկում (միայն ձեր համաձայնությամբ):',
    ],
  },
  {
    id: 4,
    icon: Lock,
    title: 'Տվյալների պաշտպանություն',
    content: [
      'Մենք օգտագործում ենք արդյունաբերական ստանդարտներին համապատասխան անվտանգության միջոցներ:',
      'Վճարման տվյալները գաղտնագրում ենք SSL/TLS տեխնոլոգիաներով:',
      'Մուտքագրում ենք խիստ մուտքի հսկողություն և մոնիտորինգ:',
      'Պարբերաբար թարմացնում ենք անվտանգության համակարգերը:',
      'Ձեր գաղտնաբառերը պահվում են գաղտնագրված ձևով:',
    ],
  },
  {
    id: 5,
    icon: UserCheck,
    title: 'Ձեր իրավունքները',
    content: [
      'Մուտք ձեր անձնական տվյալներին:',
      'Ուղղում և թարմացում:',
      'Ջնջում (առաջարկվում է օրենքով):',
      'Տվյալների փոխանցման սահմանափակում:',
      'Վիճարկում մշակման օգտագործման:',
      'Տվյալների պորտաբիլություն:',
    ],
  },
  {
    id: 6,
    icon: Shield,
    title: 'Cookie-ների օգտագործում',
    content: [
      'Մենք օգտագործում ենք cookie-ներ ձեր փորձը բարելավելու համար:',
      'Ֆունկցիոնալ cookie-ներ անհրաժեշտ են կայքի աշխատանքի համար:',
      'Անալիտիկ cookie-ներ օգնում են հասկանալ, թե ինչպես են օգտատերերը օգտագործում կայքը:',
      'Դուք կարող եք կառավարել cookie-ները ձեր բրաուզերի կարգավորումներում:',
      'Cookie-ների անջատումը կարող է ազդել կայքի որոշ գործառույթների վրա:',
    ],
  },
  {
    id: 7,
    icon: Database,
    title: 'Տվյալների փոխանցում',
    content: [
      'Մենք չենք վաճառում ձեր անձնական տվյալները երրորդ կողմերին:',
      'Տվյալները կարող են փոխանցվել վճարային մշակիչներին (վճարումների համար):',
      'Օգտագործվում են վստահելի ծառայություններ, որոնք համապատասխանում են GDPR-ին:',
      'Օրենքով պահանջվող դեպքերում տվյալները կարող են փոխանցվել պետական մարմիններին:',
    ],
  },
  {
    id: 8,
    icon: Calendar,
    title: 'Տվյալների պահպանման ժամկետ',
    content: [
      'Հաշվի տվյալները պահվում են հաշիվը ջնջելու կամ 3 տարի անգործության դեպքում:',
      'Տոմսերի և վճարումների տվյալները պահվում են 5 տարի (ՀՀ հաշվապահական հաշվառման օրենքի պահանջ):',
      'Ջնջման հարցումների դեպքում անձնական տվյալները ջնջվում են 30 օրացուցային օրվա ընթացքում:',
      'Անանունացված վիճակագրական տվյալները կարող են պահվել անժամկետ:',
    ],
  },
  {
    id: 9,
    icon: UserCheck,
    title: 'Համաձայնություն և հրաժարում',
    content: [
      'Կայքն օգտագործելիս կամ գրանցվելիս դուք տալիս եք ձեր ազատ, գիտակից և հստակ համաձայնությունը ձեր անձնական տվյալների մշակմանը:',
      'Դուք կարող եք ցանկացած ժամանակ հետ կանչել ձեր համաձայնությունը՝ ուղարկելով հարցում info@gocinema.am հասցեին:',
      'Համաձայնության հետ կանչումը չի ազդում մինչ այդ կատարված մշակման օրինականության վրա:',
      'Որոշ տվյալների մշակումը կարող է շարունակվել օրինական պարտավորությունների կատարման նպատակով:',
    ],
  },
];

export default function PrivacyPageClient() {
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
              <Shield className="w-12 h-12 text-white" />
            </div>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl md:text-5xl font-bold text-gray-900 mb-3"
          >
            Անձնական տվյալների մշակման քաղաքականություն
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="text-base text-gray-500 mb-1"
          >
            Գաղտնիության քաղաքականություն
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
          className="max-w-4xl mx-auto mb-12"
        >
          <div className="bg-white rounded-xl shadow-lg p-8 border-l-4 border-purple-600 space-y-4">
            <p className="text-gray-700 text-lg leading-relaxed">
              GoCinema-ն հարգում է ձեր գաղտնիությունը և պարտավորվում է պաշտպանել
              ձեր անձնական տվյալները: Սույն փաստաթուղթը բացատրում է, թե ինչ
              անձնական տվյալներ ենք մենք հավաքագրում, ինչ նպատակով, ինչ ժամկետով
              և ինչ կերպ ենք դրանք պաշտպանում:
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-sm font-medium border border-purple-200">
                <Shield className="w-3.5 h-3.5" />
                ՀՀ «Անձնական տվյալների պաշտպանության մասին» օրենք
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium border border-blue-200">
                <Lock className="w-3.5 h-3.5" />
                GDPR համապատասխանություն
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-sm font-medium border border-green-200">
                <UserCheck className="w-3.5 h-3.5" />
                Ձեր տվյալները չեն վաճառվում
              </span>
            </div>
          </div>
        </motion.div>

        {/* Sections */}
        <div className="max-w-5xl mx-auto space-y-8">
          {sections.map((section, index) => {
            const Icon = section.icon;
            return (
              <motion.div
                key={section.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
              >
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 rounded-lg">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">
                      {section.title}
                    </h2>
                  </div>
                </div>
                <div className="p-6">
                  <ul className="space-y-3">
                    {section.content.map((item, itemIndex) => (
                      <li key={itemIndex} className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-purple-600 rounded-full mt-2 flex-shrink-0" />
                        <span className="text-gray-700 leading-relaxed">
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
            transition={{ duration: 0.5, delay: 1.1 }}
            className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-8 text-white shadow-xl"
          >
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-3">
                <Lock className="w-6 h-6" />
                Հարցեր գաղտնիության վերաբերյալ
              </h2>
              <p className="text-white/90 mb-6">
                Եթե ունեք հարցեր կամ մտահոգություններ մեր գաղտնիության
                քաղաքականության վերաբերյալ, խնդրում ենք կապ հաստատել մեզ հետ:
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <div className="flex items-center gap-2">
                  <Phone className="w-5 h-5" />
                  <a href="tel:+37412345678" className="hover:underline">
                    +374 77 769 668
                  </a>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-white/20">
                <Link
                  href="/contacts"
                  className="inline-block px-6 py-3 bg-white text-purple-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
                >
                  Կապ մեզ հետ
                </Link>
              </div>
            </div>
          </motion.div>

          {/* Additional Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.2 }}
            className="bg-gray-50 rounded-xl p-6 border border-gray-200"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Լրացուցիչ տեղեկություններ
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              Այս քաղաքականությունը կարող է թարմացվել ժամանակ առ ժամանակ: Մենք
              կտեղեկացնենք ձեզ կարևոր փոփոխությունների մասին էլեկտրոնային փոստով
              կամ կայքի ծանուցմամբ:
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
              <Link
                href="/rules"
                className="text-purple-600 hover:text-purple-700 hover:underline"
              >
                Կանոններ
              </Link>
              <Link
                href="/faq"
                className="text-purple-600 hover:text-purple-700 hover:underline"
              >
                Հաճախակի հարցեր
              </Link>
              <Link
                href="/contacts"
                className="text-purple-600 hover:text-purple-700 hover:underline"
              >
                Կոնտակտներ
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
