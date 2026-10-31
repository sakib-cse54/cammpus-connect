import React, { useId, useRef } from 'react';
import { cn } from '../../lib/utils.js';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
  variant?: 'pills' | 'underline';
  /** Accessible name of the tab list. */
  label?: string;
  /** Prefix used to link tabs to panels: tab id `${idBase}-tab-${id}`, panel id `${idBase}-panel-${id}`. */
  idBase?: string;
}

export const tabId = (base: string, id: string): string => `${base}-tab-${id}`;
export const panelId = (base: string, id: string): string => `${base}-panel-${id}`;

/** WAI-ARIA tablist with roving tabindex; Arrow keys, Home and End move between tabs. */
export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange, className, variant = 'pills', label = 'Sections', idBase }) => {
  const autoId = useId();
  const base = idBase ?? autoId;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const move = (index: number) => {
    const n = tabs.length;
    const next = ((index % n) + n) % n;
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const map: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 };
    if (e.key in map) {
      e.preventDefault();
      move(map[e.key]);
    }
  };

  const underline = variant === 'underline';
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        underline ? 'border-b border-slate-200 flex gap-4 overflow-x-auto' : 'flex gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80 overflow-x-auto',
        className
      )}
    >
      {tabs.map((tab, i) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={tabId(base, tab.id)}
            aria-selected={isActive}
            aria-controls={panelId(base, tab.id)}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'min-h-[44px] text-xs sm:text-sm font-semibold flex items-center gap-2 whitespace-nowrap transition-colors',
              underline
                ? cn('px-1 border-b-2 -mb-px', isActive ? 'border-blue-900 text-blue-900' : 'border-transparent text-slate-500 hover:text-slate-900')
                : cn('px-3.5 rounded-lg', isActive ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60')
            )}
          >
            {tab.icon && <span aria-hidden="true" className="w-4 h-4 shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && (
              <span className={cn('px-1.5 rounded-full text-[10px] font-mono font-bold', isActive ? 'bg-blue-50 text-blue-900' : 'bg-slate-200 text-slate-600')}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export interface TabPanelProps {
  idBase: string;
  id: string;
  activeTab: string;
  children: React.ReactNode;
  className?: string;
}

/** Panel paired with a tab of the same id; hidden when not active. */
export const TabPanel: React.FC<TabPanelProps> = ({ idBase, id, activeTab, children, className }) => (
  <div role="tabpanel" id={panelId(idBase, id)} aria-labelledby={tabId(idBase, id)} hidden={activeTab !== id} tabIndex={0} className={className}>
    {activeTab === id ? children : null}
  </div>
);
