'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Edit,
  Trash2,
  X,
  Save,
  Image as ImageIcon,
  ShoppingCart,
} from 'lucide-react';
import Image from 'next/image';
import AdminLayout from './admin-layout';
import FileUpload from './file-upload';
import {
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from '@/app/actions/products';

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
  image?: string | null;
  category: string;
  isActive: boolean;
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
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    image: '',
    category: 'snack',
    isActive: true,
  });

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
      image: '',
      category: 'snack',
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
      image: product.image || '',
      category: product.category,
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
      image: '',
      category: 'snack',
      isActive: true,
    });
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
          image: formData.image || null,
          category: formData.category as string,
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
          image: formData.image || null,
          category: formData.category as string,
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

  const getCategoryLabel = (category: string) => {
    const categoryLabels: Record<string, string> = {
      snack: 'Նախուտեստ',
      drink: 'Խմիչք',
      combo: 'Կոմբո',
      popcorn: 'Պոպկորն',
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
    return categoryLabels[category] || category;
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
      <div className="p-6">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Արտադրանքների կառավարում
            </h1>
            <p className="text-gray-600">
              Կարգավորեք նախուտեստները, խմիչքները և կոմբոներն
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              Ցույց տալ անակտիվները
            </label>
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Ավելացնել արտադրանք
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

        {/* Products Grid */}
        {visibleProducts.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <ShoppingCart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">
              {products.length === 0
                ? 'Արտադրանքներ չկան'
                : 'Ակտիվ արտադրանքներ չկան'}
            </p>
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Ավելացնել արտադրանք
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleProducts.map((product) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
              >
                {product.image && (
                  <div className="relative w-full h-48 bg-gray-200">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-6">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-xl font-bold text-gray-900">
                      {product.name}
                    </h3>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        product.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {product.isActive ? 'Ակտիվ' : 'Անակտիվ'}
                    </span>
                  </div>
                  <p className="text-sm text-purple-600 mb-2">
                    {getCategoryLabel(product.category)}
                  </p>
                  {product.description && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                      {product.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-gray-900">
                      {product.price.toFixed(0)} ֏
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenEditModal(product)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Խմբագրել"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Ջնջել"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
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
                        Գին (֏) *
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
                  օգտագործվել, այն կապաակտիվացվի և չի երևա դրամարկղում։
                  Եթե պատվերներ չկան, ամբողջությամբ կջնջվի։
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
      </div>
    </AdminLayout>
  );
}
