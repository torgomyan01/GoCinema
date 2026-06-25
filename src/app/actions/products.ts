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
        stock:
          data.stock !== undefined && Number.isFinite(data.stock)
            ? Math.max(0, Math.floor(data.stock))
            : 0,
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
        ...(data.stock !== undefined &&
          Number.isFinite(data.stock) && {
            stock: Math.max(0, Math.floor(data.stock)),
          }),
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
 * Ապրանքին քանակ ավելացնել (restock)։ `amount`-ը ավելացվում է առկա պաշարին։
 */
export async function restockProduct(id: number, amount: number) {
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
      message: `Ավելացվեց ${qty} միավոր։ Ընդհանուր պաշարը՝ ${product.stock}`,
    };
  } catch (error: any) {
    console.error('[Restock Product] Error:', error);
    return {
      success: false,
      error: 'Քանակ լրացնելիս սխալ է տեղի ունեցել',
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
