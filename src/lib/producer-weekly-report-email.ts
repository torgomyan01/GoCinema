import { GOCINEMA_LEGAL } from '@/lib/gocinema-legal';
import {
  formatDateHy,
  formatDateNumericHy,
  formatDateTimeHy,
  formatPrice,
} from '@/lib/format';

export type WeeklyReportScreening = {
  startTime: Date;
  hallName: string;
  ticketsSold: number;
  revenue: number;
};

export type WeeklyReportEmailData = {
  movieTitle: string;
  companyName: string | null;
  contractNumber: string | null;
  weekStart: Date;
  weekEnd: Date;
  screenings: WeeklyReportScreening[];
  screeningsCount: number;
  ticketsSold: number;
  revenue: number;
  royaltyPercent: number;
  royaltyAmount: number;
};

function amd(value: number): string {
  return `${formatPrice(value)} ֏`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function weeklyReportSubject(
  data: WeeklyReportEmailData,
  isTest = false
): string {
  const from = formatDateNumericHy(data.weekStart);
  const to = formatDateNumericHy(data.weekEnd);
  const subject = `GoCinema · շաբաթական հաշվետվություն · «${data.movieTitle}» · ${from}–${to}`;
  return isTest ? `[Թեստ] ${subject}` : subject;
}

export function weeklyReportText(data: WeeklyReportEmailData): string {
  const lines = [
    'GO CINEMA',
    'Շաբաթական հաշվետվություն',
    '',
    `Ֆիլմ՝ ${data.movieTitle}`,
    data.companyName ? `Լիցենզատու՝ ${data.companyName}` : '',
    data.contractNumber ? `Պայմանագիր՝ ${data.contractNumber}` : '',
    `Ժամանակահատված՝ ${formatDateNumericHy(data.weekStart)} – ${formatDateNumericHy(data.weekEnd)}`,
    '',
    `Ցուցադրություններ՝ ${data.screeningsCount}`,
    `Վաճառված տոմսեր՝ ${data.ticketsSold}`,
    `Հասույթ՝ ${amd(data.revenue)}`,
    `Վարձատրություն (${data.royaltyPercent}%)՝ ${amd(data.royaltyAmount)}`,
    '',
  ];

  if (data.screenings.length === 0) {
    lines.push('Այս շաբաթ ցուցադրություն չի եղել։');
  } else {
    lines.push('Ցուցադրություններ՝');
    for (const row of data.screenings) {
      lines.push(
        `• ${formatDateTimeHy(row.startTime)} · ${row.hallName} · ${row.ticketsSold} տոմս · ${amd(row.revenue)}`
      );
    }
  }

  lines.push(
    '',
    'Հարցերի դեպքում՝ ' + GOCINEMA_LEGAL.email,
    GOCINEMA_LEGAL.shortName
  );

  return lines.filter((line) => line !== '').join('\n');
}

export function weeklyReportHtml(data: WeeklyReportEmailData): string {
  const title = escapeHtml(data.movieTitle);
  const company = data.companyName ? escapeHtml(data.companyName) : '';
  const period = `${formatDateHy(data.weekStart, { year: true })} – ${formatDateHy(data.weekEnd, { year: true })}`;

  const rows =
    data.screenings.length === 0
      ? `<tr><td colspan="4" style="padding:12px 10px;color:#666;text-align:center;">Այս շաբաթ ցուցադրություն չի եղել։</td></tr>`
      : data.screenings
          .map(
            (row) => `<tr>
              <td style="padding:8px 10px;border-bottom:1px solid #eee;">${escapeHtml(formatDateTimeHy(row.startTime))}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #eee;">${escapeHtml(row.hallName)}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;">${row.ticketsSold}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;">${amd(row.revenue)}</td>
            </tr>`
          )
          .join('');

  return `<!DOCTYPE html>
<html lang="hy">
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Georgia,'Noto Serif Armenian',serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;background:#ffffff;border:1px solid #e5e5e5;">
          <tr>
            <td style="padding:20px 24px;background:#111;color:#fff;">
              <div style="font-size:20px;letter-spacing:0.14em;font-weight:700;">GO CINEMA</div>
              <div style="margin-top:6px;font-size:13px;color:#d4d4d4;">Շաբաթական հաշվետվություն</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <h1 style="margin:0 0 8px;font-size:20px;">«${title}»</h1>
              ${company ? `<p style="margin:0 0 4px;font-size:14px;color:#444;">Լիցենզատու՝ ${company}</p>` : ''}
              ${
                data.contractNumber
                  ? `<p style="margin:0 0 4px;font-size:14px;color:#444;">Պայմանագիր՝ ${escapeHtml(data.contractNumber)}</p>`
                  : ''
              }
              <p style="margin:0 0 20px;font-size:14px;color:#444;">Ժամանակահատված՝ ${escapeHtml(period)}</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:20px;">
                <tr>
                  <td style="width:25%;padding:12px;background:#fafafa;border:1px solid #eee;">
                    <div style="font-size:11px;color:#666;">Ցուցադրություն</div>
                    <div style="font-size:18px;font-weight:700;">${data.screeningsCount}</div>
                  </td>
                  <td style="width:25%;padding:12px;background:#fafafa;border:1px solid #eee;">
                    <div style="font-size:11px;color:#666;">Տոմսեր</div>
                    <div style="font-size:18px;font-weight:700;">${data.ticketsSold}</div>
                  </td>
                  <td style="width:25%;padding:12px;background:#fafafa;border:1px solid #eee;">
                    <div style="font-size:11px;color:#666;">Հասույթ</div>
                    <div style="font-size:18px;font-weight:700;">${amd(data.revenue)}</div>
                  </td>
                  <td style="width:25%;padding:12px;background:#111;color:#fff;border:1px solid #111;">
                    <div style="font-size:11px;color:#bbb;">Վարձատրություն ${data.royaltyPercent}%</div>
                    <div style="font-size:18px;font-weight:700;">${amd(data.royaltyAmount)}</div>
                  </td>
                </tr>
              </table>
              <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:13px;">
                <thead>
                  <tr style="background:#f3f3f3;">
                    <th align="left" style="padding:8px 10px;">Ամսաթիվ / ժամ</th>
                    <th align="left" style="padding:8px 10px;">Դահլիճ</th>
                    <th align="right" style="padding:8px 10px;">Տոմսեր</th>
                    <th align="right" style="padding:8px 10px;">Հասույթ</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
              <p style="margin:20px 0 0;font-size:12px;color:#666;line-height:1.5;">
                Հասույթը վաճառված տոմսերից փաստացի ստացված գումարն է։ Վարձատրությունը հաշվարկված է պայմանագրով սահմանված տոկոսով։
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;border-top:1px solid #eee;font-size:12px;color:#666;">
              ${escapeHtml(GOCINEMA_LEGAL.shortName)}<br/>
              ${escapeHtml(GOCINEMA_LEGAL.address)} · ${escapeHtml(GOCINEMA_LEGAL.email)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
