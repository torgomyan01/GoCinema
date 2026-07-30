import {
  Briefcase,
  Heart,
  PartyPopper,
  type LucideIcon,
} from 'lucide-react';

export interface PackageItem {
  id: string;
  icon: LucideIcon;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  features: string[];
  gradient: string;
  iconBg: string;
  accent: string;
}

export const packages: PackageItem[] = [
  {
    id: 'private-party',
    icon: PartyPopper,
    badge: 'Ամենապահանջվածը',
    title: 'Փակ Կինոդիտում',
    subtitle: 'Private Party',
    description:
      'Տարածքի տրամադրում ծննդյան տոների, երեկույթների կամ ընկերական հավաքույթների համար։ Հաճախորդը վարձակալում է ամբողջ դահլիճը 2–3 ժամով և ինքն է ընտրում ֆիլմը կամ տեսանյութը։',
    features: [
      'Ամբողջ դահլիճը՝ միայն ձեր հյուրերի համար',
      'Ֆիլմի կամ սեփական տեսանյութի ընտրություն',
      '2–3 ժամ վարձակալություն',
      'Կինոբարի սպասարկում՝ պոպկորն և ըմպելիքներ',
    ],
    gradient: 'from-purple-600 via-fuchsia-600 to-pink-600',
    iconBg: 'bg-purple-500/20 text-purple-300',
    accent: 'text-purple-300',
  },
  {
    id: 'corporate',
    icon: Briefcase,
    badge: 'Բիզնեսի համար',
    title: 'Կորպորատիվ և Պրեզենտացիոն Փաթեթ',
    subtitle: 'Business & Presentation',
    description:
      'Տեղական բիզնեսները կարող են օգտագործել տարածքը իրենց աշխատակիցների համար սեմինարներ, թիմ-բիլդինգներ կամ պրեզենտացիաներ անելու նպատակով։',
    features: [
      '8K պրոյեկտոր և մեծ պրոյեկցիոն էկրան',
      'Իդեալական սլայդների ու գրաֆիկների համար',
      'Սեմինար, թիմ-բիլդինգ կամ պրեզենտացիա',
      'Պրոֆեսիոնալ ձայնային համակարգ',
    ],
    gradient: 'from-blue-600 via-indigo-600 to-violet-600',
    iconBg: 'bg-blue-500/20 text-blue-300',
    accent: 'text-blue-300',
  },
  {
    id: 'vip-date',
    icon: Heart,
    badge: 'Հատուկ առիթներ',
    title: 'Ռոմանտիկ Ժամադրություն',
    subtitle: 'VIP Date',
    description:
      'Դահլիճի վարձակալություն միայն երկու հոգու համար՝ ամուսնության առաջարկությունների կամ հատուկ անակնկալների նպատակով։',
    features: [
      'Ամբողջ դահլիճը՝ միայն երկուսի համար',
      'Իդեալական ամուսնության առաջարկության համար',
      'Համագործակցություն ծաղկի սրահների հետ',
      'Անհատական անակնկալների կազմակերպում',
    ],
    gradient: 'from-rose-600 via-red-600 to-orange-600',
    iconBg: 'bg-rose-500/20 text-rose-300',
    accent: 'text-rose-300',
  },
];
