"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { clsx } from "clsx";

type TreeContextValue = {
  expandedIds: Set<string>;
  toggleExpanded: (id: string) => void;
  selectedIds: Set<string>;
  setSelectedId: (id: string, addToSelection?: boolean) => void;
  isExpanded: (id: string) => boolean;
  isSelected: (id: string) => boolean;
};

type TreeNodeContextValue = {
  nodeId: string;
  hasChildren: boolean;
};

const TreeContext = createContext<TreeContextValue | null>(null);
const TreeNodeContext = createContext<TreeNodeContextValue | null>(null);

function useTree() {
  const ctx = useContext(TreeContext);
  if (!ctx) throw new Error("Tree components must be used within TreeProvider");
  return ctx;
}

function useTreeNode() {
  return useContext(TreeNodeContext);
}

export interface TreeProviderProps {
  defaultExpandedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  children: ReactNode;
}

export function TreeProvider({
  defaultExpandedIds = [],
  onSelectionChange,
  children,
}: TreeProviderProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(defaultExpandedIds));
  const [selectedIds, setSelectedIdsState] = useState<Set<string>>(new Set());

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setSelectedId = useCallback(
    (id: string, addToSelection?: boolean) => {
      setSelectedIdsState((prev) => {
        const next = addToSelection ? new Set(prev) : new Set<string>();
        if (next.has(id)) next.delete(id);
        else next.add(id);
        onSelectionChange?.(Array.from(next));
        return next;
      });
    },
    [onSelectionChange]
  );

  const isExpanded = useCallback((id: string) => expandedIds.has(id), [expandedIds]);
  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const value = useMemo<TreeContextValue>(
    () => ({
      expandedIds,
      toggleExpanded,
      selectedIds,
      setSelectedId,
      isExpanded,
      isSelected,
    }),
    [expandedIds, toggleExpanded, selectedIds, setSelectedId, isExpanded, isSelected]
  );

  return <TreeContext.Provider value={value}>{children}</TreeContext.Provider>;
}

export function TreeView({ children }: { children: ReactNode }) {
  return (
    <div role="tree" aria-multiselectable="true" className="select-none text-sm text-kyar-text">
      {children}
    </div>
  );
}

export interface TreeNodeProps {
  nodeId: string;
  level?: number;
  isLast?: boolean;
  hasChildren?: boolean;
  children: ReactNode;
}

export function TreeNode({
  nodeId,
  level = 0,
  isLast = false,
  hasChildren = false,
  children,
}: TreeNodeProps) {
  const tree = useTree();
  const expanded = tree.isExpanded(nodeId);
  const nodeCtx = useMemo<TreeNodeContextValue>(
    () => ({ nodeId, hasChildren }),
    [nodeId, hasChildren]
  );
  return (
    <TreeNodeContext.Provider value={nodeCtx}>
      <div
        role="treeitem"
        aria-expanded={hasChildren ? expanded : undefined}
        data-node-id={nodeId}
        data-level={level}
        className={clsx(!isLast && "border-b border-kyar-borderSubtle/50")}
      >
        {children}
      </div>
    </TreeNodeContext.Provider>
  );
}

export function TreeNodeTrigger({
  children,
  onClick,
  ...rest
}: {
  children: ReactNode;
  onClick?: (e: React.MouseEvent) => void;
} & React.HTMLAttributes<HTMLDivElement>) {
  const tree = useTree();
  const node = useTreeNode();
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (node) {
        tree.setSelectedId(node.nodeId, e.ctrlKey || e.metaKey);
        if (node.hasChildren) tree.toggleExpanded(node.nodeId);
      }
      onClick?.(e);
    },
    [node, tree, onClick]
  );
  return (
    <div
      role="button"
      tabIndex={0}
      className="flex items-center gap-1.5 min-h-[32px] px-2 py-1.5 rounded-sm hover:bg-kyar-mutedWarm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-1"
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick(e as unknown as React.MouseEvent);
        }
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function TreeExpander({ hasChildren }: { hasChildren?: boolean }) {
  const tree = useTree();
  const node = useTreeNode();
  const expanded = node ? tree.isExpanded(node.nodeId) : false;
  if (!hasChildren && !node?.hasChildren) {
    return <span className="w-4 shrink-0" aria-hidden />;
  }
  return (
    <span className="w-4 shrink-0 flex items-center justify-center text-kyar-textTertiary">
      <span
        className={clsx(
          "material-symbols-outlined text-base transition-transform",
          expanded && "rotate-90"
        )}
        aria-hidden
      >
        chevron_right
      </span>
    </span>
  );
}

export function TreeIcon({ hasChildren, icon }: { hasChildren?: boolean; icon?: ReactNode }) {
  if (icon) {
    return (
      <span className="shrink-0 text-kyar-textTertiary flex items-center justify-center w-5">
        {icon}
      </span>
    );
  }
  return (
    <span
      className="shrink-0 text-kyar-textTertiary flex items-center justify-center w-5"
      aria-hidden
    >
      {hasChildren ? (
        <span className="material-symbols-outlined text-lg">folder</span>
      ) : (
        <span className="material-symbols-outlined text-lg">description</span>
      )}
    </span>
  );
}

export function TreeLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={clsx("truncate flex-1 min-w-0", className)}>{children}</span>;
}

export interface TreeNodeContentProps {
  hasChildren?: boolean;
  children: ReactNode;
}

export function TreeNodeContent({ hasChildren, children }: TreeNodeContentProps) {
  const tree = useTree();
  const node = useTreeNode();
  const shouldHide = (hasChildren ?? node?.hasChildren) && node && !tree.isExpanded(node.nodeId);
  if (shouldHide) return null;
  return <div className="pl-0">{children}</div>;
}
