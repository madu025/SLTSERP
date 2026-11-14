'use client';

import { Download } from 'lucide-react';
import { downloadCsv, type CsvCell } from '@/lib/csv-export';

interface Props {
    filename: string;
    /** Called on click so the export always reflects what is on screen. */
    getRows: () => CsvCell[][];
    disabled?: boolean;
    className?: string;
}

export default function ExportCsvButton({ filename, getRows, disabled, className = '' }: Props) {
    return (
        <button
            type="button"
            onClick={() => downloadCsv(filename, getRows())}
            disabled={disabled}
            className={`inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-50 ${className}`}
        >
            <Download className="h-4 w-4" />Export CSV
        </button>
    );
}
