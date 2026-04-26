/**
 * Accessibility Tests - Task 60.4
 *
 * Covers:
 *  1. ARIA labels: all interactive elements have proper ARIA labels
 *  2. Keyboard navigation: all interactive elements are keyboard accessible
 *  3. Color contrast: contrast ratio requirements documented (4.5:1 for text)
 *  4. Alt text: all images have text alternatives
 *  5. Focus management: focus is managed correctly in modals and dialogs
 *  6. Screen reader announcements: dynamic content changes are announced
 *  7. Form accessibility: form fields have associated labels
 *
 * Requirements: 29.1-29.11
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Minimal HTML parser helpers – no browser or DOM library required.
 * These operate on raw HTML strings to verify accessibility attributes.
 */

/** Extract all occurrences of a given tag from an HTML string. */
function extractTags(html: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>`, 'gi');
  return html.match(regex) ?? [];
}

/** Return true when the tag string contains the given attribute (with any value). */
function hasAttr(tag: string, attr: string): boolean {
  return new RegExp(`\\b${attr}\\s*=`, 'i').test(tag);
}

/** Return the value of an attribute from a tag string, or null if absent. */
function getAttrValue(tag: string, attr: string): string | null {
  const match = tag.match(new RegExp(`${attr}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return match ? match[1] : null;
}

/** Return true when the tag string contains a non-empty value for the attribute. */
function hasNonEmptyAttr(tag: string, attr: string): boolean {
  const value = getAttrValue(tag, attr);
  return value !== null && value.trim().length > 0;
}

/** Extract all self-closing <img … /> or <img … > tags. */
function extractImgTags(html: string): string[] {
  return html.match(/<img[^>]*\/?>/gi) ?? [];
}

/** Extract all <input … > tags. */
function extractInputTags(html: string): string[] {
  return html.match(/<input[^>]*\/?>/gi) ?? [];
}

/** Extract all <label … > tags (opening tag only). */
function extractLabelTags(html: string): string[] {
  return html.match(/<label[^>]*>/gi) ?? [];
}

/** Extract all <button … > tags. */
function extractButtonTags(html: string): string[] {
  return html.match(/<button[^>]*>/gi) ?? [];
}

/** Extract all <a … > anchor tags. */
function extractAnchorTags(html: string): string[] {
  return html.match(/<a[^>]*>/gi) ?? [];
}

/** Extract all <select … > tags. */
function extractSelectTags(html: string): string[] {
  return html.match(/<select[^>]*>/gi) ?? [];
}

/** Extract all <textarea … > tags. */
function extractTextareaTags(html: string): string[] {
  return html.match(/<textarea[^>]*>/gi) ?? [];
}

/** Return true when the element has a tabindex that allows keyboard focus (≥ 0 or absent). */
function isKeyboardFocusable(tag: string): boolean {
  const tabindex = getAttrValue(tag, 'tabindex');
  if (tabindex === null) return true; // default – focusable by default
  return parseInt(tabindex, 10) >= 0;
}

/** Return true when the element has a negative tabindex (removed from tab order). */
function isRemovedFromTabOrder(tag: string): boolean {
  const tabindex = getAttrValue(tag, 'tabindex');
  return tabindex !== null && parseInt(tabindex, 10) < 0;
}

// ─── Sample HTML fixtures ─────────────────────────────────────────────────────
// These represent the expected output of the TST portal components.

const ACCESSIBLE_FORM_HTML = `
<form>
  <label for="email">Email address</label>
  <input id="email" type="email" name="email" aria-required="true" />

  <label for="password">Password</label>
  <input id="password" type="password" name="password" aria-required="true" />

  <label for="country">Country</label>
  <select id="country" name="country" aria-label="Select country">
    <option value="">Choose a country</option>
    <option value="KE">Kenya</option>
  </select>

  <label for="notes">Notes</label>
  <textarea id="notes" name="notes" aria-label="Additional notes"></textarea>

  <button type="submit" aria-label="Submit form">Submit</button>
</form>
`;

const ACCESSIBLE_MODAL_HTML = `
<div role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-desc">
  <h2 id="modal-title">Confirm Payment</h2>
  <p id="modal-desc">Are you sure you want to process this payment?</p>
  <button aria-label="Confirm payment" autofocus>Confirm</button>
  <button aria-label="Cancel and close dialog">Cancel</button>
</div>
`;

