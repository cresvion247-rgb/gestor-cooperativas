import React from 'react';
import { useI18n } from '@/lib/i18n';

/** Active | Archived segmented control with counts. */
export default function ArchiveTabs({ value, onChange, activeCount = 0, archivedCount = 0, className = '' }) {
  const { t } = useI18n();
  const tabs = [
    { id: 'active', label: t('archive.active'), count: activeCount },
    { id: 'archived', label: t('archive.archived'), count: archivedCount },
  ];
  return (
    <div className={`mb-4 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm ${className}`}>
      {tabs.map((tab) => {
        const selected = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              selected ? 'bg-[#102A43] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 text-xs ${selected ? 'text-white/80' : 'text-slate-400'}`}>({tab.count})</span>
          </button>
        );
      })}
    </div>
  );
}
