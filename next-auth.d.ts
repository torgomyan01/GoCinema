import NextAuth, { DefaultSession } from 'next-auth';

type AppRole = 'user' | 'admin' | 'moderator' | 'employee' | string;

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: AppRole;
      phone?: string | null;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    role: AppRole;
    phone?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: AppRole;
    phone?: string | null;
  }
}
