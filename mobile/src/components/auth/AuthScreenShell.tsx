import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";

/** Matches cream surface on primary button / spinner on dark CTA. */
export const AUTH_ON_PRIMARY = "#FFFDF8";

export const AUTH_PLACEHOLDER_COLOR = "rgba(23,22,41,0.52)";

export const authTitleCls = "text-2xl font-semibold text-kyar-text";
export const authSubtitleCls = "mt-1 text-kyar-textSecondary";
export const authLabelCls = "text-sm font-medium text-kyar-text";
export const authInputCls =
  "mt-1 rounded-lg border border-kyar-borderSubtle bg-kyar-surface px-3 py-3 text-base text-kyar-text";
export const authPrimaryBtnCls =
  "mt-8 items-center rounded-xl bg-kyar-text py-4 active:opacity-90";
/** Outlined OAuth / secondary actions (wrap in a column with gap-3) */
export const authOAuthBtnCls =
  "flex-row items-center justify-center gap-2 rounded-xl border border-kyar-borderSubtle bg-transparent py-3.5 active:opacity-90";
export const authErrorCls = "mt-3 text-sm text-kyar-danger";
export const authSuccessCls = "mt-3 text-sm text-emerald-800";
export const authFooterTextCls = "text-center text-sm text-kyar-textSecondary";
export const authFooterEmCls = "font-semibold text-kyar-text";
export const authLinkCls = "text-sm font-medium text-kyar-accent";

export function AuthScreenShell({ children }: { children: ReactNode }) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-kyar-bg"
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        className="flex-1"
        contentContainerClassName="grow px-6 pb-10 pt-4"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
