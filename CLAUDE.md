# Momentum - Project Guidelines

## Tech Stack

This project uses a modern mobile-first stack optimized for rapid development with AI assistance:

| Component | Purpose | Notes |
|-----------|---------|-------|
| **Claude Code** | AI pair programming | Handles ~90% of logic implementation |
| **Expo SDK 54 + Router** | Cross-platform mobile | iOS/Android from single codebase |
| **NativeWind v4** | Styling | Tailwind CSS for React Native |
| **Supabase** | Backend | Auth, Database, Realtime, Storage |
| **Supabase MCP** | AI Integration | Direct database access for Claude |
| **Zustand** | State Management | Lightweight, persistent stores |
| **React Query** | Server State | Caching, background refetching |

## Styling with NativeWind

**Always prefer NativeWind classes over StyleSheet.create()**

```tsx
// ✅ Preferred - NativeWind
<View className="bg-bg-secondary p-4 rounded-xl">
  <Text className="text-text-primary text-base font-semibold">Hello</Text>
</View>

// ❌ Avoid - StyleSheet
<View style={styles.container}>
  <Text style={styles.text}>Hello</Text>
</View>
```

### Custom Color Tokens

Defined in `tailwind.config.js`:

```
Backgrounds:    bg-bg-primary, bg-bg-secondary, bg-bg-tertiary
Text:           text-text-primary, text-text-secondary, text-text-muted
Accent:         bg-accent, bg-accent-light, bg-accent-dark, text-accent
Border:         border-border, border-border-light
Status:         bg-success, bg-warning, bg-error, bg-info
```

### Common Patterns

```tsx
// Card
<View className="bg-bg-secondary rounded-xl p-4">

// Button
<TouchableOpacity className="bg-accent py-4 rounded-xl items-center">
  <Text className="text-text-primary font-semibold">Button</Text>
</TouchableOpacity>

// Input
<TextInput className="bg-bg-secondary rounded-xl p-4 text-text-primary border border-border" />

// Flex row with gap
<View className="flex-row items-center gap-4">
```

## Supabase MCP

Claude has direct access to the Supabase project via MCP. Use it for:
- Querying the database schema
- Generating type-safe queries
- Creating/modifying tables and migrations
- Debugging data issues

**Project ID:** `zrjsbkpzqnkzdustqvgf`

## Project Structure

```
app/                    # Expo Router pages
  (auth)/              # Auth screens (sign-in, sign-up)
  (tabs)/              # Main tab navigation
  workout/             # Workout flow screens
components/            # Reusable components
  home/               # Home screen components
  profile/            # Profile components
  workout/            # Workout components
constants/             # Colors, default data
hooks/                 # Custom React hooks
lib/                   # Utilities (supabase client, alerts)
services/              # Business logic, API calls
stores/                # Zustand state stores
types/                 # TypeScript types
```

## Database Tables

Key Supabase tables:
- `profiles` - User profiles
- `user_stats` - Aggregated user statistics
- `exercises` - Exercise library
- `workout_sessions` - Completed workouts
- `workout_sets` - Individual sets within workouts
- `custom_workouts` - User-created workout templates

## Development Commands

```bash
# Start development
npx expo start --clear

# iOS simulator
npx expo start --ios

# Android emulator
npx expo start --android

# Type check
npx tsc --noEmit
```

## Code Style

- Use TypeScript for all files
- Prefer functional components with hooks
- Use NativeWind for styling (not StyleSheet)
- Keep components small and focused
- Extract reusable logic into custom hooks
- Use Zustand for client state, React Query for server state

## UI Guidelines

Reference `/ui-skills` for:
- Accessible component primitives
- Animation constraints (opacity/transform only, <200ms)
- Typography rules (text-balance, tabular-nums for data)
- Layout patterns (consistent z-index scale)
