'use client';

import type { Buffet } from '@/types';
import type { getMessages } from '@/lib/i18n/messages';
import { Button } from '@/components/ui/Button';
import {
  buffetPanelToolbarClass,
  buffetSegmentBtnClass,
  buffetSegmentWrapClass,
} from '@/components/dashboard/buffet/buffet-field-styles';
import {
  BuffetToolbarSelect,
  buffetToolbarChipClass,
} from '@/components/dashboard/buffet/BuffetToolbarSelect';

type BuffetAdminMessages = ReturnType<typeof getMessages>['buffetAdmin'];

type Props = {
  t: BuffetAdminMessages;
  buffets: Buffet[];
  matrixBuffetId: string;
  onMatrixBuffetIdChange: (id: string) => void;
  rulesView: 'matrix' | 'list';
  onRulesViewChange: (view: 'matrix' | 'list') => void;
  onOpenPreview: () => void;
  onAddRule: () => void;
  showPreview: boolean;
};

export function BuffetRulesToolbar({
  t,
  buffets,
  matrixBuffetId,
  onMatrixBuffetIdChange,
  rulesView,
  onRulesViewChange,
  onOpenPreview,
  onAddRule,
  showPreview,
}: Props) {
  const activeBuffets = buffets.filter((b) => b.is_active);
  const selectedId = matrixBuffetId || activeBuffets[0]?.id || '';

  return (
    <div className={buffetPanelToolbarClass}>
      {rulesView === 'matrix' ? (
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[13px] text-brand-text-muted shrink-0 select-none">{t.ruleBuffet}</span>
          {activeBuffets.length <= 1 ? (
            <span className={buffetToolbarChipClass} title={activeBuffets[0]?.name}>
              {activeBuffets[0]?.name ?? '—'}
            </span>
          ) : (
            <BuffetToolbarSelect
              value={selectedId}
              onChange={(e) => onMatrixBuffetIdChange(e.target.value)}
              aria-label={t.ruleBuffet}
            >
              {activeBuffets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </BuffetToolbarSelect>
          )}
        </div>
      ) : (
        <span className="text-[13px] text-brand-text-muted">{t.tabRules}</span>
      )}

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <div className={buffetSegmentWrapClass} role="group" aria-label={t.viewMatrix}>
          <button
            type="button"
            className={buffetSegmentBtnClass(rulesView === 'matrix')}
            onClick={() => onRulesViewChange('matrix')}
          >
            {t.viewMatrix}
          </button>
          <button
            type="button"
            className={buffetSegmentBtnClass(rulesView === 'list')}
            onClick={() => onRulesViewChange('list')}
          >
            {t.viewList}
          </button>
        </div>
        {showPreview && (
          <Button type="button" size="sm" variant="ghost" onClick={onOpenPreview}>
            {t.previewRun}
          </Button>
        )}
        <Button type="button" size="sm" variant="gold" onClick={onAddRule}>
          {t.addRule}
        </Button>
      </div>
    </div>
  );
}
