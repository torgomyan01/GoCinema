'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle,
  Send,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import {
  requestPasswordReset,
  checkTelegramLinked,
  verifyResetOtp,
  resetPassword,
} from '@/app/actions/forgot-password';

type Step = 'phone' | 'telegram-connect' | 'otp' | 'new-password' | 'success';

export default function ForgotPasswordClient() {
  const [step, setStep] = useState<Step>('phone');

  // Form values
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [telegramBotUsername, setTelegramBotUsername] = useState('');
  const [isPolling, setIsPolling] = useState(false);
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── OTP resend cooldown ────────────────────────────────────────────────────
  useEffect(() => {
    if (otpResendCooldown <= 0) return;
    const t = setTimeout(() => setOtpResendCooldown((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [otpResendCooldown]);

  // ── Polling: check if user has started the Telegram bot ───────────────────
  useEffect(() => {
    if (step !== 'telegram-connect' || !isPolling) return;

    let active = true;

    const poll = async () => {
      while (active) {
        await new Promise((r) => setTimeout(r, 3000));
        if (!active) break;

        const { linked } = await checkTelegramLinked(phone);
        if (linked && active) {
          active = false;
          setIsPolling(false);
          // Directly send OTP — user now has a telegramChatId
          setIsLoading(true);
          setError('');
          const result = await requestPasswordReset(phone);
          setIsLoading(false);

          if (!result.success) {
            setError(result.error ?? 'Սխալ է տեղի ունեցել');
            setStep('phone');
            return;
          }

          setOtpResendCooldown(60);
          setStep('otp');
          return;
        }
      }
    };

    poll();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, isPolling, phone]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const formatPhone = (value: string): string => {
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

  async function sendOtp() {
    setIsLoading(true);
    setError('');
    const result = await requestPasswordReset(phone);
    setIsLoading(false);

    if (!result.success) {
      setError(result.error ?? 'Սխալ է տեղի ունեցել');
      return;
    }

    if (!result.hasTelegram) {
      // User has not started the bot
      setTelegramBotUsername(result.telegramBotUsername ?? '');
      setStep('telegram-connect');
      setIsPolling(true);
      return;
    }

    setOtpResendCooldown(60);
    setStep('otp');
  }

  // ── Step handlers ──────────────────────────────────────────────────────────
  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = phone.replace(/\s/g, '');
    if (!/^0[0-9]{8}$/.test(clean)) {
      setError('Մուտքագրեք վավեր հեռախոսահամար (0XX XXX XXX)');
      return;
    }
    await sendOtp();
  };

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
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = [...otp];
    pasted.split('').forEach((ch, i) => { next[i] = ch; });
    setOtp(next);
    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < 6) {
      setError('Մուտքագրեք 6-նիշ կոդը');
      return;
    }
    setIsLoading(true);
    setError('');
    const result = await verifyResetOtp(phone, code);
    setIsLoading(false);

    if (!result.success || !result.resetToken) {
      setError(result.error ?? 'Սխալ կոդ');
      return;
    }

    setResetToken(result.resetToken);
    setStep('new-password');
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('Գաղտնաբառը պետք է լինի առնվազն 6 նիշ');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Գաղտնաբառերը չեն համընկնում');
      return;
    }
    setIsLoading(true);
    setError('');
    const result = await resetPassword(resetToken, newPassword);
    setIsLoading(false);

    if (!result.success) {
      setError(result.error ?? 'Սխալ է տեղի ունեցել');
      return;
    }

    setStep('success');
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pt-24 pb-20">
      <div className="container mx-auto px-4">
        <div className="max-w-md mx-auto">
          <AnimatePresence mode="wait">
            {/* ── STEP 1: Phone ── */}
            {step === 'phone' && (
              <motion.div
                key="phone"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-xl shadow-lg p-8"
              >
                <Link
                  href="/account"
                  className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
                >
                  <ArrowLeft className="w-4 h-4" /> Վերադառնալ մուտք
                </Link>

                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
                    <Lock className="w-8 h-8 text-purple-600" />
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    Գաղտնաբառի վերականգնում
                  </h1>
                  <p className="text-gray-500 text-sm">
                    Մուտքագրեք ձեր հաշվի հեռախոսահամարը
                  </p>
                </div>

                {error && <ErrorBox message={error} />}

                <form onSubmit={handlePhoneSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Հեռախոսահամար
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => {
                          setPhone(formatPhone(e.target.value));
                          setError('');
                        }}
                        placeholder="0XX XXX XXX"
                        maxLength={11}
                        required
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <SubmitButton isLoading={isLoading} label="Շարունակել" />
                </form>
              </motion.div>
            )}

            {/* ── STEP 2: Telegram connect ── */}
            {step === 'telegram-connect' && (
              <motion.div
                key="telegram"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-xl shadow-lg p-8 text-center"
              >
                <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6">
                  <svg viewBox="0 0 24 24" className="w-10 h-10 fill-blue-500">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248-1.97 9.289c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.932z" />
                  </svg>
                </div>

                <h2 className="text-xl font-bold text-gray-900 mb-3">
                  Միացե՛ք մեր Telegram բոտին
                </h2>
                <p className="text-gray-500 text-sm mb-6">
                  Հաստատման կոդ ստանալու համար անհրաժեշտ է.
                </p>

                <ol className="text-left space-y-3 mb-8 text-sm text-gray-600">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-semibold text-xs">1</span>
                    <span>Բացեք Telegram բոտը հետևյալ կոճակով</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-semibold text-xs">2</span>
                    <span>Սեղմեք <strong>START</strong> կոճակը բոտում</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-semibold text-xs">3</span>
                    <span>
                      Ուղարկեք ձեր հեռախոսահամարը բոտին.{' '}
                      <code className="bg-gray-100 px-1 rounded">{phone}</code>
                    </span>
                  </li>
                </ol>

                <a
                  href={`https://t.me/${telegramBotUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors mb-6"
                >
                  <ExternalLink className="w-5 h-5" />
                  Բացել Telegram բոտը
                </a>

                <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                  <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                  Սպասում ենք Telegram-ի կապին...
                </div>

                <button
                  onClick={() => {
                    if (pollingRef.current) clearInterval(pollingRef.current);
                    setIsPolling(false);
                    setStep('phone');
                  }}
                  className="mt-6 text-sm text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Չեղարկել
                </button>
              </motion.div>
            )}

            {/* ── STEP 3: OTP ── */}
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
                    <Send className="w-8 h-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Հաստատման կոդ
                  </h2>
                  <p className="text-gray-500 text-sm">
                    6-նիշ կոդ ուղարկվեց Telegram-ի միջոցով
                  </p>
                </div>

                {error && <ErrorBox message={error} />}

                <form onSubmit={handleOtpSubmit} className="space-y-6">
                  <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                    {otp.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => { otpRefs.current[i] = el; }}
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

                  <SubmitButton isLoading={isLoading} label="Հաստատել" />
                </form>

                <div className="text-center mt-4">
                  {otpResendCooldown > 0 ? (
                    <p className="text-sm text-gray-400">
                      Կրկին ուղարկել {otpResendCooldown}վ հետո
                    </p>
                  ) : (
                    <button
                      onClick={async () => {
                        setOtp(['', '', '', '', '', '']);
                        setError('');
                        await sendOtp();
                      }}
                      className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700"
                    >
                      <RefreshCw className="w-4 h-4" /> Կրկին ուղարկել կոդը
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── STEP 4: New Password ── */}
            {step === 'new-password' && (
              <motion.div
                key="newpass"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-xl shadow-lg p-8"
              >
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
                    <Lock className="w-8 h-8 text-purple-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Նոր գաղտնաբառ
                  </h2>
                  <p className="text-gray-500 text-sm">
                    Ստեղծեք ձեր նոր գաղտնաբառը
                  </p>
                </div>

                {error && <ErrorBox message={error} />}

                <form onSubmit={handlePasswordSubmit} className="space-y-5">
                  <PasswordField
                    label="Նոր գաղտնաբառ"
                    value={newPassword}
                    onChange={(v) => { setNewPassword(v); setError(''); }}
                    show={showPassword}
                    onToggle={() => setShowPassword(!showPassword)}
                    placeholder="Առնվազն 6 նիշ"
                  />
                  <PasswordField
                    label="Կրկնել գաղտնաբառը"
                    value={confirmPassword}
                    onChange={(v) => { setConfirmPassword(v); setError(''); }}
                    show={showConfirm}
                    onToggle={() => setShowConfirm(!showConfirm)}
                    placeholder="Կրկնեք գաղտնաբառը"
                  />
                  <SubmitButton isLoading={isLoading} label="Պահպանել գաղտնաբառը" />
                </form>
              </motion.div>
            )}

            {/* ── STEP 5: Success ── */}
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
                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  Հաջողությամբ վերականգնվեց
                </h2>
                <p className="text-gray-500 text-sm mb-8">
                  Ձեր գաղտնաբառը հաջողությամբ փոխվեց: Այժմ կարող եք մուտք գործել:
                </p>
                <Link
                  href="/account"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-md"
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

// ── Small reusable components ──────────────────────────────────────────────────

function ErrorBox({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
    >
      {message}
    </motion.div>
  );
}

function SubmitButton({ isLoading, label }: { isLoading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={isLoading}
      className={`w-full px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
        isLoading
          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
          : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 shadow-md hover:shadow-lg'
      }`}
    >
      {isLoading ? (
        <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
      ) : (
        label
      )}
    </button>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggle,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required
          className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
