'use client';

import { useRef, useState } from 'react';
import { FileText, Loader2, Upload, X } from 'lucide-react';

type Props = {
  url?: string;
  fileName?: string;
  onChange: (next: { url: string; fileName: string }) => void;
  label?: string;
  deleteOnRemove?: boolean;
};

export default function DocumentUpload({
  url,
  fileName,
  onChange,
  label = 'Պայմանագիր',
  deleteOnRemove = true,
}: Props) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedExts = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp'];
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!allowedExts.includes(ext)) {
      setError('Թույլատրվում են PDF, Word և նկար ֆայլեր');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setError('Ֆայլի չափը չպետք է գերազանցի 15MB');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('kind', 'document');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Ֆայլի ներբեռնումը ձախողվեց');
      }

      onChange({
        url: data.url,
        fileName: data.originalName || file.name,
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Ֆայլի ներբեռնումը ձախողվեց'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    if (deleteOnRemove && url?.startsWith('/api/files/')) {
      const filename = url.replace('/api/files/', '');
      try {
        await fetch(`/api/files/${filename}`, { method: 'DELETE' });
      } catch {
        // Non-blocking
      }
    }
    onChange({ url: '', fileName: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>

      {url ? (
        <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <FileText className="h-5 w-5 shrink-0 text-purple-600" />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 flex-1 truncate text-sm font-medium text-purple-700 hover:underline"
          >
            {fileName || 'Պայմանագիր'}
          </a>
          <button
            type="button"
            onClick={() => void handleRemove()}
            className="rounded-full p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
            aria-label="Հեռացնել"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`relative cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
            isUploading
              ? 'border-purple-400 bg-purple-50'
              : 'border-gray-300 hover:border-purple-400 hover:bg-gray-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,image/jpeg,image/png,image/webp"
            onChange={(e) => void handleFileSelect(e)}
            className="hidden"
            disabled={isUploading}
          />
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              <p className="text-sm text-gray-600">Ներբեռնվում է...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
                <Upload className="h-6 w-6 text-purple-600" />
              </div>
              <p className="text-sm font-medium text-gray-700">
                Կցել ֆիլմի պայմանագիրը
              </p>
              <p className="text-xs text-gray-500">PDF, Word, նկար · մինչև 15MB</p>
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
