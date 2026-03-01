'use client';

import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import Image from 'next/image';

interface FileUploadProps {
  value?: string;
  onChange: (url: string) => void;
  label?: string;
  required?: boolean;
}

/**
 * Resolves an image URL for display. Old records may store bare filenames
 * (e.g. "/upload/foo.jpg" or "1234-abc.jpg") — we normalise them all to the
 * /api/files/<filename> route so they go through the filesystem handler.
 */
function resolvePreviewUrl(url: string): string {
  if (!url) return url;
  // Already a proper API files URL or an external http(s) URL — use as-is
  if (url.startsWith('/api/files/') || url.startsWith('http')) return url;
  // Legacy public/upload path stored as "/upload/filename"
  if (url.startsWith('/upload/')) {
    return `/api/files/${url.replace('/upload/', '')}`;
  }
  // Bare filename
  return `/api/files/${url}`;
}

export default function FileUpload({
  value,
  onChange,
  label = 'Նկար',
  required = false,
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(value ? resolvePreviewUrl(value) : null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setError('Միայն նկարների ֆայլեր են թույլատրված (JPEG, PNG, WebP, GIF)');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setError('Ֆայլի չափը չպետք է գերազանցի 5MB');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      // Create FormData
      const formData = new FormData();
      formData.append('file', file);

      // Upload file
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ֆայլի ներբեռնումը ձախողվեց');
      }

      // Update preview and call onChange
      setPreview(resolvePreviewUrl(data.url));
      onChange(data.url);
    } catch (err: any) {
      setError(err.message || 'Ֆայլի ներբեռնումը ձախողվեց');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    // Delete the file from the server if it's a local upload
    if (preview && preview.startsWith('/api/files/')) {
      const filename = preview.replace('/api/files/', '');
      try {
        await fetch(`/api/files/${filename}`, { method: 'DELETE' });
      } catch {
        // Non-blocking — clear UI regardless
      }
    }

    setPreview(null);
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {preview ? (
        <div className="relative">
          <div className="relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-300">
            <Image
              src={preview}
              alt="Preview"
              fill
              className="object-cover"
            />
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          onClick={handleClick}
          className={`relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isUploading
              ? 'border-purple-400 bg-purple-50'
              : 'border-gray-300 hover:border-purple-400 hover:bg-gray-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />

          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
              <p className="text-sm text-gray-600">Ներբեռնվում է...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Upload className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">
                  Կտտացրեք նկար ավելացնելու համար
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  JPEG, PNG, WebP, GIF (առավելագույն 5MB)
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}

      {preview && (
        <p className="mt-2 text-xs text-gray-500 truncate">{preview}</p>
      )}
    </div>
  );
}
