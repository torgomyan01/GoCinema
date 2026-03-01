'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Phone,
  Lock,
  LogIn,
  UserPlus,
  Eye,
  EyeOff,
  User,
  LogOut,
  CheckCircle,
  Shield,
} from 'lucide-react';
import Link from 'next/link';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SITE_URL } from '@/utils/consts';

export default function LoginPageClient() {
  const { data: session, status, update } = useSession();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl');

  useEffect(() => {
    // Only clear form fields when user is authenticated
    if (status === 'authenticated' && session) {
      setPhone('');
      setPassword('');
    }
  }, [status, session]);

  const formatPhoneNumber = (value: string): string => {
    // Remove all non-digit characters
    let cleaned = value.replace(/\D/g, '');

    // If starts with 374 (from +374 or just 374), convert to local format (0XX XXX XXX)
    if (cleaned.startsWith('374')) {
      cleaned = '0' + cleaned.slice(3); // Remove 374, add 0
    }

    // Limit to 9 digits (0 + 8 digits)
    cleaned = cleaned.slice(0, 9);

    // If empty, return empty
    if (cleaned.length === 0) {
      return '';
    }

    // If doesn't start with 0, add it
    if (!cleaned.startsWith('0')) {
      cleaned = '0' + cleaned.slice(0, 8);
    }

    const digits = cleaned.slice(1); // Remove leading 0

    // Format as 0XX XXX XXX
    if (digits.length <= 2) {
      return `0${digits}`;
    } else if (digits.length <= 5) {
      return `0${digits.slice(0, 2)} ${digits.slice(2)}`;
    } else {
      return `0${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)}`;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
    setError(''); // Clear error when user starts typing
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Client-side validation
    if (!phone || !password) {
      setError('Բոլոր դաշտերը պարտադիր են');
      return;
    }

    // Phone validation
    const cleanPhone = phone.replace(/\s/g, '');
    const phoneRegex = /^0[0-9]{8}$/;
    if (!phoneRegex.test(cleanPhone)) {
      setError('Մուտքագրեք վավեր հեռախոսահամար (օրինակ: 0XX XXX XXX)');
      return;
    }

    if (password.length < 6) {
      setError('Password-ը պետք է լինի առնվազն 6 նիշ');
      return;
    }

    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        phone: cleanPhone,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Սխալ հեռախոսահամար կամ password');
        setIsLoading(false);
      } else if (result?.ok) {
        // Success - update session immediately
        // Small delay to ensure cookie is set
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Update session and wait for it
        await update();

        // Another small delay before fetching session
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Get fresh session to check role and redirect
        try {
          const freshSession = await fetch('/api/auth/session', {
            cache: 'no-store',
          }).then((res) => res.json());

          if (freshSession?.user) {
            const user = freshSession.user as any;

            // Redirect based on role or callback URL
            if (callbackUrl && callbackUrl !== '/account') {
              const decodedCallbackUrl = decodeURIComponent(callbackUrl);
              window.location.href = decodedCallbackUrl;
            } else if (user.role === 'admin') {
              window.location.href = '/admin';
            } else {
              window.location.href = '/account';
            }
          } else {
            window.location.href = '/account';
          }
        } catch (err) {
          window.location.href = '/account';
        }
      } else {
        setError('Մուտք գործելիս սխալ է տեղի ունեցել');
        setIsLoading(false);
      }
    } catch (err) {
      setError('Սխալ է տեղի ունեցել');
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut({ redirect: false });
      router.refresh();
    } catch (err) {
      console.error('[Logout] Error:', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const formatPhoneDisplay = (phone: string | null | undefined): string => {
    if (!phone) return 'Չկա';
    // Format phone as 0XX XXX XXX
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 9 && cleaned.startsWith('0')) {
      const digits = cleaned.slice(1);
      return `0${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)}`;
    }
    return phone;
  };

  // Show loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pt-24 pb-20">
        <div className="container mx-auto px-4">
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-xl shadow-lg p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Բեռնվում է...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show user info if logged in
  if (status === 'authenticated' && session?.user) {
    const user = session.user as any;
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pt-24 pb-20">
        <div className="container mx-auto px-4">
          <div className="max-w-md mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl shadow-lg p-8"
            >
              {/* Success Header */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Բարի վերադարձ
                </h1>
                <p className="text-gray-600">
                  Դուք հաջողությամբ մուտք եք գործել
                </p>
              </div>

              {/* User Information */}
              <div className="space-y-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        {user.name || 'Օգտատեր'}
                      </h2>
                      {user.role && (
                        <div className="flex items-center gap-1 mt-1">
                          <Shield className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-500 capitalize">
                            {user.role === 'admin'
                              ? 'Ադմինիստրատոր'
                              : 'Օգտատեր'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone className="w-4 h-4" />
                        <span className="text-sm">Հեռախոսահամար</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {formatPhoneDisplay(user.phone || user.email)}
                      </span>
                    </div>

                    {user.id && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-gray-600">
                          <User className="w-4 h-4" />
                          <span className="text-sm">ID</span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          #{user.id}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <Link
                  href={SITE_URL.HOME}
                  className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all text-center block"
                >
                  Գնալ գլխավոր էջ
                </Link>

                <Link
                  href={SITE_URL.TICKETS}
                  className="w-full px-6 py-3 bg-white border-2 border-purple-600 text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-all text-center block"
                >
                  Իմ տոմսերը
                </Link>

                {user.role === 'admin' && (
                  <Link
                    href={SITE_URL.ADMIN}
                    className="w-full px-6 py-3 bg-white border-2 border-purple-600 text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-all text-center block"
                  >
                    Ադմինիստացիոն էջ
                  </Link>
                )}

                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className={`w-full px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                    isLoggingOut
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {isLoggingOut ? (
                    <>
                      <div className="w-5 h-5 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                      Ելք գործում...
                    </>
                  ) : (
                    <>
                      <LogOut className="w-5 h-5" />
                      Ելք գործել
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  // Show login form if not authenticated
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pt-24 pb-20">
      <div className="container mx-auto px-4">
        <div className="max-w-md mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-lg p-8"
          >
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Մուտք</h1>
              <p className="text-gray-600">Մուտք գործեք ձեր GoCinema հաշիվ</p>
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
              >
                {error}
              </motion.div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Phone */}
              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Հեռախոսահամար
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={handlePhoneChange}
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="0XX XXX XXX"
                    maxLength={11}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(''); // Clear error when user starts typing
                    }}
                    required
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Forgot Password */}
              <div className="text-right">
                <Link
                  href="/forgot-password"
                  className="text-sm text-purple-600 hover:text-purple-700 transition-colors"
                >
                  Մոռացել եք գաղտնաբառը?
                </Link>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                  isLoading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 shadow-md hover:shadow-lg'
                }`}
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Մուտք գործում...
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    Մուտք գործել
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">կամ</span>
              </div>
            </div>

            {/* Register Link */}
            <div className="text-center">
              <p className="text-gray-600 mb-4">Դեռ չունեք հաշիվ?</p>
              <Link
                href={SITE_URL.REGISTER}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white border-2 border-purple-600 text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-all"
              >
                <UserPlus className="w-5 h-5" />
                Գրանցվել
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
