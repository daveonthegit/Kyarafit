import { useCallback, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { REPLICA_META_FIELDS } from "@kyarafit/design-system/domain/replicaProtocol";
import { glass } from "@kyarafit/design-system/rn";
import { APP_HREF } from "@/lib/appRoutes";
import { getActiveReplicator, getActiveVault } from "@/vault/activeVault";
import { useActiveVault } from "@/vault/hooks";
import { restoreChange, type ChangeNotApplied } from "@/vault/replica/conflicts";
import { useChangesNotApplied } from "@/vault/replica/hooks";
import {
  SettingsGlassFrame,
  SettingsGlassSection,
  settingsGlassStyles as styles,
} from "@/screens/settings/glassSettings";
import { GlassEmptyState, PhotoPill } from "@/ui/glass";

const KIND_KEYS: Record<ChangeNotApplied["kind"], string> = {
  "concurrent-field-edit": "concurrent",
  "edit-after-delete": "editAfterDelete",
  "delete-over-unseen-edit": "deletedWithEdits",
  "orphan-recovered": "recovered",
  "orphan-unlinked": "unlinked",
  "orphan-removed": "removed",
};

const MAX_VALUE_LENGTH = 120;

function humanize(field: string): string {
  const words = field.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The user-visible values a change carries (no bookkeeping, ids or nested structures). */
function visibleValues(change: ChangeNotApplied): [string, unknown][] {
  return Object.entries(change.lost).filter(
    ([key, value]) =>
      !REPLICA_META_FIELDS.has(key) &&
      !key.startsWith("_") &&
      key !== "userId" &&
      !/Ids?$/.test(key) &&
      (value === null || ["string", "number", "boolean"].includes(typeof value))
  );
}

function ChangeRow({
  change,
  onRestore,
  onDismiss,
  showBuildLink,
}: {
  change: ChangeNotApplied;
  onRestore: (change: ChangeNotApplied) => void;
  onDismiss: (change: ChangeNotApplied) => void;
  showBuildLink: boolean;
}) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const kind = KIND_KEYS[change.kind];
  const values = change.action === "restore-fields" ? visibleValues(change) : [];
  const when = new Date(change.createdAt).toLocaleString(i18n.language, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const buildExists = change.buildId != null && getActiveVault()?.reader().get(change.buildId);
  const format = (value: unknown) => {
    if (value === null || value === "") return t("sync.changes.emptyValue");
    if (typeof value === "boolean") return value ? t("sync.changes.yes") : t("sync.changes.no");
    const text = String(value);
    return text.length > MAX_VALUE_LENGTH ? `${text.slice(0, MAX_VALUE_LENGTH)}…` : text;
  };

  return (
    <SettingsGlassSection label={t(`sync.changes.kind.${kind}`)}>
      <Text style={styles.value} numberOfLines={2}>
        {change.label ?? t("sync.changes.untitled")}
      </Text>
      <Text style={styles.body}>{t(`sync.changes.explain.${kind}`)}</Text>
      {values.length > 0 ? (
        <View style={{ gap: 4 }}>
          {values.map(([field, value]) => (
            <Text key={field} style={styles.body}>
              <Text style={{ color: glass.text.fg }}>{humanize(field)}</Text>
              {`  ${format(value)}`}
            </Text>
          ))}
        </View>
      ) : null}
      {change.action !== "acknowledge" && !change.restorable ? (
        <Text style={styles.body}>
          {t(
            change.action === "restore-fields" ? "sync.changes.goneItem" : "sync.changes.goneParent"
          )}
        </Text>
      ) : null}
      <Text style={[styles.label, { textTransform: "none", letterSpacing: 0 }]}>{when}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        {change.action !== "acknowledge" && change.restorable ? (
          <PhotoPill
            variant="outline"
            icon="arrow-undo-outline"
            label={t(
              change.action === "restore-fields"
                ? "sync.changes.useMine"
                : "sync.changes.restoreAsNew"
            )}
            onPress={() => onRestore(change)}
          />
        ) : null}
        {showBuildLink && change.action === "acknowledge" && buildExists ? (
          <PhotoPill
            variant="outline"
            icon="open-outline"
            label={t("sync.changes.openBuild")}
            onPress={() => router.push(APP_HREF.build(change.buildId!))}
          />
        ) : null}
        <PhotoPill
          variant="text"
          label={t(
            change.action === "acknowledge" ? "sync.changes.acknowledge" : "sync.changes.dismiss"
          )}
          onPress={() => onDismiss(change)}
        />
      </View>
    </SettingsGlassSection>
  );
}

/**
 * Managed sync's "changes that didn't apply" (owner decision 2): every value a conflict
 * overwrote or a delete removed, newest first, with one-tap restore as a new edit. Opened from
 * Settings → Offline (all builds) or from a build (just that build's).
 */
export function ChangesNotAppliedScreen({ buildId }: { buildId?: string }) {
  const { t } = useTranslation();
  const vault = useActiveVault();
  const changes = useChangesNotApplied(buildId);
  const [busy, setBusy] = useState(false);
  const buildName = buildId ? vault?.reader().get(buildId)?.name : undefined;

  const resolve = useCallback((change: ChangeNotApplied) => {
    getActiveReplicator()?.resolveConflicts([change.id]);
  }, []);

  const onRestore = useCallback(
    (change: ChangeNotApplied) => {
      if (busy || !vault) return;
      setBusy(true);
      try {
        restoreChange(vault, change);
        resolve(change);
      } catch (error) {
        Alert.alert(
          t("common.errorTitle"),
          error instanceof Error ? error.message : t("sync.changes.restoreFailed")
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, resolve, t, vault]
  );

  return (
    <SettingsGlassFrame
      eyebrow={t("settings.cloudSync")}
      title={t("sync.changes.title")}
      description={
        typeof buildName === "string"
          ? t("sync.changes.introBuild", { name: buildName })
          : t("sync.changes.intro")
      }
    >
      {changes.length === 0 ? (
        <GlassEmptyState
          icon="checkmark-done-outline"
          message={t("sync.changes.emptyTitle")}
          secondary={t("sync.changes.emptyBody")}
        />
      ) : (
        changes.map((change) => (
          <ChangeRow
            key={change.id}
            change={change}
            onRestore={onRestore}
            onDismiss={resolve}
            showBuildLink={!buildId}
          />
        ))
      )}
    </SettingsGlassFrame>
  );
}
