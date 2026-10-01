'use client';

import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { SortOrderDragHandle } from '@/components/dashboard/SortOrderDragHandle';
import type { MenuCategory } from '@/types';
import {
  categorySiblingDroppableId,
  menuCategorySiblingsInScope,
  parseCategorySiblingDroppableId,
} from '@/lib/menu-category-order';

const MENU_ROW_ICON_BTN =
  'h-5 w-5 inline-flex items-center justify-center rounded-md border border-brand-border/70 bg-brand-card/80 text-brand-text leading-none hover:text-brand-gold hover:border-brand-gold/35 hover:bg-brand-gold/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/45 focus-visible:bg-brand-gold/15 transition-colors disabled:opacity-35 disabled:hover:bg-brand-card/80 disabled:hover:text-brand-text disabled:cursor-not-allowed shrink-0';
const MENU_ROW_ICON_BTN_DANGER = `${MENU_ROW_ICON_BTN} border-status-danger/35 bg-[rgb(var(--color-status-danger-border)/0.12)] mesa-text-danger leading-none hover:bg-[rgb(var(--color-status-danger-border)/0.2)] focus-visible:ring-[rgb(var(--color-status-danger-border)/0.45)]`;
const MENU_ROW_ICON_CLUSTER =
  'flex h-6 shrink-0 items-center gap-1 rounded-md bg-brand-border/35 px-1';
/**
 * Sole category-tree spacing source:
 * triangle | GAP | handle | GAP | label  (GAP = former gap-1 4px → 1/3).
 * Expand width = per-depth indent; ▸ flush-right so visual triangle↔handle equals GAP.
 * LABEL_INSET aligns root category names with 「新增大类」 text.
 */
const CATEGORY_TREE_ROW_GAP_PX = Math.round(4 / 3);
const CATEGORY_TREE_EXPAND_SLOT_PX = 12;
/** Matches SortOrderDragHandle `w-6` — do not diverge. */
const CATEGORY_TREE_HANDLE_WIDTH_PX = 24;
export const CATEGORY_TREE_LABEL_INSET_PX =
  CATEGORY_TREE_EXPAND_SLOT_PX +
  CATEGORY_TREE_ROW_GAP_PX +
  CATEGORY_TREE_HANDLE_WIDTH_PX +
  CATEGORY_TREE_ROW_GAP_PX;
const CATEGORY_TREE_EXPAND_SLOT =
  'h-7 shrink-0 inline-flex items-center justify-end text-brand-text-muted';

export type MenuCategorySortTreeLabels = {
  sameLevelSort: string;
  addChild: string;
  edit: string;
  remove: string;
  addChildAction: string;
  editAction: string;
  deleteAction: string;
  maxDepthTitle: string;
};

type Props = {
  categories: MenuCategory[];
  selectedCategoryId: string;
  expandedKeys: string[];
  onExpandedKeysChange: (keys: string[]) => void;
  depthById: Map<string, number>;
  maxDepth: number;
  reorderBusy: boolean;
  getLabel: (category: MenuCategory) => string;
  labels: MenuCategorySortTreeLabels;
  onSelect: (category: MenuCategory) => void;
  onAddChild: (category: MenuCategory) => void;
  onEdit: (category: MenuCategory) => void;
  onDelete: (categoryId: string) => void;
  onReorder: (parentId: string | null, fromIndex: number, toIndex: number) => void;
};

