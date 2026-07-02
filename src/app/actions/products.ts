'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { deleteUploadedFile } from '@/lib/delete-upload';

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

/** Ապրանքի միավորների ամփոփում՝ in_stock և վաճառված (հարկային հաշվառման համար) */
export async function getProductUnits(productId: number) {
  try {
    const [units, inStock, sold] = await Promise.all([
      prisma.productUnit.findMany({
        where: { productId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          qrCode: true,
          status: true,
          soldAt: true,
          createdAt: true,
        },
      }),
      prisma.productUnit.count({ where: { productId, status: 'in_stock' } }),
      prisma.productUnit.count({ where: { productId, status: 'sold' } }),
    ]);

    return { success: true, units, inStock, sold };
  } catch (error: any) {
    console.error('[Get Product Units] Error:', error);
    return {
      success: false,
      error: 'Միավորները բեռնելիս սխալ է տեղի ունեցել',
      units: [],
      inStock: 0,
      sold: 0,
    };
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
