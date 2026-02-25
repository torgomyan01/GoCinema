import { Metadata } from 'next';
import { unstable_noStore } from 'next/cache';
import MainTemplate from '@/components/layout/main-template/main-template';
import PrivacyPageClient from '@/components/privacy/privacy-page-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Անձնական տվյալների մշակման քաղաքականություն - GoCinema',
  description: 'GoCinema կինոթատրոնի անձնական տվյալների մշակման և գաղտնիության քաղաքականություն',
};

export default async function PrivacyPage() {
  unstable_noStore();

  return (
    <MainTemplate>
      <PrivacyPageClient />
    </MainTemplate>
  );
}
