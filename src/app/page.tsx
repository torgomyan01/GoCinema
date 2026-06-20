import MainTemplate from '@/components/layout/main-template/main-template';
import HeroSection from '@/components/home/hero-section';
import MoviesSection from '@/components/home/movies-section';
import ScheduleSection from '@/components/home/schedule-section';
import FeaturesSection from '@/components/home/features-section';
import CinemaExperienceSection from '@/components/home/cinema-experience-section';
import BookingJourneySection from '@/components/home/booking-journey-section';
import FAQSection from '@/components/home/faq-section';
import { Metadata } from 'next';
import { unstable_noStore } from 'next/cache';
import { getFAQs } from '@/app/actions/faq';
import { getUpcomingScreeningMovies } from '@/app/actions/screenings';

// Force dynamic rendering to prevent caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'GoCinema - Կինոթատրոն | Տոմսերի ամրագրում',
  description:
    'GoCinema - Երևանի լավագույն կինոթատրոնը: Ամրագրեք տոմսեր օնլայն, դիտեք նոր ֆիլմեր, վայելեք կինոփորձը 80 նստատեղանոց դահլիճում:',
  keywords: 'կինոթատրոն, GoCinema, կինո Երևան, տոմսերի ամրագրում, կինո տոմսեր',
  openGraph: {
    title: 'GoCinema - Կինոթատրոն Երևանում',
    description:
      'GoCinema - Երևանի լավագույն կինոթատրոնը: Ամրագրեք տոմսեր օնլայն, դիտեք նոր ֆիլմեր',
    type: 'website',
    siteName: 'GoCinema',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GoCinema - Կինոթատրոն Երևանում',
    description:
      'GoCinema - Երևանի լավագույն կինոթատրոնը: Ամրագրեք տոմսեր օնլայն, դիտեք նոր ֆիլմեր',
  },
};

export default async function Page() {
  // Disable caching for this page to always get fresh data
  unstable_noStore();

  // Fetch FAQs for the FAQ section
  const faqsResult = await getFAQs();
  const faqs = faqsResult.success && faqsResult.faqs ? faqsResult.faqs : [];

  // Fetch upcoming screening movies for the hero card
  const upcomingResult = await getUpcomingScreeningMovies(4);
  const upcomingMovies = upcomingResult.success ? upcomingResult.movies : [];

  return (
    <MainTemplate>
      <HeroSection upcomingMovies={upcomingMovies} />
      <MoviesSection />
      <CinemaExperienceSection />
      <ScheduleSection />
      <FeaturesSection />
      <BookingJourneySection />
      <FAQSection faqs={faqs} />
    </MainTemplate>
  );
}
