import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { rateLimitConsume } from './rate-limit';

// Validate required environment variables
if (!process.env.NEXTAUTH_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error(
    'NEXTAUTH_SECRET is not set. Please set it in your environment variables.'
  );
}

const ROLE_REFRESH_MS = 5 * 60 * 1000; // 5 minutes
const LOGIN_MAX_ATTEMPTS = 8;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        phone: { label: 'Phone', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.phone || !credentials?.password) {
            return null;
          }

          const cleanPhone = credentials.phone.replace(/\s/g, '');
          const limit = rateLimitConsume(
            `login:${cleanPhone}`,
            LOGIN_MAX_ATTEMPTS,
            LOGIN_WINDOW_MS
          );
          if (!limit.ok) {
            return null;
          }

          const user = await prisma.user.findUnique({
            where: {
              phone: cleanPhone,
            },
          });

          if (!user) {
            return null;
          }

          if ((user as { isBlocked?: boolean }).isBlocked) {
            return null;
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password
          );

          if (!isPasswordValid) {
            return null;
          }

          return {
            id: user.id.toString(),
            email: user.email || user.phone,
            name: user.name || user.phone,
            phone: user.phone,
            role: user.role || 'user',
          };
        } catch (error) {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Initial sign in - user object is available
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || 'user';
        token.phone = (user as any).phone;
        token.lastRoleCheck = Date.now();
        delete (token as { error?: string }).error;
      }

      const userId = token.id ? Number(token.id) : NaN;
      const lastCheck = Number((token as { lastRoleCheck?: number }).lastRoleCheck || 0);
      const needsRefresh =
        Number.isFinite(userId) &&
        (!lastCheck || Date.now() - lastCheck > ROLE_REFRESH_MS);

      if (needsRefresh) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, isBlocked: true },
          });
          if (!dbUser || dbUser.isBlocked) {
            (token as { error?: string }).error = 'blocked';
            token.role = 'user';
          } else {
            token.role = dbUser.role || 'user';
            delete (token as { error?: string }).error;
          }
          (token as { lastRoleCheck?: number }).lastRoleCheck = Date.now();
        } catch {
          // Keep existing token role on transient DB errors
        }
      }

      if (!token.role) {
        token.role = 'user';
      }

      return token;
    },
    async session({ session, token }) {
      if ((token as { error?: string }).error === 'blocked') {
        // Force client to treat session as invalid
        return {
          ...session,
          user: undefined as unknown as typeof session.user,
          expires: new Date(0).toISOString(),
        };
      }
      if (session.user && token) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role || 'user';
        (session.user as any).phone = token.phone;
      }
      return session;
    },
  },
  pages: {
    signIn: '/account',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        // none+secure՝ բանկի cross-site POST backURL-ին cookie-ն չի կորչում
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    callbackUrl: {
      name: `next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
};
