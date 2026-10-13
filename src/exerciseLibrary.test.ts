import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import records from '../public/data/exercises.json';
import stretchCatalog from '../public/data/exercises-stretch.json';
import strengthCatalog from '../public/data/exercises-strength.json';
import {
  buildDiscoveryGuides,
  filterExerciseGuides,
  getExerciseGuideFamily,
  getGuideDiscipline,
  matchesExerciseGuide,
  recordsForDiscovery,
  resolvePersonalExerciseGuide,
  toExerciseGuide,
  getCustomExerciseGuides,
  getGuideRegions,
  isExerciseRoutinePlaceholder,
  type FreeExerciseRecord,
  type GuideFilters,
} from './exerciseLibrary';
import { STRETCH_COACHING } from './stretchCoaching';
import stretchAdditions from './stretchAdditions.json';

const library = records as FreeExerciseRecord[];
const guides = buildDiscoveryGuides(library);
const base: GuideFilters = { query: '', discipline: 'all', region: 'all', equipment: 'all', beginner: false };
const record = (id: string) => library.find((item) => item.id === id)!;
const guide = (id: string) => toExerciseGuide(record(id));

describe('movement discovery', () => {
  it('makes the entire catalog browsable with no search and no silent 24-result cap', () => {
    expect(filterExerciseGuides(guides, base)).toHaveLength(guides.length);
    expect(filterExerciseGuides(guides, { ...base, discipline: 'stretch' }).length).toBeGreaterThan(70);
    expect(filterExerciseGuides(guides, { ...base, discipline: 'strength' }).length).toBeGreaterThan(500);
    expect(new Set(guides.map((item) => item.id)).size).toBe(guides.length);
    expect(guides[0].coaching).toBeDefined();
  });

  it('puts gentle movement and recovery with stretch and resistance work with strength', () => {
    expect(getGuideDiscipline(guide('Ankle_On_The_Knee'))).toBe('stretch');
    expect(getGuideDiscipline(guide('Ankle_Circles'))).toBe('stretch');
    expect(getGuideDiscipline(guide('Superman'))).toBe('strength');
    expect(getGuideDiscipline(guide('Quadriceps-SMR'))).toBe('stretch');
    expect(getGuideDiscipline(toExerciseGuide(library.find((item) => item.category === 'cardio')!))).toBe(
      'strength',
    );
    expect(getExerciseGuideFamily('mobility', 'Old saved exercise')).toBe('stretch');
  });

  it('supports common language, plural names, and common spelling mistakes', () => {
    expect(matchesExerciseGuide(guide('Kneeling_Hip_Flexor'), 'hip flexor')).toBe(true);
    expect(matchesExerciseGuide(guide('Ankle_Circles'), 'ankle mobiltiy')).toBe(true);
    expect(matchesExerciseGuide(guide('Calf_Stretch_Hands_Against_Wall'), 'calf stretches')).toBe(true);
    expect(matchesExerciseGuide(guide('Dumbbell_Bench_Press'), 'dumbbells chest')).toBe(true);
    expect(matchesExerciseGuide(guide('On_Your_Side_Quad_Stretch'), 'quads')).toBe(true);
    expect(matchesExerciseGuide(guide('On_Your_Side_Quad_Stretch'), 'hamstrings')).toBe(false);
    expect(matchesExerciseGuide(guide('Wrist_Circles'), 'wrists')).toBe(true);
  });

  it('combines movement type, body area, equipment, and solo beginner filters', () => {
    const results = filterExerciseGuides(guides, {
      ...base,
      discipline: 'stretch',
      region: 'glutes',
      equipment: 'body only',
      beginner: true,
    });
    expect(results.some((item) => item.recordId === 'Ankle_On_The_Knee')).toBe(true);
    expect(results.every((item) => !item.assisted && item.level === 'beginner')).toBe(true);
    expect(results.some((item) => item.recordId === 'Lying_Glute')).toBe(false);
    expect(
      filterExerciseGuides(guides, {
        ...base,
        discipline: 'stretch',
        region: 'calves',
        equipment: 'support',
      }).some((item) => item.recordId === 'Calf_Stretch_Hands_Against_Wall'),
    ).toBe(true);
    expect(filterExerciseGuides(guides, { ...base, query: 'nonexistentmovement' })).toEqual([]);
  });

  it('marks assisted source records even when the source omits their equipment', () => {
    const assisted = guide('Adductor_Groin');
    expect(assisted.assisted).toBe(true);
    expect(assisted.equipment).toBe('partner assistance');
    expect(filterExerciseGuides([assisted], { ...base, beginner: true })).toEqual([]);
  });

  it('preserves saved names while resolving the exact curated solo demonstration', () => {
    const saved = resolvePersonalExerciseGuide('Figure 4 Glute Stretch', library, 'stretch');
    expect(saved.name).toBe('Figure 4 Glute Stretch');
    expect(saved.recordId).toBe('Ankle_On_The_Knee');
    expect(saved.coaching).toBeDefined();
    expect(resolvePersonalExerciseGuide('Half-Kneeling Hip Flexor Stretch', library).recordId).toBe(
      'Kneeling_Hip_Flexor',
    );
    expect(resolvePersonalExerciseGuide('Supported Ankle Circles', library).recordId).toBe('Ankle_Circles');
    expect(resolvePersonalExerciseGuide('My custom movement', library).name).toBe('My custom movement');
  });
});

