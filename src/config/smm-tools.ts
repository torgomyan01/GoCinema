export interface SmmTool {
  id: string;
  href: string;
  title: string;
  description: string;
  badge: string;
}

export const SMM_TOOLS: SmmTool[] = [
  {
    id: 'schedule',
    href: '/admin/smm/schedule',
    title: 'Ժամանակացույց',
    description:
      'Instagram Stories 9:16 նկար՝ մինչև 5 ֆիլմ, այսօրվանից հետո օրեր, ժամեր և գին',
    badge: '9:16 PNG',
  },
  {
    id: 'movie',
    href: '/admin/smm/movie',
    title: 'Ֆիլմի հայտարարություն',
    description:
      'Մեկ ֆիլմի պոստեր՝ 9:16 Stories կամ 1:1 Feed, ժանր, տարիք, սեանսներ',
    badge: '9:16 / 1:1',
  },
  {
    id: 'today',
    href: '/admin/smm/today',
    title: 'Այսօր կինոյում',
    description: 'Այսօրվա բոլոր սեանսները մեկ Stories նկարում',
    badge: '9:16 PNG',
  },
  {
    id: 'premiere',
    href: '/admin/smm/premiere',
    title: 'Պրեմիերա',
    description: 'Պոստեր, ամսաթիվ և countdown՝ այսօր, վաղը, այս ուրբաթ',
    badge: '9:16 PNG',
  },
  {
    id: 'caption',
    href: '/admin/smm/caption',
    title: 'Տեքստ / caption',
    description: 'Հայերեն տեքստ, հեշթեգներ և հղում՝ պատճենել Instagram',
    badge: 'Copy',
  },
];
