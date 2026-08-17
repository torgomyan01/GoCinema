import LicenseContractDocument from '@/components/contracts/license-contract-document';
import type { LicenseContractContent } from '@/lib/license-contract';
import './license-contract-document.css';

type Props = {
  content: LicenseContractContent;
  bodyHtml?: string | null;
};

export default function LicenseContractBody({ content, bodyHtml }: Props) {
  if (bodyHtml) {
    return <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />;
  }
  return <LicenseContractDocument content={content} />;
}
