'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Edit,
  Trash2,
  X,
  Save,
  Sparkles,
  Eye,
  EyeOff,
  Calendar,
  Film,
} from 'lucide-react';
import {
  getAllPremieres,
  createPremiere,
  updatePremiere,
  deletePremiere,
} from '@/app/actions/premieres';
import { getMovies } from '@/app/actions/movies';

interface AdminPremieresClientProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    role: string;
  };
}

interface Premiere {
  id: number;
  premiereDate: Date | string;
  description?: string | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  movie: {
    id: number;
    title: string;
    image?: string | null;
  };
}

interface Movie {
  id: number;
  title: string;
}

export default function AdminPremieresClient({
  user,
}: AdminPremieresClientProps) {
  const [premieres, setPremieres] = useState<Premiere[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPremiere, setSelectedPremiere] = useState<Premiere | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    movieId: '',
    premiereDate: '',
    premiereTime: '',
    description: '',
    isActive: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [premieresResult, moviesResult] = await Promise.all([
        getAllPremieres(),
        getMovies(),
      ]);

      if (premieresResult.success && premieresResult.premieres) {
        setPremieres(premieresResult.premieres as Premiere[]);
      } else {
        setError(
          premieresResult.error || 'Պրեմիերաները բեռնելիս սխալ է տեղի ունեցել'
        );
      }

      if (moviesResult.success && moviesResult.movies) {
        setMovies(moviesResult.movies as Movie[]);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Տվյալները բեռնելիս սխալ է տեղի ունեցել');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setSelectedPremiere(null);
    setFormData({
      movieId: '',
      premiereDate: '',
      premiereTime: '',
      description: '',
      isActive: true,
    });
    setError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (premiere: Premiere) => {
    setSelectedPremiere(premiere);
    const premiereDate =
      typeof premiere.premiereDate === 'string'
        ? new Date(premiere.premiereDate)
        : premiere.premiereDate;

    setFormData({
      movieId: premiere.movie.id.toString(),
      premiereDate: premiereDate.toISOString().split('T')[0],
      premiereTime: premiereDate.toTimeString().slice(0, 5),
      description: premiere.description || '',
      isActive: premiere.isActive,
    });
    setError(null);
    setIsEditModalOpen(true);
  };

  const handleCloseModals = () => {
    setIsAddModalOpen(false);
    setIsEditModalOpen(false);
    setSelectedPremiere(null);
    setFormData({
      movieId: '',
      premiereDate: '',
      premiereTime: '',
      description: '',
      isActive: true,
    });
    setError(null);
  };

  const handleSave = async () => {
    if (!formData.movieId || !formData.premiereDate || !formData.premiereTime) {
      setError('Խնդրում ենք լրացնել բոլոր պարտադիր դաշտերը');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Combine date and time
      const dateTime = new Date(
        `${formData.premiereDate}T${formData.premiereTime}`
      );

      if (selectedPremiere) {
        // Update existing premiere
        const result = await updatePremiere({
          id: selectedPremiere.id,
          movieId: parseInt(formData.movieId, 10),
          premiereDate: dateTime,
          description: formData.description.trim() || null,
          isActive: formData.isActive,
        });

        if (result.success) {
          await loadData();
          handleCloseModals();
        } else {
          setError(result.error || 'Պրեմիերան թարմացնելիս սխալ է տեղի ունեցել');
        }
      } else {
        // Create new premiere
        const result = await createPremiere({
          movieId: parseInt(formData.movieId, 10),
          premiereDate: dateTime,
          description: formData.description.trim() || null,
          isActive: formData.isActive,
        });

        if (result.success) {
          await loadData();
          handleCloseModals();
        } else {
          setError(result.error || 'Պրեմիերան ստեղծելիս սխալ է տեղի ունեցել');
        }
      }
    } catch (err) {
      console.error('Error saving premiere:', err);
      setError('Պրեմիերան պահպանելիս սխալ է տեղի ունեցել');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Դուք համոզված եք, որ ցանկանում եք ջնջել այս պրեմիերան?')) {
      return;
    }

    try {
      const result = await deletePremiere(id);
      if (result.success) {
        await loadData();
      } else {
        alert(result.error || 'Պրեմիերան ջնջելիս սխալ է տեղի ունեցել');
      }
    } catch (err) {
      console.error('Error deleting premiere:', err);
      alert('Պրեմիերան ջնջելիս սխալ է տեղի ունեցել');
    }
  };

  const handleToggleActive = async (premiere: Premiere) => {
    try {
      const result = await updatePremiere({
        id: premiere.id,
        isActive: !premiere.isActive,
      });
      if (result.success) {
        await loadData();
      }
    } catch (err) {
      console.error('Error toggling premiere active status:', err);
    }
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const weekdays = [
      'կիրակի',
      'երկուշաբթի',
      'երեքշաբթի',
      'չորեքշաբթի',
      'հինգշաբթի',
      'ուրբաթ',
      'շաբաթ',
    ];
    const months = [
      'հունվար',
      'փետրվար',
      'մարտ',
      'ապրիլ',
      'մայիս',
      'հունիս',
      'հուլիս',
      'օգոստոս',
      'սեպտեմբեր',
      'հոկտեմբեր',
      'նոյեմբեր',
      'դեկտեմբեր',
    ];
    return `${weekdays[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Sparkles className="w-6 h-6 text-purple-600" />
            </div>
            Պրեմիերաներ
          </h1>
          <p className="text-gray-600 mt-1">Կառավարեք ֆիլմերի պրեմիերաները</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg"
        >
          <Plus className="w-5 h-5" />
          Ավելացնել պրեմիերա
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Premieres List */}
      {isLoading ? (
        <div className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          <p className="mt-4 text-gray-600">Բեռնվում է...</p>
        </div>
      ) : premieres.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <Sparkles className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg mb-4">Պրեմիերաներ դեռ չկան</p>
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
          >
            Ավելացնել առաջին պրեմիերան
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ֆիլմ
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Պրեմիերայի ամսաթիվ
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Նկարագրություն
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
                {premieres.map((premiere) => (
                  <tr
                    key={premiere.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {premiere.movie.image && (
                          <img
                            src={premiere.movie.image}
                            alt={premiere.movie.title}
                            className="w-12 h-16 object-cover rounded"
                          />
                        )}
                        <div className="text-sm font-medium text-gray-900">
                          {premiere.movie.title}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {formatDate(premiere.premiereDate)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 max-w-md truncate">
                        {premiere.description || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActive(premiere)}
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          premiere.isActive
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {premiere.isActive ? (
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
                          onClick={() => handleOpenEditModal(premiere)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Խմբագրել"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(premiere.id)}
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
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={handleCloseModals}
          >
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
                      {selectedPremiere
                        ? 'Խմբագրել պրեմիերա'
                        : 'Ավելացնել նոր պրեմիերա'}
                    </h2>
                    <p className="text-white/90 text-sm">
                      Լրացրեք պրեմիերայի մանրամասները
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
                  {/* Movie Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ֆիլմ <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.movieId}
                      onChange={(e) =>
                        setFormData({ ...formData, movieId: e.target.value })
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required
                    >
                      <option value="">Ընտրեք ֆիլմ</option>
                      {movies.map((movie) => (
                        <option key={movie.id} value={movie.id}>
                          {movie.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Premiere Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Պրեմիերայի ամսաթիվ <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.premiereDate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          premiereDate: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required
                    />
                  </div>

                  {/* Premiere Time */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Պրեմիերայի ժամ <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={formData.premiereTime}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          premiereTime: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Նկարագրություն (ընտրովի)
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      placeholder="Մուտքագրեք պրեմիերայի նկարագրությունը..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                      rows={4}
                    />
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
                    <label
                      htmlFor="isActive"
                      className="text-sm font-medium text-gray-700"
                    >
                      Ակտիվ (ցուցադրվում է պրեմիերաների էջում)
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
