'use client';

import { motion } from 'framer-motion';
import {
  Ticket,
  Users,
  Clock,
  Phone,
  CreditCard,
  Shield,
  AlertCircle,
  CheckCircle,
  XCircle,
  Film,
  ShoppingCart,
} from 'lucide-react';

const rules = [
  {
    id: 1,
    icon: Ticket,
    title: 'Տոմսերի ամրագրում և վճարում',
    items: [
      'Տոմսերը կարող են ամրագրվել առցանց կամ կինոթատրոնում:',
      'Առցանց ամրագրումների դեպքում վճարումը կատարվում է բանկային քարտով կամ բանկային փոխանցումով:',
      'Տոմսերը կարող են չեղարկվել կամ փոխվել ցուցադրությունից առնվազն 2 ժամ առաջ:',
      'Չեղարկված տոմսերի գումարը վերադարձվում է նույն մեթոդով, որով կատարվել է վճարումը:',
    ],
  },
  {
    id: 2,
    icon: Clock,
    title: 'ժամանակացույց և ժամանում',
    items: [
      'Խորհուրդ ենք տալիս ժամանել առնվազն 15-20 րոպե առաջ:',
      'Ցուցադրությունը սկսվում է ճշգրիտ ժամանակին:',
      'Ուշ ժամանած հաճախորդները կարող են չմտնել դահլիճ, եթե ցուցադրությունը արդեն սկսվել է:',
      'Ուշ ժամանման դեպքում տոմսերի գումարը չի վերադարձվում:',
    ],
  },
  {
    id: 3,
    icon: Users,
    title: 'Նստատեղերի ընտրություն',
    items: [
      'Նստատեղերը ընտրվում են ամրագրումների ժամանակ:',
      'Կանաչ նշված նստատեղերը ազատ են, կարմիր նշվածները զբաղված:',
      'Նստատեղերը չեն կարող փոխվել ցուցադրության ժամանակ:',
      'Խմբային ամրագրումների դեպքում նստատեղերը կարող են ընտրվել միասին:',
    ],
  },
  {
    id: 4,
    icon: ShoppingCart,
    title: 'Լրացուցիչ արտադրանքներ',
    items: [
      'Կինոթատրոնում կարելի է գնել պոպկորն, ըմպելիքներ, քաղցրավենիք և այլ նախուտեստներ:',
      'Արտադրանքները կարող են ամրագրվել առցանց կամ գնվել կինոթատրոնում:',
      'Սեփական սնունդ և ըմպելիքներ բերելը արգելվում է:',
      'Արտադրանքների գները նշված են մենյուում:',
    ],
  },
  {
    id: 5,
    icon: Film,
    title: 'Ցուցադրությունների կանոններ',
    items: [
      'Դահլիճ մուտքը թույլատրվում է միայն վճարված տոմսով:',
      'QR կոդը պետք է ներկայացվի մուտքի ժամանակ:',
      'Դահլիճում արգելվում է ծխել, ալկոհոլ օգտագործել:',
      'Բարձր ձայնով խոսելը և բջջային հեռախոսների օգտագործումը արգելվում է:',
      'Վիդեո և աուդիո ձայնագրությունները արգելվում են:',
    ],
  },
  {
    id: 6,
    icon: Shield,
    title: 'Անվտանգություն և վարքագիծ',
    items: [
      'Բոլոր հաճախորդները պարտավոր են պահպանել կարգուկանոնը:',
      'Անպատշաճ վարքագծի դեպքում հաճախորդը կարող է հեռացվել դահլիճից:',
      'Կինոթատրոնը պատասխանատվություն չի կրում հաճախորդների անձնական իրերի համար:',
      'Վնասվածքների կամ վթարների դեպքում անհապաղ կապ հաստատեք անձնակազմի հետ:',
    ],
  },
  {
    id: 7,
    icon: AlertCircle,
    title: 'Սահմանափակումներ',
    items: [
      '18+ ֆիլմերի ցուցադրություններին մուտքը թույլատրվում է միայն 18 տարեկանից բարձր անձանց:',
      'Նույնականացման փաստաթուղթ պահանջվում է:',
      'Կենդանիների մուտքը դահլիճ արգելվում է (բացառությամբ ուղեկցող շների):',
      'Մեծ բեռներ և պայուսակներ պետք է թողնել պահեստարանում:',
    ],
  },
  {
    id: 8,
    icon: CreditCard,
    title: 'Վերադարձ և փոխանակում',
    items: [
      'Տոմսերը կարող են վերադարձվել ցուցադրությունից առնվազն 2 ժամ առաջ:',
      'Վերադարձի դեպքում գումարը վերադարձվում է նույն մեթոդով:',
      'Վերադարձված տոմսերի համար կարող է գանձվել փոքր վճար:',
      'Վնասված կամ կորած տոմսերը չեն փոխարինվում:',
    ],
  },
];

const prohibitedItems = [
  'Սեփական սնունդ և ըմպելիքներ',
  'Ալկոհոլային խմիչքներ',
  'Ծխախոտ և ծխելու պարագաներ',
  'Սուր առարկաներ',
  'Վթարային իրեր',
  'Բարձր ձայնով սարքեր',
];

const allowedItems = [
  'Բջջային հեռախոս (լռության ռեժիմում)',
  'Փոքր պայուսակ',
  'Դեղորայք (անհրաժեշտության դեպքում)',
  'Ուղեկցող շուն (հատուկ թույլտվությամբ)',
];

export default function RulesPageClient() {
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
            Կանոններ և կարգավորումներ
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl text-gray-600 max-w-2xl mx-auto"
          >
            Ծանոթացեք GoCinema կինոթատրոնի կանոններին և կարգավորումներին
          </motion.p>
        </div>

        {/* Rules Sections */}
        <div className="max-w-5xl mx-auto space-y-8">
          {rules.map((rule, index) => {
            const Icon = rule.icon;
            return (
              <motion.div
                key={rule.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
              >
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 rounded-lg">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">
                      {rule.title}
                    </h2>
                  </div>
                </div>
                <div className="p-6">
                  <ul className="space-y-3">
                    {rule.items.map((item, itemIndex) => (
                      <li key={itemIndex} className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            );
          })}

          {/* Prohibited Items */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="bg-white rounded-xl shadow-lg border border-red-200 overflow-hidden"
          >
            <div className="bg-red-600 p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-lg">
                  <XCircle className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">Արգելված իրեր</h2>
              </div>
            </div>
            <div className="p-6">
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {prohibitedItems.map((item, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>

          {/* Allowed Items */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.9 }}
            className="bg-white rounded-xl shadow-lg border border-green-200 overflow-hidden"
          >
            <div className="bg-green-600 p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">
                  Թույլատրված իրեր
                </h2>
              </div>
            </div>
            <div className="p-6">
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {allowedItems.map((item, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>

          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1 }}
            className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-8 text-white shadow-xl"
          >
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4">
                Հարցեր ունե՞ք կանոնների վերաբերյալ
              </h2>
              <p className="text-white/90 mb-6">
                Մենք պատրաստ ենք պատասխանել ձեր բոլոր հարցերին
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="/contacts"
                  className="inline-block px-6 py-3 bg-white text-purple-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
                >
                  Կապ մեզ հետ
                </a>
                <a
                  href="/faq"
                  className="inline-block px-6 py-3 bg-white/20 text-white rounded-lg font-semibold hover:bg-white/30 transition-colors"
                >
                  Հաճախակի հարցեր
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
