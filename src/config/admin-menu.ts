import {
  Home,
  Film,
  Calendar,
  Grid3x3,
  ShoppingCart,
  Ticket,
  Users,
  BarChart3,
  Settings,
  HelpCircle,
  Mail,
  Sparkles,
  QrCode,
  LucideIcon,
} from 'lucide-react';

export interface AdminMenuItem {
  title: string;
  icon: LucideIcon;
  href: string;
  color: string;
  bgColor: string;
}

export const adminMenuItems: AdminMenuItem[] = [
  {
    title: 'Գլխավոր',
    icon: Home,
    href: '/admin',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  {
    title: 'Ֆիլմեր',
    icon: Film,
    href: '/admin/movies',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  {
    title: 'Ցուցադրություններ',
    icon: Calendar,
    href: '/admin/screenings',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    title: 'Պրեմիերաներ',
    icon: Sparkles,
    href: '/admin/premieres',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  {
    title: 'Նստատեղեր',
    icon: Grid3x3,
    href: '/admin/seats',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
  },
  {
    title: 'Արտադրանքներ',
    icon: ShoppingCart,
    href: '/admin/products',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
  },
  {
    title: 'Տոմսեր',
    icon: Ticket,
    href: '/admin/tickets',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  {
    title: 'Հաճախորդի մուտք',
    icon: QrCode,
    href: '/admin/scanner',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  {
    title: 'Օգտատերեր',
    icon: Users,
    href: '/admin/users',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
  {
    title: 'Հաճախակի հարցեր',
    icon: HelpCircle,
    href: '/admin/faq',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  {
    title: 'Կոնտակտներ',
    icon: Mail,
    href: '/admin/contacts',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    title: 'Վիճակագրություն',
    icon: BarChart3,
    href: '/admin/analytics',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
  },
  {
    title: 'Կարգավորումներ',
    icon: Settings,
    href: '/admin/settings',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
  },
];
