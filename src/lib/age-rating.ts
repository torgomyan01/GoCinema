export const AGE_RATINGS = [
  '0+',
  '6+',
  '12+',
  '14+',
  '15+',
  '16+',
  '18+',
  '21+',
] as const;

export type AgeRating = (typeof AGE_RATINGS)[number];

export interface AgeRatingOption {
  value: AgeRating;
  label: string;
  description: string;
}

export const AGE_RATING_OPTIONS: AgeRatingOption[] = [
  { value: '0+', label: '0+', description: 'Բոլոր տարիքի համար' },
  { value: '6+', label: '6+', description: '6 տարեկան և բարձր' },
  { value: '12+', label: '12+', description: '12 տարեկան և բարձր' },
  { value: '14+', label: '14+', description: '14 տարեկան և բարձր' },
  { value: '15+', label: '15+', description: '15 տարեկան և բարձր' },
  { value: '16+', label: '16+', description: '16 տարեկան և բարձր' },
  {
    value: '18+',
    label: '18+',
    description: '18 տարեկան և բարձր (մեծահասակների համար)',
  },
  {
    value: '21+',
    label: '21+',
    description: '21 տարեկան և բարձր (մեծահասակների համար)',
  },
];

/** Badge-ի գունավորում տարիքային սահմանափակման համար */
export function ageRatingClasses(rating?: string | null): string {
  switch (rating) {
    case '21+':
    case '18+':
      return 'bg-red-600 text-white';
    case '16+':
    case '15+':
      return 'bg-orange-500 text-white';
    case '14+':
    case '12+':
      return 'bg-amber-400 text-gray-900';
    case '6+':
      return 'bg-lime-500 text-white';
    case '0+':
      return 'bg-green-500 text-white';
    default:
      return 'bg-gray-200 text-gray-700';
  }
}

export function ageRatingDescription(rating?: string | null): string {
  const found = AGE_RATING_OPTIONS.find((o) => o.value === rating);
  return found?.description ?? '';
}
