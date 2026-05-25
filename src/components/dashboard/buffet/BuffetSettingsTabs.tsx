'use client';

type Tab = { id: string; label: string };

type Props = {
  tabs: Tab[];
  activeId: string;
  onChange: (id: string) => void;
};

/** Segmented navigation for buffet settings sub-pages. */
export function BuffetSettingsTabs({ tabs, activeId, onChange }: Props) {
  return (
    <div
      className="inline-flex max-w-full flex-wrap rounded-xl border border-brand-border/80 bg-brand-bg/60 p-1 gap-0.5"
      role="tablist"
      aria-label="Buffet settings"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`px-3.5 py-2 rounded-lg text-sm transition-all whitespace-nowrap ${
              active
                ? 'bg-brand-card text-brand-gold font-medium shadow-sm border border-brand-border/50'
                : 'text-brand-text-muted hover:text-brand-text border border-transparent'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
