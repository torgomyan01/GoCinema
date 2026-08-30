import type { ReactNode } from 'react';

export default function PackagesSlideLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        html, body {
          background: #f1f2ed !important;
          overflow: hidden;
        }
      `}</style>
      {children}
    </>
  );
}
