'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Lock,
  User,
  UserPlus,
  Eye,
  EyeOff,
  ArrowLeft,
  Phone,
  CheckCircle,
  FileText,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SITE_URL } from '@/utils/consts';
import { registerUser } from '@/app/actions/auth';

export default function RegisterPageClient() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const router = useRouter();

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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!name || !phone || !password) {
      setError('Բոլոր պարտադիր դաշտերը պետք է լրացված լինեն');
      return;
    }

    if (password !== confirmPassword) {
      setError('Password-ները չեն համընկնում');
      return;
    }

    if (password.length < 6) {
      setError('Password-ը պետք է լինի առնվազն 6 նիշ');
      return;
    }

    if (!agreeToTerms) {
      setError('Դուք պետք է համաձայնվեք անվտանգության պայմաններին');
      return;
    }

    // Phone validation
    const cleanPhone = phone.replace(/\s/g, '');
    // Validate Armenian phone format: 0XX XXX XXX (9 digits total, starting with 0)
    const phoneRegex = /^0[0-9]{8}$/;
    if (!phoneRegex.test(cleanPhone)) {
      setError('Մուտքագրեք վավեր հեռախոսահամար (օրինակ: 077 777 777)');
      return;
    }

    setIsLoading(true);

    try {
      const result = await registerUser({
        name,
        phone: cleanPhone,
        password,
      });

      if (!result.success) {
        setError(result.error || 'Գրանցումը ձախողվեց');
        return;
      }

      // Success
      setIsSuccess(true);
    } catch (err) {
      setError('Սխալ է տեղի ունեցել');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pt-24 pb-20">
        <div className="container mx-auto px-4">
          <div className="max-w-md mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl shadow-lg p-8 text-center"
            >
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Գրանցումը հաջողվեց
              </h1>
              <p className="text-gray-600 mb-6">
                Ձեր հաշիվը հաջողությամբ ստեղծվեց: Այժմ կարող եք մուտք գործել:
              </p>
              <Link
                href={SITE_URL.LOGIN}
                className="inline-block px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all"
              >
                Մուտք գործել
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

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
            <div className="mb-6">
              <Link
                href={SITE_URL.LOGIN}
                className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                Վերադառնալ
              </Link>
              <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Գրանցում
                </h1>
                <p className="text-gray-600">Ստեղծեք նոր GoCinema հաշիվ</p>
              </div>
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

            {/* Register Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name */}
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Անուն <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Ձեր անունը"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Հեռախոսահամար <span className="text-red-500">*</span>
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
                    placeholder="077 777 777"
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
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Առնվազն 6 նիշ"
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
                {password && password.length < 6 && (
                  <p className="mt-1 text-sm text-red-600">
                    Password-ը պետք է լինի առնվազն 6 նիշ
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Հաստատել Password-ը <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">
                    Password-ները չեն համընկնում
                  </p>
                )}
              </div>

              {/* Terms and Conditions Checkbox */}
              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <input
                  type="checkbox"
                  id="agreeToTerms"
                  checked={agreeToTerms}
                  onChange={(e) => setAgreeToTerms(e.target.checked)}
                  className="mt-1 w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500 focus:ring-2 cursor-pointer"
                />
                <label
                  htmlFor="agreeToTerms"
                  className="flex-1 text-sm text-gray-700 cursor-pointer"
                >
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                    <span>
                      Ես համաձայնվում եմ{' '}
                      <Link
                        href="/terms"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-600 hover:text-purple-700 font-medium underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        օգտագործման պայմաններին
                      </Link>{' '}
                      և{' '}
                      <Link
                        href="/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-600 hover:text-purple-700 font-medium underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        գաղտնիության քաղաքականությանը
                      </Link>
                    </span>
                  </div>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={
                  isLoading ||
                  !phone ||
                  !name ||
                  !password ||
                  password !== confirmPassword ||
                  !agreeToTerms
                }
                className={`w-full px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                  isLoading ||
                  !phone ||
                  !name ||
                  !password ||
                  password !== confirmPassword
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 shadow-md hover:shadow-lg'
                }`}
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Գրանցվում է...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    Գրանցվել
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

            {/* Login Link */}
            <div className="text-center">
              <p className="text-gray-600 mb-4">Արդեն ունեք հաշիվ?</p>
              <Link
                href={SITE_URL.LOGIN}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white border-2 border-purple-600 text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-all"
              >
                Մուտք գործել
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
