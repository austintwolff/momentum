/**
 * Import Strong app workout data into Momentum
 *
 * Usage:
 *   node scripts/import-strong-data.js <csv-path> <user-id>
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Load environment variables from .env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or key in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Weight conversion: lbs to kg
const lbsToKg = (lbs) => lbs * 0.453592;

// Parse duration string like "49m" or "1h 30m" to seconds
const parseDuration = (duration) => {
  let totalSeconds = 0;
  const hourMatch = duration.match(/(\d+)h/);
  const minMatch = duration.match(/(\d+)m/);
  if (hourMatch) totalSeconds += parseInt(hourMatch[1]) * 3600;
  if (minMatch) totalSeconds += parseInt(minMatch[1]) * 60;
  return totalSeconds;
};

// Muscle group mapping based on exercise name patterns
const getMuscleGroup = (exerciseName) => {
  const name = exerciseName.toLowerCase();

  // Chest
  if (name.includes('bench press') || name.includes('chest') || name.includes('hex press') || name.includes('push up')) {
    return 'chest';
  }
  // Shoulders
  if (name.includes('shoulder') || name.includes('overhead press') || name.includes('arnold press') ||
      name.includes('lateral raise') || name.includes('front raise') || name.includes('face pull') ||
      name.includes('shrug') || name.includes('landmine push')) {
    return 'shoulders';
  }
  // Back - upper
  if (name.includes('lat pulldown') || name.includes('pull up') || name.includes('pulldown') ||
      name.includes('row') || name.includes('t bar') || name.includes('reverse bench') ||
      name.includes('vertical traction') || name.includes('low row')) {
    return 'upper back';
  }
  // Triceps
  if (name.includes('tricep') || name.includes('skullcrusher') || name.includes('dip')) {
    return 'triceps';
  }
  // Biceps
  if (name.includes('bicep') || name.includes('curl') && !name.includes('leg curl')) {
    return 'biceps';
  }
  // Quads
  if (name.includes('squat') || name.includes('leg extension') || name.includes('leg press')) {
    return 'quads';
  }
  // Hamstrings
  if (name.includes('leg curl') || name.includes('romanian') || name.includes('stiff leg')) {
    return 'hamstrings';
  }
  // Core
  if (name.includes('crunch') || name.includes('ab') || name.includes('leg lift') || name.includes('core')) {
    return 'core';
  }
  // Calves
  if (name.includes('calf') || name.includes('calves')) {
    return 'calves';
  }
  // Glutes
  if (name.includes('glute') || name.includes('hip thrust')) {
    return 'glutes';
  }
  // Forearms
  if (name.includes('wrist') || name.includes('forearm')) {
    return 'forearms';
  }
  // Cardio - skip or default
  if (name.includes('stairmaster') || name.includes('treadmill') || name.includes('exertion')) {
    return 'cardio';
  }

  // Default to upper back for unknown
  return 'upper back';
};

// Determine if exercise is bodyweight
const isBodyweight = (exerciseName) => {
  const name = exerciseName.toLowerCase();
  return name.includes('pull up') || name.includes('push up') || name.includes('dip') ||
         name.includes('leg lift') || name.includes('crunch');
};

// Determine if exercise is compound
const isCompound = (exerciseName) => {
  const name = exerciseName.toLowerCase();
  return name.includes('bench press') || name.includes('squat') || name.includes('deadlift') ||
         name.includes('row') || name.includes('overhead press') || name.includes('pull up') ||
         name.includes('dip') || name.includes('shoulder press');
};

// Parse CSV line handling quoted fields
const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node scripts/import-strong-data.js <csv-path> <user-id>');
    process.exit(1);
  }

  const csvPath = args[0].replace('~', process.env.HOME || '');
  const userId = args[1];

  console.log(`\n📂 Reading CSV: ${csvPath}`);
  console.log(`👤 User ID: ${userId}`);

  // Read and parse CSV
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim());
  const dataLines = lines.slice(1);

  console.log(`📊 Found ${dataLines.length} rows of data\n`);

  // Parse CSV rows
  const rows = dataLines.map(line => {
    const cols = parseCSVLine(line);
    return {
      date: cols[0],
      workoutName: cols[1],
      duration: cols[2],
      exerciseName: cols[3],
      setOrder: parseInt(cols[4]) || 1,
      weight: parseFloat(cols[5]) || 0,
      reps: parseFloat(cols[6]) || 0,
      distance: parseFloat(cols[7]) || 0,
      seconds: parseFloat(cols[8]) || 0,
      rpe: cols[9] ? parseFloat(cols[9]) : null,
    };
  }).filter(row => row.exerciseName && row.reps > 0);

  // Group by workout session (date + name combo)
  const workoutMap = new Map();

  for (const row of rows) {
    // Skip cardio/exertion entries
    if (row.exerciseName.toLowerCase().includes('stairmaster') ||
        row.exerciseName.toLowerCase().includes('exertion')) {
      continue;
    }

    const workoutKey = `${row.date}_${row.workoutName}`;

    if (!workoutMap.has(workoutKey)) {
      const startDate = new Date(row.date);
      const durationSecs = parseDuration(row.duration);
      const endDate = new Date(startDate.getTime() + durationSecs * 1000);

      workoutMap.set(workoutKey, {
        id: uuidv4(),
        name: row.workoutName,
        startedAt: startDate,
        completedAt: endDate,
        durationSeconds: durationSecs,
        sets: [],
      });
    }

    workoutMap.get(workoutKey).sets.push({
      exerciseName: row.exerciseName,
      setNumber: row.setOrder,
      weightLbs: row.weight,
      reps: row.reps,
      rpe: row.rpe,
    });
  }

  const workouts = Array.from(workoutMap.values()).sort(
    (a, b) => a.startedAt.getTime() - b.startedAt.getTime()
  );

  console.log(`🏋️ Parsed ${workouts.length} workout sessions\n`);

  // Get unique exercise names
  const uniqueExercises = new Set();
  for (const workout of workouts) {
    for (const set of workout.sets) {
      uniqueExercises.add(set.exerciseName);
    }
  }

  console.log(`💪 Found ${uniqueExercises.size} unique exercises\n`);

  // Fetch existing exercises
  const { data: existingExercises, error: exerciseError } = await supabase
    .from('exercises')
    .select('id, name');

  if (exerciseError) {
    console.error('Error fetching exercises:', exerciseError);
    process.exit(1);
  }

  const exerciseNameToId = new Map();
  for (const ex of existingExercises || []) {
    exerciseNameToId.set(ex.name.toLowerCase(), ex.id);
  }

  console.log(`📚 Found ${existingExercises?.length || 0} existing exercises in database\n`);

  // Create missing exercises
  const exercisesToCreate = [];

  for (const exName of uniqueExercises) {
    if (!exerciseNameToId.has(exName.toLowerCase())) {
      const id = uuidv4();
      exercisesToCreate.push({
        id,
        name: exName,
        exercise_type: isBodyweight(exName) ? 'bodyweight' : 'weighted',
        muscle_group: getMuscleGroup(exName),
        is_compound: isCompound(exName),
        is_public: true,
      });
      exerciseNameToId.set(exName.toLowerCase(), id);
    }
  }

  if (exercisesToCreate.length > 0) {
    console.log(`📝 Creating ${exercisesToCreate.length} new exercises...`);

    for (const ex of exercisesToCreate) {
      console.log(`   - ${ex.name} (${ex.muscle_group})`);
    }
    console.log('');

    // Insert in batches
    const batchSize = 50;
    for (let i = 0; i < exercisesToCreate.length; i += batchSize) {
      const batch = exercisesToCreate.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('exercises')
        .insert(batch);

      if (insertError) {
        console.error(`Error creating exercises:`, insertError.message);
      }
    }

    console.log(`✅ Created exercises\n`);
  } else {
    console.log(`✅ All exercises already exist in database\n`);
  }

  // Import workouts
  console.log(`🚀 Importing ${workouts.length} workouts...\n`);

  let totalVolume = 0;
  let totalSets = 0;
  let successCount = 0;

  for (let i = 0; i < workouts.length; i++) {
    const workout = workouts[i];

    // Calculate total volume for this workout
    let workoutVolume = 0;
    for (const set of workout.sets) {
      const weightKg = lbsToKg(set.weightLbs);
      workoutVolume += weightKg * set.reps;
    }

    // Create workout session
    const { error: sessionError } = await supabase
      .from('workout_sessions')
      .insert({
        id: workout.id,
        user_id: userId,
        name: workout.name,
        started_at: workout.startedAt.toISOString(),
        completed_at: workout.completedAt.toISOString(),
        duration_seconds: workout.durationSeconds,
        total_volume_kg: workoutVolume,
        total_points: 0,
      });

    if (sessionError) {
      if (!sessionError.message.includes('duplicate')) {
        console.error(`Error creating session ${i + 1}:`, sessionError.message);
      }
      continue;
    }

    // Create workout sets
    const setsToInsert = workout.sets.map((set, idx) => {
      const exerciseId = exerciseNameToId.get(set.exerciseName.toLowerCase());
      if (!exerciseId) {
        return null;
      }

      return {
        workout_session_id: workout.id,
        exercise_id: exerciseId,
        set_number: set.setNumber,
        set_type: 'working',
        weight_kg: lbsToKg(set.weightLbs),
        reps: set.reps,
        rpe: set.rpe,
        is_bodyweight: isBodyweight(set.exerciseName),
        points_earned: 0,
        is_pr: false,
        completed_at: new Date(workout.startedAt.getTime() + (idx + 1) * 60000).toISOString(),
      };
    }).filter(Boolean);

    if (setsToInsert.length > 0) {
      const { error: setsError } = await supabase
        .from('workout_sets')
        .insert(setsToInsert);

      if (setsError && !setsError.message.includes('duplicate')) {
        console.error(`Error creating sets for workout ${i + 1}:`, setsError.message);
      }
    }

    totalVolume += workoutVolume;
    totalSets += workout.sets.length;
    successCount++;

    // Progress indicator
    if ((i + 1) % 25 === 0 || i === workouts.length - 1) {
      console.log(`  Progress: ${i + 1}/${workouts.length} workouts processed`);
    }
  }

  // Update user stats
  console.log(`\n📈 Updating user stats...`);

  const { data: currentStats } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', userId)
    .single();

  const lastWorkout = workouts[workouts.length - 1];

  if (currentStats) {
    await supabase
      .from('user_stats')
      .update({
        total_workouts: (currentStats.total_workouts || 0) + successCount,
        total_volume_kg: (currentStats.total_volume_kg || 0) + totalVolume,
        last_workout_at: lastWorkout.completedAt.toISOString(),
      })
      .eq('user_id', userId);
  } else {
    await supabase
      .from('user_stats')
      .insert({
        user_id: userId,
        total_workouts: successCount,
        total_volume_kg: totalVolume,
        last_workout_at: lastWorkout.completedAt.toISOString(),
      });
  }

  console.log(`\n✅ Import complete!`);
  console.log(`   📊 ${successCount} workouts imported`);
  console.log(`   🏋️ ${totalSets} sets`);
  console.log(`   💪 ${Math.round(totalVolume).toLocaleString()} kg total volume`);
  console.log(`   📅 Date range: ${workouts[0].startedAt.toLocaleDateString()} - ${lastWorkout.completedAt.toLocaleDateString()}\n`);
}

main().catch(console.error);
