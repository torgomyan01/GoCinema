'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Edit,
  Trash2,
  X,
  Save,
  Image as ImageIcon,
  ShoppingCart,
  PackagePlus,
  Boxes,
  QrCode,
  ScanLine,
  Tag,
  FileDown,
  CheckSquare,
  Square,
} from 'lucide-react';
import Image from 'next/image';
import AdminLayout from './admin-layout';
import FileUpload from './file-upload';
import {
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  restockProductUnits,
  restockProductQuantity,
} from '@/app/actions/products';
import { isQuantityOnlyProduct } from '@/lib/product-units';
import { openProductPriceTagsPdf } from '@/lib/product-price-tags';
import ProductUnitsModal from './product-units-modal';

interface AdminProductsClientProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    role: string;
  };
}

interface Product {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  costPrice: number;
  image?: string | null;
  category: string;
  stock: number;
  isActive: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  snack: 'Նախուտեստ',
  drink: 'Խմիչք',
  combo: 'Կոմբո',
  popcorn: 'Պոպկորն',
  iced_tea: 'Սառը թեյ',
  soda: 'Գազավորված խմիչք',
  candy: 'Քաղցրավենիք',
  hot_dog: 'Հոթ-դոգ',
  nachos: 'Նաչոս',
  coffee: 'Սրճարանային խմիչք',
  tea: 'Թեյ',
  juice: 'Հյութ',
  water: 'Ջուր',
  chips: 'Չիպս',
  chocolate: 'Շոկոլադ',
  ice_cream: 'Պաղպաղակ',
  sandwich: 'Սենդվիչ',
  pizza: 'Պիցցա',
  burger: 'Բուրգեր',
  salad: 'Աղցան',
  other: 'Այլ',
};

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

function getCategoryLabel(category: string) {
  return CATEGORY_LABELS[category] || category;
}

