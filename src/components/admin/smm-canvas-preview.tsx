import { Loader2 } from 'lucide-react';
import type { RefObject } from 'react';

type Props = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  overlayRef: RefObject<HTMLDivElement | null>;
  width: number;
  height: number;
  maxWidthClass?: string;
};

export default function SmmCanvasPreview({
  canvasRef,
  overlayRef,
  width,
  height,
  maxWidthClass = 'max-w-[280px]',
}: Props) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-950 p-4 shadow-sm">
      <p className="mb-3 text-center text-xs font-medium text-gray-400">
        Նախադիտում · {width}×{height}
      </p>
      <div
        className={`relative mx-auto w-full overflow-hidden rounded-2xl border border-white/10 bg-black ${maxWidthClass}`}
      >
        <div
          ref={overlayRef}
          hidden
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/40"
        >
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </div>
        <canvas
          ref={canvasRef}
          className="block h-auto w-full"
          style={{ aspectRatio: `${width} / ${height}` }}
        />
      </div>
    </div>
  );
}
