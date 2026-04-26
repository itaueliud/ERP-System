import React, { useState } from 'react';

export interface FAQItem {
  q: string;
  a: string;
}

export interface FAQCategory {
  category: string;
  items: FAQItem[];
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function FAQAccordionItem({ item }: { item: FAQItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-lg shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left bg-white hover:bg-slate-50 transition-colors gap-3"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-slate-800">{item.q}</span>
        <Chevron open={open} />
      </button>
      {/* Animated answer panel */}
      <div className={`overflow-hidden transition-all duration-200 ease-in-out ${open ? 'max-h-96' : 'max-h-0'}`}>
        <div className="px-4 pb-4 pt-2 bg-white border-t border-slate-100">
          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{item.a}</p>
        </div>
      </div>
    </div>
  );
}

export function FAQPanel({ faqs, accentColor, portalName }: {
  faqs: FAQCategory[];
  accentColor: string;
  portalName: string;
}) {
  const [search, setSearch] = useState('');
  const [openCats, setOpenCats] = useState<Set<string>>(new Set(faqs.map(f => f.category)));

  const toggleCat = (cat: string) =>
    setOpenCats(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });

  const q = search.toLowerCase().trim();
  const filtered = faqs.map(cat => ({
    ...cat,
    items: q
      ? cat.items.filter(i => i.q.toLowerCase().includes(q) || i.a.toLowerCase().includes(q))
      : cat.items,
  })).filter(cat => cat.items.length > 0);

  const totalResults = filtered.reduce((sum, cat) => sum + cat.items.length, 0);

  return (
    <div className="max-w-3xl px-1">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Frequently Asked Questions</h1>
        <p className="text-sm text-slate-500 mt-0.5">{portalName} — find answers to common questions below.</p>
      </div>

      {/* Search */}
      <div className="relative mb-2">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search questions…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-slate-300 shadow-sm text-sm focus:outline-none focus:ring-2 bg-white"
          style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            aria-label="Clear search"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Result count */}
      {q && (
        <p className="text-xs text-slate-400 mb-5">
          {totalResults > 0 ? `${totalResults} result${totalResults !== 1 ? 's' : ''} for "${search}"` : ''}
        </p>
      )}
      {!q && <div className="mb-5" />}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-14 text-slate-400">
          <svg className="w-10 h-10 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-sm font-medium">No results for "{search}"</p>
          <p className="text-xs mt-1">Try a different keyword or browse the categories below.</p>
        </div>
      )}

      {/* Categories */}
      <div className="space-y-5">
        {filtered.map(cat => (
          <div key={cat.category}>
            {/* Category header — full-width strip */}
            <button
              onClick={() => toggleCat(cat.category)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors mb-2 group"
            >
              <span
                className="w-1 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: accentColor }}
              />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 group-hover:text-slate-700 transition-colors flex-1 text-left">
                {cat.category}
              </span>
              <span className="text-xs text-slate-400 mr-1">{cat.items.length}</span>
              <Chevron open={openCats.has(cat.category)} />
            </button>

            {/* Animated items list */}
            <div className={`overflow-hidden transition-all duration-200 ease-in-out ${openCats.has(cat.category) ? 'max-h-[2000px]' : 'max-h-0'}`}>
              <div className="space-y-2 pl-3">
                {cat.items.map((item, i) => (
                  <FAQAccordionItem key={i} item={item} />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        className="mt-8 p-4 rounded-lg bg-slate-50 border border-slate-200 border-l-4 text-sm text-slate-500"
        style={{ borderLeftColor: accentColor }}
      >
        Still need help? Contact your system administrator or use the Chat section.
      </div>
    </div>
  );
}

export default FAQPanel;
