import React, {
  forwardRef,
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type HTMLAttributes,
  type ReactNode,
  type KeyboardEvent,
} from 'react';
import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { type IconSvgElement } from '@hugeicons/react';
import { IconBox, TextSizeProvider } from '../Icon/IconBox';
import { Dot } from '../Indicator/Dot';
import { Checkbox, type CheckboxSize } from '../Selector/Checkbox';
import selectorStyles from '../Selector/Selector.module.css';
import s from './Tree.module.css';
import { PAD_CLASS, TEXT_CLASS, type PadSize, type TextSize } from '../../tokens/size';

const SELECTOR_SIZE: Record<PadSize, CheckboxSize> = { lg: 'l', md: 'm', sm: 's' };

/* ─── Types ─── */

export interface TreeNodeData {
  id: string;
  label: ReactNode;
  icon?: IconSvgElement;
  children?: TreeNodeData[];
  disabled?: boolean;
}

export type StickyScrollMode = 'single' | 'all' | 'breadcrumb' | false;

export interface TreeProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  nodes: TreeNodeData[];
  padSize?: PadSize;
  textSize?: TextSize;
  /** Show connector lines (default true) */
  showLines?: boolean;
  /** Controlled expanded node ids */
  expanded?: Set<string>;
  defaultExpanded?: Set<string>;
  onExpandedChange?: (expanded: Set<string>) => void;
  /** Controlled selected node id (single select) */
  selected?: string | null;
  defaultSelected?: string | null;
  onSelectedChange?: (id: string | null) => void;
  /** Auto-expand ancestors of this node id (useful for revealing selected item) */
  autoExpandTo?: string | null;
  /** Lines drawn outside the row hover area (default false) */
  linesOutside?: boolean;
  /** Enable multi-select with checkboxes */
  multiSelect?: boolean;
  /** Controlled checked node ids (multi-select) */
  checkedIds?: Set<string>;
  defaultCheckedIds?: Set<string>;
  onCheckedIdsChange?: (ids: Set<string>) => void;
  /** Sticky scroll mode: 'single' (nearest parent), 'all' (all ancestors), 'breadcrumb' (path string), false (off). Default: false */
  stickyScroll?: StickyScrollMode;
}

/* ─── Helpers ─── */

interface FlatNode {
  id: string;
  node: TreeNodeData;
  depth: number;
  parentId: string | null;
  hasChildren: boolean;
}

/** Check if any id from a Set exists anywhere in the subtree */
function containsAnyInSubtree(nodes: TreeNodeData[], ids: Set<string>): boolean {
  if (ids.size === 0) return false;
  for (const node of nodes) {
    if (ids.has(node.id)) return true;
    if (node.children && containsAnyInSubtree(node.children, ids)) return true;
  }
  return false;
}

/** Collect all leaf ids in a subtree */
function collectLeafIds(nodes: TreeNodeData[]): string[] {
  const result: string[] = [];
  for (const node of nodes) {
    if (!node.children || node.children.length === 0) {
      result.push(node.id);
    } else {
      result.push(...collectLeafIds(node.children));
    }
  }
  return result;
}

/** Get check state for a branch: 'all' | 'some' | 'none' */
function branchCheckState(
  nodes: TreeNodeData[],
  checkedSet: Set<string>,
): 'all' | 'some' | 'none' {
  const leaves = collectLeafIds(nodes);
  if (leaves.length === 0) return 'none';
  const checkedCount = leaves.filter((id) => checkedSet.has(id)).length;
  if (checkedCount === 0) return 'none';
  if (checkedCount === leaves.length) return 'all';
  return 'some';
}

/** Collect ancestor ids for a target node */
function collectAncestorIds(nodes: TreeNodeData[], targetId: string, path: string[] = []): string[] | null {
  for (const node of nodes) {
    if (node.id === targetId) return path;
    if (node.children) {
      const result = collectAncestorIds(node.children, targetId, [...path, node.id]);
      if (result) return result;
    }
  }
  return null;
}

