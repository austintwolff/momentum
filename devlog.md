# Devlog

---
## [14:32] Implement audit fixes - Part 1 & Part 2

**What:** Applied security, build, and performance fixes from codebase audit: renamed service role env var to prevent client exposure, replaced macOS-only sed with cross-platform Node.js script, added database index on completed_at, optimized select queries to fetch only needed columns, and consolidated useWorkoutStats from 2 queries to 1.

**Why:** Security: EXPO_PUBLIC_ prefix could embed secrets in client builds. Performance: select('*') fetches unnecessary data, and 2 sequential queries can be 1. Portability: sed -i '' fails on Linux CI/CD.

**Files:** scripts/import-strong-data.js, scripts/backfill-workout-scores.ts, .env, .env.example, package.json, scripts/fix-web-paths.js, supabase/migrations/00008_add_completed_at_index.sql, services/workout.service.ts, services/exercise-sync.service.ts, hooks/useWorkoutStats.ts

**Concepts:** Environment variable security, EXPO_PUBLIC_ prefix behavior, cross-platform build scripts, database indexing, query optimization, N+1 query consolidation

---

---
## [15:45] Clean up exercise database data

**What:** Ran three rounds of SQL migrations against Supabase to fix exercise data: removed equipment from exercise names (e.g., "Arnold Press (Dumbbell)" → "Arnold Press"), standardized muscle_group capitalization to Title Case, fixed incorrect exercise_type/equipment values, and merged duplicate exercises by re-pointing workout_sets and exercise_baselines foreign keys before deleting.

**Why:** Strong app imports created duplicates with equipment in parentheses, inconsistent casing, and wrong exercise types (weighted exercises marked as bodyweight). Needed to merge workout history before deleting duplicates to avoid FK constraint violations.

**Files:** supabase/migrations/00009_cleanup_exercise_data.sql, supabase/migrations/00010_cleanup_exercise_names_v2.sql

**Concepts:** SQL data migration, regex_replace in PostgreSQL, foreign key constraint handling, duplicate merging strategy, Supabase Management API for direct SQL execution

---

---
## [16:10] Polish workout complete screen

**What:** Reduced score animation jiggle (damping 10 → 18), made all score breakdown progress bars consistently purple instead of color-coded, and capitalized stat labels (Duration, Sets, Exercises, Top Performer).

**Why:** The spring animation was too bouncy and distracting, multi-colored bars looked noisy, and lowercase labels were inconsistent with the rest of the app's typography.

**Files:** app/workout/summary.tsx, components/workout/ScoreBreakdown.tsx

**Concepts:** React Native Reanimated spring physics, damping parameter tuning, consistent UI design tokens

---

---
## [16:25] Show equipment type in Exercise PR picker

**What:** Added equipment type (Barbell, Dumbbell, Cable, etc.) to the subtitle line in the Exercise PR picker modal, displayed as "Chest · Barbell" format. Bodyweight exercises show "· Bodyweight".

**Why:** Without the equipment type, exercises with similar names (e.g., Bench Press vs Dumbbell Bench Press) were hard to distinguish in the picker list.

**Files:** components/progress/ExercisePickerModal.tsx

**Concepts:** UI disambiguation, equipment metadata display, conditional string formatting

---

---
## [16:40] Fix home screen not refreshing after workout

**What:** Added `useFocusEffect` to the home screen that re-fetches rolling scores and user stats whenever the tab gains focus. Previously data only loaded on mount, so returning from a completed workout showed stale scores.

**Why:** The rolling scores cache was correctly invalidated after saving a workout, but nothing triggered a re-fetch when navigating back to the home tab. The `useEffect` only ran on initial mount.

**Files:** app/(tabs)/index.tsx

**Concepts:** React Navigation useFocusEffect, tab focus lifecycle, Zustand cache invalidation + refetch pattern

---

---
## [17:00] Fix tutorial showing on every app reload

**What:** Changed the tutorial display logic to check `userStats.total_workouts` in addition to `hasSeenTutorial`. The tutorial now only appears for users with zero workout data, preventing the flash caused by Zustand persist hydration delay.

**Why:** The `hasSeenTutorial` flag uses Zustand persist with AsyncStorage, which loads asynchronously. The flag defaults to `false` before hydration completes, causing the tutorial to briefly appear on every app reload even for users who have already seen it and have workout data.

