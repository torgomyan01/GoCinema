'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { deleteUploadedFile } from '@/lib/delete-upload';
import { isQuantityOnlyProduct } from '@/lib/product-units';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isStaffRole } from '@/lib/roles';

async function requireStaff() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || !isStaffRole(user.role)) {
    return null;
  }
  return user;
}

export interface CreateProductData {
  name: string;
  description?: string | null;
  price: number;
  image?: string | null;
  category: string;
  stock?: number;
  isActive?: boolean;
}

export interface UpdateProductData extends Partial<CreateProductData> {
  id: number;
}

export async function getProducts(category?: string) {
  try {
    const where: any = {};
    if (category) {
      where.category = category;
    }
    where.isActive = true;

    const products = await prisma.product.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return { success: true, products };
  } catch (error: any) {
    console.error('[Get Products] Error:', error);
    return {
      success: false,
      error: 'Արտադրանքները բեռնելիս սխալ է տեղի ունեցել',
      products: [],
    };
  }
}

export async function getAllProducts() {
  try {
    const products = await prisma.product.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return { success: true, products };
  } catch (error: any) {
    console.error('[Get All Products] Error:', error);
    return {
      success: false,
      error: 'Արտադրանքները բեռնելիս սխալ է տեղի ունեցել',
      products: [],
    };
  }
}