export default function AdminProductsClient({
  user,
}: AdminProductsClientProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    costPrice: '',
    image: '',
    category: 'snack',
    stock: '0',
    isActive: true,
  });

  // «Ավելացնել քանակ (QR սկան)» modal
  const [restockTarget, setRestockTarget] = useState<Product | null>(null);
  const [scannedCodes, setScannedCodes] = useState<string[]>([]);
  const [scanInput, setScanInput] = useState('');
  const [scanWarning, setScanWarning] = useState<string | null>(null);
  const [restockAmount, setRestockAmount] = useState('');
  const [isRestocking, setIsRestocking] = useState(false);

  // QR միավորների կառավարում
  const [unitsTarget, setUnitsTarget] = useState<Product | null>(null);

  // Գնապիտակների ընտրություն
  const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(
    () => new Set()
  );

  const handleProductStockUpdated = useCallback(
    (productId: number, stock: number) => {
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, stock } : p))
      );
    },
    []
  );

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const result = await getAllProducts();
      if (result.success && result.products) {
        setProducts(result.products as Product[]);
      }
    } catch (err) {
      console.error('Error loading products:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setSelectedProduct(null);
    setFormData({
      name: '',
      description: '',
      price: '',
      costPrice: '',
      image: '',
      category: 'snack',
      stock: '0',
      isActive: true,
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      costPrice: (product.costPrice ?? 0).toString(),
      image: product.image || '',
      category: product.category,
      stock: product.stock.toString(),
      isActive: product.isActive,
    });
    setIsEditModalOpen(true);
  };

  const handleCloseModals = () => {
    setIsAddModalOpen(false);
    setIsEditModalOpen(false);
    setSelectedProduct(null);
    setFormData({
      name: '',
      description: '',
      price: '',
      costPrice: '',
      image: '',
      category: 'snack',
      stock: '0',
      isActive: true,
    });
  };

  const openRestockModal = (product: Product) => {
    setRestockTarget(product);
    setScannedCodes([]);
    setScanInput('');
    setScanWarning(null);
    setRestockAmount('');
  };

  const closeRestockModal = () => {
    if (isRestocking) return;
    setRestockTarget(null);
    setScannedCodes([]);
    setScanInput('');
    setScanWarning(null);
    setRestockAmount('');
  };

  const handleAddScan = (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    if (scannedCodes.includes(code)) {
      setScanWarning(`«${code}» կոդն արդեն ավելացված է ցանկում`);
      setScanInput('');
      return;
    }
    setScannedCodes((prev) => [...prev, code]);
    setScanInput('');
    setScanWarning(null);
  };

  const handleRemoveScan = (code: string) => {
    setScannedCodes((prev) => prev.filter((c) => c !== code));
  };

  const handleRestockQuantity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockTarget) return;

    const amount = parseInt(restockAmount, 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      setScanWarning('Քանակը պետք է լինի 0-ից մեծ ամբողջ թիվ');
      return;
    }

    setIsRestocking(true);
    setStatusMessage(null);
    try {
      const result = await restockProductQuantity(restockTarget.id, amount);
      if (result.success && result.product) {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === restockTarget.id ? (result.product as Product) : p
          )
        );
        setStatusMessage({
          type: 'success',
          text: result.message || 'Քանակը ավելացվեց',
        });
        closeRestockModal();
      } else {
        setStatusMessage({
          type: 'error',
          text: result.error || 'Քանակ ավելացնելիս սխալ է տեղի ունեցել',
        });
      }
    } catch (err) {
      console.error('Error restocking product:', err);
      setStatusMessage({
        type: 'error',
        text: 'Քանակ ավելացնելիս սխալ է տեղի ունեցել',
      });
    } finally {
      setIsRestocking(false);
    }
  };

  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockTarget) return;

    if (scannedCodes.length === 0) {
      setScanWarning('Սկանավորեք առնվազն մեկ QR կոդ');
      return;
    }

    setIsRestocking(true);
    setStatusMessage(null);
    try {
      const result = await restockProductUnits(restockTarget.id, scannedCodes);
      if (result.success && result.product) {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === restockTarget.id ? (result.product as Product) : p
          )
        );
        setStatusMessage({
          type: 'success',
          text: result.message || 'Քանակը ավելացվեց',
        });
        closeRestockModal();
      } else {
        setStatusMessage({
          type: 'error',
          text: result.error || 'Քանակ ավելացնելիս սխալ է տեղի ունեցել',
        });
      }
    } catch (err) {
      console.error('Error restocking product:', err);
      setStatusMessage({
        type: 'error',
        text: 'Քանակ ավելացնելիս սխալ է տեղի ունեցել',
      });
    } finally {
      setIsRestocking(false);
    }
  };

  const handleDeleteProduct = (product: Product) => {
    setDeleteTarget(product);
  };

  const confirmDeleteProduct = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    setStatusMessage(null);
    try {
      const result = await deleteProduct(deleteTarget.id);
      if (result.success) {
        if (result.softDeleted) {
          setProducts((prev) =>
            prev.map((p) =>
              p.id === deleteTarget.id ? { ...p, isActive: false } : p
            )
          );
        } else {
          setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
        }
        setStatusMessage({
          type: 'success',
          text:
            result.message ||
            (result.softDeleted
              ? 'Ապրանքը ապաակտիվացվեց'
              : 'Արտադրանքը ջնջվեց'),
        });
        if (
          selectedProduct?.id === deleteTarget.id &&
          (isEditModalOpen || isAddModalOpen)
        ) {
          handleCloseModals();
        }
        setDeleteTarget(null);
      } else {
        setStatusMessage({
          type: 'error',
          text: result.error || 'Արտադրանք ջնջելիս սխալ է տեղի ունեցել',
        });
      }
    } catch (err) {
      console.error('Error deleting product:', err);
      setStatusMessage({
        type: 'error',
        text: 'Արտադրանք ջնջելիս սխալ է տեղի ունեցել',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const visibleProducts = showInactive
    ? products
    : products.filter((p) => p.isActive);

  const groupedProducts = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const product of visibleProducts) {
      const list = map.get(product.category) ?? [];
      list.push(product);
      map.set(product.category, list);
    }

    const ordered: { category: string; label: string; products: Product[] }[] =
      [];
    for (const category of CATEGORY_ORDER) {
      const items = map.get(category);
      if (items?.length) {
        ordered.push({
          category,
          label: getCategoryLabel(category),
          products: items,
        });
        map.delete(category);
      }
    }
    for (const [category, items] of map.entries()) {
      ordered.push({
        category,
        label: getCategoryLabel(category),
        products: items,
      });
    }
    return ordered;
  }, [visibleProducts]);

  const categoryTabs = useMemo(
    () => [
      { id: 'all', label: 'Բոլորը', count: visibleProducts.length },
      ...groupedProducts.map((g) => ({
        id: g.category,
        label: g.label,
        count: g.products.length,
      })),
    ],
    [groupedProducts, visibleProducts.length]
  );

  const displayedSections = useMemo(() => {
    if (activeCategory === 'all') return groupedProducts;
    return groupedProducts.filter((g) => g.category === activeCategory);
  }, [activeCategory, groupedProducts]);

  const displayedProducts = useMemo(
    () => displayedSections.flatMap((s) => s.products),
    [displayedSections]
  );

  const selectedTagProducts = useMemo(
    () => products.filter((p) => selectedTagIds.has(p.id)),
    [products, selectedTagIds]
  );

  const allDisplayedSelected =
    displayedProducts.length > 0 &&
    displayedProducts.every((p) => selectedTagIds.has(p.id));

  const toggleTagSelection = (productId: number) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const toggleSelectAllDisplayed = () => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (allDisplayedSelected) {
        for (const p of displayedProducts) next.delete(p.id);
      } else {
        for (const p of displayedProducts) next.add(p.id);
      }
      return next;
    });
  };

  const handlePrintPriceTags = (items: Product[]) => {
    if (items.length === 0) {
      setStatusMessage({
        type: 'error',
        text: 'Ընտրեք առնվազն մեկ ապրանք գնապիտակի համար',
      });
      return;
    }
    const ok = openProductPriceTagsPdf(
      items.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        category: p.category,
      }))
    );
    if (!ok) {
      setStatusMessage({
        type: 'error',
        text: 'Պատուհանը արգելափակված է։ Թույլատրեք popup-ները և կրկին փորձեք։',
      });
      return;
    }
    setStatusMessage({
      type: 'success',
      text:
        items.length === 1
          ? 'Գնապիտակը բացվեց · տպեք կամ պահեք որպես PDF'
          : `${items.length} գնապիտակ բացվեց · տպեք կամ պահեք որպես PDF`,
    });
  };

  const renderProductCard = (product: Product) => {
    const isTagSelected = selectedTagIds.has(product.id);
    return (
    <motion.div
      key={product.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative flex h-full flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md ${
        isTagSelected ? 'border-purple-400 ring-2 ring-purple-200' : 'border-gray-100'
      }`}
    >
      <button
        type="button"
        onClick={() => toggleTagSelection(product.id)}
        className={`absolute left-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg border bg-white/95 shadow-sm transition ${
          isTagSelected
            ? 'border-purple-500 text-purple-700'
            : 'border-gray-200 text-gray-400 hover:text-gray-700'
        }`}
        title={isTagSelected ? 'Հանել ընտրությունից' : 'Ընտրել գնապիտակի համար'}
      >
        {isTagSelected ? (
          <CheckSquare className="h-4 w-4" />
        ) : (
          <Square className="h-4 w-4" />
        )}
      </button>
      {product.image ? (
        <div className="relative aspect-[4/3] w-full bg-gray-100 sm:aspect-video">
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center bg-gray-100 text-gray-300 sm:aspect-video">
          <ImageIcon className="h-10 w-10 sm:h-12 sm:w-12" />
        </div>
      )}
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm font-bold text-gray-900 sm:text-base">
            {product.name}
          </h3>
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium sm:text-xs ${
              product.isActive
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {product.isActive ? 'Ակտիվ' : 'Անակտիվ'}
          </span>
        </div>

        {product.description && (
          <p className="mb-2 line-clamp-2 text-xs text-gray-500 sm:text-sm">
            {product.description}
          </p>
        )}

        <div className="mb-3">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold sm:text-xs ${
              product.stock <= 0
                ? 'bg-red-100 text-red-700'
                : product.stock <= 5
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-green-100 text-green-700'
            }`}
          >
            <Boxes className="h-3 w-3" />
            {product.stock <= 0 ? 'Առկա չէ' : `Պաշար՝ ${product.stock}`}
          </span>
        </div>

        <div className="mt-auto">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-lg font-bold text-gray-900 sm:text-xl">
                {product.price.toFixed(0)} ֏
              </span>
              <p className="text-[11px] text-gray-500">
                Ինքնաարժեք՝ {(product.costPrice ?? 0).toFixed(0)} ֏
                {(product.costPrice ?? 0) > 0 && (
                  <span className="ml-1 text-emerald-600">
                    · շահույթ{' '}
                    {(product.price - (product.costPrice ?? 0)).toFixed(0)} ֏
                  </span>
                )}
              </p>
            </div>
            <div className="flex shrink-0 gap-0.5 sm:gap-1">
              <button
                type="button"
                onClick={() => handlePrintPriceTags([product])}
                className="rounded-lg p-1.5 text-amber-700 transition-colors hover:bg-amber-50 sm:p-2"
                title="Գնապիտակ (PDF)"
              >
                <Tag className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => openRestockModal(product)}
                className="rounded-lg p-1.5 text-green-600 transition-colors hover:bg-green-50 sm:p-2"
                title={
                  isQuantityOnlyProduct(product.category)
                    ? 'Ավելացնել քանակ'
                    : 'Ավելացնել քանակ · QR սկան'
                }
              >
                <PackagePlus className="h-4 w-4" />
              </button>
              {!isQuantityOnlyProduct(product.category) && (
                <button
                  type="button"
                  onClick={() => setUnitsTarget(product)}
                  className="rounded-lg p-1.5 text-purple-600 transition-colors hover:bg-purple-50 sm:p-2"
                  title="QR միավորներ"
                >
                  <QrCode className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => handleOpenEditModal(product)}
                className="rounded-lg p-1.5 text-blue-600 transition-colors hover:bg-blue-50 sm:p-2"
                title="Խմբագրել"
              >
                <Edit className="h-4 w-4" />
              </button>
            <button
              type="button"
              onClick={() => handleDeleteProduct(product)}
              className="rounded-lg p-1.5 text-red-600 transition-colors hover:bg-red-50 sm:p-2"
              title="Ջնջել"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);

    try {
      if (isAddModalOpen) {
        const result = await createProduct({
          name: formData.name,
          description: formData.description || null,
          price: parseFloat(formData.price),
          costPrice: parseFloat(formData.costPrice) || 0,
          image: formData.image || null,
          category: formData.category as string,
          stock: parseInt(formData.stock, 10) || 0,
          isActive: formData.isActive,
        });

        if (result.success && result.product) {
          setProducts([...products, result.product as Product]);
          setStatusMessage({
            type: 'success',
            text: 'Արտադրանքը ավելացվեց',
          });
          handleCloseModals();
        } else {
          setStatusMessage({
            type: 'error',
            text: result.error || 'Արտադրանք ավելացնելիս սխալ է տեղի ունեցել',
          });
        }
      } else if (isEditModalOpen && selectedProduct) {
        const result = await updateProduct({
          id: selectedProduct.id,
          name: formData.name,
          description: formData.description || null,
          price: parseFloat(formData.price),
          costPrice: parseFloat(formData.costPrice) || 0,
          image: formData.image || null,
          category: formData.category as string,
          stock: parseInt(formData.stock, 10) || 0,
          isActive: formData.isActive,
        });

        if (result.success && result.product) {
          setProducts(
            products.map((p) =>
              p.id === selectedProduct.id ? (result.product as Product) : p
            )
          );
          setStatusMessage({
            type: 'success',
            text: 'Արտադրանքը թարմացվեց',
          });
          handleCloseModals();
        } else {
          setStatusMessage({
            type: 'error',
            text: result.error || 'Արտադրանք թարմացնելիս սխալ է տեղի ունեցել',
          });
        }
      }
    } catch (error) {
      console.error('Error saving product:', error);
      setStatusMessage({
        type: 'error',
        text: 'Արտադրանք պահպանելիս սխալ է տեղի ունեցել',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && products.length === 0) {
    return (
      <AdminLayout user={user}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout user={user}>
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="mb-1 text-2xl font-bold text-gray-900 sm:mb-2 sm:text-3xl">
              Արտադրանքների կառավարում
            </h1>
            <p className="text-sm text-gray-600 sm:text-base">
              Կարգավորեք նախուտեստները, խմիչքները և կոմբոներն
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <label className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 sm:flex-none sm:text-sm">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              Ցույց տալ անակտիվները
            </label>
            {displayedProducts.length > 0 && (
              <button
                type="button"
                onClick={toggleSelectAllDisplayed}
                className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50 sm:text-sm"
                title={
                  allDisplayedSelected
                    ? 'Հանել բոլոր ընտրությունները'
                    : 'Ընտրել երևացող բոլոր ապրանքները'
                }
              >
                {allDisplayedSelected ? (
                  <CheckSquare className="h-4 w-4 text-purple-600" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                {allDisplayedSelected ? 'Հանել ընտրությունը' : 'Ընտրել բոլորը'}
              </button>
            )}
            <button
              type="button"
              onClick={() => handlePrintPriceTags(selectedTagProducts)}
              disabled={selectedTagIds.size === 0}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                selectedTagIds.size === 0
                  ? 'cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400'
                  : 'border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
              }`}
              title="Ընտրված ապրանքների գնապիտակներ PDF"
            >
              <FileDown className="h-4 w-4" />
              Գնապիտակներ
              {selectedTagIds.size > 0 ? ` (${selectedTagIds.size})` : ''}
            </button>
            <button
              onClick={handleOpenAddModal}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm text-white transition-colors hover:bg-purple-700 sm:flex-none"
            >
              <Plus className="h-4 w-4" />
              <span className="sm:inline">Ավելացնել</span>
            </button>
          </div>
        </div>

        {statusMessage && (
          <div
            className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
              statusMessage.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        {/* Բաժինների ֆիլտր */}
        {categoryTabs.length > 1 && (
          <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-gray-200 bg-gray-50/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:mb-6 sm:px-6">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {categoryTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCategory(tab.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition sm:px-4 sm:py-2 sm:text-sm ${
                    activeCategory === tab.id
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold sm:text-xs ${
                      activeCategory === tab.id
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Արտադրանքներ՝ բաժիններով */}
        {visibleProducts.length === 0 ? (
          <div className="rounded-lg bg-gray-50 py-12 text-center">
            <ShoppingCart className="mx-auto mb-4 h-16 w-16 text-gray-400" />
            <p className="mb-4 text-gray-600">
              {products.length === 0
                ? 'Արտադրանքներ չկան'
                : 'Ակտիվ արտադրանքներ չկան'}
            </p>
            <button
              onClick={handleOpenAddModal}
              className="rounded-lg bg-purple-600 px-4 py-2 text-white transition-colors hover:bg-purple-700"
            >
              Ավելացնել արտադրանք
            </button>
          </div>
        ) : (
          <div className="space-y-8 sm:space-y-10">
            {displayedSections.map((section) => (
              <section key={section.category} id={`category-${section.category}`}>
                <div className="mb-3 flex items-center justify-between sm:mb-4">
                  <h2 className="text-base font-bold text-gray-900 sm:text-lg">
                    {section.label}
                  </h2>
                  <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-700">
                    {section.products.length}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {section.products.map((product) => renderProductCard(product))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Add/Edit Modal */}
        <AnimatePresence>
          {(isAddModalOpen || isEditModalOpen) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={handleCloseModals}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {isAddModalOpen
                      ? 'Ավելացնել արտադրանք'
                      : 'Խմբագրել արտադրանք'}
                  </h2>
                  <button
                    onClick={handleCloseModals}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Անվանում *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Նկարագրություն
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Վաճառքի գին (֏) *
                      </label>
                      <input
                        type="number"
                        value={formData.price}
                        onChange={(e) =>
                          setFormData({ ...formData, price: e.target.value })
                        }
                        min="0"
                        step="0.01"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Ինքնաարժեք (֏)
                      </label>
                      <input
                        type="number"
                        value={formData.costPrice}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            costPrice: e.target.value,
                          })
                        }
                        min="0"
                        step="0.01"
                        placeholder="0"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Գնումի արժեքը՝ շահույթի հաշվարկի համար
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Կատեգորիա *
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          category: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      required
                    >
                      <option value="snack">Նախուտեստ</option>
                      <option value="drink">Խմիչք</option>
                      <option value="combo">Կոմբո</option>
                      <option value="popcorn">Պոպկորն</option>
                      <option value="iced_tea">Սառը թեյ</option>
                      <option value="soda">Գազավորված խմիչք</option>
                      <option value="candy">Քաղցրավենիք</option>
                      <option value="hot_dog">Հոթ-դոգ</option>
                      <option value="nachos">Նաչոս</option>
                      <option value="coffee">Սրճարանային խմիչք</option>
                      <option value="tea">Թեյ</option>
                      <option value="juice">Հյութ</option>
                      <option value="water">Ջուր</option>
                      <option value="chips">Չիպս</option>
                      <option value="chocolate">Շոկոլադ</option>
                      <option value="ice_cream">Պաղպաղակ</option>
                      <option value="sandwich">Սենդվիչ</option>
                      <option value="pizza">Պիցցա</option>
                      <option value="burger">Բուրգեր</option>
                      <option value="salad">Աղցան</option>
                      <option value="other">Այլ</option>
                    </select>
                  </div>

                  <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      {isQuantityOnlyProduct(formData.category) ? (
                        <Boxes className="h-4 w-4 text-green-600" />
                      ) : (
                        <ScanLine className="h-4 w-4 text-green-600" />
                      )}
                      {isQuantityOnlyProduct(formData.category)
                        ? `${getCategoryLabel(formData.category)}-ը հաշվառվում է քանակով`
                        : 'Պաշարը կառավարվում է QR-սկանավորմամբ'}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {isQuantityOnlyProduct(formData.category)
                        ? 'Քանակ ավելացնելու համար օգտագործեք «Ավելացնել քանակ» կոճակը։'
                        : 'Քանակ ավելացնելու համար սկանավորեք ամեն միավորի QR կոդը։'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Նկար URL
                    </label>
                    <FileUpload
                      value={formData.image}
                      onChange={(url) =>
                        setFormData({ ...formData, image: url })
                      }
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={(e) =>
                        setFormData({ ...formData, isActive: e.target.checked })
                      }
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <label htmlFor="isActive" className="text-sm text-gray-700">
                      Ակտիվ
                    </label>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {isSaving ? 'Պահպանվում է...' : 'Պահպանել'}
                    </button>
                    {isEditModalOpen && selectedProduct && (
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(selectedProduct)}
                        disabled={isSaving || isDeleting}
                        className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Ջնջել
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleCloseModals}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Չեղարկել
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete confirmation modal */}
        <AnimatePresence>
          {deleteTarget && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
              onClick={() => !isDeleting && setDeleteTarget(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
              >
                <h3 className="text-lg font-bold text-gray-900">
                  Ջնջել արտադրանքը՞
                </h3>
                <p className="mt-2 text-sm text-gray-600">
                  «{deleteTarget.name}» — եթե ապրանքը արդեն պատվերներում է
                  օգտագործվել, այն կապաակտիվացվի և չի երևա դրամարկղում։ Եթե
                  պատվերներ չկան, ամբողջությամբ կջնջվի։
                </p>
                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => setDeleteTarget(null)}
                    disabled={isDeleting}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Չեղարկել
                  </button>
                  <button
                    onClick={confirmDeleteProduct}
                    disabled={isDeleting}
                    className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                  >
                    {isDeleting ? 'Ջնջվում է...' : 'Ջնջել'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Ավելացնել քանակ modal — պոպկորն (քանակ) կամ մնացած (QR) */}
        <AnimatePresence>
          {restockTarget && isQuantityOnlyProduct(restockTarget.category) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
              onClick={closeRestockModal}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-700">
                    <PackagePlus className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      Ավելացնել քանակ
                    </h3>
                    <p className="text-sm text-gray-600">
                      «{restockTarget.name}» · ընթացիկ պաշար՝{' '}
                      <span className="font-semibold">
                        {restockTarget.stock}
                      </span>
                    </p>
                  </div>
                </div>

                <form onSubmit={handleRestockQuantity} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Ավելացվող քանակ
                    </label>
                    <input
                      type="number"
                      autoFocus
                      value={restockAmount}
                      onChange={(e) => setRestockAmount(e.target.value)}
                      min="1"
                      step="1"
                      placeholder="Օր.՝ 50"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    {restockAmount && parseInt(restockAmount, 10) > 0 && (
                      <p className="mt-1 text-xs text-gray-500">
                        Նոր պաշարը կլինի՝{' '}
                        <span className="font-semibold text-green-700">
                          {restockTarget.stock +
                            (parseInt(restockAmount, 10) || 0)}
                        </span>
                      </p>
                    )}
                    {scanWarning && (
                      <p className="mt-1 text-xs font-medium text-amber-600">
                        {scanWarning}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={closeRestockModal}
                      disabled={isRestocking}
                      className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Չեղարկել
                    </button>
                    <button
                      type="submit"
                      disabled={isRestocking}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
                    >
                      <PackagePlus className="h-4 w-4" />
                      {isRestocking ? 'Ավելացվում է...' : 'Ավելացնել'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}

          {restockTarget && !isQuantityOnlyProduct(restockTarget.category) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
              onClick={closeRestockModal}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-700">
                    <ScanLine className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      Ավելացնել քանակ · QR սկան
                    </h3>
                    <p className="text-sm text-gray-600">
                      «{restockTarget.name}» · ընթացիկ պաշար՝{' '}
                      <span className="font-semibold">
                        {restockTarget.stock}
                      </span>
                    </p>
                  </div>
                </div>

                <form onSubmit={handleRestock} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Սկանավորեք ամեն միավորի QR կոդը
                    </label>
                    <div className="relative">
                      <QrCode className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        autoFocus
                        value={scanInput}
                        onChange={(e) => setScanInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddScan(scanInput);
                          }
                        }}
                        placeholder="Սկանավորեք կամ մուտքագրեք կոդը"
                        className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Ապարատային սկաները ավտոմատ ավելացնում է կոդը (Enter)։ Ամեն
                      միավոր՝ առանձին QR։
                    </p>
                    {scanWarning && (
                      <p className="mt-1 text-xs font-medium text-amber-600">
                        {scanWarning}
                      </p>
                    )}
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        Սկանավորված միավորներ
                      </span>
                      <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-sm font-bold text-green-700">
                        {scannedCodes.length}
                      </span>
                    </div>
                    {scannedCodes.length === 0 ? (
                      <p className="py-4 text-center text-sm text-gray-400">
                        Դեռ սկանավորված կոդ չկա
                      </p>
                    ) : (
                      <div className="max-h-52 space-y-1.5 overflow-y-auto">
                        {scannedCodes.map((code, idx) => (
                          <div
                            key={code}
                            className="flex items-center justify-between gap-2 rounded-md bg-white px-3 py-1.5 text-sm shadow-sm"
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <span className="text-xs text-gray-400">
                                {idx + 1}.
                              </span>
                              <span className="truncate font-mono text-gray-800">
                                {code}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveScan(code)}
                              disabled={isRestocking}
                              className="shrink-0 rounded p-1 text-red-500 hover:bg-red-50 disabled:opacity-50"
                              title="Հեռացնել"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {scannedCodes.length > 0 && (
                      <p className="mt-2 text-xs text-gray-500">
                        Նոր պաշարը կլինի՝{' '}
                        <span className="font-semibold text-green-700">
                          {restockTarget.stock + scannedCodes.length}
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={closeRestockModal}
                      disabled={isRestocking}
                      className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Չեղարկել
                    </button>
                    <button
                      type="submit"
                      disabled={isRestocking || scannedCodes.length === 0}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
                    >
                      <PackagePlus className="h-4 w-4" />
                      {isRestocking
                        ? 'Ավելացվում է...'
                        : `Ավելացնել ${scannedCodes.length} միավոր`}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* QR միավորների կառավարում */}
        <AnimatePresence>
          {unitsTarget && (
            <ProductUnitsModal
              key={unitsTarget.id}
              product={unitsTarget}
              onClose={() => setUnitsTarget(null)}
              onStockUpdated={handleProductStockUpdated}
            />
          )}
        </AnimatePresence>
      </div>
    </AdminLayout>
  );
}