**Files:** app/(tabs)/index.tsx

**Concepts:** Zustand persist hydration race condition, AsyncStorage async loading, defensive UI state checks

---

---
## [10:30] Fix EAS iOS build configuration

**What:** Fixed `eas.json` by adding `channel` to all build profiles (development, preview, production), removed hardcoded Xcode image override, and removed duplicate RECORD_AUDIO permission from `app.json`. Moved `expo-dev-client` from dependencies to devDependencies.

**Why:** The `expo-updates` package requires a `channel` in each build profile — without it, the build plugin fails during Xcode's "Bundle React Native code and images" phase. The Xcode image pin was unnecessary (Expo's `auto` default works for SDK 54).

**Files:** eas.json, app.json, package.json

**Concepts:** EAS Build channels, expo-updates build plugin, Xcode build phases, devDependencies vs dependencies

---

---
## [10:35] Set EAS environment variables

**What:** Created `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` environment variables on EAS for all three environments (development, preview, production) using `eas env:create`.

**Why:** EAS does not read local `.env` files. `EXPO_PUBLIC_*` variables are inlined at build time — if missing, they become `undefined` and the Supabase client fails on launch. These are public anon keys, safe for client embedding.

**Files:** (EAS remote config only, no local files)

**Concepts:** EAS environment variables, EXPO_PUBLIC_ prefix inlining, build-time vs runtime env vars

---

---
## [11:15] Fix baseUrl ENOTDIR error on iOS builds

**What:** Removed `experiments.baseUrl: "/momentum"` from `app.json` and consolidated config into `app.config.js`. The baseUrl is now only applied when `EXPO_BASE_URL` env var is set (web builds only). Updated the web build script to pass this env var.

**Why:** The `baseUrl` setting was causing iOS builds to fail with `ENOTDIR: not a directory` during "Bundle React Native code and images" — the bundler prefixed all asset paths with `momentum/`, creating path collisions in the app bundle. This setting is only needed for GitHub Pages web deployment at `/momentum/`.

**Files:** app.json (deleted), app.config.js (created), package.json

**Concepts:** Expo dynamic config, experiments.baseUrl, platform-conditional config, ENOTDIR, Metro asset bundling paths

---

---
## [10:30] Performance optimization — Phase 1 quick wins

**What:** Replaced all Zustand store destructuring with atomic selectors across 25+ files, wrapped 4 heavily-rendered components (CalendarDayCell, CalendarMonth, ScoreDial, AnimatedSetRow) with React.memo, and isolated the workout timer into a self-contained component so the parent screens don't re-render every second.

**Why:** Store destructuring causes any store change to re-render consuming components. Atomic selectors (`useStore(s => s.field)`) only trigger re-renders when that specific field changes. The timer was the worst offender — updating elapsedTime via setState re-rendered the entire exercise list 60 times/min. React.memo prevents re-renders on calendar cells and score dials that receive unchanged props.

**Files:** app/(tabs)/index.tsx, app/(tabs)/profile.tsx, app/(tabs)/history.tsx, app/(tabs)/progress.tsx, app/(auth)/sign-in.tsx, app/(auth)/sign-up.tsx, app/workout/active.tsx, app/workout/exercise.tsx, app/workout/exercise-v2.tsx, app/workout/deck.tsx, app/workout/[id].tsx, app/workout/summary.tsx, app/workout/new.tsx, app/workout/edit-workout.tsx, app/workout/create-custom.tsx, hooks/useTotalSets.ts, hooks/useWorkoutStats.ts, hooks/useRollingScores.ts, hooks/useProgressCalendar.ts, hooks/useDailyGoals.ts, hooks/useMuscleTraining.ts, hooks/useBiWeeklyStats.ts, hooks/useWorkoutTypeStats.ts, hooks/useTopExercises.ts, hooks/useTrainingFrequency.ts, components/workout/SetLogger.tsx, components/workout/ExerciseLogPopup.tsx, components/profile/EditMeasurementsModal.tsx, components/progress/CalendarDayCell.tsx, components/progress/CalendarMonth.tsx, components/home/ScoreDial.tsx, components/workout/AnimatedSetRow.tsx

