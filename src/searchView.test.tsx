import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ExerciseGuideDialog,
  ExerciseVisualButton,
  SearchView,
  WorkoutPanel,
  exerciseSearchHash,
  guideForPrefill,
  isolateExerciseRowActivation,
  parseAppHash,
} from './App';
import { PROGRAM } from './program';
import { BODY_REGIONS, getCustomExerciseGuides, resolvePersonalExerciseGuide, type FreeExerciseRecord } from './exerciseLibrary';
import { createEmptyLog, DEFAULT_PREFERENCES } from './storage';
import type { Exercise } from './types';
import records from '../public/data/exercises.json';

// Source-render checks only: the repository does not permit browser previews.
const markup = () => renderToStaticMarkup(<SearchView program={PROGRAM} logs={{}} todayKey="2026-09-14" />);

describe('search controls', () => {
  it('keeps the primary type choices short and free of overflowing numeric badges', () => {
    const html = markup();
    const choices = html.match(/aria-label="Movement type">(.*?)<\/div>/)?.[1] ?? '';
    expect(choices.replace(/<[^>]*>/g, '')).toBe('StretchStrength');
    expect(html).not.toContain('>Mobility<');
    expect(html).not.toContain('exercise-search-stat');
    expect(html).not.toContain('exercise-search-hero');
    expect(html).not.toContain('exercise-quick-picks');
  });

  it('renders every muscle choice without hiding them in a horizontal scroller', () => {
    const html = markup();
    expect(html).toContain('<legend>Choose a muscle</legend>');
    for (const region of BODY_REGIONS) expect(html).toContain(`<span>${region.label}</span>`);
    expect(html).not.toContain('exercise-region-options');
    expect(html).toContain('exercise-extra-filters');
  });

  it('provides coached stretches with photos before the larger catalog loads', () => {
    const html = markup();
    expect(html).toContain('Doorway Chest Stretch');
    expect(html).toContain('Half-Split Hamstring Stretch');
    expect(html).toContain('exercises/library/Groin_and_Back_Stretch/1.jpg');
    expect(html).not.toContain('Visual guide coming soon');
    expect(html).not.toContain('exercises/positions/');
    expect(html).not.toContain('10-Minute Stretch Video');
    expect(html).not.toContain('stretch-video.png');
  });
});

describe('stretch guide artwork', () => {
  const guide = (id: string) => getCustomExerciseGuides().find((item) => item.id === `custom:${id}`)!;
  const dialog = (id: string) => renderToStaticMarkup(
    <ExerciseGuideDialog guide={guide(id)} saved={false} onClose={() => undefined} />,
  );

  it('shows a dedicated 90/90 photo without diagram chrome or incorrect library credit', () => {
    const html = dialog('ninety-ninety-front');
    expect(html).toContain('exercise-guide-images single');
    expect(html).toContain('exercises/ninety-ninety-front.jpg');
    expect(html).not.toContain('Visual guide coming soon');
    expect(html).toContain('The outer hip of the front leg.');
    expect(html).toContain('<img');
    expect(html).toContain('<figcaption>Movement reference</figcaption>');
    expect(html).not.toContain('Photo reference: Free Exercise DB');
    expect(html).not.toContain('POSITION DIAGRAM');
    expect(html).not.toContain('ANGLED VIEW');
  });

  it('shows matched library photos as a start and finish pair', () => {
    const html = dialog('butterfly');
    expect(html).toContain('Groin_and_Back_Stretch/0.jpg');
    expect(html).toContain('Groin_and_Back_Stretch/1.jpg');
    expect(html).toContain('<figcaption>Start</figcaption>');
    expect(html).toContain('<figcaption>Finish</figcaption>');
    expect(html).toContain('Photo reference: Free Exercise DB');
  });

  it('keeps the custom Cat-Cow photo guide', () => {
    expect(dialog('cat-cow')).toContain('exercises/cat-cow.jpg');
  });

  it('shows both photographed halves of a combined movement and the stretch safety line', () => {
    const library = records as FreeExerciseRecord[];
    const combined = resolvePersonalExerciseGuide('Back Extension + Incline Sit-Ups', library, 'strength');
    const combinedHtml = renderToStaticMarkup(
      <ExerciseGuideDialog guide={combined} saved onClose={() => undefined} />,
    );
    expect(combinedHtml).toContain('Hyperextensions (Back Extensions)');
    expect(combinedHtml).toContain('Sit-Up');
    expect(combinedHtml).toContain('Hyperextensions_Back_Extensions/0.jpg');
    expect(combinedHtml).toContain('Sit-Up/1.jpg');
    expect(combinedHtml).not.toContain('Visual guide coming soon');

    const bridge = resolvePersonalExerciseGuide('Glute Bridge', library, 'stretch');
    const bridgeHtml = renderToStaticMarkup(
      <ExerciseGuideDialog guide={bridge} saved onClose={() => undefined} />,
    );
    expect(bridgeHtml).toContain('>Stretch<');
    expect(bridgeHtml).toContain('exercises/library/Butt_Lift_Bridge/0.jpg');
    expect(bridgeHtml).toContain('Move gently and breathe');
    expect(bridgeHtml).toContain('squeeze your glutes');
    expect(bridgeHtml).not.toContain('raw.githubusercontent.com');
    expect(bridgeHtml).not.toContain('Lie flat on the floor');
  });
});

