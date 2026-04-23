import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";

/** Matches cream surface on primary button / spinner on dark CTA. */
export const AUTH_ON_PRIMARY = "#FFFDF8";

export const authTitleCls = "text-2xl font-semibold text-kyar-text dark:text-kyar-dark-text";
export const authSubtitleCls = "mt-1 text-kyar-textSecondary dark:text-kyar-dark-textSecondary";
export const authLabelCls = "text-sm font-medium text-kyar-text dark:text-kyar-dark-text";
/** Web `meta-label` — small caps, wide tracking. */
export const authMetaLabelCls =
  "text-[10px] font-bold uppercase tracking-meta text-kyar-meta dark:text-kyar-dark-meta";
export const authInputCls =
  "mt-1 rounded-lg border border-kyar-borderSubtle bg-kyar-surface px-3 py-3 text-base text-kyar-text dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface dark:text-kyar-dark-text";
/** Web sign-in / sign-up field: square border, `text-sm` */
export const authFieldInputCls =
  "mt-1 w-full rounded-none border border-kyar-border bg-kyar-surface px-4 py-3 text-sm text-kyar-text dark:border-kyar-dark-border dark:bg-kyar-dark-surface dark:text-kyar-dark-text";
export const authPrimaryBtnCls =
  "mt-8 w-full items-center rounded-xl bg-kyar-text py-4 active:opacity-90 dark:bg-kyar-dark-text";
/** Web sign-in CTA: full-bleed, square, caps (use with `text-xs uppercase tracking-widest font-semibold text-kyar-bg`) */
export const authPrimaryBtnWebCls =
  "mt-4 w-full items-center rounded-none bg-kyar-text py-3 active:opacity-90 dark:bg-kyar-dark-text";
/** Outlined OAuth / secondary actions (wrap in a column with gap-3) */
export const authOAuthBtnCls =
  "flex-row items-center justify-center gap-2 rounded-xl border border-kyar-borderSubtle bg-transparent py-3.5 active:opacity-90 dark:border-kyar-dark-borderSubtle";
/** Web: Google — `border-kyar-text` */
export const authOAuthGoogleBtnCls =
  "w-full flex-row items-center justify-center gap-3 rounded-none border border-kyar-text bg-transparent py-3 active:opacity-90 dark:border-kyar-dark-text";
/** Web: Apple — `border-kyar-border` */
export const authOAuthAppleBtnCls =
  "w-full flex-row items-center justify-center gap-3 rounded-none border border-kyar-border bg-transparent py-3 active:opacity-90 dark:border-kyar-dark-border";
export const authOAuthLabelCls =
  "text-xs font-semibold uppercase tracking-widest text-kyar-text dark:text-kyar-dark-text";
export const authErrorCls = "mt-3 text-sm text-kyar-danger dark:text-kyar-dark-danger";
export const authSuccessCls = "mt-3 text-sm text-kyar-accent dark:text-kyar-dark-accent";
export const authFooterTextCls =
  "text-center text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary";
export const authFooterEmCls = "font-semibold text-kyar-text dark:text-kyar-dark-text";
export const authLinkCls = "text-sm font-medium text-kyar-accent dark:text-kyar-dark-accent";

export function AuthScreenShell({ children }: { children: ReactNode }) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg"
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
