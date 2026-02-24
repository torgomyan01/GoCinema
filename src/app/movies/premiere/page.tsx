import { Metadata } from 'next';
import { unstable_noStore } from 'next/cache';
import MainTemplate from '@/components/layout/main-template/main-template';
import PremierePageClient from '@/components/movies/premiere-page-client';
import { getPremieres } from '@/app/actions/premieres';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Պրեմիերաներ - GoCinema',
  description: 'Նոր ֆիլմերի պրեմիերաներ GoCinema կինոթատրոնում',
};

export default async function PremierePage() {
  unstable_noStore();

  const premieresResult = await getPremieres();
  const premieres = premieresResult.success && premieresResult.premieres ? premieresResult.premieres : [];

  return (
    <MainTemplate>
      <PremierePageClient premieres={premieres} />
    </MainTemplate>
  );
}
