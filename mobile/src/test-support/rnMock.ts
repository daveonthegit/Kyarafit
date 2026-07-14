/**
 * Minimal React Native → DOM shim for the offline vitest (jsdom) runner. RN cannot execute under
 * vitest, so component tests map the handful of primitives we use onto DOM nodes, forwarding the
 * accessibility props our screens rely on. Imported inside `vi.mock("react-native", ...)` factories.
 */
export async function createReactNativeMock() {
  const { createElement, forwardRef } = await import("react");

  type AnyProps = Record<string, unknown> & { children?: unknown };

  function rnComponent(tag: string, asInput = false) {
    return forwardRef(function RNComp(props: AnyProps, ref: unknown) {
      const {
        children,
        onPress,
        onChangeText,
        accessibilityLabel,
        accessibilityRole,
        accessibilityState,
        testID,
        value,
        placeholder,
        disabled,
        multiline: _multiline,
        editable: _editable,
        keyboardType: _keyboardType,
        placeholderTextColor: _placeholderTextColor,
        numberOfLines: _numberOfLines,
        textAlignVertical: _textAlignVertical,
        showsHorizontalScrollIndicator: _showsHorizontalScrollIndicator,
        horizontal: _horizontal,
        className: _className,
        style: _style,
        ...rest
      } = props;

      const state = (accessibilityState ?? {}) as { checked?: boolean; disabled?: boolean };
      const mapped: Record<string, unknown> = {
        ref,
        "aria-label": accessibilityLabel,
        role: accessibilityRole,
        "data-testid": testID,
        ...rest,
      };
      if ("checked" in state) mapped["aria-checked"] = String(Boolean(state.checked));
      if ("disabled" in state) mapped["aria-disabled"] = String(Boolean(state.disabled));
      if (disabled) mapped["aria-disabled"] = "true";
      if (onPress && !disabled) mapped.onClick = onPress;

      if (asInput) {
        mapped.value = (value as string) ?? "";
        mapped.placeholder = placeholder;
        if (onChangeText) {
          mapped.onChange = (event: { target: { value: string } }) =>
            (onChangeText as (text: string) => void)(event.target.value);
        }
        return createElement(tag, mapped);
      }
      return createElement(tag, mapped, children as never);
    });
  }

  function Modal(props: AnyProps) {
    if (props.visible === false) return null;
    return createElement("div", { "data-testid": "modal" }, props.children as never);
  }

  // Animated/Easing shims for glass primitives (GlassSheet, PhotoBackdrop):
  // values are inert, animations resolve immediately.
  class AnimatedValue {
    constructor(public value: number) {}
    setValue(v: number) {
      this.value = v;
    }
    interpolate() {
      return this;
    }
  }
  const finished = { start: (cb?: (r: { finished: boolean }) => void) => cb?.({ finished: true }), stop: () => {} };
  const Animated = {
    Value: AnimatedValue,
    timing: () => finished,
    parallel: () => finished,
    sequence: () => finished,
    loop: () => finished,
    View: rnComponent("div"),
    Text: rnComponent("span"),
  };
  const Easing = {
    bezier: () => (t: number) => t,
    inOut: (fn: unknown) => fn,
    ease: (t: number) => t,
  };

  return {
    View: rnComponent("div"),
    Text: rnComponent("span"),
    Pressable: rnComponent("div"),
    ScrollView: rnComponent("div"),
    TextInput: rnComponent("input", true),
    TextField: rnComponent("input", true),
    ActivityIndicator: rnComponent("div"),
    Modal,
    Alert: { alert: () => {} },
    Animated,
    Easing,
    StyleSheet: {
      absoluteFill: {},
      absoluteFillObject: {},
      create: (styles: Record<string, unknown>) => styles,
      flatten: (style: unknown) => style,
      hairlineWidth: 1,
    },
    Platform: { OS: "ios", select: (spec: Record<string, unknown>) => spec.ios ?? spec.default },
    useWindowDimensions: () => ({ width: 390, height: 844, scale: 2, fontScale: 1 }),
    AccessibilityInfo: {
      isReduceMotionEnabled: () => Promise.resolve(false),
      addEventListener: () => ({ remove: () => {} }),
    },
    Image: rnComponent("img"),
    RefreshControl: rnComponent("div"),
    FlatList: rnComponent("div"),
  };
}