function CategorySiblingList({
  parentId,
  categories,
  selectedCategoryId,
  expandedKeys,
  onExpandedKeysChange,
  depthById,
  maxDepth,
  reorderBusy,
  getLabel,
  labels,
  onSelect,
  onAddChild,
  onEdit,
  onDelete,
}: Omit<Props, 'onReorder'> & { parentId: string | null }) {
  const siblings = menuCategorySiblingsInScope(categories, parentId);
  const droppableId = categorySiblingDroppableId(parentId);

  return (
    <Droppable droppableId={droppableId} type={droppableId} isDropDisabled={reorderBusy}>
      {(droppableProvided) => (
        <ul
          ref={droppableProvided.innerRef}
          {...droppableProvided.droppableProps}
          className="list-none m-0 p-0 space-y-0.5"
        >
          {siblings.map((category, index) => {
            const depth = depthById.get(category.id) || 1;
            const children = menuCategorySiblingsInScope(categories, category.id);
            const hasChildren = children.length > 0;
            const expanded = expandedKeys.includes(category.id);
            const canAddChild = depth < maxDepth;
            const maxDepthTitle = labels.maxDepthTitle.replace('{max}', String(maxDepth));
            const selected = selectedCategoryId === category.id;
            const dragDisabled = reorderBusy;

            return (
              <Draggable
                key={category.id}
                draggableId={category.id}
                index={index}
                isDragDisabled={dragDisabled}
              >
                {(draggableProvided, snapshot) => (
                  <li
                    ref={draggableProvided.innerRef}
                    {...draggableProvided.draggableProps}
                    className={`list-none ${snapshot.isDragging ? 'z-10' : ''}`}
                    style={draggableProvided.draggableProps.style}
                  >
                    <div
                      className={`group flex w-full items-center min-h-8 pr-1 min-w-0 rounded-md ${
                        selected ? 'ring-1 ring-brand-gold/50 bg-brand-gold/5' : ''
                      } ${snapshot.isDragging ? 'shadow-lg ring-1 ring-brand-gold/40 bg-brand-card' : ''}`}
                      style={{
                        paddingLeft: `${Math.max(0, depth - 1) * CATEGORY_TREE_EXPAND_SLOT_PX}px`,
                        gap: CATEGORY_TREE_ROW_GAP_PX,
                      }}
                    >
                      {hasChildren ? (
                        <button
                          type="button"
                          aria-label={expanded ? 'collapse' : 'expand'}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (expanded) {
                              onExpandedKeysChange(expandedKeys.filter((k) => k !== category.id));
                            } else {
                              onExpandedKeysChange([...expandedKeys, category.id]);
                            }
                          }}
                          className={`${CATEGORY_TREE_EXPAND_SLOT} hover:text-brand-gold`}
                          style={{ width: CATEGORY_TREE_EXPAND_SLOT_PX }}
                        >
                          <span
                            className={`text-[10px] leading-none transition-transform ${
                              expanded ? 'rotate-90' : ''
                            }`}
                            aria-hidden
                          >
                            ▸
                          </span>
                        </button>
                      ) : (
                        <span
                          className={CATEGORY_TREE_EXPAND_SLOT}
                          style={{ width: CATEGORY_TREE_EXPAND_SLOT_PX }}
                          aria-hidden
                        />
                      )}
                      <SortOrderDragHandle
                        label={labels.sameLevelSort}
                        disabled={dragDisabled}
                        dragHandleProps={draggableProvided.dragHandleProps}
                      />
                      <button
                        type="button"
                        onClick={() => onSelect(category)}
                        className={`truncate text-sm leading-5 min-w-0 flex-1 text-left ${
                          selected ? 'text-brand-gold font-medium' : 'text-brand-text'
                        }`}
                      >
                        {getLabel(category)}
                        {category.item_code?.trim() ? (
                          <span className="text-brand-text-muted font-normal">
                            {' '}
                            [{category.item_code.trim()}]
                          </span>
                        ) : null}
                      </button>
                      <div
                        className={`ml-auto ${MENU_ROW_ICON_CLUSTER} transition-opacity ${
                          selected ? 'opacity-100' : 'opacity-75 group-hover:opacity-100'
                        }`}
                      >
                        <button
                          type="button"
                          title={canAddChild ? labels.addChild : maxDepthTitle}
                          aria-label={labels.addChildAction}
                          disabled={!canAddChild}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!canAddChild) return;
                            onAddChild(category);
                          }}
                          className={MENU_ROW_ICON_BTN}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          title={labels.edit}
                          aria-label={labels.editAction}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(category);
                          }}
                          className={MENU_ROW_ICON_BTN}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          title={labels.remove}
                          aria-label={labels.deleteAction}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(category.id);
                          }}
                          className={MENU_ROW_ICON_BTN_DANGER}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    {hasChildren && expanded ? (
                      <CategorySiblingList
                        parentId={category.id}
                        categories={categories}
                        selectedCategoryId={selectedCategoryId}
                        expandedKeys={expandedKeys}
                        onExpandedKeysChange={onExpandedKeysChange}
                        depthById={depthById}
                        maxDepth={maxDepth}
                        reorderBusy={reorderBusy}
                        getLabel={getLabel}
                        labels={labels}
                        onSelect={onSelect}
                        onAddChild={onAddChild}
                        onEdit={onEdit}
                        onDelete={onDelete}
                      />
                    ) : null}
                  </li>
                )}
              </Draggable>
            );
          })}
          {droppableProvided.placeholder}
        </ul>
      )}
    </Droppable>
  );
}

/** Sole dashboard UI for menu category tree + same-parent sort_order drag reorder. */
export function MenuCategorySortTree(props: Props) {
  const onDragEnd = (result: DropResult) => {
    if (props.reorderBusy) return;
    if (!result.destination) return;
    if (result.source.droppableId !== result.destination.droppableId) return;
    if (result.source.index === result.destination.index) return;
    const parentId = parseCategorySiblingDroppableId(result.source.droppableId);
    if (parentId === undefined) return;
    props.onReorder(parentId, result.source.index, result.destination.index);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <CategorySiblingList {...props} parentId={null} />
    </DragDropContext>
  );
}
