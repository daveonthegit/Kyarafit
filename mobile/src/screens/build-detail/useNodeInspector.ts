import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import {
  dbFromElementCombined,
  elementCombinedFromDb,
  type ElementCombinedStatus,
} from "@kyarafit/design-system/domain";

type CosplayNodeId = Id<"cosplayNodes">;

export type NodeSelectionMeta = {
  nodeId: CosplayNodeId;
  isRoot: boolean;
  rootIndex?: number;
  parentNodeId?: CosplayNodeId;
  siblingLinkIds?: Id<"cosplayNodeLinks">[];
  siblingIndex?: number;
};

export type InspectorForm = {
  name: string;
  notes: string;
  directCostDollars: string;
  elementCombinedStatus: ElementCombinedStatus;
  materialStatus: string;
};

export type PersistStatus = "saved" | "dirty" | "saving" | "error";

export type DetailedNode = {
  _id: CosplayNodeId;
  name: string;
  nodeType: "element" | "material";
  notes?: string | null;
  directCostCents?: number | null;
  totalCostCents?: number | null;
  imageUrl?: string | null;
  imageStorageId?: Id<"_storage"> | null;
  progressPercent?: number | null;
  overallBucket?: "incomplete" | "in_progress" | "complete";
  purchaseStatus?: string | null;
  buildStatus?: string | null;
  materialStatus?: string | null;
  children?: Array<{
    _id: CosplayNodeId;
    name: string;
    nodeType: "element" | "material";
    linkId: Id<"cosplayNodeLinks">;
    linkMode: "owned" | "reference";
    sortOrder: number;
  }>;
};

type UseNodeInspectorOpts = {
  buildId: Id<"builds">;
  userId: string | null;
};

