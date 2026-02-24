'use client';

import { useState, useEffect, useCallback } from 'react';
import { StudentWithStats } from '@/app/actions/admin-students';
import { updateStudentInfo } from '@/app/actions/admin-students';
import { useRouter } from 'next/navigation';
import { getImageUrl } from '@/utils/image-utils';

interface StudentReviewFormProps {
  student: StudentWithStats;
}

export default function StudentReviewForm({ student }: StudentReviewFormProps) {
  const router = useRouter();
  const [name, setName] = useState(student.name || '');
  const [photo, setPhoto] = useState<string | null>(student.photo);
  const [examResult, setExamResult] = useState(student.examResult || '');
  const [review, setReview] = useState(student.review || '');
  const [imagePreview, setImagePreview] = useState<string | null>(
    student.photo ? getImageUrl(student.photo) : null
  );
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // If approved, show read-only view
  if (student.isApproved) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-6">
          {student.photo ? (
            <img
              src={getImageUrl(student.photo)}
              alt={student.name || 'Student'}
              className="w-32 h-32 object-cover rounded-full border-4 border-[#FA8604]"
            />
          ) : (
            <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center border-4 border-[#FA8604]">
              <i className="fas fa-user text-gray-400 text-4xl"></i>
            </div>
          )}
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-2xl font-bold text-[#1A2229] mb-2">
              {student.name || 'Անանուն'}
            </h3>
            {student.examResult && (
              <p className="text-[#FA8604] text-lg font-semibold">
                Քննական արդյունք: {student.examResult}
              </p>
            )}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#1A2229] mb-2">
            Ձեր կարծիքը
          </label>
          <div className="bg-gray-50 border border-gray-200 rounded-[10px] px-4 py-3 min-h-[200px]">
            <p className="text-sm text-[#1A2229] whitespace-pre-wrap">
              {student.review || 'Կարծիք դեռ չի գրվել'}
            </p>
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          <div className="flex items-center gap-2">
            <i className="fas fa-check-circle"></i>
            <span>Ձեր կարծիքը հաստատված է</span>
          </div>
        </div>
      </div>
    );
  }

  const handleImageFile = useCallback(async (file: File) => {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
    ];
    if (!allowedTypes.includes(file.type)) {
      setError('Միայն նկարներ են թույլատրված (JPG, PNG, GIF, WEBP)');
      return;
    }

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      setError('Ֆայլի չափը չպետք է գերազանցի 50MB');
      return;
    }

    setUploadingImage(true);
    setError('');

    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const response = await fetch('/api/admin/upload-image', {
        method: 'POST',
        body: uploadFormData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Սխալ է տեղի ունեցել');
      }

      const filename = result.filename;
      setPhoto(filename);
      setImagePreview(result.url || getImageUrl(filename));
    } catch (err: any) {
      setError(err.message || 'Նկարի բեռնումը ձախողվեց');
      setImagePreview(null);
    } finally {
      setUploadingImage(false);
    }
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleImageFile(file);
  };

  const handleRemoveImage = () => {
    setPhoto(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      // Validate required fields
      if (!name.trim()) {
        setError('Անունը պարտադիր է');
        setLoading(false);
        return;
      }

      if (!photo) {
        setError('Նկարը պարտադիր է');
        setLoading(false);
        return;
      }

      if (!examResult.trim()) {
        setError('Քննական թեստի արդյունքը պարտադիր է');
        setLoading(false);
        return;
      }

      // Validate review length - must be at least 150 characters
      if (!review.trim() || review.trim().length < 150) {
        setError('Կարծիքը պետք է լինի առնվազն 150 նիշ');
        setLoading(false);
        return;
      }

      const result = await updateStudentInfo(student.uniqueToken, {
        name: name.trim(),
        photo,
        examResult: examResult.trim(),
        review: review.trim(),
      });

      if (!result.success) {
        setError(result.error || 'Սխալ է տեղի ունեցել');
      } else {
        setSuccess(true);
        router.refresh();
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err: any) {
      setError(err.message || 'Սխալ է տեղի ունեցել');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-[#1A2229] mb-2">
          Անուն *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Մուտքագրեք ձեր անունը"
          className="w-full border border-gray-300 rounded-[10px] px-4 py-2 focus:outline-none focus:border-[#FA8604]"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#1A2229] mb-2">
          Նկար *
        </label>
        {imagePreview ? (
          <div className="relative inline-block">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-32 h-32 object-cover rounded-[10px] border border-gray-300"
            />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
            >
              ×
            </button>
          </div>
        ) : (
          <div className="border-2 border-dashed border-gray-300 rounded-[10px] p-6 text-center">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={uploadingImage}
              className="hidden"
              id="photo-upload"
            />
            <label
              htmlFor="photo-upload"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <i className="fas fa-cloud-upload-alt text-3xl text-[#8D8D8D]"></i>
              <span className="text-sm text-[#8D8D8D]">
                {uploadingImage
                  ? 'Բեռնվում է...'
                  : 'Կտտացրեք նկար ավելացնելու համար'}
              </span>
            </label>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-[#1A2229] mb-2">
          Հանձնած քննական թեստի արդյունք *
        </label>
        <input
          type="text"
          value={examResult}
          onChange={(e) => setExamResult(e.target.value)}
          required
          placeholder="Օրինակ: 25/30"
          className="w-full border border-gray-300 rounded-[10px] px-4 py-2 focus:outline-none focus:border-[#FA8604]"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#1A2229] mb-2">
          Ձեր կարծիքը մեր ավտոդպրոցի մասին *
        </label>
        <textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          rows={12}
          minLength={150}
          required
          placeholder="Գրեք ձեր կարծիքը ավտոդպրոցի մասին (առնվազն 150 նիշ)..."
          className={`w-full border rounded-[10px] px-4 py-3 focus:outline-none resize-y min-h-[200px] ${
            review.length > 0 && review.length < 150
              ? 'border-orange-300 focus:border-orange-500'
              : 'border-gray-300 focus:border-[#FA8604]'
          }`}
        />
        <p
          className={`text-sm mt-2 ${
            review.length > 0 && review.length < 150
              ? 'text-orange-600 font-medium'
              : review.length >= 150
                ? 'text-green-600'
                : 'text-[#8D8D8D]'
          }`}
        >
          {review.length} նիշ
          {review.length > 0 && review.length < 150 && (
            <span> (պակասում է {150 - review.length} նիշ)</span>
          )}
          {review.length >= 150 && (
            <span className="ml-2">
              <i className="fas fa-check-circle"></i> Բավարար է
            </span>
          )}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          Տվյալները հաջողությամբ պահպանվել են
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading || uploadingImage}
          className="px-6 py-2 rounded-[10px] bg-[#FA8604] hover:bg-[#FA8604]/90 text-white font-medium transition-colors disabled:opacity-50"
        >
          {loading ? 'Պահպանում...' : 'Պահպանել'}
        </button>
      </div>
    </form>
  );
}
