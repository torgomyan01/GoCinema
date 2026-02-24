'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Edit,
  Trash2,
  X,
  Save,
  HelpCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  getAllFAQs,
  createFAQ,
  updateFAQ,
  deleteFAQ,
} from '@/app/actions/faq';

interface AdminFAQClientProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    role: string;
  };
}

interface FAQ {
  id: number;
  question: string;
  answer: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export default function AdminFAQClient({ user }: AdminFAQClientProps) {
  const [faqs, setFAQs] = useState<FAQ[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedFAQ, setSelectedFAQ] = useState<FAQ | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    question: '',
    answer: '',
    order: '',
    isActive: true,
  });

  useEffect(() => {
    loadFAQs();
  }, []);

  const loadFAQs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getAllFAQs();
      if (result.success && result.faqs) {
        setFAQs(result.faqs as FAQ[]);
      } else {
        setError(result.error || 'Հաճախակի հարցերը բեռնելիս սխալ է տեղի ունեցել');
      }
    } catch (err) {
      console.error('Error loading FAQs:', err);
      setError('Հաճախակի հարցերը բեռնելիս սխալ է տեղի ունեցել');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setSelectedFAQ(null);
    setFormData({
      question: '',
      answer: '',
      order: '',
      isActive: true,
    });
    setError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (faq: FAQ) => {
    setSelectedFAQ(faq);
    setFormData({
      question: faq.question,
      answer: faq.answer,
      order: faq.order.toString(),
      isActive: faq.isActive,
    });
    setError(null);
    setIsEditModalOpen(true);
  };

  const handleCloseModals = () => {
    setIsAddModalOpen(false);
    setIsEditModalOpen(false);
    setSelectedFAQ(null);
    setFormData({
      question: '',
      answer: '',
      order: '',
      isActive: true,
    });
    setError(null);
  };

  const handleSave = async () => {
    if (!formData.question.trim() || !formData.answer.trim()) {
      setError('Խնդրում ենք լրացնել բոլոր պարտադիր դաշտերը');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      if (selectedFAQ) {
        // Update existing FAQ
        const result = await updateFAQ({
          id: selectedFAQ.id,
          question: formData.question.trim(),
          answer: formData.answer.trim(),
          order: formData.order ? parseInt(formData.order, 10) : undefined,
          isActive: formData.isActive,
        });

        if (result.success) {
          await loadFAQs();
          handleCloseModals();
        } else {
          setError(result.error || 'Հաճախակի հարցը թարմացնելիս սխալ է տեղի ունեցել');
        }
      } else {
        // Create new FAQ
        const result = await createFAQ({
          question: formData.question.trim(),
          answer: formData.answer.trim(),
          order: formData.order ? parseInt(formData.order, 10) : undefined,
          isActive: formData.isActive,
        });

        if (result.success) {
          await loadFAQs();
          handleCloseModals();
        } else {
          setError(result.error || 'Հաճախակի հարցը ստեղծելիս սխալ է տեղի ունեցել');
        }
      }
    } catch (err) {
      console.error('Error saving FAQ:', err);
      setError('Հաճախակի հարցը պահպանելիս սխալ է տեղի ունեցել');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Դուք համոզված եք, որ ցանկանում եք ջնջել այս հաճախակի հարցը?')) {
      return;
    }

    try {
      const result = await deleteFAQ(id);
      if (result.success) {
        await loadFAQs();
      } else {
        alert(result.error || 'Հաճախակի հարցը ջնջելիս սխալ է տեղի ունեցել');
      }
    } catch (err) {
      console.error('Error deleting FAQ:', err);
      alert('Հաճախակի հարցը ջնջելիս սխալ է տեղի ունեցել');
    }
  };

  const handleToggleActive = async (faq: FAQ) => {
    try {
      const result = await updateFAQ({
        id: faq.id,
        isActive: !faq.isActive,
      });
      if (result.success) {
        await loadFAQs();
      }
    } catch (err) {
      console.error('Error toggling FAQ active status:', err);
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <HelpCircle className="w-6 h-6 text-purple-600" />
            </div>
            Հաճախակի հարցեր
          </h1>
          <p className="text-gray-600 mt-1">
            Կառավարեք հաճախակի տրվող հարցերը և պատասխանները
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg"
        >
          <Plus className="w-5 h-5" />
          Ավելացնել հարց
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* FAQs List */}
      {isLoading ? (
        <div className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          <p className="mt-4 text-gray-600">Բեռնվում է...</p>
        </div>
      ) : faqs.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <HelpCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg mb-4">Հաճախակի հարցեր դեռ չկան</p>
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
          >
            Ավելացնել առաջին հարցը
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Հարց
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Պատասխան
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Կարգ
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Կարգավիճակ
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Գործողություններ
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {faqs.map((faq) => (
                  <tr key={faq.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 max-w-md truncate">
                        {faq.question}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 max-w-md truncate">
                        {faq.answer}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">{faq.order}</span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActive(faq)}
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          faq.isActive
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {faq.isActive ? (
                          <>
                            <Eye className="w-4 h-4" />
                            Ակտիվ
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-4 h-4" />
                            Անակտիվ
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEditModal(faq)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Խմբագրել"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(faq.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Ջնջել"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {(isAddModalOpen || isEditModalOpen) && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={handleCloseModals}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-1">
                      {selectedFAQ ? 'Խմբագրել հարց' : 'Ավելացնել նոր հարց'}
                    </h2>
                    <p className="text-white/90 text-sm">
                      Լրացրեք հարցի և պատասխանի մանրամասները
                    </p>
                  </div>
                  <button
                    onClick={handleCloseModals}
                    className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Form */}
              <div className="p-6 max-h-[70vh] overflow-y-auto">
                {error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                  {/* Question */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Հարց <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={formData.question}
                      onChange={(e) =>
                        setFormData({ ...formData, question: e.target.value })
                      }
                      placeholder="Մուտքագրեք հարցը..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                      rows={2}
                    />
                  </div>

                  {/* Answer */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Պատասխան <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={formData.answer}
                      onChange={(e) =>
                        setFormData({ ...formData, answer: e.target.value })
                      }
                      placeholder="Մուտքագրեք պատասխանը..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                      rows={6}
                    />
                  </div>

                  {/* Order */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Կարգ (ընտրովի)
                    </label>
                    <input
                      type="number"
                      value={formData.order}
                      onChange={(e) =>
                        setFormData({ ...formData, order: e.target.value })
                      }
                      placeholder="Կարգ (ցուցադրման հերթականություն)"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Ցածր թվերը ցուցադրվում են առաջինը
                    </p>
                  </div>

                  {/* Is Active */}
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={(e) =>
                        setFormData({ ...formData, isActive: e.target.checked })
                      }
                      className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                      Ակտիվ (ցուցադրվում է հաճախակի հարցերի էջում)
                    </label>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-gray-200">
                <button
                  onClick={handleCloseModals}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  disabled={isSaving}
                >
                  Չեղարկել
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
