import { KnowledgeBaseService, Article, ArticleImprovement } from './knowledgeBaseService';

const service = new KnowledgeBaseService();

function makeArticle(overrides: Partial<Article> = {}): Article {
  return service.createArticle({
    title: overrides.title ?? 'Test Article',
    content: overrides.content ?? 'Some content here.',
    category: overrides.category ?? 'FAQs',
    status: overrides.status ?? 'published',
    tags: overrides.tags ?? [],
    authorId: 'user-1',
    authorName: 'Alice',
    relatedArticleIds: [],
    ...overrides,
  });
}

describe('KnowledgeBaseService', () => {
  describe('createArticle', () => {
    it('creates article with correct fields and zero counts', () => {
      const article = makeArticle({ title: 'Getting Started Guide', category: 'Getting_Started' });

      expect(article.id).toMatch(/^article-/);
      expect(article.title).toBe('Getting Started Guide');
      expect(article.category).toBe('Getting_Started');
      expect(article.viewCount).toBe(0);
      expect(article.helpfulCount).toBe(0);
      expect(article.notHelpfulCount).toBe(0);
      expect(article.createdAt).toBeInstanceOf(Date);
      expect(article.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('incrementViewCount', () => {
    it('increments view count by 1', () => {
      const article = makeArticle();
      const updated = service.incrementViewCount(article);
      expect(updated.viewCount).toBe(1);
    });

    it('does not mutate the original article', () => {
      const article = makeArticle();
      service.incrementViewCount(article);
      expect(article.viewCount).toBe(0);
    });
  });

  describe('searchArticles', () => {
    const articles = [
      makeArticle({ title: 'How to reset your password', content: 'Go to settings.', tags: [] }),
      makeArticle({ title: 'API Overview', content: 'The REST API supports JSON.', tags: ['api', 'rest'] }),
      makeArticle({ title: 'Billing Policy', content: 'Invoices are sent monthly.', tags: ['billing'] }),
    ];

    it('finds articles by title match', () => {
      const results = service.searchArticles(articles, 'password');
      expect(results.length).toBe(1);
      expect(results[0].article.title).toBe('How to reset your password');
    });

    it('finds articles by content match', () => {
      const results = service.searchArticles(articles, 'JSON');
      expect(results.length).toBe(1);
      expect(results[0].article.title).toBe('API Overview');
    });

    it('finds articles by tag match', () => {
      const results = service.searchArticles(articles, 'billing');
      expect(results.length).toBe(1);
      expect(results[0].article.title).toBe('Billing Policy');
    });

    it('returns empty array for no matches', () => {
      const results = service.searchArticles(articles, 'xyznonexistent');
      expect(results).toEqual([]);
    });

    it('sorts results by relevance score descending', () => {
      // 'api' matches both tag (score+2) and title (score+3) in API Overview
      const results = service.searchArticles(articles, 'api');
      expect(results[0].article.title).toBe('API Overview');
      expect(results[0].relevanceScore).toBeGreaterThan(0);
    });
  });

  describe('getArticlesByCategory', () => {
    const articles = [
      makeArticle({ category: 'Getting_Started' }),
      makeArticle({ category: 'FAQs' }),
      makeArticle({ category: 'FAQs' }),
      makeArticle({ category: 'Troubleshooting' }),
    ];

    it('returns only articles in the specified category', () => {
      const faqs = service.getArticlesByCategory(articles, 'FAQs');
      expect(faqs.length).toBe(2);
      faqs.forEach((a) => expect(a.category).toBe('FAQs'));
    });

    it('returns empty array when no articles match the category', () => {
      const results = service.getArticlesByCategory(articles, 'Policies');
      expect(results).toEqual([]);
    });
  });

  describe('getPublishedArticles', () => {
    const articles = [
      makeArticle({ status: 'published' }),
      makeArticle({ status: 'draft' }),
      makeArticle({ status: 'archived' }),
      makeArticle({ status: 'published' }),
    ];

    it('returns only published articles', () => {
      const published = service.getPublishedArticles(articles);
      expect(published.length).toBe(2);
      published.forEach((a) => expect(a.status).toBe('published'));
    });
  });

  describe('rateArticle', () => {
    it('increments helpfulCount when isHelpful=true', () => {
      const article = makeArticle();
      const rated = service.rateArticle(article, true);
      expect(rated.helpfulCount).toBe(1);
      expect(rated.notHelpfulCount).toBe(0);
    });

    it('increments notHelpfulCount when isHelpful=false', () => {
      const article = makeArticle();
      const rated = service.rateArticle(article, false);
      expect(rated.notHelpfulCount).toBe(1);
      expect(rated.helpfulCount).toBe(0);
    });
  });

  describe('getRelatedArticles', () => {
    it('returns articles with shared tags', () => {
      const base = makeArticle({ id: 'a1', tags: ['typescript', 'api'], status: 'published' });
      const related = makeArticle({ id: 'a2', tags: ['typescript'], status: 'published' });
      const unrelated = makeArticle({ id: 'a3', tags: ['billing'], status: 'published' });
      const results = service.getRelatedArticles(base, [base, related, unrelated], 10);
      expect(results.some((a) => a.id === related.id)).toBe(true);
    });

    it('excludes the article itself', () => {
      const base = makeArticle({ id: 'a1', tags: ['typescript'], status: 'published' });
      const other = makeArticle({ id: 'a2', tags: ['typescript'], status: 'published' });
      const results = service.getRelatedArticles(base, [base, other], 10);
      expect(results.some((a) => a.id === base.id)).toBe(false);
    });

    it('respects the limit parameter', () => {
      const base = makeArticle({ id: 'base', tags: ['tag1'], status: 'published' });
      const others = Array.from({ length: 5 }, (_, i) =>
        makeArticle({ id: `a${i}`, tags: ['tag1'], status: 'published' }),
      );
      const results = service.getRelatedArticles(base, [base, ...others], 3);
      expect(results.length).toBeLessThanOrEqual(3);
    });
  });

  describe('suggestImprovement', () => {
    it('creates suggestion with pending status', () => {
      const improvement: ArticleImprovement = service.suggestImprovement('article-1', 'Add more examples', 'user-42');
      expect(improvement.articleId).toBe('article-1');
      expect(improvement.suggestion).toBe('Add more examples');
      expect(improvement.userId).toBe('user-42');
      expect(improvement.status).toBe('pending');
      expect(improvement.id).toMatch(/^improvement-/);
      expect(improvement.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('getHelpfulnessRatio', () => {
    it('returns correct ratio', () => {
      const article = makeArticle();
      const rated = service.rateArticle(service.rateArticle(service.rateArticle(article, true), true), false);
      expect(service.getHelpfulnessRatio(rated)).toBeCloseTo(2 / 3);
    });

    it('returns 0 when no ratings', () => {
      const article = makeArticle();
      expect(service.getHelpfulnessRatio(article)).toBe(0);
    });
  });
});