describe('catalog and photo integrity', () => {
  it('gives every starter guide a real source record, two local photos, and complete coaching', () => {
    expect(Object.keys(STRETCH_COACHING)).toHaveLength(29);
    for (const [id, coaching] of Object.entries(STRETCH_COACHING)) {
      expect(record(id), id).toBeDefined();
      expect(record(id).category).toBe(id === 'Butt_Lift_Bridge' ? 'strength' : 'stretching');
      expect(guide(id).family).toBe('stretch');
      expect(guide(id).coaching?.instructions[0]).toBeTruthy();
      expect(guide(id).images).toHaveLength(2);
      expect(coaching.instructions.length).toBeGreaterThanOrEqual(3);
      for (const field of ['dose', 'feel', 'avoid', 'easier'] as const)
        expect(coaching[field].length).toBeGreaterThan(10);
    }
  });

  it('ships every catalog photograph locally and can load stretch without the strength file', () => {
    const stretch = stretchCatalog as FreeExerciseRecord[];
    const strength = strengthCatalog as FreeExerciseRecord[];
    expect(stretch.length + strength.length).toBe(library.length);
    expect(new Set([...stretch, ...strength].map((item) => item.id)).size).toBe(library.length);
    expect(stretch.some((item) => item.id === 'Butt_Lift_Bridge')).toBe(true);
    expect(strength.some((item) => item.id === 'Butt_Lift_Bridge')).toBe(false);
    expect(recordsForDiscovery(strength, 'stretch')).toEqual([]);
    expect(recordsForDiscovery(library, 'strength').some((item) => item.id === 'Dumbbell_Bench_Press')).toBe(true);
    expect(recordsForDiscovery(library, 'strength').some((item) => item.id === 'Butt_Lift_Bridge')).toBe(false);
    for (const item of library) {
      for (const image of item.images) {
        expect(existsSync(resolve('public/exercises/library', image)), image).toBe(true);
      }
    }
    const bench = toExerciseGuide(record('Dumbbell_Bench_Press'));
    expect(bench.images.every((image) => image.includes('/exercises/library/') && !image.startsWith('https:'))).toBe(true);
    expect(readFileSync(resolve('public/exercises/library', 'Dumbbell_Bench_Press/0.jpg')).subarray(0, 2).toString('hex')).toBe('ffd8');
  });

  it('ships every stretch source photograph locally as a valid JPEG', () => {
    const stretches = library.filter((item) => item.category === 'stretching');
    expect(stretches).toHaveLength(123);
    for (const item of stretches) {
      expect(toExerciseGuide(item).images.every((image) => !image.startsWith('https:'))).toBe(true);
      for (const image of item.images) {
        const filename = resolve('public/exercises/library', image);
        expect(existsSync(filename), image).toBe(true);
        const bytes = readFileSync(filename);
        expect(bytes.subarray(0, 2).toString('hex'), image).toBe('ffd8');
        expect(bytes.length).toBeGreaterThan(1000);
      }
    }
  });

  it('shows only complete catalog entries with imagery and instructions', () => {
    expect(guides.some((item) => item.recordId === 'Iron_Cross')).toBe(false);
    expect(guides.some((item) => item.recordId === 'Kettlebell_Halo')).toBe(false);
    for (const item of guides) {
      if (item.source === 'library' || ['custom:cat-cow', 'custom:bird-dog', 'custom:open-book-t-spine'].includes(item.id)) {
        expect(item.images.length, item.id).toBeGreaterThan(0);
      }
      expect(item.instructions.length, item.id).toBeGreaterThan(0);
    }
  });
});

