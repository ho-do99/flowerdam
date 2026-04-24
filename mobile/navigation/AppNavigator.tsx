import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function HomeStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="HomeTab" component={HomeScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#FF6B6B',
          tabBarInactiveTintColor: '#999',
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeStack}
          options={{
            tabBarLabel: '홈',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🏠</Text>,
          }}
        />
        <Tab.Screen
          name="Orders"
          component={HomeScreen}
          options={{
            tabBarLabel: '주문',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📦</Text>,
          }}
        />
        <Tab.Screen
          name="Profile"
          component={HomeScreen}
          options={{
            tabBarLabel: '프로필',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👤</Text>,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

import { Text } from 'react-native';
