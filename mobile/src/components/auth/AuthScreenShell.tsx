import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import Svg, { Path } from "react-native-svg";

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
/** Web-aligned social action button. Keep providers visually identical. */
export const authSocialBtnCls =
  "w-full flex-row items-center justify-center gap-3 rounded-none border border-kyar-text bg-transparent py-3 active:opacity-90 dark:border-kyar-dark-text";
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

export function GoogleLogo({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  );
}

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
        <View className="h-4" />
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
