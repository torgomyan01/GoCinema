import LicenseContractDocument from '@/components/contracts/license-contract-document';
import LicenseContractLetterhead from '@/components/contracts/license-contract-letterhead';
import type { LicenseContractContent } from '@/lib/license-contract';
import './license-contract-document.css';

type Props = {
  content: LicenseContractContent;
  bodyHtml?: string | null;
};

function innerSheetHtml(html: string): string {
  const match = html.match(
    /<article\b[^>]*class="[^"]*\blc-sheet\b[^"]*"[^>]*>([\s\S]*)<\/article>/i
  );
  return (match ? match[1] : html).trim();
}

export default function LicenseContractBody({ content, bodyHtml }: Props) {
  if (!bodyHtml) {
    return <LicenseContractDocument content={content} />;
  }

  const inner = innerSheetHtml(bodyHtml);
  if (inner.includes('lc-letterhead')) {
    return (
      <article
        className="lc-sheet"
        dangerouslySetInnerHTML={{ __html: inner }}
      />
    );
  }

  return (
    <article className="lc-sheet">
      <LicenseContractLetterhead />
      <div dangerouslySetInnerHTML={{ __html: inner }} />
    </article>
  );
}
