import { MOBILITY_COACHING, type MobilityCoaching } from './mobilityCoaching';
import exerciseSource from '../public/data/exercise-source.json';

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
  recordId?: string;
  coaching?: MobilityCoaching;
  assisted?: boolean;
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
  `${import.meta.env.BASE_URL}data/exercises.json`;
export const FREE_EXERCISE_DB_PROJECT_URL = 'https://github.com/yuhonas/free-exercise-db';

const FREE_EXERCISE_IMAGE_ROOT =
  `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${exerciseSource.revision}/exercises/`;

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
  'back extension incline sit ups': 'Hyperextensions_Back_Extensions',
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
  'ez bar curl concentration curl': 'EZ-Bar_Curl',
  'ez bar curls concentration curls': 'EZ-Bar_Curl',
  'face away cable curls': 'High_Cable_Curls',
  'face pulls': 'Face_Pull',
  'flat bench': 'Barbell_Bench_Press_-_Medium_Grip',
  'flat bench press': 'Barbell_Bench_Press_-_Medium_Grip',
  'flat db bench': 'Dumbbell_Bench_Press',
  'forward fold': 'Standing_Toe_Touches',
  'front raises': 'Front_Dumbbell_Raise',
  'full body stretch': 'Worlds_Greatest_Stretch',
  'glute bridge': 'Butt_Lift_Bridge',
  'glute bridges': 'Butt_Lift_Bridge',
  'hack squat': 'Hack_Squat',
  'hammer curl': 'Hammer_Curls',
  'hammer curls': 'Hammer_Curls',
  'hip thrust': 'Barbell_Hip_Thrust',
  'in n outs': 'Leg_Pull-In',
  'incline bicep curls': 'Alternate_Incline_Dumbbell_Curl',
  'incline curls': 'Alternate_Incline_Dumbbell_Curl',
  'incline bench': 'Incline_Dumbbell_Press',
  'incline db': 'Incline_Dumbbell_Press',
  'incline db row': 'Dumbbell_Incline_Row',
  'incline dumbbell row': 'Dumbbell_Incline_Row',
  'incline dumbbell press': 'Incline_Dumbbell_Press',
  'incline smith bench': 'Smith_Machine_Incline_Bench_Press',
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
  'figure 4 glute stretch': 'Ankle_On_The_Knee',
  'lying figure 4': 'Ankle_On_The_Knee',
  'triceps stretch': 'Triceps_Stretch',
  'lateral band walks': 'Monster_Walk',
  'leg curl': 'Seated_Leg_Curl',
  'leg extension': 'Leg_Extensions',
  'nippard superset': 'EZ-Bar_Curl',
  'bulgarian split squat': 'Split_Squat_with_Dumbbells',
  'standing quad stretch': 'Quad_Stretch',
  'tibialis raise': 'Posterior_Tibialis_Stretch',
  'tibialis stretch': 'Posterior_Tibialis_Stretch',
  'trap stretch': 'Upper_Back_Stretch',
  'tricep pushdown': 'Triceps_Pushdown',
  'tricep superset': 'EZ-Bar_Skullcrusher',
  'triceps 7x7': 'EZ-Bar_Skullcrusher',
  'zottman curls': 'Zottman_Curl',
  'zottman curl': 'Zottman_Curl',
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

export function toExerciseGuide(record: FreeExerciseRecord, displayName?: string): ExerciseGuide {
  const coaching = MOBILITY_COACHING[record.id];
  const name = displayName ?? coaching?.name ?? record.name;
  const assisted = !coaching && /partner|helper/i.test(record.instructions.join(' '));
  return {
    id: `library:${record.id}:${normalizeExerciseName(name)}`,
    recordId: record.id,
    name,
    libraryName: normalizeExerciseName(name) === normalizeExerciseName(record.name) ? undefined : record.name,
    source: 'library',
    family: getExerciseGuideFamily(record.category, name),
    category: coaching?.mode ?? record.category,
    level: coaching ? (record.id === 'Inchworm' ? 'intermediate' : 'beginner') : record.level,
    equipment: coaching?.equipment ?? (assisted ? 'partner assistance' : record.equipment ?? 'body only'),
    primaryMuscles: record.primaryMuscles,
    secondaryMuscles: record.secondaryMuscles,
    instructions: coaching?.instructions ?? record.instructions,
    images: record.images.map((image) => record.category === 'stretching'
      ? `${import.meta.env.BASE_URL}exercises/library/${image}`
      : `${FREE_EXERCISE_IMAGE_ROOT}${image}`),
    coaching,
    assisted,
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
    (record) => normalizeExerciseName(record.name) === normalizedName
      || normalizeExerciseName(MOBILITY_COACHING[record.id]?.name ?? '') === normalizedName,
  );
  return exactRecord ? toExerciseGuide(exactRecord, name) : getFallbackGuide(name, family);
}

