import { ScrollView, Pressable, Text } from "react-native";
import { colors, font, ls } from "@kyarafit/design-system/rn";

export type FilterTabItem<T extends string> = {
  id: T;
  label: string;
};

export type FilterTabsProps<T extends string> = {
  tabs: FilterTabItem<T>[];
  active: T;
  onChange: (id: T) => void;
};

export function FilterTabs<T extends string>({ tabs, active, onChange }: FilterTabsProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 12, gap: 0 }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={{ paddingHorizontal: 16, paddingVertical: 8, marginRight: 8 }}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <Text
              style={{
                fontSize: 11,
                fontFamily: font.family.sansWide,
                fontWeight: isActive ? "600" : "500",
                letterSpacing: ls(0.15, 11),
                textTransform: "uppercase",
                color: isActive ? colors.text : colors.textTertiary,
                borderBottomWidth: isActive ? 1 : 0,
                borderBottomColor: colors.text,
                paddingBottom: 4,
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