describe('exercise search deep links', () => {
  it('parses a search hash query without treating the query string as a missing tab', () => {
    expect(parseAppHash('#search?q=Cat-Cow')).toEqual({ tab: 'search', searchQuery: 'Cat-Cow' });
    expect(parseAppHash('#search?q=Flat%20Bench')).toEqual({ tab: 'search', searchQuery: 'Flat Bench' });
    expect(parseAppHash('#logbook?q=Cat-Cow')).toEqual({ tab: 'logbook', searchQuery: '' });
    expect(parseAppHash('#search')).toEqual({ tab: 'search', searchQuery: '' });
    expect(parseAppHash('#today')).toEqual({ tab: 'logbook', searchQuery: '' });
  });

  it('round-trips an exercise name, including punctuation, into the search hash', () => {
    expect(exerciseSearchHash('Cat-Cow')).toBe('#search?q=Cat-Cow');
    expect(exerciseSearchHash('Flat Bench')).toBe('#search?q=Flat%20Bench');
    expect(parseAppHash(exerciseSearchHash("Child's Pose")).searchQuery).toBe("Child's Pose");
  });

  it('resolves a visual for programmed names and skips names with no guide images', () => {
    expect(guideForPrefill('Cat-Cow')?.images.some((src) => src.includes('cat-cow'))).toBe(true);
    expect(guideForPrefill('Totally Unknown Movement')).toBeNull();
    expect(guideForPrefill('Flat Bench')).toBeNull();
    expect(guideForPrefill('Flat Bench', records as FreeExerciseRecord[])?.images.length).toBeGreaterThan(0);
  });
});

