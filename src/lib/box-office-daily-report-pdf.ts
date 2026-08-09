import type { BoxOfficeDailyReport } from '@/app/actions/box-office-daily-report';

const CATEGORY_LABELS: Record<string, string> = {
  snack: 'Նախուտեստ',
  drink: 'Խմիչք',
  combo: 'Կոմբո',
  popcorn: 'Պոպկորն',
  iced_tea: 'Սառը թեյ',
  soda: 'Գազավորված',
  candy: 'Քաղցրավենիք',
  hot_dog: 'Հոթ-դոգ',
  nachos: 'Նաչոս',
  coffee: 'Սրճարան',
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

function formatAmd(amount: number) {
  return `${Math.round(amount).toLocaleString('hy-AM')} ֏`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('hy-AM', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildHtml(data: BoxOfficeDailyReport) {
  const renderProductRows = (rows: typeof data.products.byProduct) =>
    rows
      .map(
        (row, index) => `
      <tr${row.missingCost ? ' class="warn"' : ''}>
        <td>${index + 1}</td>
        <td>${escapeHtml(row.name)}${row.missingCost ? ' <span class="badge">Ինքնաարժեք չկա</span>' : ''}</td>
        <td>${escapeHtml(CATEGORY_LABELS[row.category] ?? row.category)}</td>
        <td class="num">${row.quantity}</td>
        <td class="num">${formatAmd(row.revenue)}</td>
        <td class="num">${formatAmd(row.cost)}</td>
        <td class="num strong">${formatAmd(row.profit)}</td>
      </tr>`
      )
      .join('');

  const popcorn = data.products.byProduct.filter((r) => r.category === 'popcorn');
  const icedTea = data.products.byProduct.filter(
    (r) => r.category === 'iced_tea'
  );
  const otherProducts = data.products.byProduct.filter(
    (r) => r.category !== 'popcorn' && r.category !== 'iced_tea'
  );

  const productSectionHtml = (
    title: string,
    rows: typeof data.products.byProduct,
    emptyText: string
  ) => {
    const totals = rows.reduce(
      (acc, row) => {
        acc.quantity += row.quantity;
        acc.revenue += row.revenue;
        acc.cost += row.cost;
        acc.profit += row.profit;
        return acc;
      },
      { quantity: 0, revenue: 0, cost: 0, profit: 0 }
    );

    return `
    <h2>${title}</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Ապրանք</th>
          <th>Կատեգորիա</th>
          <th class="num">Քանակ</th>
          <th class="num">Եկամուտ</th>
          <th class="num">Ինքնաարժեք</th>
          <th class="num">Շահույթ</th>
        </tr>
      </thead>
      <tbody>
        ${
          renderProductRows(rows) ||
          `<tr><td colspan="7">${emptyText}</td></tr>`
        }
      </tbody>
      ${
        rows.length > 0
          ? `<tfoot>
        <tr>
          <td></td>
          <td class="strong">Ընդամենը</td>
          <td></td>
          <td class="num strong">${totals.quantity}</td>
          <td class="num strong">${formatAmd(totals.revenue)}</td>
          <td class="num strong">${formatAmd(totals.cost)}</td>
          <td class="num strong">${formatAmd(totals.profit)}</td>
        </tr>
      </tfoot>`
          : ''
      }
    </table>`;
  };

  const movieRows = data.tickets.byMovie
    .map(
      (row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(row.movieTitle)}</td>
        <td class="num">${row.count}</td>
        <td class="num strong">${formatAmd(row.revenue)}</td>
      </tr>`
    )
    .join('');

  const movieTotals = data.tickets.byMovie.reduce(
    (acc, row) => {
      acc.count += row.count;
      acc.revenue += row.revenue;
      return acc;
    },
    { count: 0, revenue: 0 }
  );

  return `<!DOCTYPE html>
<html lang="hy">
<head>
  <meta charset="utf-8" />
  <title>GoCinema — Օրվա հաշվետվություն</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Segoe UI", Arial, sans-serif; color: #111827; background: #f8fafc; }
    .toolbar {
      position: sticky; top: 0; z-index: 10;
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px; padding: 14px 20px; background: #111827; color: #fff;
    }
    .btn { border: 0; border-radius: 10px; padding: 10px 16px; font-weight: 600; cursor: pointer; }
    .btn-primary { background: #7c3aed; color: #fff; }
    .page {
      max-width: 980px; margin: 24px auto; padding: 28px;
      background: #fff; border-radius: 16px;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
    }
    h1 { margin: 0 0 6px; font-size: 26px; }
    h2 { margin: 28px 0 12px; font-size: 18px; }
    .meta {
      display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px; margin: 18px 0 8px;
    }
    .meta-card {
      padding: 14px 16px; border: 1px solid #e5e7eb; border-radius: 12px; background: #f9fafb;
    }
    .meta-card strong { display: block; font-size: 12px; color: #6b7280; margin-bottom: 4px; }
    .cards {
      display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px; margin: 16px 0 8px;
    }
    .card {
      padding: 14px 16px; border-radius: 12px; border: 1px solid #e5e7eb;
    }
    .card .label { font-size: 12px; color: #6b7280; }
    .card .value { margin-top: 4px; font-size: 20px; font-weight: 700; }
    .card.profit { background: #ecfdf5; border-color: #a7f3d0; }
    .card.warn { background: #fffbeb; border-color: #fde68a; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 9px 8px; text-align: left; }
    th {
      background: #f3f4f6; font-size: 11px; text-transform: uppercase;
      letter-spacing: 0.04em; color: #4b5563;
    }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .strong { font-weight: 700; color: #7c3aed; }
    tfoot td { border-top: 2px solid #d1d5db; background: #f9fafb; font-weight: 700; }
    tr.warn { background: #fffbeb; }
    .badge {
      display: inline-block; margin-left: 6px; padding: 2px 6px; border-radius: 999px;
      background: #fef3c7; color: #92400e; font-size: 10px; font-weight: 700;
    }
    .note {
      margin-top: 24px; padding: 14px 16px; border-radius: 12px;
      background: #faf5ff; color: #5b21b6; font-size: 13px; line-height: 1.5;
    }
    @media print {
      body { background: #fff; }
      .toolbar { display: none; }
      .page { margin: 0; box-shadow: none; border-radius: 0; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <p>GoCinema · Օրվա հաշվետվություն</p>
    <button class="btn btn-primary" type="button" onclick="window.print()">Տպել / PDF</button>
  </div>
  <div class="page">
    <h1>Օրվա հաշվետվություն</h1>
    <p>${escapeHtml(formatDateTime(data.periodStart))} — ${escapeHtml(formatDateTime(data.periodEnd))}</p>

    <div class="cards">
      <div class="card">
        <div class="label">Ընդհանուր եկամուտ (մաքուր)</div>
        <div class="value">${formatAmd(data.totals.netRevenue)}</div>
      </div>
      <div class="card">
        <div class="label">Ապրանքների ինքնաարժեք</div>
        <div class="value">${formatAmd(data.totals.productCost)}</div>
      </div>
      <div class="card profit">
        <div class="label">Մաքուր շահույթ</div>
        <div class="value">${formatAmd(data.totals.netProfit)}</div>
      </div>
    </div>

    <div class="meta">
      <div class="meta-card">
        <strong>Տոմսեր</strong>
        ${data.tickets.soldCount} վաճառված · ${formatAmd(data.tickets.revenue)}
        ${data.tickets.cancelledCount > 0 ? `<br/>Չեղարկված՝ ${data.tickets.cancelledCount} (−${formatAmd(data.tickets.cancelledRevenue)})` : ''}
      </div>
      <div class="meta-card">
        <strong>Ապրանքներ</strong>
        ${data.products.soldUnits} միավոր · ${formatAmd(data.products.revenue)}
        ${data.products.returnedAmount > 0 ? `<br/>Վերադարձ՝ −${formatAmd(data.products.returnedAmount)}` : ''}
      </div>
      <div class="meta-card">
        <strong>Վճարումներ (մաքուր)</strong>
        Կանխիկ՝ ${formatAmd(data.totals.byPayment.cash)} · Քարտ՝ ${formatAmd(data.totals.byPayment.card)}
      </div>
      <div class="meta-card${data.products.missingCostCount > 0 ? ' warn' : ''}">
        <strong>Ինքնաարժեքի կարգավիճակ</strong>
        ${
          data.products.missingCostCount > 0
            ? `${data.products.missingCostCount} ապրանքի ինքնաարժեք բացակայում է`
            : 'Բոլոր ապրանքներն ունեն ինքնաարժեք'
        }
      </div>
    </div>

    <h2>Տոմսեր ըստ ֆիլմերի</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Ֆիլմ</th>
          <th class="num">Քանակ</th>
          <th class="num">Եկամուտ</th>
        </tr>
      </thead>
      <tbody>
        ${movieRows || '<tr><td colspan="4">Այսօր տոմսեր չեն վաճառվել</td></tr>'}
      </tbody>
      ${
        data.tickets.byMovie.length > 0
          ? `<tfoot>
        <tr>
          <td></td>
          <td>Ընդամենը</td>
          <td class="num">${movieTotals.count}</td>
          <td class="num strong">${formatAmd(movieTotals.revenue)}</td>
        </tr>
      </tfoot>`
          : ''
      }
    </table>

    ${productSectionHtml('Պոպկորն', popcorn, 'Այսօր պոպկորն չի վաճառվել')}
    ${productSectionHtml('Սառը թեյ', icedTea, 'Այսօր սառը թեյ չի վաճառվել')}
    ${productSectionHtml('Ապրանքներ', otherProducts, 'Այսօր այլ ապրանքներ չեն վաճառվել')}

    <div class="note">
      Մաքուր շահույթ = (տոմսեր + ապրանքներ − չեղարկումներ/վերադարձներ) − ապրանքների ինքնաարժեք։
      Տոմսերի ինքնաարժեք չի հաշվվում։ Կազմված՝ ${escapeHtml(formatDateTime(data.generatedAt))}։
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

export function openBoxOfficeDailyReportPdf(data: BoxOfficeDailyReport): boolean {
  const html = buildHtml(data);
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  return true;
}
