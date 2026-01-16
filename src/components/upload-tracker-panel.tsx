'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { Deal } from '@/lib/types';

type UploadResult = {
  added: number;
  skipped: number;
  errors: string[];
};

type UploadApiResponse = {
  added?: number;
  skipped?: number;
  deals?: Deal[];
  error?: string;
};

export function UploadTrackerPanel({
  showBackLink = true,
}: {
  showBackLink?: boolean;
}) {
  const { addDeals } = useStore();
  const [result, setResult] = useState<UploadResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const sampleColumns = useMemo(
    () => [
      'Property Link',
      'File Type',
      'Property Name',
      'Status',
      'Type',
      'Address',
      'Listing Broker',
      'Brokerage Shop',
      'City',
      'St',
      'ZIP',
      'Units',
      'NOI',
      'Rate',
      'Asking Price',
      'Buy Box Check',
    ],
    []
  );

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload-tracker', {
        method: 'POST',
        body: formData,
      });
      const payload = (await response.json()) as UploadApiResponse;

      if (!response.ok) {
        setResult({
          added: 0,
          skipped: 0,
          errors: [payload.error || 'Failed to parse the file.'],
        });
        return;
      }

      const deals = Array.isArray(payload.deals) ? (payload.deals as Deal[]) : [];
      const skipped = typeof payload.skipped === 'number' ? payload.skipped : 0;

      addDeals(deals);
      setResult({ added: deals.length, skipped, errors: [] });
    } catch {
      setResult({
        added: 0,
        skipped: 0,
        errors: ['Failed to parse the file.'],
      });
    } finally {
      setIsLoading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-100 tracking-tight mb-2">Upload Deal Tracker</h1>
          <p className="text-slate-400">
            Upload a formatted .xlsx tracker. Deals will be created from the All_deals sheet.
          </p>
        </div>
        {showBackLink && (
          <Link
            href="/evaluation"
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Back to pipeline
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-slate-100">Upload file</h2>
            <p className="text-sm text-slate-400 mt-1">
              Only .xlsx files are supported. The parser reads the All_deals sheet.
            </p>

            <label className="mt-4 flex flex-col items-center justify-center border border-dashed border-slate-600/60 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500/60 hover:bg-slate-900/40 transition-colors">
              <input
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="text-sm text-slate-300 font-semibold">
                {isLoading ? 'Analyzing tracker...' : 'Click to upload'}
              </div>
              {isLoading ? (
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                  Parsing rows and validating fields
                </div>
              ) : (
                <div className="text-xs text-slate-500 mt-1">Maximum size depends on browser limits</div>
              )}
            </label>
          </div>

          {result && (
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-slate-100">Import summary</h2>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <p className="text-xs text-slate-500">Deals added</p>
                  <p className="text-2xl font-bold text-emerald-400">{result.added}</p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <p className="text-xs text-slate-500">Status</p>
                  <p className="text-2xl font-bold text-blue-300">
                    {result.added > 0 ? 'Imported' : 'No deals'}
                  </p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="mt-4 text-sm text-red-400">
                  {result.errors.map(err => (
                    <div key={err}>{err}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-slate-100">Expected columns</h2>
            <p className="text-sm text-slate-400 mt-1">
              The parser maps common headers. Keep these in the All_deals sheet.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {sampleColumns.map(column => (
                <span
                  key={column}
                  className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-900/60 text-slate-300"
                >
                  {column}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-700/60 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-slate-100">Asset types</h2>
            <p className="text-sm text-slate-400 mt-1">
              Supported values: Multifamily, Retail, Office, Industrial, Mixed Use.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
