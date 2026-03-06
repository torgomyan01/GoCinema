import { Metadata } from 'next';
import MainTemplate from '@/components/layout/main-template/main-template';
import AboutPageClient from '@/components/about/about-page-client';

export const metadata: Metadata = {
  title: 'Մեր մասին - GoCinema',
  description:
    'Իմացեք ավելին GoCinema կինոթատրոնի, մեր առաքելության, արժեքների և Մարտունիում մեր ստեղծած կինոփորձի մասին։',
};

export default function AboutPage() {
  return (
    <MainTemplate>
      <AboutPageClient />
    </MainTemplate>
  );
}

