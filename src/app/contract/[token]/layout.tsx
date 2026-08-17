import type { ReactNode } from 'react';

export default function ContractLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        @media print {
          html, body { background: #fff !important; }
        }
      `}</style>
      {children}
    </>
  );
}
