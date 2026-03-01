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
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { SITE_URL } from '@/utils/consts';
import { registerUser } from '@/app/actions/auth';
import { checkTelegramLinkedById } from '@/app/actions/forgot-password';

type Step = 'form' | 'telegram' | 'success';

export default function RegisterPageClient() {
  // ── Form state ─────────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('form');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [newUserId, setNewUserId] = useState<number | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const telegramBotUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'gocinema_bot';

  // ── Polling: check if user linked Telegram ─────────────────────────────────
  useEffect(() => {
    if (step !== 'telegram' || !isPolling || !newUserId) return;

    let active = true;

    const poll = async () => {
      while (active) {
        await new Promise((r) => setTimeout(r, 3000));
        if (!active) break;
        const { linked } = await checkTelegramLinkedById(newUserId);
        if (linked && active) {
          active = false;
          setIsPolling(false);
          setStep('success');
        }
      }
    };

    poll();
    return () => { active = false; };
  }, [step, isPolling, newUserId]);

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

    const cleanPhone = phone.replace(/\s/g, '');
    if (!/^0[0-9]{8}$/.test(cleanPhone)) {
      setError('Մուտքագրեք վավեր հեռախոսահամար (օրինակ: 0XX XXX XXX)');
      return;
    }

    setIsLoading(true);
    try {
      const result = await registerUser({ name, phone: cleanPhone, password });
      if (!result.success || !result.user) {
        setError(result.error || 'Գրանցումը ձախողվեց');
        return;
      }
      setNewUserId(result.user.id);
      setStep('telegram');
      setIsPolling(true);
    } catch {
      setError('Սխալ է տեղի ունեցել');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pt-24 pb-20">
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
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Գրանցում</h1>
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
                        onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                        required
                        maxLength={11}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="0XX XXX XXX"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password <span className="text-red-500">*</span>
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
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {password && password.length < 6 && (
                      <p className="mt-1 text-sm text-red-600">Password-ը պետք է լինի առնվազն 6 նիշ</p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Հաստատել Password-ը <span className="text-red-500">*</span>
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
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {confirmPassword && password !== confirmPassword && (
                      <p className="mt-1 text-sm text-red-600">Password-ները չեն համընկնում</p>
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
                    <label htmlFor="agreeToTerms" className="flex-1 text-sm text-gray-700 cursor-pointer">
                      <div className="flex items-start gap-2">
                        <FileText className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                        <span>
                          Ես համաձայնվում եմ{' '}
                          <Link href="/terms" target="_blank" className="text-purple-600 hover:text-purple-700 font-medium underline" onClick={(e) => e.stopPropagation()}>
                            օգտագործման պայմաններին
                          </Link>{' '}
                          և{' '}
                          <Link href="/privacy" target="_blank" className="text-purple-600 hover:text-purple-700 font-medium underline" onClick={(e) => e.stopPropagation()}>
                            գաղտնիության քաղաքականությանը
                          </Link>
                        </span>
                      </div>
                    </label>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={isLoading || !phone || !name || !password || password !== confirmPassword || !agreeToTerms}
                    className={`w-full px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                      isLoading || !phone || !name || !password || password !== confirmPassword || !agreeToTerms
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

            {/* ── STEP 2: Telegram verification ── */}
            {step === 'telegram' && (
              <motion.div
                key="telegram"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-xl shadow-lg p-8 text-center"
              >
                {/* Telegram icon */}
                <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6">
                  <svg viewBox="0 0 24 24" className="w-10 h-10 fill-blue-500">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248-1.97 9.289c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.932z" />
                  </svg>
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Վերիֆիկացրեք Telegram-ով
                </h2>
                <p className="text-gray-500 text-sm mb-8">
                  Հաշիվը ստեղծվեց: Հաստատելու համար կապեք ձեր Telegram-ն:
                </p>

                {/* Steps */}
                <ol className="text-left space-y-4 mb-8">
                  <li className="flex gap-3 items-start">
                    <span className="shrink-0 w-7 h-7 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-semibold text-sm">1</span>
                    <span className="text-sm text-gray-600 pt-1">
                      Բացեք GoCinema Telegram բոտը
                    </span>
                  </li>
                  <li className="flex gap-3 items-start">
                    <span className="shrink-0 w-7 h-7 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-semibold text-sm">2</span>
                    <span className="text-sm text-gray-600 pt-1">
                      Սեղմեք <strong>START</strong>, ապա ուղարկեք ձեր հեռախոսահամարը՝{' '}
                      <code className="bg-gray-100 px-1.5 py-0.5 rounded text-purple-700 font-mono">
                        {phone}
                      </code>
                    </span>
                  </li>
                  <li className="flex gap-3 items-start">
                    <span className="shrink-0 w-7 h-7 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-semibold text-sm">3</span>
                    <span className="text-sm text-gray-600 pt-1">
                      Վերադարձեք կայք — հաստատումն ավտոմատ կկատարվի
                    </span>
                  </li>
                </ol>

                {/* Telegram button */}
                <a
                  href={`https://t.me/${telegramBotUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors mb-8"
                >
                  <ExternalLink className="w-5 h-5" />
                  Բացել Telegram բոտը
                </a>

                {/* Polling indicator */}
                <div className="flex items-center justify-center gap-2 text-sm text-gray-400 mb-6">
                  <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                  Սպասում ենք հաստատմանը...
                </div>

                {/* Skip option */}
                <button
                  onClick={() => {
                    setIsPolling(false);
                    setStep('success');
                  }}
                  className="text-sm text-gray-400 hover:text-gray-600 transition-colors underline"
                >
                  Բաց թողնել հիմա, կապել հետո
                </button>
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
                  Գրանցումն ավարտված է
                </h1>
                <p className="text-gray-600 mb-8">
                  Ձեր հաշիվը հաջողությամբ ստեղծվեց և վերիֆիկացված է:
                </p>
                <Link
                  href={SITE_URL.LOGIN}
                  className="inline-block px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-md"
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