describe('supplemental stretches and muscle selection', () => {
  it('adds 24 coached stretches with local photos and gives custom photos priority', () => {
    expect(stretchAdditions).toHaveLength(24);
    expect(stretchAdditions.filter((entry) => entry.photoRecordId)).toHaveLength(24);
    const custom = getCustomExerciseGuides();
    const customPhotoIds = ['standing-quad', 'seated-figure-four', 'ninety-ninety-front'];
    for (const entry of stretchAdditions) {
      const result = custom.find((item) => item.id === `custom:${entry.id}`)!;
      expect(result, entry.name).toBeDefined();
      expect(result.instructions).toHaveLength(3);
      expect(result.primaryMuscles.length).toBeGreaterThan(0);
      expect(result.coaching?.easier).toBeTruthy();
      expect(result.coaching?.feel).toBeTruthy();
      expect(result.family).toBe('stretch');
      expect(result.coaching?.mode).toBe('stretch');
      expect(result.images.every((image) => /\.(jpg|png)$/.test(image))).toBe(true);
      const usesCustomPhoto = customPhotoIds.includes(entry.id);
      expect(result.images, entry.id).toHaveLength(usesCustomPhoto ? 1 : 2);
      if (usesCustomPhoto) {
        expect(result.images[0]).toBe(`${import.meta.env.BASE_URL}exercises/${entry.id}.jpg`);
      } else {
        expect(result.images).toEqual([0, 1].map((index) =>
          `${import.meta.env.BASE_URL}exercises/library/${entry.photoRecordId}/${index}.jpg`));
      }
      for (const image of result.images) {
        const filename = resolve('public', image.replace(import.meta.env.BASE_URL, ''));
        expect(existsSync(filename), image).toBe(true);
        const bytes = readFileSync(filename);
        expect(bytes.length, image).toBeGreaterThan(1000);
        expect(bytes.subarray(0, 2).toString('hex'), image).toBe('ffd8');
        if (usesCustomPhoto) {
          expect(bytes.length, image).toBeLessThan(300_000);
        }
      }
      expect(getGuideRegions(result).length, entry.name).toBeGreaterThan(0);
    }
    expect(new Set(custom.map((item) => item.id)).size).toBe(custom.length);
    expect(custom.find((item) => item.id === 'custom:cat-cow')?.images).toEqual([`${import.meta.env.BASE_URL}exercises/cat-cow.jpg`]);
  });

  it('shows held and active supplemental movements together as stretches', () => {
    const custom = getCustomExerciseGuides();
    expect(getGuideDiscipline(custom.find((item) => item.id === 'custom:butterfly')!)).toBe('stretch');
    expect(getGuideDiscipline(custom.find((item) => item.id === 'custom:adductor-rockback')!)).toBe(
      'stretch',
    );
    expect(custom.filter((item) => item.photoRecordId)).toHaveLength(24);
    expect(custom.filter((item) => item.customImages?.length)).toHaveLength(3);
  });

  it('uses precise primary muscle groups instead of mixing thighs, hips, chest, and shoulders', () => {
    const hamstrings = filterExerciseGuides(guides, {
      ...base,
      discipline: 'stretch',
      region: 'hamstrings',
    });
    expect(hamstrings.some((item) => item.id === 'custom:half-split')).toBe(true);
    expect(hamstrings.some((item) => item.id === 'custom:standing-quad')).toBe(false);
    const quads = filterExerciseGuides(guides, { ...base, discipline: 'stretch', region: 'quads' });
    expect(quads.some((item) => item.id === 'custom:standing-quad')).toBe(true);
    expect(quads.some((item) => item.id === 'custom:half-split')).toBe(false);
    expect(getGuideRegions(guide('Kneeling_Hip_Flexor'))).toEqual(['hip-flexors']);
    expect(
      filterExerciseGuides(guides, { ...base, region: 'chest' }).some(
        (item) => item.id === 'custom:doorway-chest',
      ),
    ).toBe(true);
    expect(
      filterExerciseGuides(guides, { ...base, region: 'feet' }).some(
        (item) => item.id === 'custom:toe-extension',
      ),
    ).toBe(true);
  });

  it('removes video and routine placeholders while keeping actual named exercises', () => {
    expect(guides.some((item) => /video/i.test(item.name))).toBe(false);
    expect(getCustomExerciseGuides().some((item) => /video/i.test(item.name))).toBe(false);
    expect(isExerciseRoutinePlaceholder('10-Minute Stretch Video')).toBe(true);
    expect(isExerciseRoutinePlaceholder('10 min ab workout')).toBe(true);
    expect(isExerciseRoutinePlaceholder('Tricep Superset')).toBe(true);
    expect(isExerciseRoutinePlaceholder('Abs Circuit')).toBe(true);
    expect(isExerciseRoutinePlaceholder('Standing Quad Stretch')).toBe(false);
  });

  it('resolves common saved names to coached custom guides', () => {
    expect(resolvePersonalExerciseGuide('Standing Quad Stretch', library).id).toBe('custom:standing-quad');
    expect(resolvePersonalExerciseGuide('Doorway Chest Stretch', library).id).toBe('custom:doorway-chest');
    expect(resolvePersonalExerciseGuide('Standing Figure 4 Glute Stretch', library).id).toBe(
      'custom:standing-figure-four',
    );
    expect(resolvePersonalExerciseGuide('Lat Stretch', library).id).toBe('custom:kneeling-lat');
  });

  it('points programmed names at the photographed movement', () => {
    const bridge = resolvePersonalExerciseGuide('Glute Bridge', library, 'stretch');
    expect(bridge.recordId).toBe('Butt_Lift_Bridge');
    expect(bridge.family).toBe('stretch');
    expect(bridge.images).toHaveLength(2);
    expect(bridge.images.every((image) => image.includes('/exercises/library/Butt_Lift_Bridge/'))).toBe(true);
    expect(bridge.images.every((image) => !image.startsWith('https:'))).toBe(true);
    expect(bridge.coaching?.instructions.some((step) => step.includes('squeeze your glutes'))).toBe(true);
    expect(bridge.instructions.join(' ')).not.toContain('Lie flat on the floor');
    for (const image of bridge.images) {
      const filename = resolve('public', image.replace(import.meta.env.BASE_URL, ''));
      const bytes = readFileSync(filename);
      expect(bytes.subarray(0, 2).toString('hex'), image).toBe('ffd8');
    }

    const raise = resolvePersonalExerciseGuide('Tibialis Raise', library, 'strength');
    expect(raise.name).toBe('Tibialis Raise');
    expect(raise.family).toBe('strength');
    expect(raise.recordId).toBeUndefined();
    expect(resolvePersonalExerciseGuide('Tibialis Stretch', library, 'stretch').recordId).toBe(
      'Posterior_Tibialis_Stretch',
    );

    const routine = resolvePersonalExerciseGuide('10 min ab workout', library, 'strength');
    expect(routine.recordId).toBeUndefined();
    expect(routine.images).toEqual([]);
    expect(resolvePersonalExerciseGuide('Nippard Superset', library).recordId).toBeUndefined();

    const back = resolvePersonalExerciseGuide('Back Extension + Incline Sit-Ups', library, 'strength');
    expect(back.segments?.map((segment) => segment.name)).toEqual([
      'Hyperextensions (Back Extensions)',
      'Sit-Up',
    ]);
    expect(back.images.some((image) => image.includes('Hyperextensions_Back_Extensions/0.jpg'))).toBe(true);
    expect(back.images.some((image) => image.includes('Sit-Up/0.jpg'))).toBe(true);

    const curls = resolvePersonalExerciseGuide('EZ Bar Curl + Concentration Curl', library, 'strength');
    expect(curls.segments?.map((segment) => segment.name)).toEqual(['EZ-Bar Curl', 'Concentration Curls']);
    expect(curls.images.some((image) => image.includes('EZ-Bar_Curl/0.jpg'))).toBe(true);
    expect(curls.images.some((image) => image.includes('Concentration_Curls/0.jpg'))).toBe(true);
  });
});
