/** Կարճ ծննդյան SMS՝ դահլիճ մինչև 42 հոգի՝ 10000֏ */
export function buildBirthdayPromoSmsText(name?: string | null): string {
  const firstName = name?.trim().split(/\s+/)[0];
  const who = firstName || 'Բարև';

  return (
    `${who}, ծննդյան օրը արի ֆիլմ դիտելու՝ ընդամենը 10.000 դրամով։ ` +
    `Մինչև 42 հոգով դիտիր քո ուզած ֆիլմը մեզ մոտ՝ GoCinema։`
  );
}
