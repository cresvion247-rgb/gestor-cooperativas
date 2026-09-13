import React from 'react';
import StatusBadge from '@/components/erp/StatusBadge';
import { useI18n } from '@/lib/i18n';

const cellValue = (row, c) => (c.render ? c.render(row[c.key], row) : row[c.key] ?? '—');

export default function DataTable({ columns, rows, empty }) {
  const { t } = useI18n();
  const emptyMessage = empty || t('common.empty');
  const dataCols = columns.filter(c => c.key !== 'acciones');
  const actionCols = columns.filter(c => c.key === 'acciones');
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Escritorio: tabla completa */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>{columns.map(c => <th key={c.key} className="px-5 py-3.5 font-semibold">{c.label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, i) => (
              <tr key={row.id || i} className="transition hover:bg-slate-50">
                {columns.map(c => (
                  <td key={c.key} className="whitespace-nowrap px-5 py-4 text-slate-700">{c.badge ? <StatusBadge value={row[c.key]} /> : cellValue(row, c)}</td>
                ))}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={columns.length} className="px-5 py-12 text-center text-slate-400">{emptyMessage}</td></tr>}
          </tbody>
        </table>
      </div>
      {/* Móvil y tablet estrecha: fichas apiladas con los campos clave */}
      <div className="divide-y divide-slate-100 md:hidden">
        {rows.map((row, i) => (
          <div key={row.id || i} className="p-4">
            {dataCols.map((c, idx) => (
              idx === 0 ? (
                <div key={c.key} className="mb-1 break-words text-sm font-semibold text-slate-900">{cellValue(row, c)}</div>
              ) : (
                <div key={c.key} className="flex flex-col gap-0.5 py-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{c.label}</p>
                  <div className="break-words text-sm text-slate-700">{c.badge ? <StatusBadge value={row[c.key]} /> : cellValue(row, c)}</div>
                </div>
              )
            ))}
            {actionCols.length > 0 && actionCols.some(c => cellValue(row, c)) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {actionCols.map(c => <React.Fragment key={c.key}>{cellValue(row, c)}</React.Fragment>)}
              </div>
            )}
          </div>
        ))}
        {!rows.length && <p className="px-5 py-12 text-center text-slate-400">{emptyMessage}</p>}
      </div>
    </div>
  );
}