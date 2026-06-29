import { Metadata } from 'next';
import MainTemplate from '@/components/layout/main-template/main-template';
import PackagesPageClient from '@/components/packages/packages-page-client';

export const metadata: Metadata = {
  title: 'Փաթեթներ և Դահլիճի Վարձակալություն - GoCinema',
  description:
    'Փակ կինոդիտում ծնունդների և երեկույթների համար, կորպորատիվ ու պրեզենտացիոն փաթեթներ, ինչպես նաև ռոմանտիկ VIP ժամադրություններ GoCinema-ում։',
};

export default function PackagesPage() {
  return (
    <MainTemplate>
      <PackagesPageClient />
    </MainTemplate>
  );
}
