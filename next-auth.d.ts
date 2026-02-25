import NextAuth, { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'user' | 'admin';
      phone?: string | null;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    role: 'user' | 'admin';
    phone?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: 'user' | 'admin';
    phone?: string | null;
  }
}
