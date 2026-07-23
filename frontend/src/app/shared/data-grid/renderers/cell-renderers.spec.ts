import { describe, expect, it } from 'vitest';

import { highlightRenderer, linkRenderer, statusBadgeRenderer } from './cell-renderers';

describe('cell-renderers', () => {
  it('escapes badge labels and sanitizes custom classes', () => {
    const render = statusBadgeRenderer({
      open: {
        label: '<img src=x onerror=alert(1)>',
        class: 'status-open bad"class'
      }
    });

    const html = render('open');

    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('status-open');
    expect(html).not.toContain('bad"class');
  });

  it('sanitizes dangerous link urls while preserving escaped labels', () => {
    const render = linkRenderer('url');
    const html = render('<Click>', { url: 'javascript:alert(1)' });

    expect(html).toContain('href="#"');
    expect(html).toContain('&lt;Click&gt;');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain('javascript:');
  });

  it('escapes highlighted text before adding mark tags', () => {
    const render = highlightRenderer('alpha');
    const html = render('<script>alpha</script>');

    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('<mark>alpha</mark>');
    expect(html).not.toContain('<script>');
  });
});
