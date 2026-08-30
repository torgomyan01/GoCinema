import { Metadata } from 'next';
import PackagesSlide from '@/components/packages/packages-slide';

export const metadata: Metadata = {
  title: 'Փաթեթների սլայդ 21:9 - GoCinema',
  robots: { index: false, follow: false },
};

export default function PackagesSlidePage() {
  return <PackagesSlide />;
}
