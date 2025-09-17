import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

// Import screens (we'll create these)
import ClosetScreen from './src/screens/ClosetScreen';
import BuildsScreen from './src/screens/BuildsScreen';
import CoordsScreen from './src/screens/CoordsScreen';
import WishlistScreen from './src/screens/WishlistScreen';
import ConventionsScreen from './src/screens/ConventionsScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused, color, size }) => {
              let iconName: keyof typeof Ionicons.glyphMap;

              if (route.name === 'Closet') {
                iconName = focused ? 'shirt' : 'shirt-outline';
              } else if (route.name === 'Builds') {
                iconName = focused ? 'construct' : 'construct-outline';
              } else if (route.name === 'Coords') {
                iconName = focused ? 'color-palette' : 'color-palette-outline';
              } else if (route.name === 'Wishlist') {
                iconName = focused ? 'heart' : 'heart-outline';
              } else if (route.name === 'Conventions') {
                iconName = focused ? 'calendar' : 'calendar-outline';
              } else {
                iconName = 'help-outline';
              }

              return <Ionicons name={iconName} size={size} color={color} />;
            },
            tabBarActiveTintColor: '#8b5cf6',
            tabBarInactiveTintColor: 'gray',
            headerStyle: {
              backgroundColor: '#1e1b4b',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          })}
        >
          <Tab.Screen 
            name="Closet" 
            component={ClosetScreen}
            options={{ title: 'My Closet' }}
          />
          <Tab.Screen 
            name="Builds" 
            component={BuildsScreen}
            options={{ title: 'Builds' }}
          />
          <Tab.Screen 
            name="Coords" 
            component={CoordsScreen}
            options={{ title: 'Coords' }}
          />
          <Tab.Screen 
            name="Wishlist" 
            component={WishlistScreen}
            options={{ title: 'Wishlist' }}
          />
          <Tab.Screen 
            name="Conventions" 
            component={ConventionsScreen}
            options={{ title: 'Conventions' }}
          />
        </Tab.Navigator>
      </NavigationContainer>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1b4b',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
