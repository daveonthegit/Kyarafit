import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '@kyarafit/design-system/rn';

const packingData = [
  { section: 'Arlecchino', items: ['Custom Wig', 'Tailored Coat', 'Pointed Boots', 'Glove Set'] },
  { section: 'Emergency Kit', items: ['Hot Glue Gun', 'Safety Pins'] },
];

export default function PackingScreen() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [selectedCon, setSelectedCon] = useState('Anime Expo');

  const toggle = (item: string) => setChecked((prev) => ({ ...prev, [item]: !prev[item] }));

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.metaLabel}>Logistics</Text>
            <Text style={styles.title}>Packing List</Text>
          </View>
          <View style={styles.conventionSelector}>
            <Text style={styles.selectorLabel}>Convention</Text>
            <Pressable style={styles.selectorBtn}>
              <Text style={styles.selectorValue}>{selectedCon}</Text>
              <Ionicons name="chevron-down" size={12} color={colors.black} />
            </Pressable>
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {packingData.map(({ section, items }) => (
            <View key={section} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section}</Text>
                <Text style={styles.itemCount}>{items.length} Items</Text>
              </View>
              <View style={styles.itemsList}>
                {items.map((item) => (
                  <Pressable key={item} style={styles.item} onPress={() => toggle(item)}>
                    <View style={[styles.checkbox, checked[item] && styles.checkboxChecked]}>
                      {checked[item] && <View style={styles.checkboxInner} />}
                    </View>
                    <Text style={[styles.itemLabel, checked[item] && styles.itemLabelChecked]}>{item}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 140 },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-end', 
    paddingHorizontal: 24, 
    paddingTop: 48, 
    paddingBottom: 24 
  },
  metaLabel: { 
    fontSize: 9, 
    letterSpacing: 2, 
    textTransform: 'uppercase', 
    fontWeight: '600', 
    color: 'rgba(0,0,0,0.5)', 
    marginBottom: 4 
  },
  title: { 
    fontFamily: font.serif, 
    fontSize: 28, 
    fontWeight: 'bold', 
    fontStyle: 'italic', 
    color: colors.black,
    letterSpacing: -0.5,
  },
  conventionSelector: { alignItems: 'flex-end' },
  selectorLabel: { 
    fontSize: 8, 
    textTransform: 'uppercase', 
    letterSpacing: 2, 
    color: 'rgba(0,0,0,0.4)', 
    marginBottom: 4 
  },
  selectorBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4 
  },
  selectorValue: { 
    fontSize: 10, 
    textTransform: 'uppercase', 
    letterSpacing: 2, 
    fontWeight: 'bold', 
    color: colors.black 
  },
  content: { paddingHorizontal: 24, gap: 40 },
  section: {},
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    borderBottomWidth: 1, 
    borderBottomColor: colors.black, 
    paddingBottom: 8, 
    marginBottom: 24 
  },
  sectionTitle: { 
    fontFamily: font.serif, 
    fontSize: 20, 
    fontWeight: 'bold', 
    fontStyle: 'italic', 
    color: colors.black,
    letterSpacing: -0.3,
  },
  itemCount: { fontSize: 9, color: 'rgba(0,0,0,0.4)' },
  itemsList: { gap: 20 },
  item: { flexDirection: 'row', alignItems: 'center' },
  checkbox: { 
    width: 16, 
    height: 16, 
    borderWidth: 0.5, 
    borderColor: colors.black, 
    marginRight: 16, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  checkboxChecked: { backgroundColor: colors.black },
  checkboxInner: { width: 8, height: 8, backgroundColor: colors.white },
  itemLabel: { 
    fontSize: 13, 
    textTransform: 'uppercase', 
    letterSpacing: 1, 
    color: colors.black, 
    flex: 1 
  },
  itemLabelChecked: { textDecorationLine: 'line-through', opacity: 0.5 },
});
