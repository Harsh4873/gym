import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ExerciseGuideDialog, SearchView } from './App';
import { PROGRAM } from './program';
import { BODY_REGIONS, getCustomExerciseGuides, resolvePersonalExerciseGuide, type FreeExerciseRecord } from './exerciseLibrary';
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
