import { Metadata } from 'next';
import { unstable_noStore } from 'next/cache';
import MainTemplate from '@/components/layout/main-template/main-template';
import TermsPageClient from '@/components/terms/terms-page-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Օգտագործման պայմաններ և ծառայությունների մատուցման կանոններ - GoCinema',
  description:
    'GoCinema կինոթատրոնի ծառայությունների մատուցման, տոմսերի վաճառքի, վճարման, չեղարկման պայմաններ (Terms & Conditions)',
};

export default async function TermsPage() {
  unstable_noStore();

  return (
    <MainTemplate>
      <TermsPageClient />
    </MainTemplate>
  );
}