export async function getProductById(id: number) {
  try {
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return {
        success: false,
        error: 'Արտադրանքը չի գտնվել',
      };
    }

    return { success: true, product };
  } catch (error: any) {
    console.error('[Get Product] Error:', error);
    return {
      success: false,
      error: 'Արտադրանքը բեռնելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function createProduct(data: CreateProductData) {
  try {
    if (!data.name || !data.price || !data.category) {
      return {
        success: false,
        error: 'Բոլոր պարտադիր դաշտերը պետք է լրացված լինեն',
      };
    }

    const product = await prisma.product.create({
      data: {
        name: data.name,
        description: data.description || null,
        price: data.price,
        image: data.image || null,
        category: data.category,
        // Պաշարը կառավարվում է QR-միավորներով (restock սկան)՝ սկզբում 0
        stock: 0,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });

    revalidatePath('/admin/products');
    revalidatePath('/checkout');

    return {
      success: true,
      product,
      message: 'Արտադրանքը հաջողությամբ ավելացվեց',
    };
  } catch (error: any) {
    console.error('[Create Product] Error:', error);
    return {
      success: false,
      error: 'Արտադրանք ավելացնելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function updateProduct(data: UpdateProductData) {
  try {
    if (!data.id) {
      return {
        success: false,
        error: 'Արտադրանքի ID-ն պարտադիր է',
      };
    }

    const existingProduct = await prisma.product.findUnique({
      where: { id: data.id },
    });

    if (!existingProduct) {
      return {
        success: false,
        error: 'Արտադրանքը չի գտնվել',
      };
    }

    const product = await prisma.product.update({
      where: { id: data.id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.price && { price: data.price }),
        ...(data.image !== undefined && { image: data.image }),
        ...(data.category && { category: data.category }),
        // Պաշարը (stock) չի փոխվում ձեռքով՝ կառավարվում է QR-միավորներով
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    revalidatePath('/admin/products');
    revalidatePath('/checkout');

    return {
      success: true,
      product,
      message: 'Արտադրանքը հաջողությամբ թարմացվեց',
    };
  } catch (error: any) {
    console.error('[Update Product] Error:', error);
    return {
      success: false,
      error: 'Արտադրանք թարմացնելիս սխալ է տեղի ունեցել',
    };
  }
}

/**
 * Քանակային ապրանքին (օր.՝ պոպկորն) պաշար ավելացնել։
 */
export async function restockProductQuantity(id: number, amount: number) {
  try {
    if (!id) {
      return { success: false, error: 'Ապրանքի ID-ն պարտադիր է' };
    }

    const qty = Math.floor(Number(amount));
    if (!Number.isFinite(qty) || qty <= 0) {
      return { success: false, error: 'Քանակը պետք է լինի 0-ից մեծ ամբողջ թիվ' };
    }

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: 'Արտադրանքը չի գտնվել' };
    }
    if (!isQuantityOnlyProduct(existing.category)) {
      return {
        success: false,
        error: 'Այս ապրանքի համար օգտագործեք QR սկանավորում',
      };
    }

    const product = await prisma.product.update({
      where: { id },
      data: { stock: { increment: qty } },
    });

    revalidatePath('/admin/products');
    revalidatePath('/admin/box-office');
    revalidatePath('/checkout');

    return {
      success: true,
      product,
      message: `Ավելացվեց ${qty} միավոր։ Ընդհանուր պաշար՝ ${product.stock}`,
    };
  } catch (error: unknown) {
    console.error('[Restock Product Quantity] Error:', error);
    return {
      success: false,
      error: 'Քանակ ավելացնելիս սխալ է տեղի ունեցել',
    };
  }
}

/**
 * Ապրանքին քանակ ավելացնել՝ սկանավորելով ամեն միավորի ունիկալ QR/գործարանային կոդը։
 * Ամեն կոդ դառնում է առանձին ProductUnit (status = in_stock)։
 * Արդեն գոյություն ունեցող կոդերը բաց են թողնվում (կրկնակի սկան)։
 * Ապրանքի `stock`-ը համաժամեցվում է՝ = in_stock միավորների քանակ։
 */
export async function restockProductUnits(id: number, qrCodes: string[]) {
  try {
    if (!id) {
      return { success: false, error: 'Ապրանքի ID-ն պարտադիր է' };
    }

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: 'Արտադրանքը չի գտնվել' };
    }
    if (isQuantityOnlyProduct(existing.category)) {
      return {
        success: false,
        error: 'Պոպկորն և նման ապրանքների համար օգտագործեք քանակի լրացում',
      };
    }

    // Նորմալիզացիա՝ trim, դատարկների զտում, ներմուտքի ներսում կրկնակիների հեռացում
    const seen = new Set<string>();
    const codes: string[] = [];
    for (const raw of qrCodes ?? []) {
      const code = String(raw ?? '').trim();
      if (!code) continue;
      if (seen.has(code)) continue;
      seen.add(code);
      codes.push(code);
    }

    if (codes.length === 0) {
      return { success: false, error: 'Սկանավորեք առնվազն մեկ QR կոդ' };
    }

    // Բազայում արդեն առկա կոդերը (ցանկացած ապրանքի)՝ բաց ենք թողնում
    const existingUnits = await prisma.productUnit.findMany({
      where: { qrCode: { in: codes } },
      select: { qrCode: true },
    });
    const existingCodes = new Set(existingUnits.map((u) => u.qrCode));
    const newCodes = codes.filter((c) => !existingCodes.has(c));

    if (newCodes.length > 0) {
      await prisma.productUnit.createMany({
        data: newCodes.map((qrCode) => ({
          productId: id,
          qrCode,
          status: 'in_stock',
        })),
        skipDuplicates: true,
      });
    }

    // stock = in_stock միավորների իրական քանակ
    const inStockCount = await prisma.productUnit.count({
      where: { productId: id, status: 'in_stock' },
    });
    const product = await prisma.product.update({
      where: { id },
      data: { stock: inStockCount },
    });

    revalidatePath('/admin/products');
    revalidatePath('/admin/box-office');
    revalidatePath('/checkout');

    const duplicates = codes.filter((c) => existingCodes.has(c));
    return {
      success: true,
      product,
      added: newCodes.length,
      duplicates,
      message:
        duplicates.length > 0
          ? `Ավելացվեց ${newCodes.length} միավոր։ ${duplicates.length} կոդ արդեն գրանցված էր և բաց թողնվեց։ Ընդհանուր պաշար՝ ${inStockCount}`
          : `Ավելացվեց ${newCodes.length} միավոր։ Ընդհանուր պաշար՝ ${inStockCount}`,
    };
  } catch (error: any) {
    console.error('[Restock Product Units] Error:', error);
    return {
      success: false,
      error: 'Քանակ լրացնելիս սխալ է տեղի ունեցել',
    };
  }
}

/** Ապրանքի միավորների ցանկ՝ որոնում և ֆիլտր */
export async function getProductUnits(
  productId: number,
  options?: {
    search?: string;
    status?: 'all' | 'in_stock' | 'sold';
  }
) {
  const staff = await requireStaff();
  if (!staff) {
    return {
      success: false,
      error: 'Մուտքն արգելված է',
      units: [],
      inStock: 0,
      sold: 0,
      verified: 0,
    };
  }

  try {
    const search = options?.search?.trim() ?? '';
    const status = options?.status ?? 'all';

    const where: {
      productId: number;
      status?: string;
      qrCode?: { contains: string };
    } = { productId };

    if (status !== 'all') {
      where.status = status;
    }
    if (search) {
      where.qrCode = { contains: search };
    }

    const [units, inStock, sold, verified] = await Promise.all([
      prisma.productUnit.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true,
          qrCode: true,
          status: true,
          soldAt: true,
          verifiedAt: true,
          createdAt: true,
          orderItemId: true,
        },
      }),
      prisma.productUnit.count({ where: { productId, status: 'in_stock' } }),
      prisma.productUnit.count({ where: { productId, status: 'sold' } }),
      prisma.productUnit.count({
        where: { productId, status: 'in_stock', verifiedAt: { not: null } },
      }),
    ]);

    return { success: true, units, inStock, sold, verified };
  } catch (error: unknown) {
    console.error('[Get Product Units] Error:', error);
    return {
      success: false,
      error: 'Միավորները բեռնելիս սխալ է տեղի ունեցել',
      units: [],
      inStock: 0,
      sold: 0,
      verified: 0,
    };
  }
}

