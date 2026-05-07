import React from 'react'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { SafeAreaView, Text, View } from 'react-native'

const Tab = createBottomTabNavigator()

function Screen({ title, body }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#090B17' }}>
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <Text style={{ color: '#f8fafc', fontSize: 28, fontWeight: '700', marginBottom: 12 }}>{title}</Text>
        <Text style={{ color: '#94a3b8', fontSize: 16, lineHeight: 24 }}>{body}</Text>
      </View>
    </SafeAreaView>
  )
}

function LoginScreen() {
  return <Screen title="Login" body="Auth placeholder wired for the existing Melody Map backend contract." />
}

function HomeScreen() {
  return <Screen title="Home" body="Mobile home scaffold for dashboard summaries, live listening state, and quick actions." />
}

function IdentityScreen() {
  return <Screen title="Identity" body="Identity summaries, drift snapshots, and shareable card surfaces will live here." />
}

function SoulOrbScreen() {
  return <Screen title="Soul Orb" body="A focused native Soul Orb placeholder powered by the same backend profile and live signal endpoints." />
}

function DiscoverScreen() {
  return <Screen title="Discover" body="Discover recommendations will reuse the current recommendation vertical contract." />
}

function SoulmatesScreen() {
  return <Screen title="Soulmates" body="Social soulmate matching will reuse the web API endpoints for public taste profiles and requests." />
}

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#090B17',
    card: '#0F1224',
    text: '#F8FAFC',
    primary: '#8F75FF',
    border: '#1E293B',
  },
}

export default function App() {
  return (
    <NavigationContainer theme={theme}>
      <Tab.Navigator screenOptions={{ headerShown: false }}>
        <Tab.Screen name="Login" component={LoginScreen} />
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Identity" component={IdentityScreen} />
        <Tab.Screen name="Soul Orb" component={SoulOrbScreen} />
        <Tab.Screen name="Discover" component={DiscoverScreen} />
        <Tab.Screen name="Soulmates" component={SoulmatesScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  )
}
