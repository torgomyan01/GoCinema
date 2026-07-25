/**
 * Ապրանքների գնապիտակներ — բացում է տպման պատուհան (Save as PDF)։
 * Չի պահանջում արտաքին PDF գրադարան։
 */

export type PriceTagProduct = {
  id: number;
  name: string;
  price: number;
  category?: string;
};

const CATEGORY_LABELS: Record<string, string> = {
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatPriceParts(price: number) {
  const amount = Math.round(price).toLocaleString('hy-AM');
  return { amount, currency: '֏' };
}

function buildTagsHtml(products: PriceTagProduct[]) {
  const tags = products
    .map((p) => {
      const category =
        p.category && CATEGORY_LABELS[p.category]
          ? CATEGORY_LABELS[p.category]
          : p.category || '';
      const { amount, currency } = formatPriceParts(p.price);
      return `
      <article class="tag">
        <div class="tag-accent" aria-hidden="true"></div>
        <div class="tag-film" aria-hidden="true">
          <span></span><span></span><span></span><span></span><span></span>
        </div>
        <header class="tag-top">
          <div class="tag-brand">
            <span class="tag-brand-mark" aria-hidden="true"></span>
            GoCinema
          </div>
          ${
            category
              ? `<div class="tag-category">${escapeHtml(category)}</div>`
              : '<div class="tag-category tag-category-empty">&nbsp;</div>'
          }
        </header>
        <h2 class="tag-name">${escapeHtml(p.name)}</h2>
        <footer class="tag-bottom">
          <div class="tag-price-label">Գին</div>
          <div class="tag-price">
            <span class="tag-amount">${escapeHtml(amount)}</span>
            <span class="tag-currency">${currency}</span>
          </div>
        </footer>
      </article>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="hy">
<head>
  <meta charset="utf-8" />
  <title>Գնապիտակներ — GoCinema</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Armenian:wght@500;700;800&family=Oswald:wght@500;600&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Noto Sans Armenian", "Segoe UI", Arial, sans-serif;
      background:
        radial-gradient(ellipse at top, #2a2438 0%, transparent 55%),
        linear-gradient(160deg, #14121a 0%, #1c1824 50%, #121016 100%);
      color: #111;
      padding: 20px 16px 32px;
      min-height: 100vh;
    }
    .toolbar {
      position: sticky;
      top: 12px;
      z-index: 10;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      justify-content: space-between;
      max-width: 210mm;
      margin: 0 auto 20px;
      padding: 12px 16px;
      background: rgba(255,255,255,.92);
      border: 1px solid rgba(255,255,255,.2);
      border-radius: 14px;
      backdrop-filter: blur(8px);
      box-shadow: 0 8px 24px rgba(0,0,0,.25);
    }
    .toolbar p { font-size: 14px; color: #4b5563; }
    .toolbar strong { color: #111; }
    .btn {
      appearance: none;
      border: none;
      border-radius: 10px;
      padding: 10px 18px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
    }
    .btn-primary {
      background: linear-gradient(135deg, #c9a227, #a8841a);
      color: #1a1408;
      box-shadow: 0 2px 8px rgba(201,162,39,.35);
    }
    .btn-primary:hover { filter: brightness(1.05); }

    .sheet {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;
      max-width: 210mm;
      margin: 0 auto;
    }

    .tag {
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 58mm;
      overflow: hidden;
      background:
        linear-gradient(165deg, #fffef9 0%, #f7f3ea 55%, #f3eee3 100%);
      border: 1.5px solid #1a1620;
      border-radius: 10px;
      page-break-inside: avoid;
      break-inside: avoid;
      box-shadow:
        0 1px 0 rgba(255,255,255,.8) inset,
        0 10px 28px rgba(0,0,0,.18);
    }

    .tag-accent {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 7px;
      background: linear-gradient(180deg, #c9a227 0%, #8b6914 100%);
    }

    .tag-film {
      position: absolute;
      right: 10px;
      top: 12px;
      display: flex;
      flex-direction: column;
      gap: 5px;
      opacity: .35;
    }
    .tag-film span {
      width: 7px;
      height: 7px;
      border-radius: 1.5px;
      background: #1a1620;
    }

    .tag-top {
      padding: 14px 28px 0 20px;
    }

    .tag-brand {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .14em;
      text-transform: uppercase;
      color: #1a1620;
    }
    .tag-brand-mark {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, #f0d878, #c9a227 55%, #8b6914);
      box-shadow: 0 0 0 2px rgba(201,162,39,.25);
    }

    .tag-category {
      margin-top: 8px;
      display: inline-block;
      max-width: 100%;
      padding: 3px 9px;
      border-radius: 999px;
      background: rgba(26,22,32,.07);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .02em;
      color: #5c5668;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tag-category-empty {
      background: transparent;
      padding: 0;
      min-height: 18px;
    }

    .tag-name {
      flex: 1;
      display: flex;
      align-items: center;
      padding: 12px 28px 10px 20px;
      font-size: 20px;
      font-weight: 800;
      line-height: 1.22;
      color: #14121a;
      letter-spacing: -.01em;
    }

    .tag-bottom {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 10px;
      margin: 0 12px 12px 12px;
      padding: 12px 14px;
      border-radius: 8px;
      background: linear-gradient(135deg, #1a1620 0%, #2a2438 100%);
      color: #fffef9;
    }

    .tag-price-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .16em;
      text-transform: uppercase;
      color: rgba(255,254,249,.55);
      padding-bottom: 4px;
    }

    .tag-price {
      display: flex;
      align-items: baseline;
      gap: 6px;
      font-family: "Oswald", "Noto Sans Armenian", sans-serif;
      line-height: 1;
    }
    .tag-amount {
      font-size: 34px;
      font-weight: 600;
      letter-spacing: -.02em;
      color: #f5e6b8;
    }
    .tag-currency {
      font-size: 18px;
      font-weight: 600;
      color: #c9a227;
    }

    @media print {
      @page { size: A4; margin: 9mm; }
      body {
        background: #fff !important;
        padding: 0;
        min-height: 0;
      }
      .toolbar { display: none !important; }
      .sheet {
        gap: 7mm;
        max-width: none;
      }
      .tag {
        min-height: 52mm;
        box-shadow: none;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .tag-bottom,
      .tag-accent,
      .tag-brand-mark,
      .tag-category,
      .tag-film span {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }

    @media (max-width: 700px) {
      .sheet { grid-template-columns: 1fr; }
      .tag-name { font-size: 18px; }
      .tag-amount { font-size: 30px; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <p><strong>${products.length}</strong> գնապիտակ · տպեք կամ պահեք որպես PDF</p>
    <button class="btn btn-primary" type="button" onclick="window.print()">Տպել / PDF</button>
  </div>
  <div class="sheet">
    ${tags}
  </div>
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); }, 400);
    });
  </script>
</body>
</html>`;
}

/**
 * Բացում է նոր պատուհան գնապիտակներով և առաջարկում տպել/պահել PDF։
 * @returns false եթե popup-ը արգելափակվել է
 */
export function openProductPriceTagsPdf(products: PriceTagProduct[]): boolean {
  if (products.length === 0) return false;

  const html = buildTagsHtml(products);
  const win = window.open('', '_blank');
  if (!win) return false;

  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  return true;
}