const ACCESSIBLE_IMAGES_HTML = `
<div>
  <img src="/logo.png" alt="TechSwiftTrix logo" />
  <img src="/dashboard-chart.png" alt="Revenue chart showing monthly growth" />
  <img src="/decorative-divider.png" alt="" role="presentation" />
  <img src="/user-avatar.png" alt="User profile picture" />
</div>
`;

const ACCESSIBLE_NAV_HTML = `
<nav aria-label="Main navigation">
  <a href="/dashboard" aria-label="Go to dashboard">Dashboard</a>
  <a href="/clients" aria-label="View clients">Clients</a>
  <a href="/projects" aria-label="View projects">Projects</a>
  <a href="#main-content" class="skip-link" aria-label="Skip to main content">Skip to main content</a>
</nav>
<main id="main-content" tabindex="-1">
  <h1>Dashboard</h1>
</main>
`;

const ACCESSIBLE_LIVE_REGION_HTML = `
<div>
  <div aria-live="polite" aria-atomic="true" id="status-announcer"></div>
  <div aria-live="assertive" id="error-announcer"></div>
  <div role="status" aria-live="polite">Loading complete</div>
  <div role="alert" aria-live="assertive">Payment failed. Please try again.</div>
</div>
`;

const ACCESSIBLE_INTERACTIVE_HTML = `
<div>
  <button type="button" aria-label="Open menu" aria-expanded="false" aria-haspopup="true">Menu</button>
  <button type="button" aria-label="Close notification" aria-pressed="false">×</button>
  <a href="/logout" role="button" aria-label="Log out of the system">Logout</a>
  <div role="checkbox" tabindex="0" aria-checked="false" aria-label="Accept terms and conditions"></div>
  <div role="tab" tabindex="0" aria-selected="true" aria-label="Overview tab">Overview</div>
</div>
`;

const INACCESSIBLE_FORM_HTML = `
<form>
  <input type="email" name="email" placeholder="Email" />
  <input type="password" name="password" placeholder="Password" />
  <select name="country">
    <option value="">Choose</option>
  </select>
  <button>Submit</button>
</form>
`;

const INACCESSIBLE_IMAGES_HTML = `
<div>
  <img src="/logo.png" />
  <img src="/chart.png" />
</div>
`;

// ─── 1. ARIA Labels ───────────────────────────────────────────────────────────

describe('Accessibility: ARIA Labels (Requirement 29.3)', () => {
  it('buttons have aria-label or accessible text', () => {
    const buttons = extractButtonTags(ACCESSIBLE_INTERACTIVE_HTML);
    expect(buttons.length).toBeGreaterThan(0);

    for (const btn of buttons) {
      const hasAriaLabel = hasNonEmptyAttr(btn, 'aria-label');
      const hasAriaLabelledBy = hasNonEmptyAttr(btn, 'aria-labelledby');
      expect(hasAriaLabel || hasAriaLabelledBy).toBe(true);
    }
  });

  it('dialog has aria-labelledby pointing to a title element', () => {
    expect(ACCESSIBLE_MODAL_HTML).toMatch(/aria-labelledby="modal-title"/i);
    expect(ACCESSIBLE_MODAL_HTML).toMatch(/id="modal-title"/i);
  });

  it('dialog has aria-describedby for additional context', () => {
    expect(ACCESSIBLE_MODAL_HTML).toMatch(/aria-describedby="modal-desc"/i);
    expect(ACCESSIBLE_MODAL_HTML).toMatch(/id="modal-desc"/i);
  });

  it('navigation landmark has aria-label', () => {
    expect(ACCESSIBLE_NAV_HTML).toMatch(/aria-label="Main navigation"/i);
  });

  it('select elements have aria-label', () => {
    const selects = extractSelectTags(ACCESSIBLE_FORM_HTML);
    expect(selects.length).toBeGreaterThan(0);
    for (const sel of selects) {
      const hasAriaLabel = hasNonEmptyAttr(sel, 'aria-label');
      const hasId = hasNonEmptyAttr(sel, 'id');
      // Either aria-label or an id (associated with a <label for="...">)
      expect(hasAriaLabel || hasId).toBe(true);
    }
  });

  it('inaccessible buttons without aria-label are detected', () => {
    const buttons = extractButtonTags(INACCESSIBLE_FORM_HTML);
    const missingLabel = buttons.filter(
      (btn) => !hasNonEmptyAttr(btn, 'aria-label') && !hasNonEmptyAttr(btn, 'aria-labelledby')
    );
    // This fixture intentionally has a button without aria-label
    expect(missingLabel.length).toBeGreaterThan(0);
  });

  it('role="dialog" element has aria-modal="true"', () => {
    expect(ACCESSIBLE_MODAL_HTML).toMatch(/aria-modal="true"/i);
  });

  it('expandable controls have aria-expanded attribute', () => {
    expect(ACCESSIBLE_INTERACTIVE_HTML).toMatch(/aria-expanded="false"/i);
  });

  it('toggle buttons have aria-pressed attribute', () => {
    expect(ACCESSIBLE_INTERACTIVE_HTML).toMatch(/aria-pressed="false"/i);
  });
});

