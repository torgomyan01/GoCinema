'use client';

import { Provider } from 'react-redux';
import { SessionProvider } from 'next-auth/react';
import { store } from '@/store/store';
import SupportWidget from '@/components/support/support-widget';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      refetchInterval={5 * 60} // Refetch session every 5 minutes
      refetchOnWindowFocus={true} // Refetch when window is focused
    >
      <Provider store={store}>
        {children}
        <SupportWidget />
      </Provider>
    </SessionProvider>
  );
}
