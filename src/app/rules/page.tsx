import { Metadata } from 'next';
import { unstable_noStore } from 'next/cache';
import MainTemplate from '@/components/layout/main-template/main-template';
import RulesPageClient from '@/components/rules/rules-page-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Կանոններ - GoCinema',
  description: 'GoCinema կինոթատրոնի կանոններ և կարգավորումներ',
};

export default async function RulesPage() {
  unstable_noStore();

  return (
    <MainTemplate>
      <RulesPageClient />
    </MainTemplate>
  );
}
