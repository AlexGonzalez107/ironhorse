'use client';

import { useEffect, useState } from 'react';
import { UploadTrackerPanel } from '@/components/upload-tracker-panel';

export function UploadTrackerModal({
  triggerLabel = 'Upload tracker',
  triggerClassName,
}: {
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={triggerClassName || 'text-sm text-blue-400 hover:text-blue-300 transition-colors'}
      >
        {triggerLabel}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8">
          <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Upload Deal Tracker</h2>
                <p className="text-xs text-slate-400">Import deals from the All_deals sheet.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-slate-700/60 px-3 py-1 text-xs text-slate-200 hover:bg-slate-800"
              >
                Close
              </button>
            </div>
            <div className="max-h-[calc(90vh-72px)] overflow-y-auto px-6 py-6">
              <UploadTrackerPanel showBackLink={false} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