export type VerifyUnitOutcome =
  | 'verified'
  | 'already_verified'
  | 'sold'
  | 'not_found'
  | 'wrong_product';

/** Սկանավորել QR-ը և նշել որպես ստուգված (ինվենտարիզացիա) */
export async function verifyProductUnitQr(productId: number, qrCode: string) {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  try {
    const code = qrCode.trim();
    if (!code) {
      return { success: false, error: 'QR կոդը դատարկ է', outcome: 'not_found' as const };
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, category: true },
    });
    if (!product) {
      return { success: false, error: 'Արտադրանքը չի գտնվել' };
    }
    if (isQuantityOnlyProduct(product.category)) {
      return { success: false, error: 'Այս ապրանքը QR ստուգում չունի' };
    }

    const unit = await prisma.productUnit.findUnique({
      where: { qrCode: code },
      include: { product: { select: { id: true, name: true } } },
    });

    if (!unit) {
      return {
        success: false,
        outcome: 'not_found' as const,
        error: 'QR կոդը բազայում չի գտնվել',
        qrCode: code,
      };
    }

    if (unit.productId !== productId) {
      return {
        success: false,
        outcome: 'wrong_product' as const,
        error: `Այս QR-ը պատկանում է «${unit.product.name}» ապրանքին`,
        qrCode: code,
        otherProductName: unit.product.name,
      };
    }

    if (unit.status === 'sold') {
      return {
        success: false,
        outcome: 'sold' as const,
        error: 'Այս միավորը արդեն վաճառված է',
        qrCode: code,
        unit: {
          id: unit.id,
          qrCode: unit.qrCode,
          status: unit.status,
          verifiedAt: unit.verifiedAt,
          soldAt: unit.soldAt,
        },
      };
    }

    if (unit.verifiedAt) {
      return {
        success: false,
        outcome: 'already_verified' as const,
        error: 'Այս միավորը արդեն ստուգված է',
        qrCode: code,
        unit: {
          id: unit.id,
          qrCode: unit.qrCode,
          status: unit.status,
          verifiedAt: unit.verifiedAt,
          soldAt: unit.soldAt,
        },
      };
    }

    const updated = await prisma.productUnit.update({
      where: { id: unit.id },
      data: { verifiedAt: new Date() },
      select: {
        id: true,
        qrCode: true,
        status: true,
        verifiedAt: true,
        soldAt: true,
        createdAt: true,
        orderItemId: true,
      },
    });

    const verified = await prisma.productUnit.count({
      where: { productId, status: 'in_stock', verifiedAt: { not: null } },
    });

    return {
      success: true,
      outcome: 'verified' as const,
      message: 'Ստուգված է',
      qrCode: code,
      unit: updated,
      verified,
    };
  } catch (error: unknown) {
    console.error('[Verify Product Unit QR] Error:', error);
    return { success: false, error: 'Ստուգելիս սխալ է տեղի ունեցել' };
  }
}

/** Նոր ստուգում սկսել՝ մաքրել բոլոր ստուգված նշումները (in_stock միավորներ) */
export async function resetProductUnitVerifications(productId: number) {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  try {
    const result = await prisma.productUnit.updateMany({
      where: { productId, status: 'in_stock', verifiedAt: { not: null } },
      data: { verifiedAt: null },
    });

    return {
      success: true,
      resetCount: result.count,
      message:
        result.count > 0
          ? `${result.count} միավորի ստուգումը զրոյացվեց`
          : 'Ստուգված միավորներ չկային',
    };
  } catch (error: unknown) {
    console.error('[Reset Product Unit Verifications] Error:', error);
    return { success: false, error: 'Ստուգումը զրոյացնելիս սխալ է տեղի ունեցել' };
  }
}