export function useNodeInspector({ buildId, userId }: UseNodeInspectorOpts) {
  const updateNode = useMutation(api.cosplayNodes.update);
  const removeNodeFromBuild = useMutation(api.builds.removeNodeFromBuild);
  const removeChildLink = useMutation(api.cosplayNodes.removeChildLink);

  const [selected, setSelected] = useState<NodeSelectionMeta | null>(null);
  const [persistStatus, setPersistStatus] = useState<PersistStatus>("saved");
  const [inspectorForm, setInspectorForm] = useState<InspectorForm>({
    name: "",
    notes: "",
    directCostDollars: "",
    elementCombinedStatus: "to_buy",
    materialStatus: "to_buy",
  });

  const inspectorFormRef = useRef(inspectorForm);
  inspectorFormRef.current = inspectorForm;
  const persistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrateKeyRef = useRef<CosplayNodeId | null>(null);

  const selectedDetail = useQuery(
    api.cosplayNodes.get,
    selected ? { id: selected.nodeId, buildId } : "skip"
  ) as DetailedNode | null | undefined;

  const selectedDetailRef = useRef<DetailedNode | null | undefined>(undefined);
  selectedDetailRef.current = selectedDetail;

  useEffect(() => {
    hydrateKeyRef.current = null;
  }, [selected?.nodeId]);

  useEffect(() => {
    const nid = selected?.nodeId;
    if (!nid || !selectedDetail || selectedDetail._id !== nid) return;
    if (hydrateKeyRef.current === nid) return;
    hydrateKeyRef.current = nid;
    setInspectorForm({
      name: selectedDetail.name,
      notes: selectedDetail.notes ?? "",
      directCostDollars:
        selectedDetail.directCostCents != null
          ? (selectedDetail.directCostCents / 100).toFixed(2)
          : "",
      elementCombinedStatus: elementCombinedFromDb(
        selectedDetail.purchaseStatus,
        selectedDetail.buildStatus
      ),
      materialStatus: selectedDetail.materialStatus ?? "to_buy",
    });
    setPersistStatus("saved");
  }, [selected?.nodeId, selectedDetail]);

  const formMatchesDetail = useCallback((form: InspectorForm, detail: DetailedNode) => {
    const directParsed = form.directCostDollars.trim()
      ? Math.round(Number(form.directCostDollars) * 100)
      : null;
    const directOk =
      form.directCostDollars.trim() === "" || !Number.isNaN(directParsed as number);
    const directCents = directOk ? directParsed : detail.directCostCents;
    return (
      form.name.trim() === detail.name &&
      (form.notes.trim() || null) === (detail.notes ?? null) &&
      directCents === (detail.directCostCents ?? null) &&
      (detail.nodeType === "element"
        ? form.elementCombinedStatus ===
          elementCombinedFromDb(detail.purchaseStatus, detail.buildStatus)
        : form.materialStatus === (detail.materialStatus ?? "to_buy"))
    );
  }, []);

  const flushSave = useCallback(async (): Promise<void> => {
    const detail = selectedDetailRef.current;
    if (!userId || !detail) return;
    const form = inspectorFormRef.current;
    const name = form.name.trim();
    if (!name) return;
    if (formMatchesDetail(form, detail)) {
      setPersistStatus("saved");
      return;
    }
    const directParsed = form.directCostDollars.trim()
      ? Math.round(Number(form.directCostDollars) * 100)
      : null;
    if (form.directCostDollars.trim() !== "" && Number.isNaN(directParsed as number)) return;

    setPersistStatus("saving");
    try {
      const elementFields =
        detail.nodeType === "element" ? dbFromElementCombined(form.elementCombinedStatus) : null;
      await updateNode({
        id: detail._id,
        userId,
        name,
        notes: form.notes.trim() || null,
        directCostCents: form.directCostDollars.trim() === "" ? null : directParsed,
        purchaseStatus: elementFields?.purchaseStatus ?? null,
        buildStatus: elementFields?.buildStatus ?? null,
        materialStatus: detail.nodeType === "material" ? form.materialStatus : null,
      });
      setPersistStatus("saved");
    } catch {
      setPersistStatus("error");
    }
  }, [userId, updateNode, formMatchesDetail]);

  const flushSaveRef = useRef(flushSave);
  flushSaveRef.current = flushSave;

  const commitSelection = useCallback(async (meta: NodeSelectionMeta | null) => {
    if (persistDebounceRef.current) {
      clearTimeout(persistDebounceRef.current);
      persistDebounceRef.current = null;
    }
    await flushSaveRef.current();
    setSelected(meta);
  }, []);

  useEffect(() => {
    return () => {
      if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (!userId || !selectedDetail) return;
    if (formMatchesDetail(inspectorForm, selectedDetail)) {
      setPersistStatus((s) => (s === "dirty" ? "saved" : s));
      return;
    }
    if (!inspectorForm.name.trim()) {
      setPersistStatus("dirty");
      return;
    }
    setPersistStatus("dirty");
    if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
    persistDebounceRef.current = setTimeout(() => {
      persistDebounceRef.current = null;
      void flushSaveRef.current();
    }, 500);
    return () => {
      if (persistDebounceRef.current) {
        clearTimeout(persistDebounceRef.current);
        persistDebounceRef.current = null;
      }
    };
  }, [inspectorForm, selectedDetail, userId, formMatchesDetail]);

  const unlinkSelected = useCallback(async () => {
    if (persistDebounceRef.current) {
      clearTimeout(persistDebounceRef.current);
      persistDebounceRef.current = null;
    }
    await flushSaveRef.current();
    if (!userId || !selected) return;
    if (selected.isRoot) {
      await removeNodeFromBuild({ userId, buildId, cosplayNodeId: selected.nodeId });
    } else {
      const linkId = selected.siblingLinkIds?.[selected.siblingIndex ?? -1];
      if (!linkId) return;
      await removeChildLink({ userId, id: linkId });
    }
    setSelected(null);
  }, [userId, selected, buildId, removeNodeFromBuild, removeChildLink]);

  return {
    selected,
    selectedDetail,
    persistStatus,
    inspectorForm,
    setInspectorForm,
    commitSelection,
    flushSave,
    unlinkSelected,
  };
}
