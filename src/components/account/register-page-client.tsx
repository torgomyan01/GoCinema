'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  MessageSquare,
  RefreshCw,
  Calendar,
  Gift,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { SITE_URL } from '@/utils/consts';
import { registerUser } from '@/app/actions/auth';
import {
  sendRegistrationOtp,
  verifyRegistrationOtp,
} from '@/app/actions/phone-verification';
import {
  birthDateInputMax,
  birthDateInputMin,
} from '@/lib/birth-date';

type Step = 'form' | 'otp' | 'success';

// SMS վերիֆիկացիան միացված է միայն երբ Sender ID-ն հաստատված է։
const SMS_VERIFICATION_ENABLED =
  process.env.NEXT_PUBLIC_SMS_VERIFICATION_ENABLED === 'true';

export default function RegisterPageClient() {
  const searchParams = useSearchParams();
  // ── Form state ─────────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [claimedAccount, setClaimedAccount] = useState(false);
  const [referralFromLink, setReferralFromLink] = useState(false);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('form');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // ── OTP state ──────────────────────────────────────────────────────────────
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── OTP resend cooldown ────────────────────────────────────────────────────
  useEffect(() => {
    if (otpResendCooldown <= 0) return;
    const t = setTimeout(() => setOtpResendCooldown((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [otpResendCooldown]);

  // ── Հրավերի հղում՝ /register?ref=GCXXXXXX ─────────────────────────────────
  useEffect(() => {
    const ref = (searchParams.get('ref') ?? '').trim().toUpperCase();
    if (!ref) return;
    setReferralCode(ref);
    setReferralFromLink(true);
  }, [searchParams]);

  // ── OTP handlers ───────────────────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    if (!/^[0-9]?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, 6);
    const next = [...otp];
    pasted.split('').forEach((ch, i) => {
      next[i] = ch;
    });
    setOtp(next);
    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const resendOtp = async () => {
    const cleanPhone = phone.replace(/\s/g, '');
    setOtp(['', '', '', '', '', '']);
    setError('');
    setIsLoading(true);
    const result = await sendRegistrationOtp(cleanPhone);
    setIsLoading(false);
    if (!result.success) {
      setError(result.error ?? 'SMS ուղարկելը ձախողվեց');
      return;
    }
    setOtpResendCooldown(60);
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < 6) {
      setError('Մուտքագրեք 6-նիշ կոդը');
      return;
    }
    const cleanPhone = phone.replace(/\s/g, '');
    setIsLoading(true);
    setError('');
    const result = await verifyRegistrationOtp(cleanPhone, code);
    setIsLoading(false);
    if (!result.success) {
      setError(result.error ?? 'Սխալ կոդ');
      return;
    }
    setStep('success');
  };

  // ── Phone formatter ────────────────────────────────────────────────────────
  const formatPhoneNumber = (value: string): string => {
    let cleaned = value.replace(/\D/g, '');
    if (cleaned.startsWith('374')) cleaned = '0' + cleaned.slice(3);
    cleaned = cleaned.slice(0, 9);
    if (!cleaned.length) return '';
    if (!cleaned.startsWith('0')) cleaned = '0' + cleaned.slice(0, 8);
    const d = cleaned.slice(1);
    if (d.length <= 2) return `0${d}`;
    if (d.length <= 5) return `0${d.slice(0, 2)} ${d.slice(2)}`;
    return `0${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)}`;
  };

  // ── Submit registration form ───────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !phone || !password || !birthDate) {
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

    const cleanPhone = phone.replace(/\s/g, '');
    if (!/^0[0-9]{8}$/.test(cleanPhone)) {
      setError('Մուտքագրեք վավեր հեռախոսահամար (օրինակ: 0XX XXX XXX)');
      return;
    }

    setIsLoading(true);
    try {
      const result = await registerUser({
        name,
        phone: cleanPhone,
        password,
        birthDate,
        referralCode: referralCode.trim() || undefined,
      });
      if (!result.success || !result.user) {
        setError(result.error || 'Գրանցումը ձախողվեց');
        return;
      }

      setClaimedAccount(Boolean(result.claimed));

      // Քանի դեռ Sender ID-ն հաստատված չէ՝ գրանցումն ավարտում ենք առանց SMS վերիֆիկացիայի։
      if (!SMS_VERIFICATION_ENABLED) {
        setStep('success');
        return;
      }

      // Հաշիվը ստեղծվեց — ուղարկում ենք SMS վերիֆիկացիայի կոդը
      setStep('otp');
      setOtp(['', '', '', '', '', '']);
      const otpResult = await sendRegistrationOtp(cleanPhone);
      if (!otpResult.success) {
        setError(
          otpResult.error ??
            'Կոդ ուղարկելը ձախողվեց: Սեղմեք «Կրկին ուղարկել»:'
        );
      } else {
        setOtpResendCooldown(60);
      }
    } catch {
      setError('Սխալ է տեղի ունեցել');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 to-white pt-24 pb-20">
      <div className="container mx-auto px-4">
        <div className="max-w-md mx-auto">
          <AnimatePresence mode="wait">
            {/* ── STEP 1: Registration form ── */}
            {step === 'form' && (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-xl shadow-lg p-8"
              >
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

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
                  >
                    {error}
                  </motion.div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Անուն <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Ձեր անունը"
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Հեռախոսահամար <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) =>
                          setPhone(formatPhoneNumber(e.target.value))
                        }
                        required
                        maxLength={11}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="0XX XXX XXX"
                      />
                    </div>
                  </div>

                  {/* Birth date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ծննդյան ամսաթիվ <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        required
                        min={birthDateInputMin()}
                        max={birthDateInputMax()}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  {/* Referral — հղումից կամ ձեռքով */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      {referralFromLink
                        ? 'Հրավերի կոդ (կիրառված է հղումից)'
                        : 'Ընկերոջ հրավերի կոդ'}
                    </label>
                    {referralFromLink ? (
                      <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                        <Gift className="h-5 w-5 shrink-0 text-emerald-600" />
                        <div className="min-w-0">
                          <p className="font-semibold tracking-wider text-emerald-800">
                            {referralCode}
                          </p>
                          <p className="text-xs text-emerald-700/80">
                            Գրանցվելուց երկուսդ էլ կստանաք բոնուս միավորներ
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                          <Gift className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            value={referralCode}
                            onChange={(e) =>
                              setReferralCode(e.target.value.toUpperCase())
                            }
                            maxLength={20}
                            className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="GCXXXXXX (ոչ պարտադիր)"
                          />
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          Կամ գրանցվեք ընկերոջ հղումով՝ ավտոմատ կիրառման համար
                        </p>
                      </>
                    )}
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Գաղտնաբառ <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Առնվազն 6 նիշ"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                        Գաղտնաբառը պետք է լինի առնվազն 6 նիշ
                      </p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Հաստատել Գաղտնաբառը{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                        className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                        Գաղտնաբառները չեն համընկնում
                      </p>
                    )}
                  </div>

                  {/* Terms */}
                  <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <input
                      type="checkbox"
                      id="agreeToTerms"
                      checked={agreeToTerms}
                      onChange={(e) => setAgreeToTerms(e.target.checked)}
                      className="mt-1 w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
                    />
                    <label
                      htmlFor="agreeToTerms"
                      className="flex-1 text-sm text-gray-700 cursor-pointer"
                    >
                      <div className="flex items-start gap-2">
                        <FileText className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                        <span>
                          Ես համաձայնվում եմ{' '}
                          <Link
                            href="/terms"
                            target="_blank"
                            className="text-purple-600 hover:text-purple-700 font-medium underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            օգտագործման պայմաններին
                          </Link>{' '}
                          և{' '}
                          <Link
                            href="/privacy"
                            target="_blank"
                            className="text-purple-600 hover:text-purple-700 font-medium underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            գաղտնիության քաղաքականությանը
                          </Link>
                        </span>
                      </div>
                    </label>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={
                      isLoading ||
                      !phone ||
                      !name ||
                      !birthDate ||
                      !password ||
                      password !== confirmPassword ||
                      !agreeToTerms
                    }
                    className={`w-full px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                      isLoading ||
                      !phone ||
                      !name ||
                      !birthDate ||
                      !password ||
                      password !== confirmPassword ||
                      !agreeToTerms
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-linear-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 shadow-md hover:shadow-lg'
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

                <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">կամ</span>
                  </div>
                </div>

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
            )}

            {/* ── STEP 2: SMS OTP verification ── */}
            {step === 'otp' && (
              <motion.div
                key="otp"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-xl shadow-lg p-8"
              >
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                    <MessageSquare className="w-8 h-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Հաստատման կոդ
                  </h2>
                  <p className="text-gray-500 text-sm">
                    6-նիշ կոդ ուղարկվեց SMS-ով՝{' '}
                    <span className="font-medium text-gray-700">{phone}</span>
                  </p>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
                  >
                    {error}
                  </motion.div>
                )}

                <form onSubmit={handleOtpSubmit} className="space-y-6">
                  <div
                    className="flex gap-2 justify-center"
                    onPaste={handleOtpPaste}
                  >
                    {otp.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => {
                          otpRefs.current[i] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        className="w-12 h-14 text-center text-xl font-bold border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-colors"
                      />
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                      isLoading
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-linear-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 shadow-md hover:shadow-lg'
                    }`}
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Հաստատել'
                    )}
                  </button>
                </form>

                <div className="text-center mt-4">
                  {otpResendCooldown > 0 ? (
                    <p className="text-sm text-gray-400">
                      Կրկին ուղարկել {otpResendCooldown}վ հետո
                    </p>
                  ) : (
                    <button
                      onClick={resendOtp}
                      disabled={isLoading}
                      className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700"
                    >
                      <RefreshCw className="w-4 h-4" /> Կրկին ուղարկել կոդը
                    </button>
                  )}
                </div>

                <div className="text-center mt-6">
                  <button
                    onClick={() => setStep('success')}
                    className="text-sm text-gray-400 hover:text-gray-600 transition-colors underline"
                  >
                    Բաց թողնել հիմա, հաստատել հետո
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 3: Success ── */}
            {step === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-xl shadow-lg p-8 text-center"
              >
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {claimedAccount
                    ? 'Հաշիվը ակտիվացված է'
                    : 'Գրանցումն ավարտված է'}
                </h1>
                <p className="text-gray-600 mb-8">
                  {claimedAccount
                    ? 'Ձեր բոնուսները պահպանվել են։ Այժմ կարող եք մուտք գործել նոր գաղտնաբառով։'
                    : SMS_VERIFICATION_ENABLED
                      ? 'Ձեր հաշիվը հաջողությամբ ստեղծվեց և վերիֆիկացված է:'
                      : 'Ձեր հաշիվը հաջողությամբ ստեղծվեց:'}
                </p>
                <Link
                  href={SITE_URL.LOGIN}
                  className="inline-block px-6 py-3 bg-linear-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-md"
                >
                  Մուտք գործել
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