/** QR կոդը փոխել (միայն in_stock միավորների համար) */
export async function updateProductUnitQr(unitId: number, qrCode: string) {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  try {
    const code = qrCode.trim();
    if (!code) {
      return { success: false, error: 'QR կոդը չի կարող դատարկ լինել' };
    }

    const unit = await prisma.productUnit.findUnique({
      where: { id: unitId },
      include: { product: { select: { id: true, category: true } } },
    });

    if (!unit) {
      return { success: false, error: 'Միավորը չի գտնվել' };
    }
    if (isQuantityOnlyProduct(unit.product.category)) {
      return { success: false, error: 'Այս ապրանքը QR հաշվառում չունի' };
    }
    if (unit.status !== 'in_stock') {
      return {
        success: false,
        error: 'Վաճառված միավորի QR-ը չի կարող փոխվել (հարկային հաշվառում)',
      };
    }

    const duplicate = await prisma.productUnit.findFirst({
      where: { qrCode: code, id: { not: unitId } },
      select: { id: true },
    });
    if (duplicate) {
      return { success: false, error: 'Այս QR կոդն արդեն գրանցված է' };
    }

    const updated = await prisma.productUnit.update({
      where: { id: unitId },
      data: { qrCode: code },
      select: {
        id: true,
        qrCode: true,
        status: true,
        soldAt: true,
        verifiedAt: true,
        createdAt: true,
        orderItemId: true,
      },
    });

    revalidatePath('/admin/products');
    return { success: true, unit: updated };
  } catch (error: unknown) {
    console.error('[Update Product Unit QR] Error:', error);
    return { success: false, error: 'QR կոդը փոխելիս սխալ է տեղի ունեցել' };
  }
}

/** Միավոր ջնջել (միայն in_stock — վաճառվածները մնում են հարկի համար) */
export async function deleteProductUnit(unitId: number) {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  try {
    const unit = await prisma.productUnit.findUnique({
      where: { id: unitId },
      include: { product: { select: { id: true, category: true } } },
    });

    if (!unit) {
      return { success: false, error: 'Միավորը չի գտնվել' };
    }
    if (unit.status !== 'in_stock') {
      return {
        success: false,
        error: 'Վաճառված միավորները չեն ջնջվում՝ հարկային հաշվառման համար',
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.productUnit.delete({ where: { id: unitId } });
      const inStock = await tx.productUnit.count({
        where: { productId: unit.productId, status: 'in_stock' },
      });
      await tx.product.update({
        where: { id: unit.productId },
        data: { stock: inStock },
      });
    });

    const product = await prisma.product.findUnique({
      where: { id: unit.productId },
      select: { stock: true },
    });

    revalidatePath('/admin/products');
    revalidatePath('/admin/box-office');

    return {
      success: true,
      productId: unit.productId,
      stock: product?.stock ?? 0,
    };
  } catch (error: unknown) {
    console.error('[Delete Product Unit] Error:', error);
    return { success: false, error: 'Միավորը ջնջելիս սխալ է տեղի ունեցել' };
  }
}

export async function deleteProduct(id: number) {
  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        orderItems: true,
      },
    });

    if (!product) {
      return {
        success: false,
        error: 'Արտադրանքը չի գտնվել',
      };
    }

    // Check if product has been ordered
    if (product.orderItems.length > 0) {
      // Soft delete - just mark as inactive (keep image, product still referenced)
      await prisma.product.update({
        where: { id },
        data: { isActive: false },
      });
    } else {
      // Hard delete if no orders — also remove the image file from disk
      await prisma.product.delete({
        where: { id },
      });
      await deleteUploadedFile(product.image);
    }

    revalidatePath('/admin/products');
    revalidatePath('/checkout');
    revalidatePath('/admin/box-office');

    return {
      success: true,
      softDeleted: product.orderItems.length > 0,
      message:
        product.orderItems.length > 0
          ? 'Ապրանքը ապաակտիվացվեց (կան պատվերներ, ամբողջությամբ ջնջել հնարավոր չէ)'
          : 'Արտադրանքը հաջողությամբ ջնջվեց',
    };
  } catch (error: any) {
    console.error('[Delete Product] Error:', error);
    return {
      success: false,
      error: 'Արտադրանք ջնջելիս սխալ է տեղի ունեցել',
    };
  }
}
