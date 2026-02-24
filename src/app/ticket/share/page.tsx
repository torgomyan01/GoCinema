import ShareTicketPageClient from '@/components/tickets/share-ticket-page-client';

interface ShareTicketPageProps {
  searchParams?: {
    code?: string | string[];
  };
}

export default function ShareTicketPage({ searchParams }: ShareTicketPageProps) {
  const rawCode = searchParams?.code;
  const code =
    typeof rawCode === 'string'
      ? rawCode
      : Array.isArray(rawCode)
        ? rawCode[0] || ''
        : '';

  return <ShareTicketPageClient initialCode={code} />;
}

