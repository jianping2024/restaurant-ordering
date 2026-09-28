'use client';

import { useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ModalConfirmActions } from '@/components/ui/ModalConfirmActions';
import { showToast } from '@/components/ui/Toast';
import { SortOrderDragHandle } from '@/components/dashboard/SortOrderDragHandle';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import {
  buildMenuNotePresetEditorGroups,
  menuNotePresetLocalizedName,
  type MenuNotePreset,
  type MenuNotePresetGroup,
} from '@/lib/menu-note-presets';
import { moveIdInOrderedList } from '@/lib/sort-order';
import {
  createNotePresetClient,
  createNotePresetGroupClient,
  deleteNotePresetClient,
  deleteNotePresetGroupClient,
  mapNotePresetApiError,
  reorderNotePresetGroupsClient,
  reorderNotePresetsClient,
  setNotePresetActiveClient,
  setNotePresetGroupActiveClient,
  updateNotePresetClient,
  updateNotePresetGroupClient,
} from '@/lib/dashboard-menu-client';

type EditorDraft = {
  mode: 'group' | 'preset';
  id: string | null;
  groupId: string | null;
  name_en: string;
  name_pt: string;
  name_zh: string;
};

type Props = {
  groups: MenuNotePresetGroup[];
  presets: MenuNotePreset[];
  onChange: (next: { groups: MenuNotePresetGroup[]; presets: MenuNotePreset[] }) => void;
};

function emptyDraft(mode: EditorDraft['mode'], groupId: string | null = null): EditorDraft {
  return { mode, id: null, groupId, name_en: '', name_pt: '', name_zh: '' };
}

