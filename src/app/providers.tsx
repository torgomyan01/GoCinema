'use client';

import { Provider } from 'react-redux';
import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import { store } from '@/store/store';
import SupportWidget from '@/components/support/support-widget';
import BirthDatePromptModal from '@/components/account/birth-date-prompt-modal';
import ReservationBlockNoticeModal from '@/components/account/reservation-block-notice-modal';

export function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  return (
    <SessionProvider
      session={session}
      refetchInterval={5 * 60}
      refetchOnWindowFocus={true}
    >
      <Provider store={store}>
        {children}
        <SupportWidget />
        <BirthDatePromptModal />
        <ReservationBlockNoticeModal />
      </Provider>
    </SessionProvider>
  );
}