**Concepts:** Zustand atomic selectors, React.memo, component isolation, render optimization, useRef for cross-component communication without re-renders, timer isolation pattern

---

---
## [11:00] Migrate data hooks to React Query

**What:** Converted 8 data-fetching hooks from manual useState+useEffect+fetch to React Query's `useQuery` with appropriate staleTime values: useTotalSets (1hr), useWorkoutStats (30min), useBiWeeklyStats (30min), useWorkoutTypeStats (1hr), useTopExercises (1hr), useDailyGoals (5min), useMuscleTraining (30min), useTrainingFrequency (30min). Left useProgressCalendar (already has Map-based caching) and useRollingScores (Zustand store with 5-min TTL) as-is.

**Why:** Despite @tanstack/react-query being installed and QueryClientProvider configured, zero hooks used it. Every tab navigation triggered fresh Supabase queries with loading spinners. React Query provides automatic caching, deduplication, and background refetching — the single highest-impact change for perceived performance.

**Files:** hooks/useTotalSets.ts, hooks/useWorkoutStats.ts, hooks/useBiWeeklyStats.ts, hooks/useWorkoutTypeStats.ts, hooks/useTopExercises.ts, hooks/useDailyGoals.ts, hooks/useMuscleTraining.ts, hooks/useTrainingFrequency.ts

**Concepts:** React Query useQuery, staleTime configuration, queryKey design, enabled flag for conditional fetching, maintaining backward-compatible return types during migration

---

---
## [11:15] Migrate PointsAnimation to Reanimated

**What:** Replaced the old React Native `Animated` API in PointsAnimation.tsx with `react-native-reanimated`. Converted `new Animated.Value()` to `useSharedValue`, `Animated.timing/spring` to `withTiming/withSpring/withSequence`, and `Animated.View` to Reanimated's `Animated.View` with `useAnimatedStyle`. Extracted each bonus item into a `BonusItem` sub-component with its own spring entry animation.

**Why:** The old Animated API's timing/spring animations and `requestAnimationFrame`-based counting competed for JS thread time during screen transitions. Reanimated runs animations on the UI thread, freeing the JS thread for navigation and rendering. The BonusItem extraction also simplifies the parent's animation orchestration.

**Files:** components/workout/PointsAnimation.tsx

**Concepts:** react-native-reanimated, useSharedValue vs Animated.Value, withTiming/withSpring, useAnimatedStyle, SharedValue typing, UI thread vs JS thread animations, animation cancellation pattern

---

---
## [11:30] Fix workout setup screen lag and remove add-on buttons

**What:** Removed the "Add Core" and "Add Cardio" checkbox buttons from the workout setup footer. Added `queryClient.prefetchQuery` on the home screen to pre-warm the `topExercises` and `workoutTypeStats` React Query caches when the home tab gains focus, so data loads instantly when the user opens the workout setup screen.

**Why:** The core/cardio add-ons were unused features cluttering the UI. The top exercises list had a visible lag on first open because the data wasn't fetched until the workout setup screen mounted. Prefetching on the home tab means the data is already cached by the time the user taps "Start Workout".

**Files:** app/workout/new.tsx, app/(tabs)/index.tsx, hooks/useTopExercises.ts, hooks/useWorkoutTypeStats.ts

**Concepts:** React Query prefetchQuery, queryClient cache warming, proactive data fetching, UI decluttering

---

---
## [10:15] Fix top exercises loading lag on workout setup screen

**What:** Parallelized the two sequential Supabase queries in `fetchTopExercises` with `Promise.all`, reduced session limit from 200→50, removed dummy data fallback, added loading skeleton placeholders, and stabilized card order with a ref lock to prevent reordering on async stats arrival.

**Why:** The workout setup screen took 1-2s to populate exercise lists due to sequential queries and over-fetching. The "No exercises yet" → real data flash was jarring, and cards reordering when stats loaded async caused a full FlatList re-render cascade.

**Files:** hooks/useTopExercises.ts, app/workout/new.tsx

**Concepts:** Promise.all parallelization, query over-fetching, skeleton loading states, ref-based memoization lock, FlatList render stability

---

---
## [12:00] Fix tutorial showing on every app restart

**What:** Added Zustand `persist.hasHydrated()` / `onFinishHydration` check so the tutorial useEffect waits for AsyncStorage hydration before evaluating `hasSeenTutorial`.

