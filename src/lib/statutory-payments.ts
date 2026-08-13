/**
 * ԱՁ · շրջանառության հարկի համակարգի պարտադիր վճարներ։
 * Գումարներն ու ժամկետները տեղեկատվական են — վերջնականը հաստատում է հաշվապահը/ՊԵԿ։
 *
 * Աղբյուրներ՝ ՀՀ հարկային օրենսգիրք, accountant.am (ԱՁ հարկեր 2025–2026)։
 */

export interface StatutoryPaymentInfo {
  dueLabel: string;
  amountLabel: string;
  ruleHy: string;
}

function formatAmd(value: number): string {
  return `${Math.round(value).toLocaleString('hy-AM')} ֏`;
}

function monthNameHy(monthIndex: number): string {
  return [
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
  ][Math.min(11, Math.max(0, monthIndex))]!;
}

/** Եռամսյակին հաջորդող ամսվա 20-ը */
export function quarterPaymentDeadlineLabel(year: number, quarter: number): string {
  const q = Math.min(4, Math.max(1, Math.floor(quarter)));
  if (q === 4) return `մինչև 20 հունվարի ${year + 1}`;
  return `մինչև 20 ${monthNameHy(q * 3)}ի ${year}`;
}

export function stampDutyEstimate(
  year: number,
  ytdTurnover: number
): { amount: number; bracketHy: string; scaleYear: number } {
  const turnover = Math.max(0, ytdTurnover);

  if (year <= 2025) {
    if (turnover <= 2_400_000) {
      return {
        amount: 18_000,
        bracketHy: 'հաշվարկման բազա մինչև 2.4 մլն ֏',
        scaleYear: 2025,
      };
    }
    if (turnover <= 6_000_000) {
      return {
        amount: 24_000,
        bracketHy: 'հաշվարկման բազա 2.4–6 մլն ֏',
        scaleYear: 2025,
      };
    }
    if (turnover <= 12_000_000) {
      return {
        amount: 48_000,
        bracketHy: 'հաշվարկման բազա 6–12 մլն ֏',
        scaleYear: 2025,
      };
    }
    return {
      amount: 120_000,
      bracketHy: 'հաշվարկման բազա 12 մլն ֏-ից ավելի',
      scaleYear: 2025,
    };
  }

  if (turnover <= 12_000_000) {
    return {
      amount: 12_000,
      bracketHy: 'հաշվարկման բազա մինչև 12 մլն ֏',
      scaleYear: year,
    };
  }
  return {
    amount: 120_000,
    bracketHy: 'հաշվարկման բազա 12 մլն ֏-ից ավելի',
    scaleYear: year,
  };
}

export function getStatutoryPaymentInfo(params: {
  category: string;
  year: number;
  quarter: number;
  ytdTurnover: number;
  yearIncomplete: boolean;
}): StatutoryPaymentInfo | null {
  const { category, year, quarter, ytdTurnover, yearIncomplete } = params;
  const quarterDeadline = quarterPaymentDeadlineLabel(year, quarter);

  if (category === 'stamp_duty') {
    const stamp = stampDutyEstimate(year, ytdTurnover);
    const dueYear = year + 1;
    const incompleteNote = yearIncomplete
      ? ` Տարին դեռ չի ավարտվել — գումարը կարող է փոխվել (այժմ YTD ${formatAmd(ytdTurnover)})։`
      : ` Տարեկան շրջանառություն՝ ${formatAmd(ytdTurnover)}։`;
    return {
      dueLabel: `Մինչև 20 ապրիլի ${dueYear}`,
      amountLabel: `${formatAmd(stamp.amount)} տարեկան`,
      ruleHy: `ԱՁ դրոշմանիշային վճար (${stamp.scaleYear}թ. սանդղակ, ${stamp.bracketHy})։ Վճարվում է տարին մեկ անգամ՝ հաշվետու տարվան հաջորդող ապրիլի 20-ը։${incompleteNote}`,
    };
  }

  if (category === 'social_payment') {
    return {
      dueLabel: `Ամսական՝ հաջորդ ամսվա 20-ը · եռամսյակ՝ ${quarterDeadline}`,
      amountLabel: `5 000 ֏/ամիս · ${formatAmd(15_000)} այս եռամսյակ`,
      ruleHy:
        'ԱՁ · շրջհարկի համակարգ՝ ֆիքսված 5 000 ֏ ամսական (եռամսյակում 15 000 ֏)։ Եթե կան աշխատակիցներ, նրանց սոցիալական վճարը հաշվվում է աշխատավարձից առանձին և վճարվում է հաջորդ ամսվա 20-ը։',
    };
  }

  if (category === 'income_tax') {
    return {
      dueLabel: `Ամսական՝ հաջորդ ամսվա 20-ը · եռամսյակ՝ ${quarterDeadline}`,
      amountLabel: `5 000 ֏/ամիս · ${formatAmd(15_000)} այս եռամսյակ`,
      ruleHy:
        'ԱՁ · շրջհարկի համակարգ՝ ֆիքսված 5 000 ֏ ամսական շահութահարկ/եկամտային (եռամսյակում 15 000 ֏)։ Աշխատակիցների եկամտային հարկը պահվում է աշխատավարձից և վճարվում է հաջորդ ամսվա 20-ը։',
    };
  }

  if (category === 'state_duty') {
    return {
      dueLabel: 'Հայտի կամ գործարքի պահին',
      amountLabel: 'Ֆիքսված չէ',
      ruleHy:
        'Պետական տուրքի գումարը կախված է տեսակից (լիցենզիա, թույլտվություն, նոտար և այլն)։ Ֆիքսված ամսական/եռամսյակային գումար չկա — վճարվում է համապատասխան հայտը ներկայացնելիս։',
    };
  }

  return null;
}
