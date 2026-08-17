import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicLicenseContract } from '@/app/actions/license-contracts';
import PublicContractClient from '@/components/contracts/public-contract-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Props = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const data = await getPublicLicenseContract(token);
  if (!data.success || !data.contract) {
    return { title: 'Պայմանագիր - GoCinema' };
  }
  return {
    title: `Լիցենզային պայմանագիր № ${data.contract.number} — ${data.contract.content.movieTitle}`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicContractPage({ params }: Props) {
  const { token } = await params;
  const data = await getPublicLicenseContract(token);
  if (!data.success || !data.contract) {
    notFound();
  }

  return (
    <PublicContractClient
      token={token}
      number={data.contract.number}
      status={data.contract.status}
      agreedAt={data.contract.agreedAt}
      signedUrl={data.contract.signedUrl}
      signedName={data.contract.signedName}
      content={data.contract.content}
      bodyHtml={data.contract.bodyHtml}
    />
  );
}
