'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from 'react';
import {
  AlertTriangle,
  Calculator,
  CalendarClock,
  CheckCircle2,
  FileText,
  Info,
  Loader2,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  Upload,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import {
  createTaxDocument,
  deleteTaxDocument,
  getAccountingDashboard,
  importTaxDocumentsFromXlsx,
  updateAccountingSettings,
  updateTaxDocument,
} from '@/app/actions/accounting';
import {
  TAX_COST_TYPE_LABELS,
  TAX_DOCUMENT_KIND_LABELS,
  TAX_STREAM_LABELS,
  defaultCostTypeForKind,
  isDeductibleCostType,
  type AccountingDashboard,
  type StreamTaxView,
  type TaxCostType,
  type TaxDocumentKind,
  type TaxDocumentRow,
} from '@/lib/accounting';
import type { TaxStream } from '@/lib/turnover-tax';

function toInputDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatAmd(value: number): string {
  return `${Math.round(value).toLocaleString('hy-AM')} ֏`;
}

function formatPct(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

function formatRate(rate: number): string {
  return `${Number((rate * 100).toFixed(2))}%`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('hy-AM', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const PRODUCT_CATEGORY_LABELS: Record<string, string> = {
  snack: 'Նախուտեստ',
  drink: 'Խմիչք',
  combo: 'Կոմբո',
  popcorn: 'Պոպկորն',
  iced_tea: 'Սառը թեյ',
  soda: 'Գազավորված խմիչք',
  candy: 'Քաղցրավենիք',
  hot_dog: 'Հոթ-դոգ',
  nachos: 'Նաչոս',
  coffee: 'Սրճարանային խմիչք',
  tea: 'Թեյ',
  juice: 'Հյութ',
  water: 'Ջուր',
  chips: 'Չիպս',
  chocolate: 'Շոկոլադ',
  ice_cream: 'Պաղպաղակ',
  sandwich: 'Սենդվիչ',
  pizza: 'Պիցցա',
  burger: 'Բուրգեր',
  salad: 'Աղցան',
  other: 'Այլ',
};

const QUARTER_MONTHS: Record<1 | 2 | 3 | 4, string> = {
  1: 'հունվար–մարտ',
  2: 'ապրիլ–հունիս',
  3: 'հուլիս–սեպտեմբեր',
  4: 'հոկտեմբեր–դեկտեմբեր',
};

const QUARTER_MONTHS_SHORT: Record<1 | 2 | 3 | 4, string> = {
  1: 'հնվ–մրտ',
  2: 'ապր–հնս',
  3: 'հլս–սեպ',
  4: 'հկտ–դեկ',
};

/** Հայտարարագրման ամիսը՝ եռամսյակին հաջորդող ամսվա 20-ը */
const QUARTER_DEADLINE_MONTH: Record<1 | 2 | 3 | 4, string> = {
  1: 'ապրիլ',
  2: 'հուլիս',
  3: 'հոկտեմբեր',
  4: 'հունվար',
};

const CATEGORY_DISPLAY_ORDER = [
  'popcorn',
  'iced_tea',
  'soda',
  'drink',
  'snack',
  'combo',
  'chocolate',
  'candy',
  'other',
];

function categoryLabel(category: string): string {
  return PRODUCT_CATEGORY_LABELS[category] || category;
}

function sortCategories<T extends { category: string; revenue: number }>(
  rows: T[]
): T[] {
  const rank = (c: string) => {
    const i = CATEGORY_DISPLAY_ORDER.indexOf(c);
    return i === -1 ? 1000 : i;
  };
  return [...rows].sort((a, b) => {
    const d = rank(a.category) - rank(b.category);
    return d !== 0 ? d : b.revenue - a.revenue;
  });
}

interface DocForm {
  id: number | null;
  kind: TaxDocumentKind;
  stream: TaxStream;
  costType: TaxCostType;
  deductible: boolean;
  title: string;
  supplierName: string;
  supplierTin: string;
  invoiceNumber: string;
  amount: string;
  documentDate: string;
  note: string;
}

function emptyDocForm(): DocForm {
  return {
    id: null,
    kind: 'producer',
    stream: 'tickets',
    costType: 'service',
    deductible: true,
    title: '',
    supplierName: '',
    supplierTin: '',
    invoiceNumber: '',
    amount: '',
    documentDate: toInputDate(new Date()),
    note: '',
  };
}

function currentQuarter(): { year: number; quarter: number } {
  const now = new Date();
  return {
    year: now.getFullYear(),
    quarter: Math.floor(now.getMonth() / 3) + 1,
  };
}

export default function AdminAccountingClient() {
  const initialPeriod = currentQuarter();
  const [year, setYear] = useState(initialPeriod.year);
  const [quarter, setQuarter] = useState(initialPeriod.quarter);

  const [data, setData] = useState<AccountingDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showDocForm, setShowDocForm] = useState(false);
  const [docForm, setDocForm] = useState<DocForm>(emptyDocForm());
  const [isSavingDoc, setIsSavingDoc] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [shareInput, setShareInput] = useState('50');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getAccountingDashboard({ year, quarter });
      if (!res.success || !res.data) {
        setError(res.error || 'Չհաջողվեց բեռնել');
        setData(null);
        return;
      }
      setData(res.data);
      setShareInput(String(res.data.settings.ticketProducerSharePercent));
    } catch {
      setError('Չհաջողվեց բեռնել');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [year, quarter]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreateDoc = (kind: TaxDocumentKind = 'producer') => {
    const costType = defaultCostTypeForKind(kind);
    setDocForm({
      ...emptyDocForm(),
      kind,
      costType,
      deductible: isDeductibleCostType(costType),
      stream: kind === 'purchase' ? 'products' : 'tickets',
      title:
        kind === 'producer'
          ? 'Ֆիլմ արտադրողի հաշիվ'
          : kind === 'purchase'
            ? 'Ապրանքի գնում'
            : '',
      documentDate: data
        ? toInputDate(new Date(data.period.to))
        : toInputDate(new Date()),
    });
    setDocError(null);
    setShowDocForm(true);
  };

  const openEditDoc = (row: TaxDocumentRow) => {
    setDocForm({
      id: row.id,
      kind: (row.kind as TaxDocumentKind) || 'other',
      stream: row.stream === 'products' ? 'products' : 'tickets',
      costType: (row.costType as TaxCostType) || 'other',
      deductible: row.deductible,
      title: row.title,
      supplierName: row.supplierName || '',
      supplierTin: row.supplierTin || '',
      invoiceNumber: row.invoiceNumber || '',
      amount: String(row.amount),
      documentDate: toInputDate(new Date(row.documentDate)),
      note: row.note || '',
    });
    setDocError(null);
    setShowDocForm(true);
  };

  const saveDoc = async () => {
    setIsSavingDoc(true);
    setDocError(null);
    const payload = {
      kind: docForm.kind,
      stream: docForm.stream,
      costType: docForm.costType,
      deductible: docForm.deductible,
      title: docForm.title,
      supplierName: docForm.supplierName,
      supplierTin: docForm.supplierTin,
      invoiceNumber: docForm.invoiceNumber,
      amount: Number(docForm.amount),
      documentDate: docForm.documentDate,
      note: docForm.note,
    };
    try {
      const res = docForm.id
        ? await updateTaxDocument({ id: docForm.id, ...payload })
        : await createTaxDocument(payload);
      if (!res.success) {
        setDocError(res.error || 'Սխալ');
        return;
      }
      setShowDocForm(false);
      await load();
    } catch {
      setDocError('Պահպանումը ձախողվեց');
    } finally {
      setIsSavingDoc(false);
    }
  };

  const removeDoc = async (id: number) => {
    if (!confirm('Ջնջե՞լ այս փաստաթուղթը')) return;
    setDeletingId(id);
    try {
      const res = await deleteTaxDocument(id);
      if (!res.success) {
        setError(res.error || 'Ջնջումը ձախողվեց');
        return;
      }
      await load();
    } finally {
      setDeletingId(null);
    }
  };

  const saveSettings = async () => {
    setIsSavingSettings(true);
    setSettingsError(null);
    try {
      const res = await updateAccountingSettings({
        ticketProducerSharePercent: Number(shareInput),
      });
      if (!res.success) {
        setSettingsError(res.error || 'Սխալ');
        return;
      }
      setShowSettings(false);
      await load();
    } catch {
      setSettingsError('Պահպանումը ձախողվեց');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleImportFiles = async (files: FileList | File[] | null) => {
    const list = files ? Array.from(files) : [];
    const excelFiles = list.filter((f) => {
      const name = f.name.toLowerCase();
      return (
        name.endsWith('.xlsx') ||
        name.endsWith('.xls') ||
        f.type.includes('spreadsheet') ||
        f.type.includes('excel')
      );
    });

    if (excelFiles.length === 0) {
      setError('Ընտրեք .xlsx կամ .xls ֆայլ');
      return;
    }

    setIsImporting(true);
    setImportMessage(null);
    setError(null);

    const lines: string[] = [];
    let hadError = false;

    try {
      for (const file of excelFiles) {
        const formData = new FormData();
        formData.set('file', file);
        formData.set('kind', 'auto');
        const res = await importTaxDocumentsFromXlsx(formData);
        if (!res.success) {
          hadError = true;
          lines.push(`${file.name}՝ ${res.error || 'սխալ'}`);
          continue;
        }
        const kindLabel =
          res.fileKind === 'purchase'
            ? 'ապրանք'
            : res.fileKind === 'producer'
              ? 'արտադրող'
              : String(res.fileKind);
        lines.push(
          `${file.name} (${kindLabel})՝ +${res.created} հաշիվ ${formatAmd(res.totalAmount)}, կրկնօրինակ ${res.skippedExisting}`
        );
      }
      if (hadError && lines.length === excelFiles.length) {
        setError(lines.join(' · '));
      } else {
        setImportMessage(lines.join(' · '));
        if (hadError) setError('Որոշ ֆայլեր չներմուծվեցին');
      }
      await load();
    } catch {
      setError('Excel ներմուծումը ձախողվեց');
    } finally {
      setIsImporting(false);
      setIsDragging(false);
      dragDepthRef.current = 0;
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onDropZoneDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    if (e.dataTransfer.types.includes('Files')) setIsDragging(true);
  };

  const onDropZoneDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setIsDragging(false);
    }
  };

  const onDropZoneDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const onDropZoneDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragDepthRef.current = 0;
    if (isImporting) return;
    void handleImportFiles(e.dataTransfer.files);
  };

  const yearOptions = (() => {
    const thisYear = new Date().getFullYear();
    return [thisYear + 1, thisYear, thisYear - 1, thisYear - 2];
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Calculator className="h-7 w-7 text-cyan-600" />
            Հաշվապահություն
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Շրջանառության հարկ · հոդ. 258 · եռամսյակային հաշվարկ
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Settings2 className="h-4 w-4" />
            Կարգավորումներ
          </button>
          <button
            type="button"
            onClick={() => openCreateDoc('producer')}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-700"
          >
            <Plus className="h-4 w-4" />
            Ձեռքով հաշիվ
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm text-gray-600">
            Տարի
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <div className="text-sm text-gray-600">
            Հաշվետու եռամսյակ
            <div className="mt-1 flex gap-1">
              {([1, 2, 3, 4] as const).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuarter(q)}
                  title={`${q}-ին եռամսյակ · ${QUARTER_MONTHS[q]} · հայտարարագրում մինչև ${QUARTER_DEADLINE_MONTH[q]}-ի 20-ը`}
                  aria-pressed={quarter === q}
                  className={`flex flex-col items-center rounded-lg px-3 py-1.5 text-sm font-medium leading-tight ${
                    quarter === q
                      ? 'bg-cyan-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span>Q{q}</span>
                  <span
                    className={`text-[10px] font-normal ${
                      quarter === q ? 'text-cyan-100' : 'text-gray-500'
                    }`}
                  >
                    {QUARTER_MONTHS_SHORT[q]}
                  </span>
                </button>
              ))}
            </div>
          </div>
          {data && (
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
              <CalendarClock className="h-4 w-4 text-gray-400" />
              <span>
                {formatDate(data.period.from)} — {formatDate(data.period.to)} ·
                հայտարարագրման վերջնաժամկետ{' '}
                <strong>{formatDate(data.period.filingDeadline)}</strong>
              </span>
            </div>
          )}
          {isLoading && (
            <Loader2 className="mb-2 h-5 w-5 animate-spin text-cyan-600" />
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        multiple
        className="hidden"
        onChange={(e) => void handleImportFiles(e.target.files)}
      />

      <div
        role="button"
        tabIndex={0}
        onClick={() => !isImporting && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!isImporting) fileInputRef.current?.click();
          }
        }}
        onDragEnter={onDropZoneDragEnter}
        onDragLeave={onDropZoneDragLeave}
        onDragOver={onDropZoneDragOver}
        onDrop={onDropZoneDrop}
        className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
          isDragging
            ? 'border-cyan-500 bg-cyan-50'
            : 'border-cyan-200 bg-cyan-50/40 hover:border-cyan-400 hover:bg-cyan-50'
        } ${isImporting ? 'pointer-events-none opacity-70' : ''}`}
      >
        <div className="flex flex-col items-center gap-2">
          {isImporting ? (
            <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
          ) : (
            <Upload
              className={`h-8 w-8 ${isDragging ? 'text-cyan-700' : 'text-cyan-600'}`}
            />
          )}
          <p className="text-sm font-medium text-cyan-900">
            {isImporting
              ? 'Ներմուծվում է…'
              : isDragging
                ? 'Թողեք ֆայլը այստեղ'
                : 'Քաշեք ՊԵԿ Excel ֆայլը այստեղ կամ սեղմեք՝ ընտրելու'}
          </p>
          <p className="text-xs text-cyan-700/80">
            «Ստացված հարկային հաշիվներ» → ապրանք (47.x) · «Ստացված հաշիվ
            վավերագրեր» → արտադրող (59.14)
          </p>
        </div>
      </div>

      {importMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {importMessage}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading && !data && (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {data && (
        <>
          {data.warnings.length > 0 && (
            <div className="space-y-2">
              {data.warnings.map((w, i) => (
                <div
                  key={i}
                  className={`flex gap-3 rounded-xl border px-4 py-3 text-sm ${
                    w.level === 'error'
                      ? 'border-red-200 bg-red-50 text-red-900'
                      : w.level === 'warning'
                        ? 'border-amber-200 bg-amber-50 text-amber-900'
                        : 'border-gray-200 bg-gray-50 text-gray-700'
                  }`}
                >
                  {w.level === 'error' ? (
                    <XCircle className="h-5 w-5 shrink-0 text-red-600" />
                  ) : w.level === 'warning' ? (
                    <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                  ) : (
                    <Info className="h-5 w-5 shrink-0 text-gray-400" />
                  )}
                  <p>{w.message}</p>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Հարկման բազա (զուտ)"
              value={formatAmd(data.tax.totalTurnover)}
              hint="Տոմս + ապրանք − վերադարձ"
            />
            <StatCard
              label={`Վճարման ենթակա · ${data.period.label}`}
              value={formatAmd(data.tax.totalTaxDue)}
              hint={`Մինչև ${formatDate(data.period.filingDeadline)}`}
              accent
            />
            <StatCard
              label="Նվազեցվող ծախս"
              value={formatAmd(data.tax.totalDocumentedCosts)}
              hint={
                data.documents.nonDeductibleTotal > 0
                  ? `Չնվազեցվող՝ ${formatAmd(data.documents.nonDeductibleTotal)}`
                  : 'Հաշիվ-ապրանքագրերով'
              }
            />
            <StatCard
              label="Գործնական շահույթ (մոտ.)"
              value={formatAmd(data.operational.estimatedOperatingProfit)}
              hint={`Արտադրողի ${data.operational.producerSharePercent}%-ից հետո + ապրանք`}
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-gray-900">
                Տարեկան շեմ · {data.period.year}
              </h2>
              <span className="text-sm text-gray-500">
                Մնացել է {formatAmd(data.yearToDate.remaining)} /{' '}
                {formatAmd(data.yearToDate.threshold)}
              </span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full transition-all ${
                  data.yearToDate.percentUsed >= 90
                    ? 'bg-red-500'
                    : data.yearToDate.percentUsed >= 70
                      ? 'bg-amber-500'
                      : 'bg-cyan-500'
                }`}
                style={{
                  width: `${Math.min(100, data.yearToDate.percentUsed)}%`,
                }}
              />
            </div>
            <p className="mt-2 text-sm text-gray-600">
              Շրջանառություն Q1–Q{data.period.quarter}՝{' '}
              {formatAmd(data.yearToDate.turnover)} (
              {data.yearToDate.percentUsed.toFixed(1)}%) · գնահատված հարկ տարվա
              սկզբից {formatAmd(data.yearToDate.taxPaidEstimate)}
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <TaxStreamCard
              tax={data.tax.tickets}
              extra={
                <div className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-600">
                  <p className="mb-1 font-medium text-gray-700">
                    Գործնական բաշխում (ոչ հարկային)
                  </p>
                  <div className="flex justify-between">
                    <span>Արտադրողին {data.operational.producerSharePercent}%</span>
                    <span className="tabular-nums">
                      {formatAmd(data.operational.producerShareAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Կինոյին</span>
                    <span className="tabular-nums">
                      {formatAmd(data.operational.cinemaTicketKeep)}
                    </span>
                  </div>
                  <p className="mt-2 text-gray-500">
                    Հարկման բազան ամբողջ տոմսային շրջանառությունն է. արտադրողի
                    հաշիվը նվազեցնում է հարկը ծախսի{' '}
                    {formatRate(data.tax.tickets.deductionRate)}-ի չափով։
                  </p>
                </div>
              }
            />
            <TaxStreamCard
              tax={data.tax.products}
              extra={
                data.revenue.byProductCategory.length > 0 ? (
                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <p className="mb-2 text-xs font-medium text-gray-700">
                      Վաճառք ըստ կատեգորիայի (համախառն)
                    </p>
                    <ul className="space-y-1.5 text-xs text-gray-600">
                      {sortCategories(data.revenue.byProductCategory).map((c) => (
                        <li
                          key={c.category}
                          className="flex items-center justify-between gap-2"
                        >
                          <span>
                            {categoryLabel(c.category)}
                            <span className="ml-1 text-gray-400">
                              · {c.quantity} հատ
                            </span>
                          </span>
                          <span className="font-medium tabular-nums text-gray-800">
                            {formatAmd(c.revenue)}
                          </span>
                        </li>
                      ))}
                      <li className="flex justify-between gap-2 border-t border-dashed border-gray-200 pt-1.5 font-semibold text-gray-900">
                        <span>Զուտ (հարկման բազա)</span>
                        <span className="tabular-nums">
                          {formatAmd(data.tax.products.turnover)}
                        </span>
                      </li>
                      {data.revenue.productReturnsProcessed > 0 && (
                        <li className="flex justify-between gap-2 text-gray-500">
                          <span>Ձևակերպված վերադարձ (արդեն հանված)</span>
                          <span className="tabular-nums">
                            {formatAmd(data.revenue.productReturnsProcessed)}
                          </span>
                        </li>
                      )}
                    </ul>
                    <p className="mt-2 text-xs text-gray-500">
                      Բոլոր ապրանքները՝ ներառյալ պոպկորն և սառը թեյ, ՀԴՄ-ում
                      դասակարգված են որպես մանրածախ առևտուր (47.x), ուստի
                      հարկվում են նույն բանաձևով։ Վերադարձված միավորը դուրս է
                      գրվում պատվերից, ուստի վերևի գումարներն արդեն զուտ են։
                    </p>
                  </div>
                ) : null
              }
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-gray-900">
                <Wallet className="h-4 w-4 text-green-600" />
                Եկամուտներ · {data.period.label}
              </h2>
              <dl className="space-y-2 text-sm">
                <Row
                  label={`Տոմսեր՝ զուտ (${data.revenue.ticketsCount} հատ)`}
                  value={formatAmd(data.revenue.ticketsNet)}
                  strong
                />
                <Row
                  label={`Ձևակերպված վերադարձ (${data.revenue.ticketRefundsCount} տոմս)`}
                  value={formatAmd(data.revenue.ticketRefundsProcessed)}
                />
                <Row
                  label="Ապրանքներ՝ զուտ"
                  value={formatAmd(data.revenue.productsNet)}
                  strong
                />
                <Row
                  label="Ապրանքների ինքնաարժեք (P&L)"
                  value={formatAmd(data.revenue.productsCost)}
                />
                <Row
                  label="Ապրանքային շահույթ"
                  value={formatAmd(data.revenue.productsProfit)}
                />
              </dl>
              <p className="mt-3 text-xs text-gray-500">
                Վերադարձված տոմսերն ու ապրանքները հարկման բազայում չեն. նրանք
                դուրս են գրվում սկզբնական վաճառքից, ոչ թե հանվում վերադարձի
                օրվա շրջանառությունից։
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-gray-900">
                <FileText className="h-4 w-4 text-teal-600" />
                ՀԴՄ ստուգում
              </h2>
              <dl className="space-y-2 text-sm">
                <Row
                  label={`Վաճառքի կտրոններ (${data.fiscal.salesCount})`}
                  value={formatAmd(data.fiscal.salesTotal)}
                />
                <Row
                  label={`Վերադարձի կտրոններ (${data.fiscal.returnsCount})`}
                  value={`− ${formatAmd(data.fiscal.returnsTotal)}`}
                />
                <Row label="ՀԴՄ զուտ" value={formatAmd(data.fiscal.netTotal)} strong />
                <Row
                  label="Հաշվառման բազա"
                  value={formatAmd(data.tax.totalTurnover)}
                  strong
                />
                <Row
                  label="Տարբերություն"
                  value={formatAmd(data.fiscal.difference)}
                />
              </dl>
              <div className="mt-3 flex items-center gap-2 text-xs">
                {data.fiscal.failedCount === 0 ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span className="text-emerald-700">
                      Բոլոր կտրոնները տպված են
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span className="text-red-700">
                      {data.fiscal.failedCount} չտպված կտրոն
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {data.history.length > 1 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 font-semibold text-gray-900">
                Եռամսյակների պատմություն
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-2 py-2">Ժամանակաշրջան</th>
                      <th className="px-2 py-2 text-right">Տոմսեր</th>
                      <th className="px-2 py-2 text-right">Ապրանքներ</th>
                      <th className="px-2 py-2 text-right">Հարկ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.history.map((h) => (
                      <tr
                        key={`${h.year}-${h.quarter}`}
                        className={`border-b border-gray-100 ${
                          h.year === data.period.year &&
                          h.quarter === data.period.quarter
                            ? 'bg-cyan-50/60 font-medium'
                            : ''
                        }`}
                      >
                        <td className="px-2 py-2">{h.label}</td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {formatAmd(h.ticketsTurnover)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {formatAmd(h.productsTurnover)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {formatAmd(h.taxDue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-gray-900">
                Փաստաթղթավորված հաշիվներ · {data.period.label}
              </h2>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => openCreateDoc('producer')}
                  className="text-xs font-medium text-cyan-700 hover:underline"
                >
                  + Արտադրող
                </button>
                <button
                  type="button"
                  onClick={() => openCreateDoc('purchase')}
                  className="text-xs font-medium text-cyan-700 hover:underline"
                >
                  + Գնում
                </button>
              </div>
            </div>

            {data.documents.rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">
                Այս եռամսյակում հաշիվ չկա։ Բեռնեք ՊԵԿ Excel-ը կամ ավելացրեք ձեռքով։
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-2 py-2">Ամսաթիվ</th>
                      <th className="px-2 py-2">Հոսք</th>
                      <th className="px-2 py-2">Ծախսի տեսակ</th>
                      <th className="px-2 py-2">Մատակարար</th>
                      <th className="px-2 py-2 text-right">Գումար</th>
                      <th className="px-2 py-2 text-center">Նվազեցնո՞ւմ է</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.documents.rows.map((row) => (
                      <tr key={row.id} className="border-b border-gray-100">
                        <td className="whitespace-nowrap px-2 py-2">
                          {formatDate(row.documentDate)}
                        </td>
                        <td className="px-2 py-2">
                          {
                            TAX_STREAM_LABELS[
                              row.stream === 'products' ? 'products' : 'tickets'
                            ]
                          }
                        </td>
                        <td className="px-2 py-2 text-gray-600">
                          {TAX_COST_TYPE_LABELS[row.costType as TaxCostType] ||
                            row.costType}
                          <span className="ml-1 text-gray-400">
                            ·{' '}
                            {TAX_DOCUMENT_KIND_LABELS[
                              row.kind as TaxDocumentKind
                            ] || row.kind}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-gray-600">
                          {row.supplierName || '—'}
                          {row.invoiceNumber ? ` · ${row.invoiceNumber}` : ''}
                        </td>
                        <td className="px-2 py-2 text-right font-medium tabular-nums">
                          {formatAmd(row.amount)}
                        </td>
                        <td className="px-2 py-2 text-center">
                          {row.deductible ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                              Այո
                            </span>
                          ) : (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                              Ոչ
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEditDoc(row)}
                              className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
                              aria-label="Խմբագրել"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void removeDoc(row.id)}
                              disabled={deletingId === row.id}
                              className="rounded p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-50"
                              aria-label="Ջնջել"
                            >
                              {deletingId === row.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
            <p>{data.disclaimer}</p>
          </div>
        </>
      )}

      {showDocForm && (
        <Modal
          title={docForm.id ? 'Խմբագրել հաշիվը' : 'Նոր հաշիվ-ապրանքագիր'}
          onClose={() => setShowDocForm(false)}
        >
          <div className="space-y-3">
            <label className="block text-sm">
              Տեսակ
              <select
                value={docForm.kind}
                onChange={(e) => {
                  const kind = e.target.value as TaxDocumentKind;
                  const costType = defaultCostTypeForKind(kind);
                  setDocForm((f) => ({
                    ...f,
                    kind,
                    costType,
                    deductible: isDeductibleCostType(costType),
                    stream:
                      kind === 'purchase'
                        ? 'products'
                        : kind === 'producer'
                          ? 'tickets'
                          : f.stream,
                  }));
                }}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="producer">Ֆիլմ արտադրող</option>
                <option value="purchase">Ապրանքի գնում</option>
                <option value="other">Այլ</option>
              </select>
            </label>

            {docForm.kind === 'other' && (
              <label className="block text-sm">
                Հարկային հոսք
                <select
                  value={docForm.stream}
                  onChange={(e) =>
                    setDocForm((f) => ({
                      ...f,
                      stream: e.target.value as TaxStream,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="tickets">Տոմսեր · 59.14 (նվազեցում 6%)</option>
                  <option value="products">Ապրանքներ · 47.x (նվազեցում 9.5%)</option>
                </select>
              </label>
            )}

            <label className="block text-sm">
              Ծախսի տեսակ (հոդ. 258 մաս 6)
              <select
                value={docForm.costType}
                onChange={(e) => {
                  const costType = e.target.value as TaxCostType;
                  setDocForm((f) => ({
                    ...f,
                    costType,
                    deductible: isDeductibleCostType(costType),
                  }));
                }}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                {(Object.keys(TAX_COST_TYPE_LABELS) as TaxCostType[]).map((t) => (
                  <option key={t} value={t}>
                    {TAX_COST_TYPE_LABELS[t]}
                    {isDeductibleCostType(t) ? '' : ' — չի նվազեցնում'}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={docForm.deductible}
                disabled={!isDeductibleCostType(docForm.costType)}
                onChange={(e) =>
                  setDocForm((f) => ({ ...f, deductible: e.target.checked }))
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              Ներառել հարկի նվազեցման մեջ
            </label>

            <label className="block text-sm">
              Վերնագիր
              <input
                value={docForm.title}
                onChange={(e) =>
                  setDocForm((f) => ({ ...f, title: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                Մատակարար
                <input
                  value={docForm.supplierName}
                  onChange={(e) =>
                    setDocForm((f) => ({ ...f, supplierName: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                ՀՎՀՀ
                <input
                  value={docForm.supplierTin}
                  onChange={(e) =>
                    setDocForm((f) => ({ ...f, supplierTin: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                Սերիա և համար
                <input
                  value={docForm.invoiceNumber}
                  onChange={(e) =>
                    setDocForm((f) => ({ ...f, invoiceNumber: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                Ամսաթիվ (մատակարարման)
                <input
                  type="date"
                  value={docForm.documentDate}
                  onChange={(e) =>
                    setDocForm((f) => ({ ...f, documentDate: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>
            </div>

            <label className="block text-sm">
              Գումար՝ ընդհանուր ԱԱՀ-ով (֏)
              <input
                type="number"
                min={0}
                step="0.01"
                value={docForm.amount}
                onChange={(e) =>
                  setDocForm((f) => ({ ...f, amount: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              />
              <span className="mt-1 block text-xs text-gray-500">
                Շրջհարկ վճարողի համար վճարված ԱԱՀ-ն նույնպես ծախս է։
              </span>
            </label>

            <label className="block text-sm">
              Նշում
              <textarea
                value={docForm.note}
                onChange={(e) =>
                  setDocForm((f) => ({ ...f, note: e.target.value }))
                }
                rows={2}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>

            {docError && <p className="text-sm text-red-600">{docError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDocForm(false)}
                className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
              >
                Փակել
              </button>
              <button
                type="button"
                onClick={() => void saveDoc()}
                disabled={isSavingDoc}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-60"
              >
                {isSavingDoc && <Loader2 className="h-4 w-4 animate-spin" />}
                Պահպանել
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showSettings && (
        <Modal
          title="Հաշվապահության կարգավորումներ"
          onClose={() => setShowSettings(false)}
        >
          <div className="space-y-3">
            <label className="block text-sm">
              Արտադրողի մաս տոմսից (%) — գործնական P&L
              <input
                type="number"
                min={0}
                max={100}
                step="1"
                value={shareInput}
                onChange={(e) => setShareInput(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>
            <p className="text-xs text-gray-500">
              Հարկային բազան մնում է ամբողջ տոմսային շրջանառությունը (ՀԴՄ 59.14)։
              Այս տոկոսը միայն գործնական շահույթի ցուցադրման համար է — հարկը
              հաշվվում է արտադրողի իրական հաշիվների հիման վրա։
            </p>
            {settingsError && (
              <p className="text-sm text-red-600">{settingsError}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
              >
                Փակել
              </button>
              <button
                type="button"
                onClick={() => void saveSettings()}
                disabled={isSavingSettings}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-60"
              >
                {isSavingSettings && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Պահպանել
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 shadow-sm ${
        accent ? 'border-cyan-200 bg-cyan-50' : 'border-gray-200 bg-white'
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={strong ? 'font-medium text-gray-800' : 'text-gray-600'}>
        {label}
      </dt>
      <dd
        className={`tabular-nums ${
          strong ? 'font-semibold text-gray-900' : 'font-medium text-gray-900'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function TaxStreamCard({
  tax,
  extra,
}: {
  tax: StreamTaxView;
  extra?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold text-gray-900">{tax.labelHy}</h2>
          <p className="text-xs text-gray-500">{tax.activityHy}</p>
        </div>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
          ԱԴԳ {tax.adgCode}
        </span>
      </div>

      <dl className="mt-3 space-y-2 text-sm">
        <Row label="Հարկման բազա" value={formatAmd(tax.turnover)} strong />
        <Row
          label={`Հարկ ${formatRate(tax.baseRate)}`}
          value={formatAmd(tax.grossTax)}
        />
        <Row
          label="Փաստաթղթավորված ծախս"
          value={formatAmd(tax.documentedCosts)}
        />
        <Row
          label={`Նվազեցում ծախսի ${formatRate(tax.deductionRate)}`}
          value={`− ${formatAmd(tax.deductionFromCosts)}`}
        />
        {tax.carriedInDeduction > 0 && (
          <Row
            label="Փոխանցված նախորդ եռամսյակից"
            value={`− ${formatAmd(tax.carriedInDeduction)}`}
          />
        )}
        <Row
          label="Կիրառված նվազեցում"
          value={`− ${formatAmd(tax.appliedDeduction)}`}
        />
        <Row
          label={`Նվազագույն շեմ ${formatRate(tax.minRate)}`}
          value={formatAmd(tax.minTax)}
        />
        <div className="border-t border-gray-100 pt-2">
          <Row
            label="Վճարման ենթակա"
            value={formatAmd(tax.taxDue)}
            strong
          />
        </div>
        <Row label="Արդյունավետ դրույք" value={formatPct(tax.effectiveRate)} />
      </dl>

      {tax.floorApplied && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Նվազեցումը սահմանափակվել է նվազագույն շեմով։ Չօգտագործված{' '}
          {formatAmd(tax.carriedOutDeduction)} փոխանցվում է հաջորդ եռամսյակ։
        </p>
      )}
      {tax.nonDeductibleCosts > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          Չնվազեցվող ծախս այս հոսքում՝ {formatAmd(tax.nonDeductibleCosts)}
        </p>
      )}

      {extra}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="Փակել"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
