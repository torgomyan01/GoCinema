'use client';

import { useMemo, useState } from 'react';
import {
  Building2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Trash2,
  X,
  Landmark,
  User,
} from 'lucide-react';
import {
  createCompany,
  deleteCompany,
  updateCompany,
  type CompanyInput,
  type CompanySocial,
  type CompanyView,
} from '@/app/actions/companies';

const SOCIAL_NETWORKS = [
  'Instagram',
  'Facebook',
  'YouTube',
  'TikTok',
  'Telegram',
  'LinkedIn',
  'WhatsApp',
  'X',
  'Այլ',
];

type FormState = {
  name: string;
  tin: string;
  bankName: string;
  bankAccount: string;
  address: string;
  director: string;
  email: string;
  website: string;
  phones: string[];
  socials: CompanySocial[];
  notes: string;
  isActive: boolean;
};

const emptyForm = (): FormState => ({
  name: '',
  tin: '',
  bankName: '',
  bankAccount: '',
  address: '',
  director: '',
  email: '',
  website: '',
  phones: [''],
  socials: [{ network: 'Instagram', url: '' }],
  notes: '',
  isActive: true,
});

function fromCompany(row: CompanyView): FormState {
  return {
    name: row.name,
    tin: row.tin,
    bankName: row.bankName || '',
    bankAccount: row.bankAccount || '',
    address: row.address || '',
    director: row.director || '',
    email: row.email || '',
    website: row.website || '',
    phones: row.phones.length ? row.phones : [''],
    socials: row.socials.length
      ? row.socials
      : [{ network: 'Instagram', url: '' }],
    notes: row.notes || '',
    isActive: row.isActive,
  };
}

function toInput(form: FormState): CompanyInput {
  return {
    name: form.name,
    tin: form.tin,
    bankName: form.bankName,
    bankAccount: form.bankAccount,
    address: form.address,
    director: form.director,
    email: form.email,
    website: form.website,
    phones: form.phones,
    socials: form.socials,
    notes: form.notes,
    isActive: form.isActive,
  };
}

type Props = {
  initialCompanies: CompanyView[];
  initialError: string | null;
};

