import { Metadata } from 'next';
import MainTemplate from '@/components/layout/main-template/main-template';
import RefundPageClient from '@/components/refund/refund-page-client';

export const metadata: Metadata = {
  title: 'Չեղարկման և Վերադարձի Քաղաքականություն - GoCinema',
  description:
    'GoCinema կինոթատրոնի տոմսերի չեղարկման, վերադարձի և փոխհատուցման քաղաքականություն',
};

export default function RefundPage() {
  return (
    <MainTemplate>
      <RefundPageClient />
    </MainTemplate>
  );
}
