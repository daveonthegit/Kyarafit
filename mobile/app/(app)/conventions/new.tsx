import { Alert } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { api } from "convex/_generated/api";
import { APP_HREF } from "@/lib/appRoutes";
import { ConventionForm } from "@/screens/conventions/ConventionForm";
import { useOfflineMutation, useOfflineQuery } from "@/offline";
import { DataBoundary } from "@/ui";

type Ready = { userId: string };

export default function NewConventionScreen() {
  const { t } = useTranslation();
  const identity = useOfflineQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;

  const loading = identity === undefined;
  const error = identity === null ? new Error(t("builds.loadError")) : undefined;

  let status: "loading" | "error" | "empty" | "ready";
  if (loading) status = "loading";
  else if (error) status = "error";
  else if (!userId) status = "empty";
  else status = "ready";

  const data: Ready | undefined = status === "ready" && userId ? { userId } : undefined;

  return (
    <>
      <Stack.Screen options={{ title: t("conventions.createAction") }} />
      <DataBoundary status={status} data={data} error={error}>
        {(loaded) => <NewConventionBody userId={loaded.userId} />}
      </DataBoundary>
    </>
  );
}

function NewConventionBody({ userId }: Ready) {
  const { t } = useTranslation();
  const router = useRouter();
  const createConvention = useOfflineMutation(api.conventions.create);

  return (
    <ConventionForm
      eyebrow={t("conventions.eyebrow")}
      title={t("conventions.newTitle")}
      subtitle={t("conventions.newSubtitle")}
      submitLabel={t("conventions.createAction")}
      submittingLabel={t("conventions.creating")}
      onSubmit={async (values) => {
        try {
          const created = await createConvention({
            userId,
            name: values.name,
            location: values.location,
            startDate: values.startDate,
            endDate: values.endDate,
            imageStorageId: values.imageStorageId,
            imageUrl: values.imageUrl,
          });
          if (created?._id) {
            router.replace(APP_HREF.convention(created._id));
          }
        } catch (error) {
          Alert.alert(
            t("common.errorTitle"),
            String(error instanceof Error ? error.message : error)
          );
        }
      }}
    />
  );
}
