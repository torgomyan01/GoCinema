'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PartyPopper,
  Plus,
  Pencil,
  Trash2,
  X,
  Calendar,
  Clock,
  Phone,
  Users,
  Banknote,
  AlertCircle,
  Ban,
} from 'lucide-react';
import {
  getPackageBookings,
  createPackageBooking,
  updatePackageBooking,
  cancelPackageBooking,
  deletePackageBooking,
  type PackageBookingInput,
} from '@/app/actions/package-bookings';
import {
  PACKAGE_TYPES,
  PACKAGE_BUFFER_MINUTES,
  packageTypeLabelHy,
  packageStatusLabelHy,
  type PackageBookingRow,
} from '@/lib/package-booking';

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'cancelled';

interface FormState {
  packageType: string;
  customerName: string;
  customerPhone: string;
  guestsCount: string;
  price: string;
  notes: string;
  date: string; // yyyy-mm-dd
  startClock: string; // HH:mm
  endClock: string; // HH:mm
  status: string;
}

const EMPTY_FORM: FormState = {
  packageType: 'private-party',
  customerName: '',
  customerPhone: '',
  guestsCount: '',
  price: '',
  notes: '',
  date: '',
  startClock: '',
  endClock: '',
  status: 'confirmed',
};

function toLocalDateInput(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toLocalClockInput(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDateHyShort(iso: string): string {
  return new Date(iso).toLocaleDateString('hy-AM', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatClockHy(iso: string): string {
  return new Date(iso).toLocaleTimeString('hy-AM', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'confirmed':
      return 'bg-green-100 text-green-700';
    case 'pending':
      return 'bg-amber-100 text-amber-700';
    case 'cancelled':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

export default function AdminPackagesClient() {
  const [bookings, setBookings] = useState<PackageBookingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadBookings = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await getPackageBookings({
        status: statusFilter,
      });
      if (result.success) {
        setBookings(result.bookings);
      } else {
        setLoadError(result.error || 'Բեռնման սխալ');
      }
    } catch {
      setLoadError('Բեռնման սխալ');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const upcoming = useMemo(
    () =>
      bookings.filter(
        (b) => b.status !== 'cancelled' && new Date(b.endTime) > new Date()
      ).length,
    [bookings]
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEdit = (b: PackageBookingRow) => {
    setEditingId(b.id);
    setForm({
      packageType: b.packageType,
      customerName: b.customerName,
      customerPhone: b.customerPhone,
      guestsCount: b.guestsCount != null ? String(b.guestsCount) : '',
      price: b.price != null ? String(b.price) : '',
      notes: b.notes ?? '',
      date: toLocalDateInput(b.startTime),
      startClock: toLocalClockInput(b.startTime),
      endClock: toLocalClockInput(b.endTime),
      status: b.status,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const buildInput = (): PackageBookingInput | { error: string } => {
    if (!form.date || !form.startClock || !form.endClock) {
      return { error: 'Նշեք ամսաթիվը, սկզբի և ավարտի ժամերը' };
    }
    const start = new Date(`${form.date}T${form.startClock}`);
    let end = new Date(`${form.date}T${form.endClock}`);
    // Կեսգիշերն անցնող միջակայք (օր. 22:00–01:00) → ավարտը հաջորդ օրը
    if (end <= start) {
      end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    }
    return {
      packageType: form.packageType,
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      guestsCount: form.guestsCount ? parseInt(form.guestsCount, 10) : null,
      price: form.price ? parseFloat(form.price) : null,
      notes: form.notes || null,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      status: form.status,
    };
  };

  const handleSave = async () => {
    if (isSaving) return;
    setFormError(null);

    const input = buildInput();
    if ('error' in input) {
      setFormError(input.error);
      return;
    }

    setIsSaving(true);
    try {
      const result =
        editingId != null
          ? await updatePackageBooking(editingId, input)
          : await createPackageBooking(input);

      if (!result.success) {
        setFormError(result.error || 'Պահպանման սխալ');
        return;
      }
      setIsModalOpen(false);
      await loadBookings();
    } catch {
      setFormError('Պահպանման սխալ');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = async (id: number) => {
    if (busyId != null) return;
    setBusyId(id);
    try {
      const result = await cancelPackageBooking(id);
      if (!result.success) {
        alert(result.error || 'Չեղարկման սխալ');
        return;
      }
      await loadBookings();
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (busyId != null) return;
    if (!confirm('Վստա՞հ եք, որ ցանկանում եք ջնջել այս պատվերը։')) return;
    setBusyId(id);
    try {
      const result = await deletePackageBooking(id);
      if (!result.success) {
        alert(result.error || 'Ջնջման սխալ');
        return;
      }
      await loadBookings();
    } finally {
      setBusyId(null);
    }
  };

  const statusTabs: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'Բոլորը' },
    { value: 'confirmed', label: 'Հաստատված' },
    { value: 'pending', label: 'Սպասվող' },
    { value: 'cancelled', label: 'Չեղարկված' },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-fuchsia-100 p-2">
            <PartyPopper className="h-6 w-6 text-fuchsia-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Փաթեթների պատվերներ
            </h1>
            <p className="text-sm text-gray-600">
              Փակ կինոդիտում, կորպորատիվ, ռոմանտիկ ժամադրություն — պայմանավորված
              ժամերին ցուցադրություն ավելացնել չի թույլատրվի (±
              {PACKAGE_BUFFER_MINUTES}ր)
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-fuchsia-500"
        >
          <Plus className="h-4 w-4" />
          Նոր պատվեր
        </button>
      </div>

      {/* Stats + filter */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-gray-600">
            Առաջիկա ակտիվ պատվերներ՝{' '}
            <span className="font-semibold text-gray-900">{upcoming}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {statusTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatusFilter(tab.value)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  statusFilter === tab.value
                    ? 'border-fuchsia-600 bg-fuchsia-600 text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loadError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {loadError}
        </div>
      )}

      {/* List */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-700">
            Պատվերների ցանկ ({bookings.length})
          </h2>
        </div>

        {isLoading ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-b-2 border-fuchsia-600" />
            <p className="text-sm text-gray-500">Բեռնվում է…</p>
          </div>
        ) : bookings.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-400">
            Պատվերներ չկան
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-5 py-3">Փաթեթ</th>
                  <th className="px-5 py-3">Հաճախորդ</th>
                  <th className="px-5 py-3">Ամսաթիվ / Ժամ</th>
                  <th className="px-5 py-3">Հյուրեր</th>
                  <th className="px-5 py-3">Գին</th>
                  <th className="px-5 py-3">Կարգավիճակ</th>
                  <th className="px-5 py-3 text-right">Գործողություններ</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  const isPast = new Date(b.endTime) < new Date();
                  return (
                    <tr
                      key={b.id}
                      className={`border-b border-gray-50 hover:bg-gray-50/60 ${
                        b.status === 'cancelled' || isPast ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="px-5 py-3">
                        <span className="font-medium text-gray-900">
                          {packageTypeLabelHy(b.packageType)}
                        </span>
                        {b.notes && (
                          <p className="mt-0.5 max-w-56 truncate text-xs text-gray-500">
                            {b.notes}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-900">
                          {b.customerName}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Phone className="h-3 w-3" />
                          {b.customerPhone}
                        </div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-gray-900">
                          <Calendar className="h-3.5 w-3.5 text-gray-400" />
                          {formatDateHyShort(b.startTime)}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          {formatClockHy(b.startTime)} –{' '}
                          {formatClockHy(b.endTime)}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {b.guestsCount != null ? (
                          <span className="inline-flex items-center gap-1 text-gray-700">
                            <Users className="h-3.5 w-3.5 text-gray-400" />
                            {b.guestsCount}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        {b.price != null ? (
                          <span className="inline-flex items-center gap-1 font-medium text-gray-900">
                            <Banknote className="h-3.5 w-3.5 text-gray-400" />
                            {b.price.toLocaleString('hy-AM')} ֏
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(b.status)}`}
                        >
                          {packageStatusLabelHy(b.status)}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(b)}
                            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                            title="Խմբագրել"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {b.status !== 'cancelled' && (
                            <button
                              type="button"
                              onClick={() => handleCancel(b.id)}
                              disabled={busyId === b.id}
                              className="rounded-md p-1.5 text-amber-600 hover:bg-amber-50 disabled:opacity-50"
                              title="Չեղարկել"
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(b.id)}
                            disabled={busyId === b.id}
                            className="rounded-md p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-50"
                            title="Ջնջել"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {editingId != null
                  ? 'Խմբագրել պատվերը'
                  : 'Նոր փաթեթի պատվեր'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">
                  Փաթեթ *
                </label>
                <select
                  value={form.packageType}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, packageType: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
                >
                  {PACKAGE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {packageTypeLabelHy(t)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">
                    Հաճախորդի անուն *
                  </label>
                  <input
                    type="text"
                    value={form.customerName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, customerName: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
                    placeholder="Անուն Ազգանուն"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">
                    Հեռախոս *
                  </label>
                  <input
                    type="tel"
                    value={form.customerPhone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, customerPhone: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
                    placeholder="+374…"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">
                    Ամսաթիվ *
                  </label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, date: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">
                    Սկիզբ *
                  </label>
                  <input
                    type="time"
                    value={form.startClock}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, startClock: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">
                    Հավանական ավարտ *
                  </label>
                  <input
                    type="time"
                    value={form.endClock}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, endClock: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">
                    Հյուրերի քանակ
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.guestsCount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, guestsCount: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
                    placeholder="օր. 15"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">
                    Գին (֏)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.price}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, price: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
                    placeholder="օր. 50000"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">
                  Նշումներ
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
                  placeholder="Հատուկ ցանկություններ, ֆիլմ/տեսանյութ, ձևավորում…"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">
                  Կարգավիճակ
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
                >
                  <option value="confirmed">Հաստատված</option>
                  <option value="pending">Սպասվող</option>
                  {editingId != null && (
                    <option value="cancelled">Չեղարկված</option>
                  )}
                </select>
                <p className="mt-1 text-[11px] text-gray-400">
                  Չչեղարկված պատվերի ժամին (±{PACKAGE_BUFFER_MINUTES}ր)
                  ցուցադրություն ավելացնել չի թույլատրվի։
                </p>
              </div>

              {formError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
                >
                  Փակել
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="rounded-xl bg-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-fuchsia-500 disabled:opacity-60"
                >
                  {isSaving
                    ? 'Պահպանվում է…'
                    : editingId != null
                      ? 'Պահպանել'
                      : 'Ավելացնել'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