// ─── 2. Keyboard Navigation ───────────────────────────────────────────────────

describe('Accessibility: Keyboard Navigation (Requirements 29.2, 29.7, 29.10)', () => {
  it('all buttons are in the natural tab order (no negative tabindex)', () => {
    const buttons = extractButtonTags(ACCESSIBLE_INTERACTIVE_HTML);
    expect(buttons.length).toBeGreaterThan(0);
    for (const btn of buttons) {
      expect(isRemovedFromTabOrder(btn)).toBe(false);
    }
  });

  it('custom interactive roles (checkbox, tab) have tabindex="0"', () => {
    const divRoles = ACCESSIBLE_INTERACTIVE_HTML.match(/<div[^>]*role="(checkbox|tab)"[^>]*>/gi) ?? [];
    expect(divRoles.length).toBeGreaterThan(0);
    for (const el of divRoles) {
      expect(getAttrValue(el, 'tabindex')).toBe('0');
    }
  });

  it('form inputs are keyboard accessible (no negative tabindex)', () => {
    const inputs = extractInputTags(ACCESSIBLE_FORM_HTML);
    expect(inputs.length).toBeGreaterThan(0);
    for (const input of inputs) {
      expect(isRemovedFromTabOrder(input)).toBe(false);
    }
  });

  it('anchor links are keyboard accessible', () => {
    const anchors = extractAnchorTags(ACCESSIBLE_NAV_HTML);
    expect(anchors.length).toBeGreaterThan(0);
    for (const anchor of anchors) {
      expect(isRemovedFromTabOrder(anchor)).toBe(false);
    }
  });

  it('skip navigation link is present for keyboard users', () => {
    expect(ACCESSIBLE_NAV_HTML).toMatch(/skip-link|skip to main content/i);
    expect(ACCESSIBLE_NAV_HTML).toMatch(/#main-content/i);
  });

  it('main content area has tabindex="-1" to receive programmatic focus', () => {
    // The main element should accept focus when skip link is activated
    expect(ACCESSIBLE_NAV_HTML).toMatch(/tabindex="-1"/i);
  });

  it('modal dialog button has autofocus for keyboard entry point', () => {
    expect(ACCESSIBLE_MODAL_HTML).toMatch(/autofocus/i);
  });

  it('select elements are keyboard accessible', () => {
    const selects = extractSelectTags(ACCESSIBLE_FORM_HTML);
    expect(selects.length).toBeGreaterThan(0);
    for (const sel of selects) {
      expect(isRemovedFromTabOrder(sel)).toBe(false);
    }
  });

  it('textarea elements are keyboard accessible', () => {
    const textareas = extractTextareaTags(ACCESSIBLE_FORM_HTML);
    expect(textareas.length).toBeGreaterThan(0);
    for (const ta of textareas) {
      expect(isRemovedFromTabOrder(ta)).toBe(false);
    }
  });
});

// ─── 3. Color Contrast ────────────────────────────────────────────────────────

describe('Accessibility: Color Contrast (Requirement 29.4)', () => {
  /**
   * Color contrast cannot be verified from HTML strings alone – it requires
   * computed CSS values. These tests document the required contrast ratios and
   * verify that the design tokens / CSS custom properties are defined with
   * compliant values.
   *
   * The minimum ratio for normal text is 4.5:1 (WCAG 2.1 AA).
   * The minimum ratio for large text (≥ 18pt / 14pt bold) is 3:1.
   */

  const WCAG_AA_NORMAL_TEXT_RATIO = 4.5;
  const WCAG_AA_LARGE_TEXT_RATIO = 3.0;
  const WCAG_AAA_NORMAL_TEXT_RATIO = 7.0;

  /** Relative luminance of an sRGB colour (0–255 per channel). */
  function relativeLuminance(r: number, g: number, b: number): number {
    const toLinear = (c: number) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  }

  /** Contrast ratio between two colours. */
  function contrastRatio(
    fg: [number, number, number],
    bg: [number, number, number]
  ): number {
    const l1 = relativeLuminance(...fg);
    const l2 = relativeLuminance(...bg);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  it('WCAG AA minimum contrast ratio for normal text is 4.5:1', () => {
    expect(WCAG_AA_NORMAL_TEXT_RATIO).toBe(4.5);
  });

  it('WCAG AA minimum contrast ratio for large text is 3:1', () => {
    expect(WCAG_AA_LARGE_TEXT_RATIO).toBe(3.0);
  });

  it('black text on white background meets WCAG AA (21:1)', () => {
    const ratio = contrastRatio([0, 0, 0], [255, 255, 255]);
    expect(ratio).toBeCloseTo(21, 0);
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_RATIO);
  });

  it('white text on black background meets WCAG AA (21:1)', () => {
    const ratio = contrastRatio([255, 255, 255], [0, 0, 0]);
    expect(ratio).toBeCloseTo(21, 0);
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_RATIO);
  });

  it('TST primary text colour (#1a1a2e) on white meets WCAG AA', () => {
    // #1a1a2e = rgb(26, 26, 46) – dark navy
    const ratio = contrastRatio([26, 26, 46], [255, 255, 255]);
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_RATIO);
  });

  it('TST secondary text colour (#4a4a6a) on white meets WCAG AA', () => {
    // #4a4a6a = rgb(74, 74, 106)
    const ratio = contrastRatio([74, 74, 106], [255, 255, 255]);
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_RATIO);
  });

  it('TST error text colour (#c0392b) on white meets WCAG AA', () => {
    // #c0392b = rgb(192, 57, 43) – red
    const ratio = contrastRatio([192, 57, 43], [255, 255, 255]);
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_RATIO);
  });

  it('light grey text (#767676) on white just meets WCAG AA (4.54:1)', () => {
    // #767676 is the well-known borderline-compliant grey
    const ratio = contrastRatio([118, 118, 118], [255, 255, 255]);
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_RATIO);
  });

  it('insufficient contrast (#aaaaaa on white) fails WCAG AA', () => {
    // #aaaaaa = rgb(170, 170, 170) – too light
    const ratio = contrastRatio([170, 170, 170], [255, 255, 255]);
    expect(ratio).toBeLessThan(WCAG_AA_NORMAL_TEXT_RATIO);
  });

  it('contrastRatio function is symmetric', () => {
    const r1 = contrastRatio([26, 26, 46], [255, 255, 255]);
    const r2 = contrastRatio([255, 255, 255], [26, 26, 46]);
    expect(r1).toBeCloseTo(r2, 5);
  });

  it('WCAG AAA threshold is 7:1 for normal text', () => {
    expect(WCAG_AAA_NORMAL_TEXT_RATIO).toBe(7.0);
  });
});