function flattenVisible(
  nodes: TreeNodeData[],
  expandedSet: Set<string>,
  depth = 0,
  parentId: string | null = null,
): FlatNode[] {
  const result: FlatNode[] = [];
  for (const node of nodes) {
    const hasChildren = !!(node.children && node.children.length > 0);
    result.push({ id: node.id, node, depth, parentId, hasChildren });
    if (hasChildren && expandedSet.has(node.id)) {
      result.push(...flattenVisible(node.children!, expandedSet, depth + 1, node.id));
    }
  }
  return result;
}

/* ─── Animated collapse wrapper (mirrors Accordion) ─── */

function CollapseWrap({ open, children }: { open: boolean; children: ReactNode }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const timerRef = useRef(0);
  const firstRender = useRef(true);

  useEffect(() => {
    const body = bodyRef.current;
    const inner = innerRef.current;
    if (!body || !inner) return;

    if (firstRender.current) {
      firstRender.current = false;
      if (open) {
        body.style.height = 'auto';
        body.style.overflow = 'visible';
      } else {
        body.style.height = '0px';
        body.style.overflow = 'hidden';
      }
      return;
    }

    cancelAnimationFrame(rafRef.current);
    clearTimeout(timerRef.current);

    if (open) {
      body.style.overflow = 'hidden';
      body.style.height = '0px';
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      body.offsetHeight; // force reflow
      const h = inner.scrollHeight;
      body.style.height = `${h}px`;
      timerRef.current = window.setTimeout(() => {
        body.style.height = 'auto';
        body.style.overflow = 'visible';
      }, 200);
    } else {
      body.style.overflow = 'hidden';
      const h = inner.scrollHeight;
      body.style.height = `${h}px`;
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      body.offsetHeight; // force reflow
      rafRef.current = requestAnimationFrame(() => {
        body.style.height = '0px';
      });
      timerRef.current = window.setTimeout(() => {
        /* keep overflow hidden while collapsed */
      }, 200);
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(timerRef.current);
    };
  }, [open]);

  return (
    <div
      ref={bodyRef}
      style={{
        height: 0,
        overflow: 'hidden',
        transition: 'height 200ms ease',
      }}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

/* ─── Component ─── */

export const Tree = forwardRef<HTMLDivElement, TreeProps>(
  (
    {
      nodes,
      padSize = 'md',
      textSize = 14,
      showLines = true,
      autoExpandTo,
      linesOutside = false,
      expanded: expandedProp,
      defaultExpanded,
      onExpandedChange,
      selected: selectedProp,
      defaultSelected = null,
      onSelectedChange,
      multiSelect = false,
      checkedIds: checkedIdsProp,
      defaultCheckedIds,
      onCheckedIdsChange,
      stickyScroll = false,
      className,
      ...rest
    },
    ref,
  ) => {
    /* Expanded state */
    const isExpandedControlled = expandedProp !== undefined;
    const [internalExpanded, setInternalExpanded] = useState<Set<string>>(() => {
      const base = defaultExpanded ?? new Set<string>();
      if (!autoExpandTo) return base;
      const ancestors = collectAncestorIds(nodes, autoExpandTo);
      if (!ancestors || ancestors.length === 0) return base;
      const merged = new Set(base);
      for (const id of ancestors) merged.add(id);
      return merged;
    });
    const expandedSet = isExpandedControlled ? expandedProp : internalExpanded;

    /* Auto-expand to reveal a specific node on prop change (no re-mount) */
    const prevAutoExpandRef = useRef(autoExpandTo);
    useEffect(() => {
      if (autoExpandTo === prevAutoExpandRef.current) return;
      prevAutoExpandRef.current = autoExpandTo;
      if (!autoExpandTo) return;
      const ancestors = collectAncestorIds(nodes, autoExpandTo);
      if (!ancestors || ancestors.length === 0) return;
      const next = new Set(expandedSet);
      let changed = false;
      for (const id of ancestors) {
        if (!next.has(id)) { next.add(id); changed = true; }
      }
      if (changed) {
        if (!isExpandedControlled) setInternalExpanded(next);
        onExpandedChange?.(next);
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoExpandTo]);

    const toggleExpand = useCallback(
      (id: string) => {
        const next = new Set(expandedSet);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        if (!isExpandedControlled) setInternalExpanded(next);
        onExpandedChange?.(next);
      },
      [expandedSet, isExpandedControlled, onExpandedChange],
    );

    /* Selected state */
    const isSelectedControlled = selectedProp !== undefined;
    const [internalSelected, setInternalSelected] = useState<string | null>(defaultSelected);
    const selectedId = isSelectedControlled ? selectedProp : internalSelected;

    const select = useCallback(
      (id: string) => {
        const next = selectedId === id ? null : id;
        if (!isSelectedControlled) setInternalSelected(next);
        onSelectedChange?.(next);
      },
      [selectedId, isSelectedControlled, onSelectedChange],
    );

    /* Checked state (multi-select) */
    const isCheckedControlled = checkedIdsProp !== undefined;
    const [internalCheckedIds, setInternalCheckedIds] = useState<Set<string>>(
      () => defaultCheckedIds ?? new Set(),
    );
    const checkedSet = isCheckedControlled ? checkedIdsProp : internalCheckedIds;

    const toggleCheck = useCallback(
      (id: string, nodeChildren?: TreeNodeData[]) => {
        const next = new Set(checkedSet);
        if (nodeChildren && nodeChildren.length > 0) {
          // Branch node: toggle all leaf descendants
          const leaves = collectLeafIds(nodeChildren);
          const allChecked = leaves.every((lid) => next.has(lid));
          for (const lid of leaves) {
            if (allChecked) next.delete(lid);
            else next.add(lid);
          }
        } else {
          // Leaf node
          if (next.has(id)) next.delete(id);
          else next.add(id);
        }
        if (!isCheckedControlled) setInternalCheckedIds(next);
        onCheckedIdsChange?.(next);
      },
      [checkedSet, isCheckedControlled, onCheckedIdsChange],
    );

    /* Flat visible list for keyboard nav */
    const visibleNodes = useMemo(
      () => flattenVisible(nodes, expandedSet),
      [nodes, expandedSet],
    );

    /* Focus tracking */
    const [focusedId, setFocusedId] = useState<string | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);

    const focusNode = useCallback(
      (id: string) => {
        setFocusedId(id);
        const el = (rootRef.current ?? (ref as React.RefObject<HTMLDivElement>)?.current)
          ?.querySelector(`[data-tree-id="${id}"]`) as HTMLElement | null;
        el?.focus();
      },
      [ref],
    );

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLDivElement>) => {
        const idx = visibleNodes.findIndex((n) => n.id === focusedId);
        if (idx === -1 && visibleNodes.length > 0) {
          focusNode(visibleNodes[0].id);
          return;
        }
        const current = visibleNodes[idx];

        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            if (idx < visibleNodes.length - 1) focusNode(visibleNodes[idx + 1].id);
            break;
          case 'ArrowUp':
            e.preventDefault();
            if (idx > 0) focusNode(visibleNodes[idx - 1].id);
            break;
          case 'ArrowRight':
            e.preventDefault();
            if (current.hasChildren && !expandedSet.has(current.id)) {
              toggleExpand(current.id);
            } else if (current.hasChildren && expandedSet.has(current.id)) {
              // Move to first child
              if (idx < visibleNodes.length - 1) focusNode(visibleNodes[idx + 1].id);
            }
            break;
          case 'ArrowLeft':
            e.preventDefault();
            if (current.hasChildren && expandedSet.has(current.id)) {
              toggleExpand(current.id);
            } else if (current.parentId) {
              focusNode(current.parentId);
            }
            break;
          case 'Enter':
          case ' ':
            e.preventDefault();
            if (!current.node.disabled) {
              if (multiSelect) {
                toggleCheck(current.id, current.node.children);
              } else if (current.hasChildren) {
                toggleExpand(current.id);
              } else {
                select(current.id);
              }
            }
            break;
          case 'Home':
            e.preventDefault();
            if (visibleNodes.length) focusNode(visibleNodes[0].id);
            break;
          case 'End':
            e.preventDefault();
            if (visibleNodes.length) focusNode(visibleNodes[visibleNodes.length - 1].id);
            break;
        }
      },
      [visibleNodes, focusedId, expandedSet, toggleExpand, focusNode, select, multiSelect, toggleCheck],
    );

    /* ─── Sticky scroll ─── */
    const [stickyAncestors, setStickyAncestors] = useState<TreeNodeData[]>([]);
    const stickyRafRef = useRef(0);

    // Build a parentId lookup for O(1) ancestor walks
    const parentMap = useMemo(() => {
      const map = new Map<string, FlatNode>();
      for (const fn of visibleNodes) map.set(fn.id, fn);
      return map;
    }, [visibleNodes]);

    const stickyHeaderRef = useRef<HTMLDivElement>(null);
    const stickyIdsRef = useRef('');

    // Core sticky computation — called synchronously (no rAF).
    // Threshold is always 1px (row scrolled above viewport top).
    // Does NOT depend on header height — avoids feedback loops.
    const computeSticky = useCallback(
      () => {
        const container = rootRef.current;
        if (!container) return;

        // Nothing scrolled — clear sticky.
        if (container.scrollTop < 1) {
          if (stickyIdsRef.current !== '') {
            stickyIdsRef.current = '';
            setStickyAncestors([]);
          }
          return;
        }

        const containerRect = container.getBoundingClientRect();

        // Scan only visible rows (in parentMap). Skip collapsed children.
        const listEl = container.querySelector(`.${s.list}`);
        if (!listEl) return;
        const rows = listEl.querySelectorAll(`[data-tree-id]`);

        let lastScrolledId: string | null = null;

        for (let i = 0; i < rows.length; i++) {
          const el = rows[i] as HTMLElement;
          const id = el.getAttribute('data-tree-id');
          if (!id || !parentMap.has(id)) continue;
          const rowTop = el.getBoundingClientRect().top - containerRect.top;
          if (rowTop < 1) {
            lastScrolledId = id;
          } else {
            break;
          }
        }

        if (!lastScrolledId) {
          if (stickyIdsRef.current !== '') {
            stickyIdsRef.current = '';
            setStickyAncestors([]);
          }
          return;
        }

        const flatNode = parentMap.get(lastScrolledId)!;
        const chain: TreeNodeData[] = [];

        // Include the node itself if it's an expanded folder
        if (flatNode.hasChildren && expandedSet.has(flatNode.id)) {
          chain.unshift(flatNode.node);
        }

        // Walk up parents
        let cur = flatNode;
        while (cur.parentId) {
          const parent = parentMap.get(cur.parentId);
          if (!parent) break;
          chain.unshift(parent.node);
          cur = parent;
        }

        if (chain.length === 0) {
          if (stickyIdsRef.current !== '') {
            stickyIdsRef.current = '';
            setStickyAncestors([]);
          }
          return;
        }

        const finalChain = stickyScroll === 'single' ? [chain[chain.length - 1]] : chain;
        const newIds = finalChain.map((n) => n.id).join(',');

        if (newIds !== stickyIdsRef.current) {
          stickyIdsRef.current = newIds;
          setStickyAncestors(finalChain);
        }
      },
      [stickyScroll, parentMap, expandedSet],
    );

    // Throttle scroll events with rAF
    const handleScroll = useCallback(
      () => {
        if (!stickyScroll) return;
        cancelAnimationFrame(stickyRafRef.current);
        stickyRafRef.current = requestAnimationFrame(computeSticky);
      },
      [stickyScroll, computeSticky],
    );

    // Re-compute when expanded state changes (e.g. collapse via sticky chevron)
    useEffect(() => {
      if (stickyScroll) computeSticky();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [expandedSet]);

    // Apply negative margin so sticky header doesn't push content down.
    // No computeSticky call here — threshold doesn't depend on header height.
    useLayoutEffect(() => {
      if (!stickyScroll) return;
      const el = stickyHeaderRef.current;
      if (!el) return;
      el.style.marginBottom = `-${el.offsetHeight}px`;
    });

    // Scroll to a node when clicking sticky row
    const scrollToNode = useCallback((id: string) => {
      const container = rootRef.current;
      const el = container?.querySelector(`[data-tree-id="${id}"]`) as HTMLElement | null;
      if (!container || !el) return;
      const headerH = stickyHeaderRef.current?.offsetHeight ?? 0;
      const elTop = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
      container.scrollTo({ top: elTop - headerH, behavior: 'smooth' });
    }, []);

    const stickyHeader = stickyScroll && (
      <div ref={stickyHeaderRef} className={s.stickyHeader}>
        {stickyScroll === 'breadcrumb'
          ? stickyAncestors.length > 0 && (
              <div className={s.breadcrumbRow}>
                {stickyAncestors.map((node, i) => (
                  <React.Fragment key={node.id}>
                    {i > 0 && <span className={s.breadcrumbSep}>/</span>}
                    <span className={s.breadcrumbSegment} onClick={() => scrollToNode(node.id)}>
                      {node.label}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            )
          : stickyAncestors.map((node, i) => {
              const hasChildren = !!(node.children && node.children.length > 0);
              const isExpanded = expandedSet.has(node.id);
              const depth = stickyScroll === 'single'
                ? (collectAncestorIds(nodes, node.id)?.length ?? 0)
                : i;
              return (
                <div
                  key={node.id}
                  className={s.stickyRow}
                  style={{ paddingLeft: `calc(var(--fui-current-pad-h) + ${depth} * var(--tree-indent))` }}
                  onClick={() => scrollToNode(node.id)}
                >
                  <span
                    className={[s.chevron, hasChildren && s.hasChildren, isExpanded && s.expanded].filter(Boolean).join(' ')}
                    onClick={(e) => { e.stopPropagation(); toggleExpand(node.id); }}
                  >
                    {hasChildren && <IconBox icon={ArrowRight01Icon} behavior="highlight" className={s.chevronIcon} />}
                  </span>
                  {node.icon && <IconBox icon={node.icon} className={s.icon} />}
                  <span className={s.label}>{node.label}</span>
                </div>
              );
            })}
      </div>
    );

    /* ─── Recursive render ─── */

    const renderNode = (node: TreeNodeData, depth: number, isLast: boolean) => {
      const hasChildren = !!(node.children && node.children.length > 0);
      const isExpanded = expandedSet.has(node.id);
      const isLeaf = !hasChildren;
      const isSelected = isLeaf && selectedId === node.id;
      const isFocused = focusedId === node.id;

      const rowCls = [
        s.row,
        isSelected && s.selected,
        node.disabled && s.disabled,
      ]
        .filter(Boolean)
        .join(' ');

      return (
        <li
          key={node.id}
          role="treeitem"
          aria-expanded={hasChildren ? isExpanded : undefined}
          aria-selected={isLeaf ? isSelected : undefined}
          aria-disabled={node.disabled || undefined}
          className={[s.node, isLast && s.last].filter(Boolean).join(' ')}
        >
          <div
            className={rowCls}
            data-tree-id={node.id}
            tabIndex={isFocused ? 0 : -1}
            style={linesOutside
              ? { marginLeft: `calc(${depth} * var(--tree-indent))` }
              : { paddingLeft: `calc(var(--fui-current-pad-h) + ${depth} * var(--tree-indent))` }
            }
            onClick={() => {
              if (node.disabled) return;
              if (multiSelect) {
                toggleCheck(node.id, node.children);
              } else if (hasChildren) {
                toggleExpand(node.id);
              } else {
                select(node.id);
              }
            }}
            onFocus={() => setFocusedId(node.id)}
          >
            {/* Connector lines */}
            {showLines && depth > 0 && (
              <span
                className={s.connector}
                style={{ left: linesOutside
                  ? `calc(-1 * var(--tree-indent) * 0.5)`
                  : `calc(var(--fui-current-pad-h) + ${depth} * var(--tree-indent) - var(--tree-indent) * 0.5)`
                }}
              />
            )}

            {/* Chevron */}
            <span
              className={[s.chevron, hasChildren && s.hasChildren, isExpanded && s.expanded].filter(Boolean).join(' ')}
              onClick={multiSelect && hasChildren ? (e) => { e.stopPropagation(); toggleExpand(node.id); } : undefined}
            >
              {hasChildren && (
                <IconBox icon={ArrowRight01Icon} behavior="highlight" className={s.chevronIcon} />
              )}
            </span>

            {/* Checkbox (multi-select) */}
            {multiSelect && (
              <span
                className={selectorStyles.selectorWrap}
                style={{ width: 'var(--fui-current-icon-box)', height: 'var(--fui-current-icon-box)' }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!node.disabled) toggleCheck(node.id, node.children);
                }}
              >
                <Checkbox
                  size={SELECTOR_SIZE[padSize]}
                  checked={hasChildren ? branchCheckState(node.children!, checkedSet) === 'all' : checkedSet.has(node.id)}
                  indeterminate={hasChildren ? branchCheckState(node.children!, checkedSet) === 'some' : false}
                  disabled={node.disabled}
                  aria-hidden
                />
              </span>
            )}

            {/* Icon */}
            {node.icon && <IconBox icon={node.icon} className={s.icon} />}

            {/* Label */}
            <span className={s.label}>{node.label}</span>

            {/* Dot: selected/checked item is hidden inside this collapsed branch */}
            {hasChildren && !isExpanded && (() => {
              if (multiSelect) {
                return containsAnyInSubtree(node.children!, checkedSet) && <Dot color="brand" />;
              }
              return selectedId != null && containsAnyInSubtree(node.children!, new Set([selectedId])) && <Dot color="brand" />;
            })()}
          </div>

          {/* Children */}
          {hasChildren && (
            <CollapseWrap open={isExpanded}>
              <ul role="group" className={[s.children, showLines && s.lined].filter(Boolean).join(' ')}
                  style={{ '--tree-line-left': linesOutside
                    ? `calc(${depth + 1} * var(--tree-indent) - var(--tree-indent) * 0.5)`
                    : `calc(var(--fui-current-pad-h) + ${depth} * var(--tree-indent) + var(--tree-indent) * 0.5)`
                  } as React.CSSProperties}>
                {node.children!.map((child, i) =>
                  renderNode(child, depth + 1, i === node.children!.length - 1),
                )}
              </ul>
            </CollapseWrap>
          )}
        </li>
      );
    };

    const rootCls = [
      s.tree,
      PAD_CLASS[padSize],
      TEXT_CLASS[textSize],
      showLines && s.showLines,
      linesOutside && s.linesOutside,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <TextSizeProvider size={textSize}>
        <div
          ref={(el) => {
            (rootRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
            if (typeof ref === 'function') ref(el);
            else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
          }}
          role="tree"
          className={rootCls}
          onKeyDown={handleKeyDown}
          onScroll={stickyScroll ? handleScroll : undefined}
          {...rest}
        >
          {stickyHeader}
          <ul className={s.list}>
            {nodes.map((node, i) => renderNode(node, 0, i === nodes.length - 1))}
          </ul>
        </div>
      </TextSizeProvider>
    );
  },
);

Tree.displayName = 'Tree';
