import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ExerciseGuideDialog, SearchView } from './App';
import { PROGRAM } from './program';
import { BODY_REGIONS, getCustomExerciseGuides } from './exerciseLibrary';

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

  it('provides coached stretches before the larger catalog loads, with photos or an honest fallback', () => {
    const html = markup();
    expect(html).toContain('Doorway Chest Stretch');
    expect(html).toContain('Half-Split Hamstring Stretch');
    expect(html).toContain('exercises/library/Groin_and_Back_Stretch/1.jpg');
    expect(html).toContain('Visual guide coming soon');
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

  it('shows the fallback across the full image area for 90/90 without diagram chrome', () => {
    const html = dialog('ninety-ninety-front');
    expect(html).toContain('exercise-guide-images single');
    expect(html).toContain('Visual guide coming soon');
    expect(html).toContain('The outer hip of the front leg.');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<figcaption');
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
    expect(dialog('cat-cow')).toContain('exercises/cat-cow.png');
  });
});
