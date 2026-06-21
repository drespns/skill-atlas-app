import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-reanimated";

import { AuthGate } from "@/components/AuthGate";
import { useColorScheme } from "@/components/useColorScheme";
import { AuthProvider } from "@/lib/auth-context";
import { ExpenseProvider } from "@/lib/expense-context";

export { ErrorBoundary } from "expo-router";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <AuthProvider>
      <ExpenseProvider>
        <AuthGate>
          <RootLayoutNav />
        </AuthGate>
      </ExpenseProvider>
    </AuthProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="add-transaction"
          options={{ presentation: "modal", title: "Nuevo movimiento" }}
        />
        <Stack.Screen
          name="unlock-e2e"
          options={{ presentation: "modal", title: "Desbloquear cuaderno" }}
        />
      </Stack>
    </ThemeProvider>
  );
}
