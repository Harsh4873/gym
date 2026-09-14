import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import records from '../public/data/exercises.json';
import {
  buildDiscoveryGuides,
  filterExerciseGuides,
  getGuideDiscipline,
  matchesExerciseGuide,
  resolvePersonalExerciseGuide,
  toExerciseGuide,
  getCustomExerciseGuides,
  getGuideRegions,
  isExerciseRoutinePlaceholder,
  type FreeExerciseRecord,
  type GuideFilters,
} from './exerciseLibrary';
import { MOBILITY_COACHING } from './mobilityCoaching';
import stretchAdditions from './stretchAdditions.json';

const library = records as FreeExerciseRecord[];
const guides = buildDiscoveryGuides(library);
const base: GuideFilters = { query: '', discipline: 'all', region: 'all', equipment: 'all', beginner: false };
const record = (id: string) => library.find((item) => item.id === id)!;
const guide = (id: string) => toExerciseGuide(record(id));

describe('movement discovery', () => {
  it('makes the entire catalog browsable with no search and no silent 24-result cap', () => {
    expect(filterExerciseGuides(guides, base)).toHaveLength(guides.length);
    expect(filterExerciseGuides(guides, { ...base, discipline: 'stretching' }).length).toBeGreaterThan(70);
    expect(filterExerciseGuides(guides, { ...base, discipline: 'strength' }).length).toBeGreaterThan(500);
    expect(new Set(guides.map((item) => item.id)).size).toBe(guides.length);
    expect(guides[0].coaching).toBeDefined();
  });

  it('separates held stretches, active mobility, resistance work, cardio, and rolling', () => {
    expect(getGuideDiscipline(guide('Ankle_On_The_Knee'))).toBe('stretching');
    expect(getGuideDiscipline(guide('Ankle_Circles'))).toBe('mobility');
    expect(getGuideDiscipline(guide('Superman'))).toBe('strength');
    expect(getGuideDiscipline(guide('Quadriceps-SMR'))).toBe('recovery');
    expect(getGuideDiscipline(toExerciseGuide(library.find((item) => item.category === 'cardio')!))).toBe(
      'cardio',
    );
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
      discipline: 'stretching',
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
        discipline: 'stretching',
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
    const saved = resolvePersonalExerciseGuide('Figure 4 Glute Stretch', library, 'mobility');
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
    expect(Object.keys(MOBILITY_COACHING)).toHaveLength(28);
    for (const [id, coaching] of Object.entries(MOBILITY_COACHING)) {
      expect(record(id), id).toBeDefined();
      expect(record(id).category).toBe('stretching');
      expect(guide(id).images).toHaveLength(2);
      expect(coaching.instructions.length).toBeGreaterThanOrEqual(3);
      for (const field of ['dose', 'feel', 'avoid', 'easier'] as const)
        expect(coaching[field].length).toBeGreaterThan(10);
    }
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
      expect(item.images.length, item.id).toBeGreaterThan(0);
      expect(item.instructions.length, item.id).toBeGreaterThan(0);
    }
  });
});

describe('supplemental stretches and muscle selection', () => {
  it('adds 24 named, illustrated guides with instructions, targets, and easier options', () => {
    expect(stretchAdditions).toHaveLength(24);
    const custom = getCustomExerciseGuides();
    for (const entry of stretchAdditions) {
      const result = custom.find((item) => item.id === `custom:${entry.id}`)!;
      expect(result, entry.name).toBeDefined();
      expect(result.instructions).toHaveLength(3);
      expect(result.primaryMuscles.length).toBeGreaterThan(0);
      expect(result.coaching?.easier).toBeTruthy();
      expect(result.coaching?.feel).toBeTruthy();
      const svg = readFileSync(resolve('public/exercises/positions', entry.id + '.svg'), 'utf8');
      expect(svg).toContain('viewBox="0 0 480 320"');
      expect(svg).toContain('<title');
      expect(svg).not.toContain('NaN');
      expect(getGuideRegions(result).length, entry.name).toBeGreaterThan(0);
    }
    expect(new Set(custom.map((item) => item.id)).size).toBe(custom.length);
  });

  it('keeps the new held stretches separate from active mobility', () => {
    const custom = getCustomExerciseGuides();
    expect(getGuideDiscipline(custom.find((item) => item.id === 'custom:butterfly')!)).toBe('stretching');
    expect(getGuideDiscipline(custom.find((item) => item.id === 'custom:adductor-rockback')!)).toBe(
      'mobility',
    );
    expect(
      custom.filter((item) => item.artworkLabel && getGuideDiscipline(item) === 'stretching'),
    ).toHaveLength(21);
  });

  it('uses precise primary muscle groups instead of mixing thighs, hips, chest, and shoulders', () => {
    const hamstrings = filterExerciseGuides(guides, {
      ...base,
      discipline: 'stretching',
      region: 'hamstrings',
    });
    expect(hamstrings.some((item) => item.id === 'custom:half-split')).toBe(true);
    expect(hamstrings.some((item) => item.id === 'custom:standing-quad')).toBe(false);
    const quads = filterExerciseGuides(guides, { ...base, discipline: 'stretching', region: 'quads' });
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

  it('resolves common saved names to accurate custom positions instead of unrelated stock photos', () => {
    expect(resolvePersonalExerciseGuide('Standing Quad Stretch', library).id).toBe('custom:standing-quad');
    expect(resolvePersonalExerciseGuide('Doorway Chest Stretch', library).id).toBe('custom:doorway-chest');
    expect(resolvePersonalExerciseGuide('Standing Figure 4 Glute Stretch', library).id).toBe(
      'custom:standing-figure-four',
    );
    expect(resolvePersonalExerciseGuide('Lat Stretch', library).id).toBe('custom:kneeling-lat');
  });
});
