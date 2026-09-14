import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SearchView } from './App';
import { PROGRAM } from './program';
import { BODY_REGIONS } from './exerciseLibrary';

// Source-render checks only: the repository does not permit browser previews.
const markup = () => renderToStaticMarkup(<SearchView program={PROGRAM} logs={{}} todayKey="2026-09-14" />);

describe('search controls', () => {
  it('keeps the primary type choices short and free of overflowing numeric badges', () => {
    const html = markup();
    const choices = html.match(/aria-label="Movement type">(.*?)<\/div>/)?.[1] ?? '';
    expect(choices.replace(/<[^>]*>/g, '')).toBe('StretchesMobilityStrength');
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

  it('provides useful illustrated stretches before the larger catalog loads, without routine placeholders', () => {
    const html = markup();
    expect(html).toContain('Doorway Chest Stretch');
    expect(html).toContain('Half-Split Hamstring Stretch');
    expect(html).toContain('exercises/positions/doorway-chest.svg');
    expect(html).not.toContain('10-Minute Stretch Video');
    expect(html).not.toContain('stretch-video.png');
  });
});
