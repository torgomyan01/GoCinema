/** Կարճ ծննդյան SMS՝ 50% զեղչ դահլիճում ընկերներով */
export function buildBirthdayPromoSmsText(name?: string | null): string {
  const firstName = name?.trim().split(/\s+/)[0];
  const who = firstName || 'Բարև';

  return (
    `${who}, ստացիր 50% զեղչ ծննդյան առթիվ՝ ` +
    `GoCinema-ում ընկերներով ֆիլմ դիտելու համար։ ` +
    `Վարձակալելով ամբողջ դահլիճը։`
  );
}
