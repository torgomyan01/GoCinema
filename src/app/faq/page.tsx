import { Metadata } from 'next';
import { unstable_noStore } from 'next/cache';
import MainTemplate from '@/components/layout/main-template/main-template';
import FAQPageClient from '@/components/faq/faq-page-client';
import { getFAQs } from '@/app/actions/faq';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Հաճախակի հարցեր - GoCinema',
  description: 'Հաճախակի տրվող հարցեր և պատասխաններ GoCinema կինոթատրոնի մասին',
};

export default async function FAQPage() {
  unstable_noStore();

  const faqsResult = await getFAQs();
  const faqs = faqsResult.success && faqsResult.faqs ? faqsResult.faqs : [];

  return (
    <MainTemplate>
      <FAQPageClient faqs={faqs} />
    </MainTemplate>
  );
}
