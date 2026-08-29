import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Link, Tabs } from "expo-router";
import { Pressable } from "react-native";

function TabBarIcon(props: { name: React.ComponentProps<typeof FontAwesome>["name"]; color: string }) {
  return <FontAwesome size={24} style={{ marginBottom: -2 }} name={props.name} color={props.color} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: "#4f46e5",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Cuaderno",
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={String(color)} />,
          headerTitle: "Finanzas",
          headerRight: () => (
            <Link href="/add-transaction" asChild>
              <Pressable style={{ marginRight: 16 }}>
                {({ pressed }) => (
                  <FontAwesome
                    name="plus-circle"
                    size={26}
                    color="#4f46e5"
                    style={{ opacity: pressed ? 0.6 : 1 }}
                  />
                )}
              </Pressable>
            </Link>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Ajustes",
          tabBarIcon: ({ color }) => <TabBarIcon name="cog" color={String(color)} />,
        }}
      />
    </Tabs>
  );
}
