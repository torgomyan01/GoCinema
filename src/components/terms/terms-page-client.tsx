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
} from 'lucide-react';
import Link from 'next/link';

const sections = [
  {
    id: 1,
    icon: FileText,
    title: 'Ընդհանուր պայմաններ',
    content: [
      'GoCinema-ն կինոթատրոնային ծառայություններ մատուցող հարթակ է:',
      'Օգտագործելով մեր կայքը և ծառայությունները, դուք համաձայնում եք հետևյալ պայմաններին:',
      'Այս պայմանները կարող են փոփոխվել ցանկացած ժամանակ առանց նախապես ծանուցման:',
      'Օգտագործումը նշանակում է, որ դուք ընդունում եք բոլոր պայմանները:',
      'Եթե դուք չեք համաձայնում այս պայմաններին, խնդրում ենք չօգտագործել մեր ծառայությունները:',
    ],
  },
  {
    id: 2,
    icon: User,
    title: 'Հաշվի ստեղծում և օգտագործում',
    content: [
      'Դուք պետք է լինեք առնվազն 12 տարեկան, որպեսզի ստեղծեք հաշիվ:',
      'Դուք պատասխանատու եք ձեր հաշվի անվտանգության համար:',
      'Դուք պետք է տրամադրեք ճշգրիտ և ամբողջական տեղեկություններ:',
      'Մեկ հեռախոսահամար կարող է օգտագործվել միայն մեկ հաշվի համար:',
      'Դուք չպետք է կիսվեք ձեր գաղտնաբառով այլ անձանց հետ:',
      'Եթե կասկածում եք, որ ձեր հաշիվը կարող է վտանգված լինել, անմիջապես կապ հաստատեք մեզ հետ:',
    ],
  },
  {
    id: 3,
    icon: Ticket,
    title: 'Տոմսերի ամրագրում և օգտագործում',
    content: [
      'Տոմսերը ամրագրվում են առցանց և ենթակա են հասանելիության:',
      'Տոմսերի գները կարող են տարբերվել կախված նստատեղի տեսակից և ցուցադրության ժամանակից:',
      'Վճարված տոմսերը չեն կարող վերադարձվել կամ փոխարինվել, բացառությամբ հատուկ դեպքերի:',
      'Տոմսերը վավեր են միայն նշված ցուցադրության և ամսաթվի համար:',
      'Մուտքը կինոթատրոն կատարվում է QR կոդով կամ տոմսի համարով:',
      'Ուշացումների դեպքում մուտքը կարող է սահմանափակվել:',
    ],
  },
  {
    id: 4,
    icon: CreditCard,
    title: 'Վճարումներ',
    content: [
      'Վճարումները կատարվում են առցանց՝ օգտագործելով վստահելի վճարային միջոցներ:',
      'Մենք ընդունում ենք բանկային քարտեր և այլ վճարային մեթոդներ:',
      'Վճարումների մշակումը կատարվում է անվտանգ կերպով:',
      'Վճարման հաստատումից հետո տոմսերը ակտիվանում են:',
      'Եթե վճարումը ձախողվի, պատվերը չի ավարտվի:',
      'Վճարման վերաբերյալ բոլոր հարցերը պետք է ուղղվեն մեր աջակցության թիմին:',
    ],
  },
  {
    id: 5,
    icon: XCircle,
    title: 'Վերադարձ և փոխարինում',
    content: [
      'Վճարված տոմսերը, որպես կանոն, չեն վերադարձվում:',
      'Ցուցադրության չեղարկման դեպքում տոմսերը ավտոմատ կվերադարձվեն:',
      'Հատուկ դեպքերում վերադարձը կարող է դիտարկվել անհատապես:',
      'Վերադարձի հարցումները պետք է ներկայացվեն առնվազն 24 ժամ առաջ:',
      'Վերադարձված գումարը կվերադարձվի նույն վճարային մեթոդով:',
      'Վերադարձի մշակումը կարող է տևել 5-10 աշխատանքային օր:',
    ],
  },
  {
    id: 6,
    icon: Shield,
    title: 'Պատասխանատվություն',
    content: [
      'GoCinema-ն չի պատասխանատու ցուցադրության չեղարկման կամ փոփոխության համար:',
      'Մենք չենք պատասխանատու օգտատիրոջ սարքավորումների կամ ինտերնետ կապի խնդիրների համար:',
      'Օգտատերերը պատասխանատու են իրենց գործողությունների համար:',
      'Մենք պահպանում ենք իրավունքը մերժել ծառայություններ ցանկացած օգտատիրոջ:',
      'Օգտագործման ընթացքում առաջացած վնասների համար GoCinema-ն չի պատասխանատու:',
      'Օգտատերերը պետք է հետևեն կինոթատրոնի կանոններին և վարքագծի կոդին:',
    ],
  },
  {
    id: 7,
    icon: AlertCircle,
    title: 'Արգելված գործողություններ',
    content: [
      'Տոմսերի վերավաճառք առանց GoCinema-ի թույլտվության:',
      'Պատվերների կեղծում կամ խարդախություն:',
      'Համակարգի անվտանգության խախտում:',
      'Այլ օգտատերերի հաշիվների օգտագործում:',
      'Վնասակար ծրագրերի կամ վիրուսների տարածում:',
      'Սպամ կամ անցանկալի հաղորդագրությունների ուղարկում:',
      'Ինտելեկտուալ սեփականության իրավունքների խախտում:',
    ],
  },
  {
    id: 8,
    icon: Calendar,
    title: 'Ցուցադրությունների փոփոխություն',
    content: [
      'GoCinema-ն պահպանում է իրավունքը փոփոխել ցուցադրությունների ժամանակացույցը:',
      'Ցուցադրության չեղարկման դեպքում օգտատերերը կտեղեկացվեն:',
      'Փոփոխությունների մասին տեղեկությունները կհրապարակվեն կայքում:',
      'Օգտատերերը կարող են փոխարինել տոմսերը կամ ստանալ վերադարձ:',
      'Մենք ձգտում ենք նվազագույնի հասցնել փոփոխությունները:',
    ],
  },
  {
    id: 9,
    icon: CheckCircle,
    title: 'Ինտելեկտուալ սեփականություն',
    content: [
      'Կայքի բոլոր բովանդակությունը, ներառյալ տեքստերը, պատկերները և լոգոն, GoCinema-ի սեփականությունն է:',
      'Բովանդակությունը չի կարող օգտագործվել առանց թույլտվության:',
      'Ֆիլմերի պատկերները և տեղեկությունները օգտագործվում են միայն տեղեկատվական նպատակներով:',
      'Օգտատերերը չեն կարող պատճենել, վերարտադրել կամ տարածել բովանդակությունը:',
      'Պատժվում է ինտելեկտուալ սեփականության իրավունքների խախտումը:',
    ],
  },
  {
    id: 10,
    icon: Clock,
    title: 'Ծառայությունների փոփոխություն',
    content: [
      'GoCinema-ն պահպանում է իրավունքը փոփոխել կամ դադարեցնել ծառայությունները:',
      'Մենք կարող ենք ավելացնել կամ հեռացնել գործառույթներ:',
      'Ծառայությունների փոփոխությունների մասին կտեղեկացվեն օգտատերերը:',
      'Մենք ձգտում ենք ապահովել ծառայությունների անխափան աշխատանքը:',
      'Տեխնիկական աշխատանքների ժամանակ ծառայությունները կարող են ժամանակավորապես անհասանելի լինել:',
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
            className="text-5xl md:text-6xl font-bold text-gray-900 mb-4"
          >
            Օգտագործման պայմաններ
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
              Բարի գալուստ GoCinema: Այս Օգտագործման պայմանները կարգավորում են
              մեր կայքի և ծառայությունների օգտագործումը: Խնդրում ենք ուշադիր
              կարդալ այս պայմանները մինչև մեր ծառայությունները օգտագործելը:
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
            transition={{ duration: 0.5, delay: 1.3 }}
            className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-8 text-white shadow-xl"
          >
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-3">
                <FileText className="w-6 h-6" />
                Հարցեր օգտագործման պայմանների վերաբերյալ
              </h2>
              <p className="text-white/90 mb-6">
                Եթե ունեք հարցեր կամ մտահոգություններ մեր օգտագործման պայմանների
                վերաբերյալ, խնդրում ենք կապ հաստատել մեզ հետ:
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  <a
                    href="mailto:support@gocinema.am"
                    className="hover:underline"
                  >
                    support@gocinema.am
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-5 h-5" />
                  <a href="tel:+37477769668" className="hover:underline">
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
            transition={{ duration: 0.5, delay: 1.4 }}
            className="bg-gray-50 rounded-xl p-6 border border-gray-200"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Լրացուցիչ տեղեկություններ
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              Այս պայմանները կարող են թարմացվել ժամանակ առ ժամանակ: Մենք
              կտեղեկացնենք ձեզ կարևոր փոփոխությունների մասին էլեկտրոնային փոստով
              կամ կայքի ծանուցմամբ:
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
              <Link
                href="/privacy"
                className="text-purple-600 hover:text-purple-700 hover:underline"
              >
                Գաղտնիության քաղաքականություն
              </Link>
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
