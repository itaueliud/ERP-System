export type ArticleCategory =
  | 'Getting_Started'
  | 'User_Guides'
  | 'FAQs'
  | 'Troubleshooting'
  | 'API_Documentation'
  | 'Policies';

export type ArticleStatus = 'draft' | 'published' | 'archived';

export interface Article {
  id: string;
  title: string;
  content: string; // rich text / markdown
  category: ArticleCategory;
  status: ArticleStatus;
  tags: string[];
  authorId: string;
  authorName: string;
  createdAt: Date;
  updatedAt: Date;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  relatedArticleIds: string[];
}

export interface ArticleSearchResult {
  article: Article;
  relevanceScore: number;
}

export interface ArticleImprovement {
  id: string;
  articleId: string;
  suggestion: string;
  userId: string;
  createdAt: Date;
  status: 'pending' | 'reviewed' | 'applied';
}

export class KnowledgeBaseService {
  createArticle(
    data: Omit<Article, 'id' | 'createdAt' | 'updatedAt' | 'viewCount' | 'helpfulCount' | 'notHelpfulCount'>,
  ): Article {
    const now = new Date();
    return {
      ...data,
      id: `article-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: now,
      updatedAt: now,
      viewCount: 0,
      helpfulCount: 0,
      notHelpfulCount: 0,
    };
  }

  incrementViewCount(article: Article): Article {
    return { ...article, viewCount: article.viewCount + 1 };
  }

  searchArticles(articles: Article[], query: string): ArticleSearchResult[] {
    if (!query.trim()) return [];

    const lower = query.toLowerCase();
    const results: ArticleSearchResult[] = [];

    for (const article of articles) {
      let score = 0;

      if (article.title.toLowerCase().includes(lower)) score += 3;
      if (article.content.toLowerCase().includes(lower)) score += 1;
      if (article.tags.some((tag) => tag.toLowerCase().includes(lower))) score += 2;

      if (score > 0) results.push({ article, relevanceScore: score });
    }

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  getArticlesByCategory(articles: Article[], category: ArticleCategory): Article[] {
    return articles.filter((a) => a.category === category);
  }

  getPublishedArticles(articles: Article[]): Article[] {
    return articles.filter((a) => a.status === 'published');
  }

  rateArticle(article: Article, isHelpful: boolean): Article {
    if (isHelpful) {
      return { ...article, helpfulCount: article.helpfulCount + 1 };
    }
    return { ...article, notHelpfulCount: article.notHelpfulCount + 1 };
  }

  getRelatedArticles(article: Article, allArticles: Article[], limit: number): Article[] {
    const titleWords = new Set(article.title.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
    const tagSet = new Set(article.tags.map((t) => t.toLowerCase()));

    const scored = allArticles
      .filter((a) => a.id !== article.id && a.status === 'published')
      .map((a) => {
        let score = 0;
        // Shared tags (higher weight)
        for (const tag of a.tags) {
          if (tagSet.has(tag.toLowerCase())) score += 3;
        }
        // Same category
        if (a.category === article.category) score += 2;
        // Shared words in title
        for (const word of a.title.toLowerCase().split(/\s+/)) {
          if (word.length > 2 && titleWords.has(word)) score += 1;
        }
        return { article: a, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map((r) => r.article);
  }

  suggestImprovement(articleId: string, suggestion: string, userId: string): ArticleImprovement {
    return {
      id: `improvement-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      articleId,
      suggestion,
      userId,
      createdAt: new Date(),
      status: 'pending',
    };
  }

  getHelpfulnessRatio(article: Article): number {
    const total = article.helpfulCount + article.notHelpfulCount;
    if (total === 0) return 0;
    return article.helpfulCount / total;
  }
}
