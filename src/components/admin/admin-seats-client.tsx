'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Edit,
  Trash2,
  X,
  Grid3x3,
  Save,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import AdminLayout from './admin-layout';
import {
  getSeats,
  createSeat,
  updateSeat,
  deleteSeat,
  bulkCreateSeats,
  deleteAllSeats,
} from '@/app/actions/seats';

interface AdminSeatsClientProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    role: string;
  };
}

interface Seat {
  id: number;
  hallId: number;
  row: string;
  number: number;
  seatType: string;
  hall?: {
    id: number;
    name: string;
    capacity: number;
  };
}

export default function AdminSeatsClient({ user }: AdminSeatsClientProps) {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [editingSeat, setEditingSeat] = useState<Seat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    row: '',
    number: '',
    seatType: 'standard' as 'standard' | 'vip' | 'disabled',
  });

  const [bulkFormData, setBulkFormData] = useState({
    rows: 'A,B,C,D,E,F,G,H,I,J',
    seatsPerRow: '8',
    seatType: 'standard' as 'standard' | 'vip' | 'disabled',
  });

  useEffect(() => {
    loadSeats();
  }, []);

  const loadSeats = async () => {
    setIsLoading(true);
    try {
      const result = await getSeats();
      if (result.success && result.seats) {
        setSeats(result.seats as Seat[]);
      }
    } catch (err) {
      console.error('Error loading seats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingSeat(null);
    setFormData({
      row: '',
      number: '',
      seatType: 'standard',
    });
    setError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (seat: Seat) => {
    setEditingSeat(seat);
    setFormData({
      row: seat.row,
      number: seat.number.toString(),
      seatType: seat.seatType as 'standard' | 'vip' | 'disabled',
    });
    setError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSeat(null);
    setFormData({
      row: '',
      number: '',
      seatType: 'standard',
    });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (!formData.row || !formData.number) {
        setError('Բոլոր պարտադիր դաշտերը պետք է լրացված լինեն');
        setIsLoading(false);
        return;
      }

      if (editingSeat) {
        const result = await updateSeat({
          id: editingSeat.id,
          row: formData.row,
          number: parseInt(formData.number),
          seatType: formData.seatType,
        });

        if (result.success) {
          setSuccessMessage(result.message || 'Նստատեղը հաջողությամբ թարմացվեց');
          await loadSeats();
          handleCloseModal();
        } else {
          setError(result.error || 'Նստատեղ թարմացնելիս սխալ է տեղի ունեցել');
        }
      } else {
        const result = await createSeat({
          hallId: 0, // Will be auto-set to default hall
          row: formData.row,
          number: parseInt(formData.number),
          seatType: formData.seatType,
        });

        if (result.success) {
          setSuccessMessage(result.message || 'Նստատեղը հաջողությամբ ավելացվեց');
          await loadSeats();
          handleCloseModal();
        } else {
          setError(result.error || 'Նստատեղ ավելացնելիս սխալ է տեղի ունեցել');
        }
      }
    } catch (err) {
      console.error('Error saving seat:', err);
      setError('Նստատեղ պահպանելիս սխալ է տեղի ունեցել');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const rows = bulkFormData.rows
        .split(',')
        .map((r) => r.trim())
        .filter((r) => r.length > 0);

      if (rows.length === 0) {
        setError('Խնդրում ենք մուտքագրել առնվազն մեկ շարք');
        setIsLoading(false);
        return;
      }

      const seatsPerRow = parseInt(bulkFormData.seatsPerRow);
      if (isNaN(seatsPerRow) || seatsPerRow < 1) {
        setError('Նստատեղերի քանակը պետք է լինի դրական թիվ');
        setIsLoading(false);
        return;
      }

      const result = await bulkCreateSeats({
        hallId: 0, // Will be auto-set to default hall
        rows,
        seatsPerRow,
        seatType: bulkFormData.seatType,
      });

      if (result.success) {
        setSuccessMessage(result.message || 'Նստատեղերը հաջողությամբ ավելացվեցին');
        await loadSeats();
        setIsBulkModalOpen(false);
        setBulkFormData({
          rows: 'A,B,C,D,E,F,G,H,I,J',
          seatsPerRow: '8',
          seatType: 'standard',
        });
      } else {
        setError(result.error || 'Նստատեղեր ավելացնելիս սխալ է տեղի ունեցել');
      }
    } catch (err) {
      console.error('Error bulk creating seats:', err);
      setError('Նստատեղեր ավելացնելիս սխալ է տեղի ունեցել');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSeat = async (id: number) => {
    if (!confirm('Դուք համոզված եք, որ ցանկանում եք ջնջել այս նստատեղը?')) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await deleteSeat(id);
      if (result.success) {
        setSuccessMessage(result.message || 'Նստատեղը հաջողությամբ ջնջվեց');
        await loadSeats();
      } else {
        setError(result.error || 'Նստատեղ ջնջելիս սխալ է տեղի ունեցել');
      }
    } catch (err) {
      console.error('Error deleting seat:', err);
      setError('Նստատեղ ջնջելիս սխալ է տեղի ունեցել');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    if (
      !confirm(
        'Դուք համոզված եք, որ ցանկանում եք ջնջել ԲՈԼՈՐ նստատեղերը? Այս գործողությունը չի կարող հետարկվել:'
      )
    ) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await deleteAllSeats();
      if (result.success) {
        setSuccessMessage(result.message || 'Բոլոր նստատեղերը հաջողությամբ ջնջվեցին');
        await loadSeats();
      } else {
        setError(result.error || 'Նստատեղեր ջնջելիս սխալ է տեղի ունեցել');
      }
    } catch (err) {
      console.error('Error deleting all seats:', err);
      setError('Նստատեղեր ջնջելիս սխալ է տեղի ունեցել');
    } finally {
      setIsLoading(false);
    }
  };

  // Group seats by row
  const seatsByRow = useMemo(() => {
    const grouped = new Map<string, Seat[]>();
    seats.forEach((seat) => {
      if (!grouped.has(seat.row)) {
        grouped.set(seat.row, []);
      }
      grouped.get(seat.row)!.push(seat);
    });
    // Sort seats within each row by number
    grouped.forEach((rowSeats) => {
      rowSeats.sort((a, b) => a.number - b.number);
    });
    return grouped;
  }, [seats]);

  const getSeatTypeColor = (seatType: string) => {
    switch (seatType) {
      case 'vip':
        return 'bg-yellow-500';
      case 'disabled':
        return 'bg-gray-400';
      default:
        return 'bg-blue-500';
    }
  };

  const getSeatTypeLabel = (seatType: string) => {
    switch (seatType) {
      case 'vip':
        return 'VIP';
      case 'disabled':
        return 'Անջատված';
      default:
        return 'Ստանդարտ';
    }
  };

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  if (isLoading && seats.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <AdminLayout user={user}>
      <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Նստատեղերի կառավարում</h1>
        <p className="text-gray-600">
          Կարգավորեք դահլիճի նստատեղերը: Ընդամենը {seats.length} նստատեղ
        </p>
      </div>

      {/* Messages */}
      {successMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2"
        >
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <span className="text-green-800">{successMessage}</span>
        </motion.div>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2"
        >
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-800">{error}</span>
        </motion.div>
      )}

      {/* Actions */}
      <div className="mb-6 flex gap-3">
        <button
          onClick={handleOpenAddModal}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Ավելացնել նստատեղ
        </button>
        <button
          onClick={() => setIsBulkModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Grid3x3 className="w-4 h-4" />
          Մասսայական ավելացում
        </button>
        {seats.length > 0 && (
          <button
            onClick={handleDeleteAll}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Ջնջել բոլորը
          </button>
        )}
      </div>

      {/* Seats Grid */}
      {seats.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600 mb-4">Նստատեղեր չկան</p>
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Ավելացնել նստատեղ
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-lg p-6">
          {/* Screen indicator */}
          <div className="mb-8 text-center">
            <div className="inline-block bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-2 rounded-t-lg">
              <span className="font-semibold">ԷԿՐԱՆ</span>
            </div>
          </div>

          {/* Seats visualization */}
          <div className="space-y-2 mb-6">
            {Array.from(seatsByRow.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([row, rowSeats]) => (
                <div key={row} className="flex items-center gap-3">
                  <div className="w-10 text-center font-semibold text-gray-700">{row}</div>
                  <div className="flex gap-1 flex-1">
                    {rowSeats.map((seat) => (
                      <div
                        key={seat.id}
                        className={`
                          w-10 h-10 rounded flex items-center justify-center text-white text-xs font-medium
                          ${getSeatTypeColor(seat.seatType)}
                        `}
                        title={`${row}${seat.number} - ${getSeatTypeLabel(seat.seatType)}`}
                      >
                        {seat.number}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-6 justify-center text-sm mb-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-500 rounded"></div>
              <span className="text-gray-600">Ստանդարտ</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-yellow-500 rounded"></div>
              <span className="text-gray-600">VIP</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gray-400 rounded"></div>
              <span className="text-gray-600">Անջատված</span>
            </div>
          </div>

          {/* Seats List */}
          <div className="border-t pt-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Նստատեղերի ցանկ</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4">Շարք</th>
                    <th className="text-left py-2 px-4">Համար</th>
                    <th className="text-left py-2 px-4">Տիպ</th>
                    <th className="text-right py-2 px-4">Գործողություններ</th>
                  </tr>
                </thead>
                <tbody>
                  {seats
                    .sort((a, b) => {
                      if (a.row !== b.row) {
                        return a.row.localeCompare(b.row);
                      }
                      return a.number - b.number;
                    })
                    .map((seat) => (
                      <tr key={seat.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-4 font-semibold">{seat.row}</td>
                        <td className="py-2 px-4">{seat.number}</td>
                        <td className="py-2 px-4">
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              seat.seatType === 'vip'
                                ? 'bg-yellow-100 text-yellow-800'
                                : seat.seatType === 'disabled'
                                  ? 'bg-gray-100 text-gray-800'
                                  : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {getSeatTypeLabel(seat.seatType)}
                          </span>
                        </td>
                        <td className="py-2 px-4">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleOpenEditModal(seat)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Խմբագրել"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSeat(seat.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
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
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={handleCloseModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingSeat ? 'Խմբագրել նստատեղ' : 'Ավելացնել նստատեղ'}
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Շարք *
                  </label>
                  <input
                    type="text"
                    value={formData.row}
                    onChange={(e) =>
                      setFormData({ ...formData, row: e.target.value.toUpperCase() })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="A"
                    maxLength={10}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Համար *
                  </label>
                  <input
                    type="number"
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="1"
                    min="1"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Տիպ
                  </label>
                  <select
                    value={formData.seatType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        seatType: e.target.value as 'standard' | 'vip' | 'disabled',
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="standard">Ստանդարտ</option>
                    <option value="vip">VIP</option>
                    <option value="disabled">Անջատված</option>
                  </select>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {isLoading ? 'Պահպանվում է...' : 'Պահպանել'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Չեղարկել
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Create Modal */}
      <AnimatePresence>
        {isBulkModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setIsBulkModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Մասսայական ավելացում</h2>
                <button
                  onClick={() => setIsBulkModalOpen(false)}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleBulkSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Շարքեր (բաժանված ստորակետով) *
                  </label>
                  <input
                    type="text"
                    value={bulkFormData.rows}
                    onChange={(e) =>
                      setBulkFormData({ ...bulkFormData, rows: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="A,B,C,D,E,F,G,H,I,J"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Օրինակ: A,B,C,D,E կամ A,B,C,D,E,F,G,H,I,J
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Նստատեղերի քանակ յուրաքանչյուր շարքում *
                  </label>
                  <input
                    type="number"
                    value={bulkFormData.seatsPerRow}
                    onChange={(e) =>
                      setBulkFormData({ ...bulkFormData, seatsPerRow: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="8"
                    min="1"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Տիպ
                  </label>
                  <select
                    value={bulkFormData.seatType}
                    onChange={(e) =>
                      setBulkFormData({
                        ...bulkFormData,
                        seatType: e.target.value as 'standard' | 'vip' | 'disabled',
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="standard">Ստանդարտ</option>
                    <option value="vip">VIP</option>
                    <option value="disabled">Անջատված</option>
                  </select>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Grid3x3 className="w-4 h-4" />
                    {isLoading ? 'Ստեղծվում է...' : 'Ստեղծել'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsBulkModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Չեղարկել
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </AdminLayout>
  );
}