export function matchesExerciseGuide(guide: ExerciseGuide, query: string): boolean {
  const normalizedQuery = normalizeExerciseName(query)
    .split(' ').map((term) => SEARCH_SYNONYMS[term] ?? term).join(' ');
  if (!normalizedQuery) {
    return true;
  }

  const haystack = normalizeExerciseName(
    [
      guide.name,
      guide.libraryName,
      guide.category,
      guide.equipment,
      getGuideDiscipline(guide),
      ...(guide.coaching?.tags ?? []),
      ...[...guide.primaryMuscles, ...guide.secondaryMuscles].flatMap((muscle) => MUSCLE_SEARCH_TERMS[muscle] ?? []),
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

export const DISCIPLINES = [
  { id: 'stretching', label: 'Stretches', description: 'Easy holds to explore flexibility.' },
  { id: 'mobility', label: 'Mobility', description: 'Controlled movement through your range.' },
  { id: 'strength', label: 'Strength', description: 'Lifts, bodyweight work, and power training.' },
  { id: 'recovery', label: 'Foam rolling', description: 'Self-massage with a roller or ball.' },
  { id: 'cardio', label: 'Cardio', description: 'Conditioning and endurance movements.' },
] as const;
export type ExerciseDiscipline = typeof DISCIPLINES[number]['id'];
export const BODY_REGIONS = [
  { id: 'hips', label: 'Hips & glutes', muscles: ['glutes', 'abductors', 'adductors', 'hip flexors'] },
  { id: 'legs', label: 'Thighs', muscles: ['hamstrings', 'quadriceps'] },
  { id: 'ankles', label: 'Calves & ankles', muscles: ['calves'] },
  { id: 'back', label: 'Back & spine', muscles: ['lower back', 'middle back', 'lats'] },
  { id: 'shoulders', label: 'Shoulders & chest', muscles: ['shoulders', 'chest'] },
  { id: 'neck', label: 'Neck & traps', muscles: ['neck', 'traps'] },
  { id: 'arms', label: 'Arms & wrists', muscles: ['biceps', 'triceps', 'forearms'] },
  { id: 'core', label: 'Core', muscles: ['abdominals'] },
] as const;
export type BodyRegion = typeof BODY_REGIONS[number]['id'];
const MUSCLE_SEARCH_TERMS: Record<string, string[]> = {
  glutes: ['hips', 'buttocks'], abductors: ['hips', 'outer hip'], adductors: ['hips', 'groin', 'inner thighs'],
  'hip flexors': ['hips'], hamstrings: ['legs', 'thighs', 'back of thigh'], quadriceps: ['legs', 'thighs', 'quads', 'front of thigh'],
  calves: ['calf', 'ankles', 'feet', 'shin', 'achilles'], 'lower back': ['spine', 'lumbar'],
  'middle back': ['spine', 'thoracic', 'upper back'], lats: ['back'], shoulders: ['delts'], chest: ['pecs'],
  traps: ['neck', 'upper back'], forearms: ['wrists', 'arms', 'hands'], biceps: ['arms'], triceps: ['arms'],
  abdominals: ['core', 'abs', 'obliques'],
};
const SEARCH_SYNONYMS: Record<string, string> = {
  stretching: 'stretch', stretches: 'stretch', stretchs: 'stretch', mobiltiy: 'mobility',
  strenght: 'strength', stretngth: 'strength', hip: 'hips', glute: 'glutes',
  quad: 'quadriceps', quads: 'quadriceps', hamstring: 'hamstrings', shoulder: 'shoulders',
  wrist: 'wrists', ankle: 'ankles', foot: 'feet', butt: 'glutes',
  dumbbells: 'dumbbell', bands: 'band', bodyweight: 'body only',
};

const DYNAMIC_RECORDS = new Set([
  'Cat_Stretch', 'Dynamic_Back_Stretch', 'Dynamic_Chest_Stretch', 'Elbow_Circles',
  'Crossover_Reverse_Lunge', 'Frog_Hops', 'Groiners', 'Hip_Circles_prone', 'Knee_Circles',
  'Lower_Back_Curl', 'Rear_Leg_Raises', 'Round_The_World_Shoulder_Stretch',
  'Shoulder_Raise', 'Side_Leg_Raises', 'Sit_Squats', 'Standing_Pelvic_Tilt',
  'Torso_Rotation', 'Windmills', 'Groin_and_Back_Stretch',
]);
const STRENGTH_RECORDS = new Set(['Superman', 'Scissor_Kick', 'Toe_Touchers', 'Stomach_Vacuum', 'Pelvic_Tilt_Into_Bridge']);

export function getGuideDiscipline(guide: ExerciseGuide): ExerciseDiscipline {
  if (guide.coaching) return guide.coaching.mode;
  if (guide.recordId && STRENGTH_RECORDS.has(guide.recordId)) return 'strength';
  if (/smr/i.test(guide.recordId ?? '') || guide.equipment === 'foam roll') return 'recovery';
  if (guide.category === 'cardio') return 'cardio';
  if (guide.category === 'core stability') return 'strength';
  if (guide.recordId && DYNAMIC_RECORDS.has(guide.recordId)) return 'mobility';
  if (guide.category === 'stretching' || /stretch|pose/i.test(guide.name)) return 'stretching';
  return guide.family === 'mobility' ? 'mobility' : 'strength';
}

export function getGuideRegions(guide: ExerciseGuide): BodyRegion[] {
  const muscles = [...guide.primaryMuscles, ...guide.secondaryMuscles];
  const tags = guide.coaching?.tags ?? [];
  return BODY_REGIONS.filter((region) => region.muscles.some((muscle) => muscles.includes(muscle))
    || (region.id === 'hips' && tags.includes('hip flexors'))).map((region) => region.id);
}

export interface GuideFilters {
  query: string;
  discipline: 'all' | ExerciseDiscipline;
  region: 'all' | BodyRegion;
  equipment: 'all' | 'body only' | 'support' | 'equipment';
  beginner: boolean;
}

export function filterExerciseGuides(guides: ExerciseGuide[], filters: GuideFilters): ExerciseGuide[] {
  return guides.filter((guide) => {
    const equipment = guide.equipment ?? '';
    const bodyOnly = /^(body only|exercise mat)$/.test(equipment);
    const support = /wall|chair|strap|towel/.test(equipment);
    return (filters.discipline === 'all' || getGuideDiscipline(guide) === filters.discipline)
      && (filters.region === 'all' || getGuideRegions(guide).includes(filters.region))
      && (!filters.beginner || (guide.level === 'beginner' && !guide.assisted))
      && (filters.equipment === 'all'
        || (filters.equipment === 'body only' && bodyOnly)
        || (filters.equipment === 'support' && support)
        || (filters.equipment === 'equipment' && !bodyOnly && !support))
      && matchesExerciseGuide(guide, filters.query);
  });
}

export function buildDiscoveryGuides(library: FreeExerciseRecord[]): ExerciseGuide[] {
  const custom = getCustomExerciseGuides();
  const names = new Set(custom.map((guide) => normalizeExerciseName(guide.name)));
  return [...custom, ...library.filter((record) => record.images.length > 0 && record.instructions.length > 0)
    .map((record) => toExerciseGuide(record))
    .filter((guide) => !names.has(normalizeExerciseName(guide.name)))]
    .sort((a, b) => Number(Boolean(b.coaching)) - Number(Boolean(a.coaching)) || a.name.localeCompare(b.name));
}