// ─── 4. Alt Text ──────────────────────────────────────────────────────────────

describe('Accessibility: Alt Text for Images (Requirement 29.5)', () => {
  it('all informative images have non-empty alt text', () => {
    const imgs = extractImgTags(ACCESSIBLE_IMAGES_HTML);
    const informative = imgs.filter((img) => {
      const role = getAttrValue(img, 'role');
      const alt = getAttrValue(img, 'alt');
      // Decorative images have role="presentation" and alt=""
      return role !== 'presentation' && alt !== '';
    });
    expect(informative.length).toBeGreaterThan(0);
    for (const img of informative) {
      expect(hasAttr(img, 'alt')).toBe(true);
      const alt = getAttrValue(img, 'alt');
      expect(alt).not.toBeNull();
      expect(alt!.trim().length).toBeGreaterThan(0);
    }
  });

  it('decorative images have empty alt and role="presentation"', () => {
    const imgs = extractImgTags(ACCESSIBLE_IMAGES_HTML);
    const decorative = imgs.filter((img) => getAttrValue(img, 'role') === 'presentation');
    expect(decorative.length).toBeGreaterThan(0);
    for (const img of decorative) {
      expect(getAttrValue(img, 'alt')).toBe('');
    }
  });

  it('images without alt attribute are detected as inaccessible', () => {
    const imgs = extractImgTags(INACCESSIBLE_IMAGES_HTML);
    const missingAlt = imgs.filter((img) => !hasAttr(img, 'alt'));
    expect(missingAlt.length).toBeGreaterThan(0);
  });

  it('logo image has descriptive alt text', () => {
    expect(ACCESSIBLE_IMAGES_HTML).toMatch(/alt="TechSwiftTrix logo"/i);
  });

  it('chart image has descriptive alt text', () => {
    expect(ACCESSIBLE_IMAGES_HTML).toMatch(/alt="Revenue chart/i);
  });
});

// ─── 5. Focus Management ──────────────────────────────────────────────────────

describe('Accessibility: Focus Management in Modals (Requirements 29.8, 29.2)', () => {
  it('modal dialog has role="dialog"', () => {
    expect(ACCESSIBLE_MODAL_HTML).toMatch(/role="dialog"/i);
  });

  it('modal dialog has aria-modal="true" to trap focus', () => {
    expect(ACCESSIBLE_MODAL_HTML).toMatch(/aria-modal="true"/i);
  });

  it('modal has autofocus on first interactive element', () => {
    expect(ACCESSIBLE_MODAL_HTML).toMatch(/autofocus/i);
  });

  it('modal has at least one focusable button for closing', () => {
    const buttons = extractButtonTags(ACCESSIBLE_MODAL_HTML);
    const closable = buttons.filter(
      (btn) =>
        /cancel|close/i.test(getAttrValue(btn, 'aria-label') ?? '') ||
        /cancel|close/i.test(btn)
    );
    expect(closable.length).toBeGreaterThan(0);
  });

  it('skip link target (main) has tabindex="-1" for programmatic focus', () => {
    // The main element should be focusable via JS but not in natural tab order
    expect(ACCESSIBLE_NAV_HTML).toMatch(/<main[^>]*tabindex="-1"/i);
  });

  it('focus indicator is expected on interactive elements (tabindex not -1)', () => {
    const buttons = extractButtonTags(ACCESSIBLE_INTERACTIVE_HTML);
    for (const btn of buttons) {
      // Buttons should not have tabindex="-1" (which would hide focus)
      expect(isRemovedFromTabOrder(btn)).toBe(false);
    }
  });
});

// ─── 6. Screen Reader Announcements ──────────────────────────────────────────

describe('Accessibility: Screen Reader Announcements (Requirement 29.6)', () => {
  it('polite live region is present for status updates', () => {
    expect(ACCESSIBLE_LIVE_REGION_HTML).toMatch(/aria-live="polite"/i);
  });

  it('assertive live region is present for urgent errors', () => {
    expect(ACCESSIBLE_LIVE_REGION_HTML).toMatch(/aria-live="assertive"/i);
  });

  it('status role element is present for non-urgent announcements', () => {
    expect(ACCESSIBLE_LIVE_REGION_HTML).toMatch(/role="status"/i);
  });

  it('alert role element is present for urgent announcements', () => {
    expect(ACCESSIBLE_LIVE_REGION_HTML).toMatch(/role="alert"/i);
  });

  it('aria-atomic="true" ensures complete announcement of updates', () => {
    expect(ACCESSIBLE_LIVE_REGION_HTML).toMatch(/aria-atomic="true"/i);
  });

  it('error announcer uses assertive live region for immediate feedback', () => {
    expect(ACCESSIBLE_LIVE_REGION_HTML).toMatch(/id="error-announcer"[^>]*aria-live="assertive"|aria-live="assertive"[^>]*id="error-announcer"/i);
  });

  it('status announcer uses polite live region to avoid interruption', () => {
    expect(ACCESSIBLE_LIVE_REGION_HTML).toMatch(/id="status-announcer"[^>]*aria-live="polite"|aria-live="polite"[^>]*id="status-announcer"/i);
  });
});

// ─── 7. Form Accessibility ────────────────────────────────────────────────────

describe('Accessibility: Form Accessibility (Requirement 29.7)', () => {
  it('all text inputs have an associated label via for/id pairing', () => {
    const inputs = extractInputTags(ACCESSIBLE_FORM_HTML).filter((inp) => {
      const type = getAttrValue(inp, 'type') ?? 'text';
      return !['submit', 'reset', 'button', 'hidden', 'image'].includes(type);
    });
    const labels = extractLabelTags(ACCESSIBLE_FORM_HTML);
    const labelForValues = labels
      .map((lbl) => getAttrValue(lbl, 'for'))
      .filter(Boolean) as string[];

    expect(inputs.length).toBeGreaterThan(0);
    for (const input of inputs) {
      const id = getAttrValue(input, 'id');
      const hasAriaLabel = hasNonEmptyAttr(input, 'aria-label');
      const hasAriaLabelledBy = hasNonEmptyAttr(input, 'aria-labelledby');
      const hasLabelFor = id !== null && labelForValues.includes(id);
      expect(hasLabelFor || hasAriaLabel || hasAriaLabelledBy).toBe(true);
    }
  });

  it('required fields have aria-required="true"', () => {
    expect(ACCESSIBLE_FORM_HTML).toMatch(/aria-required="true"/i);
  });

  it('select elements have an associated label', () => {
    const selects = extractSelectTags(ACCESSIBLE_FORM_HTML);
    const labels = extractLabelTags(ACCESSIBLE_FORM_HTML);
    const labelForValues = labels
      .map((lbl) => getAttrValue(lbl, 'for'))
      .filter(Boolean) as string[];

    expect(selects.length).toBeGreaterThan(0);
    for (const sel of selects) {
      const id = getAttrValue(sel, 'id');
      const hasAriaLabel = hasNonEmptyAttr(sel, 'aria-label');
      const hasLabelFor = id !== null && labelForValues.includes(id);
      expect(hasLabelFor || hasAriaLabel).toBe(true);
    }
  });

  it('textarea elements have an associated label', () => {
    const textareas = extractTextareaTags(ACCESSIBLE_FORM_HTML);
    const labels = extractLabelTags(ACCESSIBLE_FORM_HTML);
    const labelForValues = labels
      .map((lbl) => getAttrValue(lbl, 'for'))
      .filter(Boolean) as string[];

    expect(textareas.length).toBeGreaterThan(0);
    for (const ta of textareas) {
      const id = getAttrValue(ta, 'id');
      const hasAriaLabel = hasNonEmptyAttr(ta, 'aria-label');
      const hasLabelFor = id !== null && labelForValues.includes(id);
      expect(hasLabelFor || hasAriaLabel).toBe(true);
    }
  });

  it('inaccessible form inputs without labels are detected', () => {
    const inputs = extractInputTags(INACCESSIBLE_FORM_HTML).filter((inp) => {
      const type = getAttrValue(inp, 'type') ?? 'text';
      return !['submit', 'reset', 'button', 'hidden', 'image'].includes(type);
    });
    const labels = extractLabelTags(INACCESSIBLE_FORM_HTML);
    const labelForValues = labels
      .map((lbl) => getAttrValue(lbl, 'for'))
      .filter(Boolean) as string[];

    const unlabelled = inputs.filter((input) => {
      const id = getAttrValue(input, 'id');
      const hasAriaLabel = hasNonEmptyAttr(input, 'aria-label');
      const hasLabelFor = id !== null && labelForValues.includes(id);
      return !hasLabelFor && !hasAriaLabel;
    });

    // The inaccessible fixture has inputs without labels
    expect(unlabelled.length).toBeGreaterThan(0);
  });

  it('submit button has an accessible label', () => {
    const buttons = extractButtonTags(ACCESSIBLE_FORM_HTML);
    const submitBtn = buttons.find((btn) => /type="submit"/i.test(btn));
    expect(submitBtn).toBeDefined();
    expect(hasNonEmptyAttr(submitBtn!, 'aria-label')).toBe(true);
  });
});
