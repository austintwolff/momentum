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
