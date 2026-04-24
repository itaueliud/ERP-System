import { GitHubAPIClient } from './client';

jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  })),
}));
jest.mock('passport');
jest.mock('passport-github2');
jest.mock('../../config', () => ({
  config: {
    github: {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      callbackUrl: 'http://localhost:3000/auth/github/callback',
    },
  },
}));

describe('GitHubAPIClient', () => {
  let client: GitHubAPIClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new GitHubAPIClient();
  });

  describe('getUserRepositories', () => {
    it('should fetch user repositories successfully', async () => {
      const mockRepos = [
        {
          id: 1,
          name: 'test-repo',
          full_name: 'user/test-repo',
          description: 'Test repository',
          html_url: 'https://github.com/user/test-repo',
          default_branch: 'main',
          private: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      ];

      (client as any).client.get = jest.fn().mockResolvedValue({ data: mockRepos });

      const result = await client.getUserRepositories('testuser', 'test-token');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 1,
        name: 'test-repo',
        fullName: 'user/test-repo',
        description: 'Test repository',
        url: 'https://github.com/user/test-repo',
        defaultBranch: 'main',
        private: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      });
    });

    it('should handle API errors', async () => {
      (client as any).client.get = jest.fn().mockRejectedValue(new Error('API Error'));

      await expect(
        client.getUserRepositories('testuser', 'test-token')
      ).rejects.toThrow('Failed to fetch repositories');
    });
  });

  describe('getRepositoryCommits', () => {
    it('should fetch repository commits successfully', async () => {
      const mockCommits = [
        {
          sha: 'abc123',
          commit: {
            message: 'Initial commit',
            author: {
              name: 'Test User',
              email: 'test@example.com',
              date: '2024-01-01T00:00:00Z',
            },
          },
          html_url: 'https://github.com/user/repo/commit/abc123',
        },
      ];

      (client as any).client.get = jest.fn().mockResolvedValue({ data: mockCommits });

      const result = await client.getRepositoryCommits('user', 'repo', 'test-token');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        sha: 'abc123',
        message: 'Initial commit',
        author: {
          name: 'Test User',
          email: 'test@example.com',
          date: '2024-01-01T00:00:00Z',
        },
        url: 'https://github.com/user/repo/commit/abc123',
      });
    });
  });

  describe('getRepositoryPullRequests', () => {
    it('should fetch pull requests successfully', async () => {
      const mockPRs = [
        {
          id: 1,
          number: 42,
          title: 'Add feature',
          state: 'open',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
          merged_at: null,
          user: { login: 'testuser' },
          html_url: 'https://github.com/user/repo/pull/42',
        },
      ];

      (client as any).client.get = jest.fn().mockResolvedValue({ data: mockPRs });

      const result = await client.getRepositoryPullRequests('user', 'repo', 'test-token');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 1,
        number: 42,
        title: 'Add feature',
        state: 'open',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
        mergedAt: null,
        author: 'testuser',
        url: 'https://github.com/user/repo/pull/42',
      });
    });

    it('should mark merged PRs correctly', async () => {
      const mockPRs = [
        {
          id: 1,
          number: 42,
          title: 'Add feature',
          state: 'closed',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
          merged_at: '2024-01-02T00:00:00Z',
          user: { login: 'testuser' },
          html_url: 'https://github.com/user/repo/pull/42',
        },
      ];

      (client as any).client.get = jest.fn().mockResolvedValue({ data: mockPRs });

      const result = await client.getRepositoryPullRequests('user', 'repo', 'test-token');

      expect(result[0].state).toBe('merged');
    });
  });
});
