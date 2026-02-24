'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings,
  Save,
  Bell,
  Mail,
  Globe,
  CreditCard,
  Shield,
  Database,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

interface AdminSettingsClientProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    role: string;
  };
}

export default function AdminSettingsClient({
  user,
}: AdminSettingsClientProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // General Settings
  const [generalSettings, setGeneralSettings] = useState({
    siteName: 'GoCinema',
    siteDescription: 'Երևանի լավագույն կինոթատրոնը',
    contactEmail: 'info@gocinema.am',
    contactPhone: '+374 12 345 678',
    address: 'Երևան, Հայաստան',
  });

  // Notification Settings
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    smsNotifications: false,
    orderNotifications: true,
    ticketNotifications: true,
    userNotifications: true,
  });

  // Payment Settings
  const [paymentSettings, setPaymentSettings] = useState({
    defaultTicketPrice: 2000,
    vipTicketPrice: 3000,
    enableOnlinePayment: true,
    enableCashPayment: true,
    currency: 'AMD',
  });

  // Security Settings
  const [securitySettings, setSecuritySettings] = useState({
    requireEmailVerification: false,
    requirePhoneVerification: false,
    sessionTimeout: 30,
    maxLoginAttempts: 5,
  });

  const handleSaveGeneral = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    // Simulate save
    setTimeout(() => {
      setIsSaving(false);
      setSaveMessage({
        type: 'success',
        text: 'Ընդհանուր կարգավորումները հաջողությամբ պահպանվեցին',
      });
      setTimeout(() => setSaveMessage(null), 3000);
    }, 1000);
  };

  const handleSaveNotifications = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    setTimeout(() => {
      setIsSaving(false);
      setSaveMessage({
        type: 'success',
        text: 'Ծանուցումների կարգավորումները հաջողությամբ պահպանվեցին',
      });
      setTimeout(() => setSaveMessage(null), 3000);
    }, 1000);
  };

  const handleSavePayment = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    setTimeout(() => {
      setIsSaving(false);
      setSaveMessage({
        type: 'success',
        text: 'Վճարման կարգավորումները հաջողությամբ պահպանվեցին',
      });
      setTimeout(() => setSaveMessage(null), 3000);
    }, 1000);
  };

  const handleSaveSecurity = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    setTimeout(() => {
      setIsSaving(false);
      setSaveMessage({
        type: 'success',
        text: 'Անվտանգության կարգավորումները հաջողությամբ պահպանվեցին',
      });
      setTimeout(() => setSaveMessage(null), 3000);
    }, 1000);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3 mb-2">
          <div className="p-2 bg-gray-100 rounded-lg">
            <Settings className="w-6 h-6 text-gray-600" />
          </div>
          Կարգավորումներ
        </h1>
        <p className="text-gray-600">Կառավարեք համակարգի կարգավորումները</p>
      </div>

      {/* Save Message */}
      {saveMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            saveMessage.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {saveMessage.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{saveMessage.text}</span>
        </motion.div>
      )}

      <div className="space-y-6">
        {/* General Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
        >
          <div className="bg-gradient-to-r from-gray-600 to-gray-700 p-6">
            <div className="flex items-center gap-3">
              <Globe className="w-6 h-6 text-white" />
              <h2 className="text-2xl font-bold text-white">
                Ընդհանուր կարգավորումներ
              </h2>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Կայքի անվանում
              </label>
              <input
                type="text"
                value={generalSettings.siteName}
                onChange={(e) =>
                  setGeneralSettings({
                    ...generalSettings,
                    siteName: e.target.value,
                  })
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Կայքի նկարագրություն
              </label>
              <textarea
                value={generalSettings.siteDescription}
                onChange={(e) =>
                  setGeneralSettings({
                    ...generalSettings,
                    siteDescription: e.target.value,
                  })
                }
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent resize-none"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Կոնտակտային էլ. հասցե
                </label>
                <input
                  type="email"
                  value={generalSettings.contactEmail}
                  onChange={(e) =>
                    setGeneralSettings({
                      ...generalSettings,
                      contactEmail: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Կոնտակտային հեռախոս
                </label>
                <input
                  type="tel"
                  value={generalSettings.contactPhone}
                  onChange={(e) =>
                    setGeneralSettings({
                      ...generalSettings,
                      contactPhone: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Հասցե
              </label>
              <input
                type="text"
                value={generalSettings.address}
                onChange={(e) =>
                  setGeneralSettings({
                    ...generalSettings,
                    address: e.target.value,
                  })
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleSaveGeneral}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Պահպանվում է...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Պահպանել
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
