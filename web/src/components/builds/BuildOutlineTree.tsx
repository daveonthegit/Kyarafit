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
import type { Id } from "convex/_generated/dataModel";

export interface BuildOutlineTreeProps {
  buildName: string;
  tasks: Array<{ _id: Id<"workflowItems">; label: string; checked: boolean }>;
  linkedItems: Array<{ _id: Id<"cosplayNodes">; name: string }>;
  onSelect: (id: string) => void;
  defaultExpandedIds?: string[];
}

export function BuildOutlineTree({
  buildName,
  tasks,
  linkedItems,
  onSelect,
  defaultExpandedIds = ["build", "tasks", "items"],
}: BuildOutlineTreeProps) {
  const hasTasks = tasks.length > 0;
  const hasItems = linkedItems.length > 0;

  return (
    <TreeProvider
      defaultExpandedIds={defaultExpandedIds}
      onSelectionChange={(ids) => {
        const id = ids[ids.length - 1];
        if (id) onSelect(id);
      }}
    >
      <TreeView>
        <TreeNode nodeId="build" hasChildren>
          <TreeNodeTrigger>
            <TreeExpander hasChildren />
            <TreeIcon hasChildren />
            <TreeLabel>{buildName}</TreeLabel>
          </TreeNodeTrigger>
          <TreeNodeContent hasChildren>
            <TreeNode level={1} nodeId="tasks" hasChildren={hasTasks}>
              <TreeNodeTrigger>
                <TreeExpander hasChildren />
                <TreeIcon hasChildren />
                <TreeLabel>Tasks ({tasks.length})</TreeLabel>
              </TreeNodeTrigger>
              <TreeNodeContent hasChildren>
                {tasks.map((task, i) => (
                  <TreeNode
                    key={task._id}
                    level={2}
                    nodeId={`task-${task._id}`}
                    isLast={!hasItems && i === tasks.length - 1}
                  >
                    <TreeNodeTrigger>
                      <TreeExpander />
                      <TreeIcon
                        icon={
                          <span
                            className={`material-symbols-outlined text-lg ${
                              task.checked ? "text-kyar-textTertiary" : ""
                            }`}
                          >
                            {task.checked ? "check_circle" : "radio_button_unchecked"}
                          </span>
                        }
                      />
                      <TreeLabel
                        className={task.checked ? "line-through text-kyar-textTertiary" : ""}
                      >
                        {task.label}
                      </TreeLabel>
                    </TreeNodeTrigger>
                  </TreeNode>
                ))}
              </TreeNodeContent>
            </TreeNode>
            <TreeNode level={1} nodeId="items" isLast hasChildren={hasItems}>
              <TreeNodeTrigger>
                <TreeExpander hasChildren />
                <TreeIcon hasChildren />
                <TreeLabel>Linked items ({linkedItems.length})</TreeLabel>
              </TreeNodeTrigger>
              <TreeNodeContent hasChildren>
                {linkedItems.map((item, i) => (
                  <TreeNode
                    key={item._id}
                    level={2}
                    nodeId={`item-${item._id}`}
                    isLast={i === linkedItems.length - 1}
                  >
                    <TreeNodeTrigger>
                      <TreeExpander />
                      <TreeIcon
                        icon={<span className="material-symbols-outlined text-lg">checkroom</span>}
                      />
                      <TreeLabel>{item.name}</TreeLabel>
                    </TreeNodeTrigger>
                  </TreeNode>
                ))}
              </TreeNodeContent>
            </TreeNode>
          </TreeNodeContent>
        </TreeNode>
      </TreeView>
    </TreeProvider>
  );
}
