import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

/**
 * Բոնուսային համակարգի սկզբնական տվյալներ՝ կանոններ + պարգևների կատալոգ։
 * Գործարկում՝ npx tsx prisma/seed-bonus.ts
 * Կրկնակի գործարկումն անվտանգ է (նույն անվանումով պարգևը չի կրկնօրինակվում)։
 */
const prisma = new PrismaClient();

async function main() {
  await prisma.bonusSettings.upsert({
    where: { id: 1 },
    update: { ticketMultiplier: 0.5 },
    create: { id: 1, ticketMultiplier: 0.5 },
  });

  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, name: true, price: true, category: true },
    orderBy: { price: 'asc' },
  });

  const popcorn = products.find((p) => /պոպկորն|popcorn/i.test(p.name));
  const drink = products.find((p) => p.category === 'drink');

  const rewards: Array<{
    name: string;
    description: string;
    pointsCost: number;
    kind: string;
    productId: number | null;
    discountAmount: number;
    sortOrder: number;
  }> = [
    {
      name: 'Զեղչ 500 ֏',
      description: 'Կիրառվում է տոմսի կամ ապրանքի վրա դրամարկղում',
      pointsCost: 200,
      kind: 'discount',
      productId: null,
      discountAmount: 500,
      sortOrder: 10,
    },
    {
      name: 'Զեղչ 1000 ֏',
      description: 'Կիրառվում է տոմսի կամ ապրանքի վրա դրամարկղում',
      pointsCost: 360,
      kind: 'discount',
      productId: null,
      discountAmount: 1000,
      sortOrder: 20,
    },
    {
      name: 'Անվճար տոմս',
      description: 'Ցանկացած ցուցադրության մեկ տոմս',
      pointsCost: 800,
      kind: 'ticket',
      productId: null,
      discountAmount: 0,
      sortOrder: 40,
    },
  ];

  if (drink) {
    rewards.push({
      name: `Անվճար ${drink.name}`,
      description: 'Բուֆետից մեկ միավոր',
      pointsCost: 240,
      kind: 'product',
      productId: drink.id,
      discountAmount: 0,
      sortOrder: 25,
    });
  }
  if (popcorn) {
    rewards.push({
      name: `Անվճար ${popcorn.name}`,
      description: 'Բուֆետից մեկ միավոր',
      pointsCost: 400,
      kind: 'product',
      productId: popcorn.id,
      discountAmount: 0,
      sortOrder: 30,
    });
  }

  let created = 0;
  for (const reward of rewards) {
    const existing = await prisma.bonusReward.findFirst({
      where: { name: reward.name },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.bonusReward.create({ data: reward });
    created += 1;
  }

  console.log(
    `Bonus seed done: settings ready, ${created} new reward(s) created.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
