import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, font } from "@kyarafit/design-system/rn";

type TabIconProps = {
  focused: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
};

function TabIcon({ focused, icon, label }: TabIconProps) {
  return (
    <View style={styles.tabItem}>
      <Ionicons name={icon} size={24} color={focused ? colors.black : "rgba(0,0,0,0.3)"} />
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
      {focused && <View style={styles.tabDot} />}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="home-outline" label="Home" />
          ),
        }}
      />
      <Tabs.Screen
        name="builds"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="layers-outline" label="Builds" />
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="calendar-outline" label="Plan" />
          ),
        }}
      />
      <Tabs.Screen
        name="packing"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="cube-outline" label="Packing" />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderTopWidth: 1,
    borderTopColor: "#f3f3f3",
    height: 100,
    paddingTop: 12,
    paddingBottom: 32,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  tabLabel: {
    fontFamily: font.sansSerif,
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontWeight: "600",
    color: "rgba(0,0,0,0.3)",
  },
  tabLabelActive: {
    color: colors.black,
  },
  tabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.black,
    marginTop: 2,
  },
});
