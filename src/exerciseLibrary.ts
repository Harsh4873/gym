export type ExerciseGuideSource = 'custom' | 'library' | 'saved';
export type ExerciseGuideFamily = 'strength' | 'mobility';

export interface FreeExerciseRecord {
  id: string;
  name: string;
  force: string | null;
  level: string;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
}

export interface ExerciseGuide {
  id: string;
  name: string;
  libraryName?: string;
  source: ExerciseGuideSource;
  family: ExerciseGuideFamily;
  category: string;
  level?: string;
  equipment?: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  images: string[];
}

export const FREE_EXERCISE_DB_URL =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
export const FREE_EXERCISE_DB_PROJECT_URL = 'https://github.com/yuhonas/free-exercise-db';

const FREE_EXERCISE_IMAGE_ROOT =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

const CUSTOM_GUIDES: ExerciseGuide[] = [
  {
    id: 'custom:cat-cow',
    name: 'Cat-Cow',
    source: 'custom',
    family: 'mobility',
    category: 'mobility',
    level: 'beginner',
    equipment: 'exercise mat',
    primaryMuscles: ['middle back', 'abdominals'],
    secondaryMuscles: ['lower back', 'neck'],
    instructions: [
      'Start on hands and knees with wrists under shoulders, knees under hips, and a neutral spine.',
      'Exhale and gently round your back upward. Let your head follow the curve without forcing your chin down.',
      'Inhale and open your chest while tipping your pelvis. Keep the movement smooth and avoid cranking into your lower back.',
      'Move slowly between the two positions for the planned rounds. Stop if the motion causes sharp or radiating pain.',
    ],
    images: [`${import.meta.env.BASE_URL}exercises/cat-cow.png`],
  },
  {
    id: 'custom:bird-dog',
    name: 'Bird Dog',
    source: 'custom',
    family: 'mobility',
    category: 'core stability',
    level: 'beginner',
    equipment: 'exercise mat',
    primaryMuscles: ['abdominals', 'glutes'],
    secondaryMuscles: ['lower back', 'shoulders'],
    instructions: [
      'Start on hands and knees with hands under shoulders, knees under hips, and your ribs gently braced.',
      'Reach one arm forward and the opposite leg backward without letting your hips twist or your lower back arch.',
      'Pause while keeping a long line from the fingertips through the heel, then return with control.',
      'Alternate sides. Make the range smaller if you cannot keep your torso still or if your back feels pinched.',
    ],
    images: [`${import.meta.env.BASE_URL}exercises/bird-dog.png`],
  },
  {
    id: 'custom:stretch-video',
    name: '10-Minute Stretch Video',
    source: 'custom',
    family: 'mobility',
    category: 'mobility',
    level: 'beginner',
    equipment: 'exercise mat',
    primaryMuscles: ['hamstrings', 'hip flexors', 'lower back'],
    secondaryMuscles: ['calves', 'glutes', 'middle back'],
    instructions: [
      'Set up somewhere you can follow the video with a mat and enough room to lie down.',
      'Move at the pace of the video, but never force a position — ease into each stretch and back off from sharp pain.',
      'Breathe slowly through every hold; long exhales are what let a stretch actually release.',
      'Treat it as one timed round: press play, follow along to the end, and log it done.',
    ],
    images: [`${import.meta.env.BASE_URL}exercises/stretch-video.png`],
  },
  {
    id: 'custom:open-book-t-spine',
    name: 'Open-Book T-Spine Stretch',
    source: 'custom',
    family: 'mobility',
    category: 'mobility',
    level: 'beginner',
    equipment: 'exercise mat',
    primaryMuscles: ['middle back'],
    secondaryMuscles: ['chest', 'shoulders', 'neck'],
    instructions: [
      'Lie on your side with hips and knees bent to ninety degrees, knees stacked, and both arms extended in front with palms together.',
      'Sweep the top arm up and across to the other side, letting your chest and head rotate with it while the knees stay glued together.',
      'Pause where the mid-back feels the stretch. The rotation should come from the ribcage, not from the lower back or the hips.',
      'Return with control and repeat, then switch sides. Keep the bottom arm and both knees in contact with the floor throughout.',
    ],
    images: [`${import.meta.env.BASE_URL}exercises/open-book-t-spine.png`],
  },
];

const CUSTOM_GUIDE_ALIASES: Record<string, string> = {
  'bird dogs': 'custom:bird-dog',
  '10 min stretch video': 'custom:stretch-video',
  'open book t spine': 'custom:open-book-t-spine',
  'open book t spine stretch': 'custom:open-book-t-spine',
};

