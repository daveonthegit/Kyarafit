import { Alert } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import type { Doc, Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import { APP_HREF } from "@/lib/appRoutes";
import { ConventionForm } from "@/screens/conventions/ConventionForm";
import { DataBoundary } from "@/ui";

type Ready = {
  userId: string;
  convention: Doc<"conventions">;
};

export default function EditConventionScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;
  const convention = useQuery(api.conventions.get, id ? { id: id as Id<"conventions"> } : "skip");

  const loading = identity === undefined || (userId != null && convention === undefined);
  const error =
    identity === null
      ? new Error(t("builds.loadError"))
      : convention === null
        ? new Error(t("conventions.notFound"))
        : undefined;

  let status: "loading" | "error" | "empty" | "ready";
  if (loading) status = "loading";
  else if (error) status = "error";
  else if (!userId || !convention) status = "empty";
  else status = "ready";

  const data: Ready | undefined =
    status === "ready" && userId && convention ? { userId, convention } : undefined;

  return (
    <>
      <Stack.Screen options={{ title: t("conventions.editAction") }} />
      <DataBoundary status={status} data={data} error={error}>
        {(loaded) => <EditConventionBody {...loaded} />}
      </DataBoundary>
    </>
  );
}

function EditConventionBody({ userId, convention }: Ready) {
  const { t } = useTranslation();
  const router = useRouter();
  const updateConvention = useMutation(api.conventions.update);

  return (
    <ConventionForm
      eyebrow={t("conventions.eyebrow")}
      title={t("conventions.editTitle")}
      subtitle={t("conventions.editSubtitle")}
      submitLabel={t("conventions.saveAction")}
      submittingLabel={t("conventions.saving")}
      initialValues={{
        name: convention.name,
        location: convention.location,
        startDate: convention.startDate,
        endDate: convention.endDate,
        imageStorageId: convention.imageStorageId,
        imageUrl: convention.imageUrl,
      }}
      onSubmit={async (values) => {
        try {
          await updateConvention({
            id: convention._id,
            userId,
            name: values.name,
            location: values.location,
            startDate: values.startDate,
            endDate: values.endDate,
            imageStorageId: values.imageStorageId,
            imageUrl: values.imageUrl,
          });
          router.replace(APP_HREF.convention(convention._id));
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