export function NotePresetsManager({ groups, presets, onChange }: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).menuManager;
  const [editor, setEditor] = useState<EditorDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingDeletePreset, setPendingDeletePreset] = useState<{
    id: string;
    label: string;
    referenced: number;
  } | null>(null);

  const editorGroups = useMemo(
    () => buildMenuNotePresetEditorGroups(groups, presets),
    [groups, presets],
  );

  const editorValid =
    !!editor && editor.name_en.trim().length > 0 && editor.name_pt.trim().length > 0;

  const openCreateGroup = () => setEditor(emptyDraft('group'));
  const openCreatePreset = () => {
    const first = groups[0]?.id ?? null;
    setEditor(emptyDraft('preset', first));
  };

  const saveEditor = async () => {
    if (!editor || !editorValid || busy) return;
    setBusy(true);
    const payload = {
      name_en: editor.name_en.trim(),
      name_pt: editor.name_pt.trim(),
      name_zh: editor.name_zh.trim(),
    };
    try {
      if (editor.mode === 'group') {
        if (editor.id) {
          const res = await updateNotePresetGroupClient(editor.id, payload);
          if (!res.ok) {
            showToast(mapNotePresetApiError(res.error, res.message, t, res.referenced_item_count), 'error');
            return;
          }
          onChange({
            groups: groups.map((g) => (g.id === editor.id ? res.data.group : g)),
            presets,
          });
        } else {
          const res = await createNotePresetGroupClient(payload);
          if (!res.ok) {
            showToast(mapNotePresetApiError(res.error, res.message, t, res.referenced_item_count), 'error');
            return;
          }
          onChange({ groups: [...groups, res.data.group], presets });
        }
      } else {
        if (!editor.groupId) {
          showToast(t.notePresetNeedGroup, 'error');
          return;
        }
        if (editor.id) {
          const res = await updateNotePresetClient(editor.id, {
            ...payload,
            group_id: editor.groupId,
          });
          if (!res.ok) {
            showToast(mapNotePresetApiError(res.error, res.message, t, res.referenced_item_count), 'error');
            return;
          }
          onChange({
            groups,
            presets: presets.map((p) => (p.id === editor.id ? res.data.preset : p)),
          });
        } else {
          const res = await createNotePresetClient(editor.groupId, payload);
          if (!res.ok) {
            showToast(mapNotePresetApiError(res.error, res.message, t, res.referenced_item_count), 'error');
            return;
          }
          onChange({ groups, presets: [...presets, res.data.preset] });
        }
      }
      setEditor(null);
      showToast(t.notePresetSaved, 'success');
    } finally {
      setBusy(false);
    }
  };

  const tryDeleteGroup = async (group: MenuNotePresetGroup) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await deleteNotePresetGroupClient(group.id);
      if (!res.ok) {
        if (res.error === 'note_preset_group_not_empty') {
          showToast(
            t.notePresetGroupNotEmpty.replace(
              '{count}',
              String(res.referenced_item_count ?? presets.filter((p) => p.group_id === group.id).length),
            ),
            'error',
          );
          return;
        }
        showToast(mapNotePresetApiError(res.error, res.message, t, res.referenced_item_count), 'error');
        return;
      }
      onChange({
        groups: groups.filter((g) => g.id !== group.id),
        presets,
      });
      showToast(t.notePresetSaved, 'success');
    } finally {
      setBusy(false);
    }
  };

  const requestDeletePreset = async (preset: MenuNotePreset) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await deleteNotePresetClient(preset.id, false);
      if (res.ok) {
        onChange({
          groups,
          presets: presets.filter((p) => p.id !== preset.id),
        });
        showToast(t.notePresetSaved, 'success');
        return;
      }
      if (res.error === 'note_preset_in_use') {
        setPendingDeletePreset({
          id: preset.id,
          label: menuNotePresetLocalizedName(preset, lang),
          referenced: res.referenced_item_count ?? 0,
        });
        return;
      }
      showToast(mapNotePresetApiError(res.error, res.message, t, res.referenced_item_count), 'error');
    } finally {
      setBusy(false);
    }
  };

  const confirmDeletePreset = async () => {
    if (!pendingDeletePreset || busy) return;
    setBusy(true);
    try {
      const res = await deleteNotePresetClient(pendingDeletePreset.id, true);
      if (!res.ok) {
        showToast(mapNotePresetApiError(res.error, res.message, t, res.referenced_item_count), 'error');
        return;
      }
      onChange({
        groups,
        presets: presets.filter((p) => p.id !== pendingDeletePreset.id),
      });
      setPendingDeletePreset(null);
      showToast(t.notePresetSaved, 'success');
    } finally {
      setBusy(false);
    }
  };

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, type } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    if (type === 'GROUP') {
      const ids = groups.map((g) => g.id);
      const nextIds = moveIdInOrderedList(ids, source.index, destination.index);
      if (!nextIds) return;
      const byId = new Map(groups.map((g) => [g.id, g]));
      const optimistic = nextIds
        .map((id, index) => {
          const row = byId.get(id);
          return row ? { ...row, sort_order: index } : null;
        })
        .filter((row): row is MenuNotePresetGroup => !!row);
      onChange({ groups: optimistic, presets });
      const res = await reorderNotePresetGroupsClient(nextIds);
      if (!res.ok) {
        onChange({ groups, presets });
        showToast(mapNotePresetApiError(res.error, res.message, t, res.referenced_item_count), 'error');
      }
      return;
    }

    if (type === 'PRESET') {
      const groupId = source.droppableId.replace(/^presets:/, '');
      if (destination.droppableId !== source.droppableId) {
        showToast(t.notePresetReorderSameGroupOnly, 'error');
        return;
      }
      const scoped = presets
        .filter((p) => p.group_id === groupId)
        .sort((a, b) => a.sort_order - b.sort_order);
      const ids = scoped.map((p) => p.id);
      const nextIds = moveIdInOrderedList(ids, source.index, destination.index);
      if (!nextIds) return;
      const byId = new Map(scoped.map((p) => [p.id, p]));
      const reordered = nextIds
        .map((id, index) => {
          const row = byId.get(id);
          return row ? { ...row, sort_order: index } : null;
        })
        .filter((row): row is MenuNotePreset => !!row);
      const others = presets.filter((p) => p.group_id !== groupId);
      onChange({ groups, presets: [...others, ...reordered] });
      const res = await reorderNotePresetsClient(groupId, nextIds);
      if (!res.ok) {
        onChange({ groups, presets });
        showToast(mapNotePresetApiError(res.error, res.message, t, res.referenced_item_count), 'error');
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Button type="button" size="sm" onClick={openCreateGroup} disabled={busy}>
          {t.notePresetAddGroup}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={openCreatePreset} disabled={busy}>
          {t.notePresetAddItem}
        </Button>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="note-groups" type="GROUP">
          {(groupProvided) => (
            <div ref={groupProvided.innerRef} {...groupProvided.droppableProps} className="space-y-3">
              {editorGroups.map((group, groupIndex) => (
                <Draggable key={group.id} draggableId={group.id} index={groupIndex}>
                  {(groupDrag, snapshot) => (
                    <section
                      ref={groupDrag.innerRef}
                      {...groupDrag.draggableProps}
                      className={`rounded-lg border bg-brand-card overflow-hidden ${
                        group.active ? 'border-brand-border' : 'border-brand-border/70 bg-brand-bg/40'
                      } ${snapshot.isDragging ? 'shadow-lg ring-1 ring-brand-gold/40 z-10' : ''}`}
                      style={groupDrag.draggableProps.style}
                    >
                      <div className="flex items-center gap-2 px-2.5 py-2 sm:px-4 border-b border-brand-border/60 bg-brand-bg/30">
                        <SortOrderDragHandle
                          label={t.notePresetGroupDrag}
                          dragHandleProps={groupDrag.dragHandleProps}
                          disabled={busy}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-brand-text truncate">
                            {menuNotePresetLocalizedName(group, lang)}
                          </p>
                          <p className="text-[11px] text-brand-text-muted truncate mt-0.5">
                            {group.name_en} · {group.name_pt}
                            {group.name_zh.trim() ? ` · ${group.name_zh}` : ''}
                          </p>
                        </div>
                        <span className="text-[11px] text-brand-text-muted shrink-0 tabular-nums">
                          {group.presets.length}
                        </span>
                        {!group.active ? (
                          <span className="mesa-badge-danger text-[10px] px-1 py-px rounded shrink-0">
                            {t.unavailableBadge}
                          </span>
                        ) : null}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            className="text-xs sm:text-sm text-brand-text-muted hover:text-brand-gold transition-colors"
                            onClick={() =>
                              setEditor({
                                mode: 'group',
                                id: group.id,
                                groupId: null,
                                name_en: group.name_en,
                                name_pt: group.name_pt,
                                name_zh: group.name_zh,
                              })
                            }
                          >
                            {t.edit}
                          </button>
                          <button
                            type="button"
                            className="text-xs sm:text-sm text-brand-text-muted hover:text-brand-gold transition-colors"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              try {
                                const res = await setNotePresetGroupActiveClient(
                                  group.id,
                                  !group.active,
                                );
                                if (!res.ok) {
                                  showToast(
                                    mapNotePresetApiError(res.error, res.message, t, res.referenced_item_count),
                                    'error',
                                  );
                                  return;
                                }
                                onChange({
                                  groups: groups.map((g) =>
                                    g.id === group.id ? res.data.group : g,
                                  ),
                                  presets,
                                });
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            {group.active ? t.notePresetDisable : t.notePresetEnable}
                          </button>
                          <button
                            type="button"
                            className="text-xs sm:text-sm text-brand-text-muted hover:text-red-600 transition-colors"
                            disabled={busy}
                            onClick={() => tryDeleteGroup(group)}
                          >
                            {t.remove}
                          </button>
                        </div>
                      </div>

                      <Droppable droppableId={`presets:${group.id}`} type="PRESET">
                        {(presetProvided) => (
                          <div
                            ref={presetProvided.innerRef}
                            {...presetProvided.droppableProps}
                            className="min-h-[8px]"
                          >
                            {group.presets.length === 0 ? (
                              <p className="text-[13px] text-brand-text-muted px-4 py-3">
                                {t.notePresetGroupEmpty}
                              </p>
                            ) : (
                              group.presets.map((preset, presetIndex) => (
                                <Draggable
                                  key={preset.id}
                                  draggableId={preset.id}
                                  index={presetIndex}
                                  isDragDisabled={busy}
                                >
                                  {(presetDrag, presetSnap) => (
                                    <div
                                      ref={presetDrag.innerRef}
                                      {...presetDrag.draggableProps}
                                      className={`flex items-center gap-1.5 sm:gap-2 px-2.5 py-2 sm:px-4 border-t border-brand-border/50 ${
                                        preset.active ? '' : 'opacity-60'
                                      } ${
                                        presetSnap.isDragging
                                          ? 'shadow-lg ring-1 ring-brand-gold/40 bg-brand-card z-10'
                                          : ''
                                      }`}
                                      style={presetDrag.draggableProps.style}
                                    >
                                      <SortOrderDragHandle
                                        label={t.notePresetItemDrag}
                                        dragHandleProps={presetDrag.dragHandleProps}
                                        disabled={busy}
                                      />
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-brand-text truncate">
                                          {menuNotePresetLocalizedName(preset, lang)}
                                        </p>
                                        <p className="text-[11px] text-brand-text-muted truncate mt-0.5">
                                          {preset.name_en} · {preset.name_pt}
                                          {preset.name_zh.trim() ? ` · ${preset.name_zh}` : ''}
                                        </p>
                                      </div>
                                      {!preset.active ? (
                                        <span className="mesa-badge-danger text-[10px] px-1 py-px rounded shrink-0">
                                          {t.unavailableBadge}
                                        </span>
                                      ) : null}
                                      <div className="flex items-center gap-2 shrink-0">
                                        <button
                                          type="button"
                                          className="text-xs sm:text-sm text-brand-text-muted hover:text-brand-gold transition-colors"
                                          onClick={() =>
                                            setEditor({
                                              mode: 'preset',
                                              id: preset.id,
                                              groupId: group.id,
                                              name_en: preset.name_en,
                                              name_pt: preset.name_pt,
                                              name_zh: preset.name_zh,
                                            })
                                          }
                                        >
                                          {t.edit}
                                        </button>
                                        <button
                                          type="button"
                                          className="text-xs sm:text-sm text-brand-text-muted hover:text-brand-gold transition-colors"
                                          disabled={busy}
                                          onClick={async () => {
                                            setBusy(true);
                                            try {
                                              const res = await setNotePresetActiveClient(
                                                preset.id,
                                                !preset.active,
                                              );
                                              if (!res.ok) {
                                                showToast(
                                                  mapNotePresetApiError(
                                                    res.error,
                                                    res.message,
                                                    t,
                                                    res.referenced_item_count,
                                                  ),
                                                  'error',
                                                );
                                                return;
                                              }
                                              onChange({
                                                groups,
                                                presets: presets.map((p) =>
                                                  p.id === preset.id ? res.data.preset : p,
                                                ),
                                              });
                                            } finally {
                                              setBusy(false);
                                            }
                                          }}
                                        >
                                          {preset.active ? t.notePresetDisable : t.notePresetEnable}
                                        </button>
                                        <button
                                          type="button"
                                          className="text-xs sm:text-sm text-brand-text-muted hover:text-red-600 transition-colors"
                                          disabled={busy}
                                          onClick={() => requestDeletePreset(preset)}
                                        >
                                          {t.remove}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              ))
                            )}
                            {presetProvided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </section>
                  )}
                </Draggable>
              ))}
              {groupProvided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <Modal
        open={!!editor}
        onClose={() => !busy && setEditor(null)}
        title={
          editor?.mode === 'group'
            ? editor.id
              ? t.notePresetEditGroup
              : t.notePresetAddGroup
            : editor?.id
              ? t.notePresetEditItem
              : t.notePresetAddItem
        }
        size="md"
      >
        {editor ? (
          <div className="space-y-3">
            {editor.mode === 'preset' ? (
              <div>
                <label className="block text-[13px] text-brand-text-muted mb-1">
                  {t.notePresetBelongGroup}
                </label>
                <select
                  className="w-full h-11 rounded-lg border border-brand-border bg-brand-card px-4 text-base text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                  value={editor.groupId ?? ''}
                  onChange={(e) =>
                    setEditor((prev) =>
                      prev ? { ...prev, groupId: e.target.value || null } : prev,
                    )
                  }
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {menuNotePresetLocalizedName(g, lang)}
                      {!g.active ? ` (${t.unavailableBadge})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <Input
              label={`${t.notePresetNameEn} *`}
              value={editor.name_en}
              onChange={(e) =>
                setEditor((prev) => (prev ? { ...prev, name_en: e.target.value } : prev))
              }
            />
            <Input
              label={`${t.notePresetNamePt} *`}
              value={editor.name_pt}
              onChange={(e) =>
                setEditor((prev) => (prev ? { ...prev, name_pt: e.target.value } : prev))
              }
            />
            <Input
              label={t.notePresetNameZhOptional}
              value={editor.name_zh}
              onChange={(e) =>
                setEditor((prev) => (prev ? { ...prev, name_zh: e.target.value } : prev))
              }
            />
            <ModalConfirmActions
              divided
              busy={busy}
              cancelLabel={t.cancel}
              confirmLabel={t.save}
              confirmDisabled={!editorValid}
              onCancel={() => setEditor(null)}
              onConfirm={() => void saveEditor()}
            />
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!pendingDeletePreset}
        onClose={() => !busy && setPendingDeletePreset(null)}
        title={t.notePresetDeleteTitle}
        size="sm"
      >
        {pendingDeletePreset ? (
          <div className="space-y-3">
            <p className="text-sm text-brand-text">
              {t.notePresetDeleteConfirm
                .replace('{name}', pendingDeletePreset.label)
                .replace('{count}', String(pendingDeletePreset.referenced))}
            </p>
            <ModalConfirmActions
              divided
              busy={busy}
              cancelLabel={t.cancel}
              confirmLabel={t.remove}
              confirmVariant="danger"
              onCancel={() => setPendingDeletePreset(null)}
              onConfirm={() => void confirmDeletePreset()}
            />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