const LIBRARY_ALIASES: Record<string, string> = {
  '10 min ab workout': '3_4_Sit-Up',
  '10 minute ab workout': '3_4_Sit-Up',
  'ab machine': 'Ab_Crunch_Machine',
  'ab rolls': 'Ab_Roller',
  'abs circuit': 'Air_Bike',
  'back extension': 'Hyperextensions_Back_Extensions',
  'back extensions incline sit ups': 'Hyperextensions_Back_Extensions',
  'incline sit ups': 'Sit-Up',
  bench: 'Barbell_Bench_Press_-_Medium_Grip',
  'bicep stretch': 'Standing_Biceps_Stretch',
  'cable fly': 'Flat_Bench_Cable_Flyes',
  'cable flyes': 'Flat_Bench_Cable_Flyes',
  'cable triceps pushdown': 'Triceps_Pushdown',
  'calf raise': 'Standing_Calf_Raises',
  'chest stretch triceps stretch': 'Dynamic_Chest_Stretch',
  child: 'Childs_Pose',
  'child s pose': 'Childs_Pose',
  'dead bug': 'Dead_Bug',
  dips: 'Dips_-_Triceps_Version',
  'dumbbell bench press': 'Dumbbell_Bench_Press',
  'dumbbell shoulder press': 'Dumbbell_Shoulder_Press',
  'doorway chest stretch': 'Dynamic_Chest_Stretch',
  'dynamic warm up': 'Worlds_Greatest_Stretch',
  'ez bar curls concentration curls': 'EZ-Bar_Curl',
  'face away cable curls': 'High_Cable_Curls',
  'face pulls': 'Face_Pull',
  'flat bench press': 'Barbell_Bench_Press_-_Medium_Grip',
  'forward fold': 'Standing_Toe_Touches',
  'front raises': 'Front_Dumbbell_Raise',
  'full body stretch': 'Worlds_Greatest_Stretch',
  'glute bridge': 'Butt_Lift_Bridge',
  'glute bridges': 'Butt_Lift_Bridge',
  'hack squat': 'Hack_Squat',
  'hammer curls': 'Hammer_Curls',
  'hip thrust': 'Barbell_Hip_Thrust',
  'in n outs': 'Leg_Pull-In',
  'incline bicep curls': 'Alternate_Incline_Dumbbell_Curl',
  'incline curls': 'Alternate_Incline_Dumbbell_Curl',
  'incline db': 'Incline_Dumbbell_Press',
  'incline dumbbell press': 'Incline_Dumbbell_Press',
  'lat pulldowns': 'Wide-Grip_Lat_Pulldown',
  'lat pulldown': 'Wide-Grip_Lat_Pulldown',
  'lat stretch': 'Overhead_Lat',
  'lateral raises': 'Side_Lateral_Raise',
  'lateral raises dumbbell': 'Side_Lateral_Raise',
  'lateral raises machine': 'Side_Lateral_Raise',
  'leg press': 'Leg_Press',
  'leg raises': 'Flat_Bench_Lying_Leg_Raise',
  'low row': 'Seated_Cable_Rows',
  'machine chest': 'Machine_Bench_Press',
  'machine chest press': 'Machine_Bench_Press',
  'military press': 'Standing_Military_Press',
  'neck stretch': 'Side_Neck_Stretch',
  'outs n ins': 'Leg_Pull-In',
  'overhead extension': 'Cable_Rope_Overhead_Triceps_Extension',
  'overhead triceps extension': 'Cable_Rope_Overhead_Triceps_Extension',
  'preacher curl': 'Preacher_Curl',
  'push ups': 'Pushups',
  'rear delt fly': 'Cable_Rear_Delt_Fly',
  'reverse lunge': 'Dumbbell_Rear_Lunge',
  'reverse lunges': 'Dumbbell_Rear_Lunge',
  'cross body shoulder stretch': 'Shoulder_Stretch',
  'seated calf raise': 'Seated_Calf_Raise',
  'shoulder stretch': 'Shoulder_Stretch',
  'single arm lat row': 'Kneeling_Single-Arm_High_Pulley_Row',
  'single arm row': 'Kneeling_Single-Arm_High_Pulley_Row',
  'skull crushers': 'EZ-Bar_Skullcrusher',
  skullcrushers: 'EZ-Bar_Skullcrusher',
  'standing calf raise': 'Standing_Calf_Raises',
  'standing figure 4 glute stretch': 'IT_Band_and_Glute_Stretch',
  'standing hamstring stretch with heel elevated': 'Standing_Hamstring_and_Calf_Stretch',
  'standing hamstring stretch': 'Standing_Hamstring_and_Calf_Stretch',
  'standing hip flexor stretch': 'Intermediate_Hip_Flexor_and_Quad_Stretch',
  'hip flexor stretch': 'Kneeling_Hip_Flexor',
  'half kneeling hip flexor stretch': 'Kneeling_Hip_Flexor',
  'figure 4 glute stretch': 'IT_Band_and_Glute_Stretch',
  'lateral band walks': 'Monster_Walk',
  'leg curl': 'Seated_Leg_Curl',
  'bulgarian split squat': 'Split_Squat_with_Dumbbells',
  'standing quad stretch': 'Quad_Stretch',
  'tibialis stretch': 'Posterior_Tibialis_Stretch',
  'trap stretch': 'Upper_Back_Stretch',
  'tricep pushdown': 'Triceps_Pushdown',
  'tricep superset': 'EZ-Bar_Skullcrusher',
  'wall calf stretch': 'Calf_Stretch_Hands_Against_Wall',
};

