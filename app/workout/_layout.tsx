import { Stack } from 'expo-router';

export default function WorkoutLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'fullScreenModal',
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="active" />
      <Stack.Screen name="summary" />
      <Stack.Screen name="[sessionId]" />
    </Stack>
  );
}
