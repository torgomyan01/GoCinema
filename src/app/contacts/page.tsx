import { Metadata } from 'next';
import { unstable_noStore } from 'next/cache';
import MainTemplate from '@/components/layout/main-template/main-template';
import ContactsPageClient from '@/components/contacts/contacts-page-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Կոնտակտներ - GoCinema',
  description:
    'Կապվեք GoCinema-ի հետ: Մենք պատրաստ ենք պատասխանել ձեր բոլոր հարցերին',
};

export default async function ContactsPage() {
  unstable_noStore();

  return (
    <MainTemplate>
      <ContactsPageClient />
    </MainTemplate>
  );
}