let freeExerciseLibraryPromise: Promise<FreeExerciseRecord[]> | undefined;

export function normalizeExerciseName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

export function getExerciseGuideFamily(category: string, name = ''): ExerciseGuideFamily {
  const normalizedCategory = normalizeExerciseName(category);
  const normalizedName = normalizeExerciseName(name);

  if (/stretch|mobility|pose|warm up|cat cow|bird dog|fold/.test(`${normalizedCategory} ${normalizedName}`)) {
    return 'mobility';
  }

  return 'strength';
}

export function getCustomExerciseGuides(): ExerciseGuide[] {
  return CUSTOM_GUIDES.map((guide) => ({ ...guide, images: [...guide.images] }));
}

export function toExerciseGuide(record: FreeExerciseRecord, displayName = record.name): ExerciseGuide {
  return {
    id: `library:${record.id}:${normalizeExerciseName(displayName)}`,
    name: displayName,
    libraryName: normalizeExerciseName(displayName) === normalizeExerciseName(record.name) ? undefined : record.name,
    source: 'library',
    family: getExerciseGuideFamily(record.category, displayName),
    category: record.category,
    level: record.level,
    equipment: record.equipment ?? 'body only',
    primaryMuscles: record.primaryMuscles,
    secondaryMuscles: record.secondaryMuscles,
    instructions: record.instructions,
    images: record.images.map((image) => `${FREE_EXERCISE_IMAGE_ROOT}${image}`),
  };
}

function getFallbackGuide(name: string, family?: ExerciseGuideFamily): ExerciseGuide {
  const resolvedFamily = family ?? getExerciseGuideFamily('', name);
  return {
    id: `saved:${normalizeExerciseName(name)}`,
    name,
    source: 'saved',
    family: resolvedFamily,
    category: resolvedFamily === 'mobility' ? 'mobility' : resolvedFamily,
    primaryMuscles: [],
    secondaryMuscles: [],
    instructions: [],
    images: [],
  };
}

export function resolvePersonalExerciseGuide(
  name: string,
  library: FreeExerciseRecord[],
  family?: ExerciseGuideFamily,
): ExerciseGuide {
  const normalizedName = normalizeExerciseName(name);
  const customGuideId = CUSTOM_GUIDE_ALIASES[normalizedName];
  const customGuide = CUSTOM_GUIDES.find((guide) => (
    guide.id === customGuideId || normalizeExerciseName(guide.name) === normalizedName
  ));
  if (customGuide) {
    return { ...customGuide, name, images: [...customGuide.images] };
  }

  const byId = new Map(library.map((record) => [record.id, record]));
  const aliasId = LIBRARY_ALIASES[normalizedName];
  const aliasedRecord = aliasId ? byId.get(aliasId) : undefined;
  if (aliasedRecord) {
    return toExerciseGuide(aliasedRecord, name);
  }

  const exactRecord = library.find(
    (record) => normalizeExerciseName(record.name) === normalizedName,
  );
  return exactRecord ? toExerciseGuide(exactRecord, name) : getFallbackGuide(name, family);
}

export function matchesExerciseGuide(guide: ExerciseGuide, query: string): boolean {
  const normalizedQuery = normalizeExerciseName(query);
  if (!normalizedQuery) {
    return true;
  }

  const haystack = normalizeExerciseName(
    [
      guide.name,
      guide.libraryName,
      guide.category,
      guide.equipment,
      ...guide.primaryMuscles,
      ...guide.secondaryMuscles,
    ]
      .filter(Boolean)
      .join(' '),
  );
  return normalizedQuery.split(' ').every((term) => haystack.includes(term));
}

export function getGuideMetaLabel(guide: ExerciseGuide): string {
  if (guide.primaryMuscles.length > 0) {
    return guide.primaryMuscles.map(toTitleCase).join(' · ');
  }

  return guide.family === 'mobility' ? 'Mobility routine' : 'Saved workout';
}

export function loadFreeExerciseLibrary(): Promise<FreeExerciseRecord[]> {
  if (!freeExerciseLibraryPromise) {
    freeExerciseLibraryPromise = fetch(FREE_EXERCISE_DB_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Exercise library returned ${response.status}`);
        }
        return response.json() as Promise<FreeExerciseRecord[]>;
      })
      .catch((error) => {
        freeExerciseLibraryPromise = undefined;
        throw error;
      });
  }

  return freeExerciseLibraryPromise;
}