describe('logbook exercise visual button', () => {
  const exercises: Exercise[] = [
    { id: 'stretch-1', day: 'CBL R1', name: 'Cat-Cow', kind: 'stretch', target: { sets: 1, restSeconds: 0 } },
    { id: 'stretch-2', day: 'CBL R1', name: "Child's Pose", kind: 'stretch', target: { sets: 1, restSeconds: 0 } },
    { id: 'stretch-3', day: 'CBL R1', name: 'Figure-4 Glute Stretch', kind: 'stretch', target: { sets: 1, restSeconds: 0 } },
    { id: 'lift-1', day: 'CBL R1', name: 'Flat Bench', kind: 'strength', target: { sets: 3, restSeconds: 90 } },
    { id: 'lift-2', day: 'CBL R1', name: 'Bulgarian Split Squat', kind: 'strength', target: { sets: 3, restSeconds: 90 } },
  ];

  it('puts a search/guide control on every exercise name row', () => {
    const html = renderToStaticMarkup(
      <WorkoutPanel
        dateKey="2026-11-21"
        exercises={exercises}
        log={createEmptyLog('2026-11-21')}
        logs={{}}
        preferences={DEFAULT_PREFERENCES}
        todayKey="2026-11-21"
        getExercises={() => exercises}
        onReorder={() => undefined}
        onRename={() => undefined}
        canRenameTemplate={() => false}
        onUpdate={() => undefined}
        onClear={() => undefined}
        onOpenExerciseGuide={() => undefined}
      />,
    );
    expect(html).toContain('aria-label="View guide for Cat-Cow"');
    expect(html).toContain('aria-label="View guide for Flat Bench"');
    expect(html).toContain('aria-label="View guide for Figure-4 Glute Stretch"');
    expect(html).toContain('aria-label="View guide for Bulgarian Split Squat"');
    expect(html).toContain('aria-label="View guide for Child&#x27;s Pose"');
    expect(html).toContain('exercise-visual-button');
    expect(html).toContain('exercise-name-heading');
    expect(html).toContain('exercise-name-controls');
    expect(html).toContain('>Guide</span>');
    expect(html).toContain('>Child&#x27;s Pose</strong>');
    expect(html).toContain('>Figure-4 Glute Stretch</strong>');
    expect(html).not.toContain('youtube.com');
    expect(html).not.toContain('Watch demo');
  });

  it('keeps the name on one line and uses icon-only controls on a wrapped row', () => {
    const css = readFileSync(resolve(import.meta.dirname, 'styles.css'), 'utf8');
    expect(css).toContain('.exercise-name-heading > strong');
    expect(css).toContain('white-space: nowrap');
    expect(css).toContain('text-overflow: ellipsis');
    expect(css).toMatch(/\.exercise-name-heading \{\s*flex: 1 1 100%;/);
    expect(css).toMatch(/\.exercise-collapse-button span,\s*\.exercise-visual-button span \{\s*display: none;/);
    expect(css).not.toMatch(/\.exercise-copy strong \{[^}]*overflow-wrap:\s*anywhere/);
  });

  it('opens the visual without toggling the parent row, including keyboard activation', () => {
    let opened = '';
    let rowToggled = false;
    const button = ExerciseVisualButton({
      name: 'Cat-Cow',
      onOpen: (name) => {
        opened = name;
      },
    });
    const event = {
      stopped: false,
      prevented: false,
      stopPropagation() {
        this.stopped = true;
      },
      preventDefault() {
        this.prevented = true;
      },
    };

    button.props.onClick(event);
    if (!event.stopped) {
      rowToggled = true;
    }
    expect(event.stopped).toBe(true);
    expect(event.prevented).toBe(false);
    expect(opened).toBe('Cat-Cow');
    expect(rowToggled).toBe(false);

    const keyEvent = {
      stopped: false,
      stopPropagation() {
        this.stopped = true;
      },
    };
    button.props.onKeyDown(keyEvent);
    button.props.onKeyUp(keyEvent);
    if (!keyEvent.stopped) {
      rowToggled = true;
    }
    expect(keyEvent.stopped).toBe(true);
    expect(rowToggled).toBe(false);

    const isolated = { stopped: false, stopPropagation() { this.stopped = true; } };
    isolateExerciseRowActivation(isolated);
    expect(isolated.stopped).toBe(true);
  });
});

describe('search prefill from a logbook exercise', () => {
  it('opens search with the exercise already queried and its visual showing', () => {
    const html = renderToStaticMarkup(
      <SearchView program={PROGRAM} logs={{}} todayKey="2026-11-21" initialQuery="Cat-Cow" />,
    );
    expect(html).toContain('value="Cat-Cow"');
    expect(html).toContain('exercise-guide-dialog');
    expect(html).toContain('exercises/cat-cow.jpg');
    expect(html).toContain('id="exercise-guide-title">Cat-Cow</h2>');
  });

  it('still prefills search when the exercise has no visual match', () => {
    const html = renderToStaticMarkup(
      <SearchView program={PROGRAM} logs={{}} todayKey="2026-11-21" initialQuery="Totally Unknown Movement" />,
    );
    expect(html).toContain('value="Totally Unknown Movement"');
    expect(html).not.toContain('exercise-guide-dialog');
    expect(html).not.toContain('id="exercise-guide-title">Totally Unknown Movement</h2>');
  });
});