**Why:** The onboarding store initializes with `hasSeenTutorial: false`, and the useEffect fired before AsyncStorage hydration restored the saved `true` value, causing the tutorial to re-open on every restart.

**Files:** app/(tabs)/index.tsx

**Concepts:** Zustand persist hydration race condition, AsyncStorage, persist.hasHydrated(), onFinishHydration callback

---

---
## [12:15] Fix workout timer pausing when app is backgrounded

**What:** Added an `AppState` listener to the `WorkoutTimer` component that forces an immediate elapsed-time recalculation when the app returns to the foreground. Extracted the calculation into a shared `update` function called by both the interval and the AppState handler.

**Why:** On iOS, `setInterval` callbacks stop firing when the JS thread is suspended (phone sleeping or app backgrounded). Although the timer uses `Date.now() - startedAt` (correct approach), there was no trigger to recalculate on resume, so the displayed time froze until the next interval tick — which may never fire reliably after suspension.

**Files:** app/workout/active.tsx

**Concepts:** React Native AppState API, iOS background suspension, setInterval reliability, timestamp-based elapsed time vs counter-based

---

---
## [10:00] Fix autofilled inputs appending instead of replacing

**What:** Added `selectTextOnFocus` prop to both the weight and reps `TextInput` components in `SetLogger.tsx`. Tapping an autofilled field now selects all text so the next keystroke replaces it entirely.

**Why:** Autofilled values (from previous set or historical best) were set as actual `value` state, so tapping placed the cursor at the end and new digits appended instead of replacing. `selectTextOnFocus` is the standard mobile pattern for this behavior.

**Files:** components/workout/SetLogger.tsx

**Concepts:** TextInput selectTextOnFocus, autofill UX, mobile input patterns

---

---
## [09:15] Auto-double weight for dumbbell exercises

**What:** Added `isDumbbell` prop to SetLogger that halves DB weights for display and doubles user input before saving. Passed the prop from exercise.tsx using `getEquipmentType`. Created migration to double all existing dumbbell `weight_kg` values.

**Why:** Users always use two dumbbells, so the single-number input should represent per-dumbbell weight while the DB stores total weight moved. This makes the UX intuitive while keeping data consistent.

**Files:** components/workout/SetLogger.tsx, app/workout/exercise.tsx, supabase/migrations/00011_double_dumbbell_weights.sql

**Concepts:** data normalization, display vs storage weight, SQL array containment (`ANY`), prop drilling, equipment type derivation

---

---
## [10:15] Fix SetLogger input clear-on-focus UX

**What:** Replaced unreliable `selectTextOnFocus` on weight and reps TextInputs with explicit `onFocus`/`onBlur` handlers that clear the field on focus and restore the previous value if the user blurs without typing.

**Why:** On iOS, `selectTextOnFocus` doesn't reliably select all text, causing new keystrokes to append to the existing value instead of replacing it. The clear-and-restore pattern gives users a clean slate when tapping a field while preventing accidental data loss.

**Files:** components/workout/SetLogger.tsx

**Concepts:** React Native TextInput focus behavior, iOS selectTextOnFocus unreliability, controlled input state, clear-on-focus UX pattern

---

---
## [21:35] Port SetLogger features to ExerciseLogPopup and clean up dead code

**What:** Discovered that the active UI is `ExerciseLogPopup.tsx` (popup modal), not `SetLogger.tsx` or `exercise-v2.tsx`. Ported clear-on-focus, x2 dumbbell label, and dumbbell weight halving/doubling to ExerciseLogPopup and deck.tsx. Deleted unused `SetLogger.tsx` and `exercise.tsx`.

**Why:** Previous session's changes were applied to a dead code path (`SetLogger.tsx`), which is why they never appeared on the device. The actual exercise logging flow uses `ExerciseLogPopup` shown from the deck list view.

**Files:** components/workout/ExerciseLogPopup.tsx, app/workout/deck.tsx, components/workout/SetLogger.tsx (deleted), app/workout/exercise.tsx (deleted)

**Concepts:** Dead code identification, multiple UI paths in codebase, dumbbell weight display vs storage (per-hand vs total), Metro bundler cache clearing, debugging stale bundles

---
