
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="splash" /> {/* Splash screen first */}
        <Stack.Screen name="index" /> {/* Your barcode scanner */}
        <Stack.Screen name="manual-entry" /> {/* Manual entry screen */}
      </Stack>
    </>
  );
}