export default function AdminCompaniesClient({
  initialCompanies,
  initialError,
}: Props) {
  const [companies, setCompanies] = useState(initialCompanies);
  const [error, setError] = useState(initialError);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<CompanyView | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((row) =>
      [row.name, row.tin, row.director, row.email, row.bankName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [companies, query]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setIsOpen(true);
  };

  const openEdit = (row: CompanyView) => {
    setEditing(row);
    setForm(fromCompany(row));
    setFormError(null);
    setIsOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const payload = toInput(form);
      const res = editing
        ? await updateCompany(editing.id, payload)
        : await createCompany(payload);
      if (!res.success || !res.company) {
        setFormError(res.error || 'Չհաջողվեց պահպանել');
        return;
      }
      setCompanies((prev) => {
        const next = editing
          ? prev.map((row) => (row.id === res.company!.id ? res.company! : row))
          : [...prev, res.company!];
        return next.sort((a, b) => a.name.localeCompare(b.name, 'hy'));
      });
      setIsOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: CompanyView) => {
    if (!window.confirm(`Ջնջե՞լ «${row.name}» ընկերությունը։`)) return;
    const res = await deleteCompany(row.id);
    if (!res.success) {
      setError(res.error || 'Չհաջողվեց ջնջել');
      return;
    }
    setCompanies((prev) => prev.filter((item) => item.id !== row.id));
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-slate-100 p-2">
            <Building2 className="h-6 w-6 text-slate-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Ընկերություններ
            </h1>
            <p className="text-sm text-gray-600">
              Գործընկեր կազմակերպությունների տվյալներ. հետո կկապվեն ֆիլմերին
              որպես արտադրող
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" />
          Ավելացնել ընկերություն
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Որոնել անունով, ՀՎՀՀ-ով, տնօրենով…"
        className="mb-4 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-slate-400"
      />

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center text-sm text-gray-500">
          Ընկերություն չկա։ Ավելացրու առաջինը։
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((row) => (
            <li
              key={row.id}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-gray-900">{row.name}</h2>
                    {!row.isActive && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                        Անջատված
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">ՀՎՀՀ՝ {row.tin}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(row)}
                    className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
                    aria-label="Խմբագրել"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(row)}
                    className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                    aria-label="Ջնջել"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
                {row.director && (
                  <p className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    Տնօրեն՝ {row.director}
                  </p>
                )}
                {row.email && (
                  <p className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-400" />
                    {row.email}
                  </p>
                )}
                {row.phones.length > 0 && (
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    {row.phones.join(', ')}
                  </p>
                )}
                {row.address && (
                  <p className="flex items-start gap-2 sm:col-span-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                    {row.address}
                  </p>
                )}
                {(row.bankName || row.bankAccount) && (
                  <p className="flex items-start gap-2 sm:col-span-2">
                    <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                    {[row.bankName, row.bankAccount]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <div className="my-8 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing ? 'Խմբագրել ընկերությունը' : 'Նոր ընկերություն'}
              </h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2 text-sm">
                <span className="mb-1 block font-medium text-gray-700">
                  Անվանում *
                </span>
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="«ԻՍՏ ՀԱՅԼԵՆԴ» ՍՊԸ"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-slate-400"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-gray-700">
                  ՀՎՀՀ *
                </span>
                <input
                  value={form.tin}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, tin: e.target.value }))
                  }
                  placeholder="01073082"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-slate-400"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-gray-700">
                  Տնօրեն
                </span>
                <input
                  value={form.director}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, director: e.target.value }))
                  }
                  placeholder="Մանե Մխիթարյան"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-slate-400"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-gray-700">
                  Email
                </span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="info@example.com"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-slate-400"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-gray-700">
                  Կայք
                </span>
                <input
                  value={form.website}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, website: e.target.value }))
                  }
                  placeholder="https://"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-slate-400"
                />
              </label>
              <label className="sm:col-span-2 text-sm">
                <span className="mb-1 block font-medium text-gray-700">
                  Հասցե
                </span>
                <input
                  value={form.address}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, address: e.target.value }))
                  }
                  placeholder="ք․Երևան, Նոր Նորք թաղամաս, Գալշոյան փ. 46, 14"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-slate-400"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-gray-700">
                  Բանկ
                </span>
                <input
                  value={form.bankName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, bankName: e.target.value }))
                  }
                  placeholder="«Ինեկոբանկ» ՓԲԸ"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-slate-400"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-gray-700">
                  Հ/Հ
                </span>
                <input
                  value={form.bankAccount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, bankAccount: e.target.value }))
                  }
                  placeholder="2050822125771001"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-slate-400"
                />
              </label>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  Հեռախոսներ
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({ ...f, phones: [...f.phones, ''] }))
                  }
                  className="text-xs font-semibold text-slate-700"
                >
                  + համար
                </button>
              </div>
              <div className="space-y-2">
                {form.phones.map((phone, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={phone}
                      onChange={(e) =>
                        setForm((f) => {
                          const phones = [...f.phones];
                          phones[i] = e.target.value;
                          return { ...f, phones };
                        })
                      }
                      placeholder="+374 ..."
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                    />
                    {form.phones.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            phones: f.phones.filter((_, idx) => idx !== i),
                          }))
                        }
                        className="rounded-xl border border-gray-200 px-2 text-gray-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  Սոցցանցեր
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      socials: [
                        ...f.socials,
                        { network: 'Instagram', url: '' },
                      ],
                    }))
                  }
                  className="text-xs font-semibold text-slate-700"
                >
                  + հղում
                </button>
              </div>
              <div className="space-y-2">
                {form.socials.map((social, i) => (
                  <div key={i} className="flex gap-2">
                    <select
                      value={social.network}
                      onChange={(e) =>
                        setForm((f) => {
                          const socials = [...f.socials];
                          socials[i] = {
                            ...socials[i],
                            network: e.target.value,
                          };
                          return { ...f, socials };
                        })
                      }
                      className="w-36 rounded-xl border border-gray-200 px-2 py-2 text-sm outline-none"
                    >
                      {SOCIAL_NETWORKS.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <input
                      value={social.url}
                      onChange={(e) =>
                        setForm((f) => {
                          const socials = [...f.socials];
                          socials[i] = { ...socials[i], url: e.target.value };
                          return { ...f, socials };
                        })
                      }
                      placeholder="https://"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                    />
                    {form.socials.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            socials: f.socials.filter((_, idx) => idx !== i),
                          }))
                        }
                        className="rounded-xl border border-gray-200 px-2 text-gray-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <label className="mt-4 block text-sm">
              <span className="mb-1 block font-medium text-gray-700">
                Նշում
              </span>
              <textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                rows={3}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-slate-400"
              />
            </label>

            <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isActive: e.target.checked }))
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              Ակտիվ է
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700"
              >
                Փակել
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? 'Պահպանվում է…' : 'Պահպանել'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
