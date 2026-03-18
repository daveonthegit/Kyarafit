"use client";

import {
  TreeExpander,
  TreeIcon,
  TreeLabel,
  TreeNode,
  TreeNodeContent,
  TreeNodeTrigger,
  TreeProvider,
  TreeView,
} from "@/components/kibo-ui/tree";

export interface ConventionDay {
  date: string;
  buildName: string | null;
}

export interface ConventionOutlineTreeProps {
  conventionName: string;
  days: ConventionDay[];
  onSelect: (id: string) => void;
  defaultExpandedIds?: string[];
}

function formatDayLabel(date: string, index: number, buildName: string | null): string {
  const d = new Date(date);
  const short = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const label = buildName
    ? `D${index + 1}: ${short} – ${buildName}`
    : `D${index + 1}: ${short} (Rest day)`;
  return label;
}

export function ConventionOutlineTree({
  conventionName,
  days,
  onSelect,
  defaultExpandedIds = ["convention", "timeline"],
}: ConventionOutlineTreeProps) {
  return (
    <TreeProvider
      defaultExpandedIds={defaultExpandedIds}
      onSelectionChange={(ids) => {
        const id = ids[ids.length - 1];
        if (id) onSelect(id);
      }}
    >
      <TreeView>
        <TreeNode nodeId="convention" hasChildren>
          <TreeNodeTrigger>
            <TreeExpander hasChildren />
            <TreeIcon hasChildren />
            <TreeLabel>{conventionName}</TreeLabel>
          </TreeNodeTrigger>
          <TreeNodeContent hasChildren>
            <TreeNode level={1} nodeId="timeline" hasChildren={days.length > 0}>
              <TreeNodeTrigger>
                <TreeExpander hasChildren />
                <TreeIcon hasChildren />
                <TreeLabel>Timeline ({days.length} days)</TreeLabel>
              </TreeNodeTrigger>
              <TreeNodeContent hasChildren>
                {days.map((day, i) => (
                  <TreeNode
                    key={day.date}
                    level={2}
                    nodeId={`day-${day.date}`}
                    isLast={i === days.length - 1}
                  >
                    <TreeNodeTrigger>
                      <TreeExpander />
                      <TreeIcon
                        icon={
                          <span className="material-symbols-outlined text-lg">
                            {day.buildName ? "checkroom" : "event_available"}
                          </span>
                        }
                      />
                      <TreeLabel>{formatDayLabel(day.date, i, day.buildName)}</TreeLabel>
                    </TreeNodeTrigger>
                  </TreeNode>
                ))}
              </TreeNodeContent>
            </TreeNode>
            <TreeNode level={1} nodeId="logistics" isLast>
              <TreeNodeTrigger>
                <TreeExpander />
                <TreeIcon
                  icon={<span className="material-symbols-outlined text-lg">inventory_2</span>}
                />
                <TreeLabel>Logistics &amp; packing</TreeLabel>
              </TreeNodeTrigger>
            </TreeNode>
          </TreeNodeContent>
        </TreeNode>
      </TreeView>
    </TreeProvider>
  );
}
