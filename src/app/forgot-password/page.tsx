import type { Metadata } from 'next';
import ForgotPasswordClient from './forgot-password-client';

export const metadata: Metadata = {
  title: 'Գաղտնաբառի վերականգնում | GoCinema',
  description: 'Վերականգնեք ձեր GoCinema հաշվի գաղտնաբառը SMS-ի միջոցով',
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordClient />;
}
