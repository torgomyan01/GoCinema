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

const sections = [
  {
    id: 1,
    icon: FileText,
    title: 'Ընդհանուր տեղեկություններ',
    content: [
      'GoCinema-ն պարտավորվում է պաշտպանել մեր օգտատերերի գաղտնիությունը:',
      'Այս Գաղտնիության քաղաքականությունը նկարագրում է, թե ինչպես ենք մենք հավաքագրում, օգտագործում և պաշտպանում ձեր անձնական տվյալները:',
      'Օգտագործելով մեր կայքը, դուք համաձայնում եք այս քաղաքականության պայմաններին:',
      'Մենք պահպանում ենք իրավունքը փոփոխել այս քաղաքականությունը ցանկացած ժամանակ:',
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
    title: 'Տվյալների պահպանում',
    content: [
      'Տվյալները պահվում են այնքան ժամանակ, որքան անհրաժեշտ է ծառայությունների մատուցման համար:',
      'Օրենքով պահանջվող տվյալները պահվում են համապատասխան ժամկետով:',
      'Ջնջման հարցումների դեպքում տվյալները ջնջվում են 30 օրվա ընթացքում:',
      'Պահվում են միայն անհրաժեշտ տվյալները:',
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
            className="text-5xl md:text-6xl font-bold text-gray-900 mb-4"
          >
            Գաղտնիության քաղաքականություն
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl text-gray-600 max-w-2xl mx-auto"
          >
            Վերջին թարմացում.{' '}
            {new Date().toLocaleDateString('hy-AM', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </motion.p>
        </div>

        {/* Introduction */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="max-w-4xl mx-auto mb-12"
        >
          <div className="bg-white rounded-xl shadow-lg p-8 border-l-4 border-purple-600">
            <p className="text-gray-700 text-lg leading-relaxed">
              GoCinema-ն հարգում է ձեր գաղտնիությունը և պարտավորվում է պաշտպանել
              ձեր անձնական տվյալները: Այս փաստաթուղթը բացատրում է, թե ինչպես ենք
              մենք հավաքագրում, օգտագործում և պաշտպանում ձեր տվյալները:
            </p>
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
