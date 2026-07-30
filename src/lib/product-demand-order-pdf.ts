import type { ProductDemandAnalytics } from '@/app/actions/product-demand';

const CATEGORY_LABELS: Record<string, string> = {
  snack: 'Նախուտեստ',
  drink: 'Խմիչք',
  combo: 'Կոմբո',
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(value: string) {
  const date = new Date(value);
  return date.toLocaleDateString('hy-AM', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function buildOrderHtml(data: ProductDemandAnalytics) {
  const rows = data.orderList
    .map(
      (item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(CATEGORY_LABELS[item.category] ?? item.category)}</td>
        <td class="num">${item.stock}</td>
        <td class="num">${item.forecastDemand}</td>
        <td class="num strong">${item.suggestedOrder}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="hy">
<head>
  <meta charset="utf-8" />
  <title>GoCinema — Ապրանքների պատվեր</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Arial, sans-serif;
      color: #111827;
      background: #f8fafc;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 20px;
      background: #111827;
      color: #fff;
    }
    .btn {
      border: 0;
      border-radius: 10px;
      padding: 10px 16px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-primary { background: #7c3aed; color: #fff; }
    .page {
      max-width: 980px;
      margin: 24px auto;
      padding: 28px;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
    }
    h1 { margin: 0 0 8px; font-size: 28px; }
    .meta {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin: 20px 0 28px;
    }
    .meta-card {
      padding: 14px 16px;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      background: #f9fafb;
    }
    .meta-card strong { display: block; font-size: 12px; color: #6b7280; margin-bottom: 4px; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th, td {
      border-bottom: 1px solid #e5e7eb;
      padding: 10px 8px;
      text-align: left;
    }
    th {
      background: #f3f4f6;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #4b5563;
    }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .strong { font-weight: 700; color: #7c3aed; }
    .note {
      margin-top: 24px;
      padding: 14px 16px;
      border-radius: 12px;
      background: #faf5ff;
      color: #5b21b6;
      font-size: 13px;
      line-height: 1.5;
    }
    @media print {
      body { background: #fff; }
      .toolbar { display: none; }
      .page {
        margin: 0;
        box-shadow: none;
        border-radius: 0;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <p><strong>${data.orderList.length}</strong> ապրանք պատվերի ցանկում</p>
    <button class="btn btn-primary" type="button" onclick="window.print()">Տպել / PDF</button>
  </div>
  <div class="page">
    <h1>GoCinema — Ապրանքների պատվերի ցանկ</h1>
    <p>Կազմված՝ ${escapeHtml(formatDate(data.generatedAt))}</p>

    <div class="meta">
      <div class="meta-card">
        <strong>Վերլուծության ժամանակահատված</strong>
        ${escapeHtml(formatDate(data.periodStart))} — ${escapeHtml(formatDate(data.periodEnd))}
      </div>
      <div class="meta-card">
        <strong>Հաջորդ պատվեր (չորեքշաբթի)</strong>
        ${escapeHtml(formatDate(data.nextOrderDate))}
      </div>
      <div class="meta-card">
        <strong>Կանխատեսման գործակից</strong>
        ${data.coefficient.toLocaleString('hy-AM')}
      </div>
      <div class="meta-card">
        <strong>Առաջիկա 7 օր — ցուցադրություններ / տոմսեր</strong>
        ${data.upcomingScreenings} / ${data.upcomingTicketsSold + data.upcomingTicketsReserved}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Ապրանք</th>
          <th>Կատեգորիա</th>
          <th class="num">Պաշար</th>
          <th class="num">Կանխատեսում</th>
          <th class="num">Պատվիրել</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="6">Պատվերի առաջարկներ չկան</td></tr>'}
      </tbody>
    </table>

    <div class="note">
      Պատվերը ուղարկվում է չորեքշաբթի, ստացում՝ հինգշաբթի։
      Պոպկորնը և սառը թեյը հաշվարկից բացառված են։
    </div>
  </div>
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); }, 400);
    });
  </script>
</body>
</html>`;
}

export function openProductDemandOrderPdf(
  data: ProductDemandAnalytics
): boolean {
  if (!data.orderList.length) return false;

  const html = buildOrderHtml(data);
  const win = window.open('', '_blank');
  if (!win) return false;

  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  return true;
}
