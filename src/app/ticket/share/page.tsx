import ShareTicketPageClient from '@/components/tickets/share-ticket-page-client';

interface ShareTicketPageProps {
  searchParams?: Promise<{
    code?: string | string[];
  }>;
}

export default async function ShareTicketPage({ searchParams }: ShareTicketPageProps) {
  const params = await searchParams;
  const rawCode = params?.code;
  const code =
    typeof rawCode === 'string'
      ? rawCode
      : Array.isArray(rawCode)
        ? rawCode[0] || ''
        : '';

  return <ShareTicketPageClient initialCode={code} />;
}

