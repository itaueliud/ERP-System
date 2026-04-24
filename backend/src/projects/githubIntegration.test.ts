import { GitHubIntegrationService } from './githubIntegration';
import { db } from '../database/connection';

jest.mock('../database/connection');
jest.mock('../utils/logger');
jest.mock('passport');
jest.mock('passport-github2');
jest.mock('../services/github/client', () => ({
  githubClient: {
    getRepositoryMetadata: jest.fn(),
    getRepositoryCommits: jest.fn(),
    getRepositoryPullRequests: jest.fn(),
    getUserRepositories: jest.fn(),
    getUserProfile: jest.fn(),
    configureOAuth: jest.fn(),
  },
}));
jest.mock('../config', () => ({
  config: {
    apiBaseUrl: 'http://localhost:3000',
    logging: { level: 'info', filePath: '/tmp/test.log' },
    database: { host: 'localhost', port: 5432, name: 'test', user: 'test', password: 'test' },
    githubIntegration: { syncIntervalMinutes: 15 },
  },
}));

import { githubClient } from '../services/github/client';

const PROJECT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const USER_ID = 'bbbbbbbb-0000-0000-0000-000000000002';
const REPO_DB_ID = 'cccccccc-0000-0000-0000-000000000003';
const ACCESS_TOKEN = 'ghp_test_token';

const MOCK_METADATA = {
  id: 123456,
  name: 'my-repo',
  fullName: 'owner/my-repo',
  description: 'Test repo',
  url: 'https://github.com/owner/my-repo',
  defaultBranch: 'main',
  private: false,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-06-01T00:00:00Z',
};

const MOCK_REPO_ROW = {
  id: REPO_DB_ID,
  github_repo_id: '123456',
  name: 'my-repo',
  full_name: 'owner/my-repo',
  url: 'https://github.com/owner/my-repo',
  metadata: MOCK_METADATA,
  last_synced: new Date('2024-06-01T00:00:00Z'),
  created_at: new Date('2024-01-01T00:00:00Z'),
};

const MOCK_COMMITS = [
  {
    sha: 'abc123',
    message: 'feat: add feature',
    author: { name: 'Dev', email: 'dev@example.com', date: '2024-06-01T00:00:00Z' },
    url: 'https://github.com/owner/my-repo/commit/abc123',
  },
];

const MOCK_PRS = [
  {
    id: 1,
    number: 42,
    title: 'Add feature',
    state: 'open' as const,
    createdAt: '2024-06-01T00:00:00Z',
    updatedAt: '2024-06-02T00:00:00Z',
    mergedAt: undefined,
    author: 'devuser',
    url: 'https://github.com/owner/my-repo/pull/42',
  },
];

describe('GitHubIntegrationService', () => {
  let service: GitHubIntegrationService;
  const mockedGithubClient = githubClient as jest.Mocked<typeof githubClient>;

  beforeEach(() => {
    service = new GitHubIntegrationService();
    jest.clearAllMocks();
  });

  // ─── linkRepository ────────────────────────────────────────────────────────

  describe('linkRepository', () => {
    it('should link a repository and return LinkedRepository', async () => {
      // project exists
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: PROJECT_ID, status: 'ACTIVE' }],
      });
      // upsert github_repositories
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [MOCK_REPO_ROW] });
      // update projects
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      // activity_timeline insert
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      mockedGithubClient.getRepositoryMetadata = jest.fn().mockResolvedValue(MOCK_METADATA);

      const result = await service.linkRepository(
        PROJECT_ID,
        'owner/my-repo',
        USER_ID,
        ACCESS_TOKEN
      );

      expect(result.fullName).toBe('owner/my-repo');
      expect(result.githubRepoId).toBe('123456');
      expect(mockedGithubClient.getRepositoryMetadata).toHaveBeenCalledWith(
        'owner',
        'my-repo',
        ACCESS_TOKEN
      );
    });

    it('should throw when project not found', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(
        service.linkRepository(PROJECT_ID, 'owner/my-repo', USER_ID, ACCESS_TOKEN)
      ).rejects.toThrow('Project not found');
    });

    it('should throw for invalid repo name format', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: PROJECT_ID, status: 'ACTIVE' }],
      });

      await expect(
        service.linkRepository(PROJECT_ID, 'invalid-repo-name', USER_ID, ACCESS_TOKEN)
      ).rejects.toThrow('Invalid repository name');
    });
  });

  // ─── unlinkRepository ──────────────────────────────────────────────────────

  describe('unlinkRepository', () => {
    it('should unlink a repository successfully', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: PROJECT_ID, github_repo_id: REPO_DB_ID }],
      });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] }); // update
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] }); // timeline

      await expect(service.unlinkRepository(PROJECT_ID, USER_ID)).resolves.toBeUndefined();
    });

    it('should throw when project not found', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(service.unlinkRepository(PROJECT_ID, USER_ID)).rejects.toThrow(
        'Project not found'
      );
    });

    it('should throw when no repository is linked', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: PROJECT_ID, github_repo_id: null }],
      });

      await expect(service.unlinkRepository(PROJECT_ID, USER_ID)).rejects.toThrow(
        'Project has no linked GitHub repository'
      );
    });
  });

  // ─── getRepositoryData ─────────────────────────────────────────────────────

  describe('getRepositoryData', () => {
    it('should return repository data with commits and PRs', async () => {
      // getLinkedRepository
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [MOCK_REPO_ROW] });

      mockedGithubClient.getRepositoryCommits = jest.fn().mockResolvedValue(MOCK_COMMITS);
      mockedGithubClient.getRepositoryPullRequests = jest.fn().mockResolvedValue(MOCK_PRS);

      const result = await service.getRepositoryData(PROJECT_ID, ACCESS_TOKEN);

      expect(result.repository.fullName).toBe('owner/my-repo');
      expect(result.commits).toHaveLength(1);
      expect(result.pullRequests).toHaveLength(1);
    });

    it('should throw when no repository is linked', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(service.getRepositoryData(PROJECT_ID, ACCESS_TOKEN)).rejects.toThrow(
        'No GitHub repository linked to this project'
      );
    });
  });

  // ─── syncRepository ────────────────────────────────────────────────────────

  describe('syncRepository', () => {
    it('should sync repository and return updated LinkedRepository', async () => {
      // getLinkedRepository
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [MOCK_REPO_ROW] });
      // update github_repositories
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [MOCK_REPO_ROW] });

      mockedGithubClient.getRepositoryMetadata = jest.fn().mockResolvedValue(MOCK_METADATA);
      mockedGithubClient.getRepositoryPullRequests = jest.fn().mockResolvedValue([]);

      const result = await service.syncRepository(PROJECT_ID, ACCESS_TOKEN);

      expect(result.fullName).toBe('owner/my-repo');
      expect(mockedGithubClient.getRepositoryMetadata).toHaveBeenCalled();
    });

    it('should log merge events for PRs merged since last sync', async () => {
      const mergedPR = {
        ...MOCK_PRS[0],
        state: 'merged' as const,
        mergedAt: new Date().toISOString(),
      };

      // getLinkedRepository — last_synced is in the past
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ ...MOCK_REPO_ROW, last_synced: new Date('2024-01-01') }],
      });
      // activity_timeline insert for merged PR
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      // update github_repositories
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [MOCK_REPO_ROW] });

      mockedGithubClient.getRepositoryMetadata = jest.fn().mockResolvedValue(MOCK_METADATA);
      mockedGithubClient.getRepositoryPullRequests = jest.fn().mockResolvedValue([mergedPR]);

      await service.syncRepository(PROJECT_ID, ACCESS_TOKEN);

      // Verify timeline insert was called
      const calls = (db.query as jest.Mock).mock.calls;
      const timelineCall = calls.find((c: any[]) =>
        typeof c[0] === 'string' && c[0].includes('activity_timeline')
      );
      expect(timelineCall).toBeDefined();
    });

    it('should throw when no repository is linked', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(service.syncRepository(PROJECT_ID, ACCESS_TOKEN)).rejects.toThrow(
        'No GitHub repository linked to this project'
      );
    });
  });

  // ─── getCommitHistory ──────────────────────────────────────────────────────

  describe('getCommitHistory', () => {
    it('should return commits with default limit of 30', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [MOCK_REPO_ROW] });
      mockedGithubClient.getRepositoryCommits = jest.fn().mockResolvedValue(MOCK_COMMITS);

      const commits = await service.getCommitHistory(PROJECT_ID, ACCESS_TOKEN);

      expect(commits).toHaveLength(1);
      expect(mockedGithubClient.getRepositoryCommits).toHaveBeenCalledWith(
        'owner',
        'my-repo',
        ACCESS_TOKEN,
        { per_page: 30 }
      );
    });

    it('should respect custom limit', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [MOCK_REPO_ROW] });
      mockedGithubClient.getRepositoryCommits = jest.fn().mockResolvedValue(MOCK_COMMITS);

      await service.getCommitHistory(PROJECT_ID, ACCESS_TOKEN, 10);

      expect(mockedGithubClient.getRepositoryCommits).toHaveBeenCalledWith(
        'owner',
        'my-repo',
        ACCESS_TOKEN,
        { per_page: 10 }
      );
    });

    it('should throw when no repository is linked', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(service.getCommitHistory(PROJECT_ID, ACCESS_TOKEN)).rejects.toThrow(
        'No GitHub repository linked to this project'
      );
    });
  });

  // ─── getPullRequests ───────────────────────────────────────────────────────

  describe('getPullRequests', () => {
    it('should return all pull requests by default', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [MOCK_REPO_ROW] });
      mockedGithubClient.getRepositoryPullRequests = jest.fn().mockResolvedValue(MOCK_PRS);

      const prs = await service.getPullRequests(PROJECT_ID, ACCESS_TOKEN);

      expect(prs).toHaveLength(1);
      expect(mockedGithubClient.getRepositoryPullRequests).toHaveBeenCalledWith(
        'owner',
        'my-repo',
        ACCESS_TOKEN,
        'all'
      );
    });

    it('should filter by state when provided', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [MOCK_REPO_ROW] });
      mockedGithubClient.getRepositoryPullRequests = jest.fn().mockResolvedValue([]);

      await service.getPullRequests(PROJECT_ID, ACCESS_TOKEN, 'open');

      expect(mockedGithubClient.getRepositoryPullRequests).toHaveBeenCalledWith(
        'owner',
        'my-repo',
        ACCESS_TOKEN,
        'open'
      );
    });

    it('should throw when no repository is linked', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(service.getPullRequests(PROJECT_ID, ACCESS_TOKEN)).rejects.toThrow(
        'No GitHub repository linked to this project'
      );
    });
  });

  // ─── syncActiveProjects ────────────────────────────────────────────────────

  describe('syncActiveProjects', () => {
    it('should sync all active projects with linked repos', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: PROJECT_ID }],
      });

      // For syncRepository: getLinkedRepository + update
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [MOCK_REPO_ROW] });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [MOCK_REPO_ROW] });

      mockedGithubClient.getRepositoryMetadata = jest.fn().mockResolvedValue(MOCK_METADATA);
      mockedGithubClient.getRepositoryPullRequests = jest.fn().mockResolvedValue([]);

      const getAccessToken = jest.fn().mockResolvedValue(ACCESS_TOKEN);

      await service.syncActiveProjects(getAccessToken);

      expect(getAccessToken).toHaveBeenCalledWith(PROJECT_ID);
    });

    it('should skip projects with no access token', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: PROJECT_ID }],
      });

      const getAccessToken = jest.fn().mockResolvedValue(null);

      await service.syncActiveProjects(getAccessToken);

      // syncRepository should not be called
      expect(mockedGithubClient.getRepositoryMetadata).not.toHaveBeenCalled();
    });

    it('should continue syncing other projects if one fails', async () => {
      const PROJECT_ID_2 = 'dddddddd-0000-0000-0000-000000000004';

      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: PROJECT_ID }, { id: PROJECT_ID_2 }],
      });

      // First project: getLinkedRepository returns empty (will throw)
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      // Second project: getLinkedRepository succeeds
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [MOCK_REPO_ROW] });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [MOCK_REPO_ROW] });

      mockedGithubClient.getRepositoryMetadata = jest.fn().mockResolvedValue(MOCK_METADATA);
      mockedGithubClient.getRepositoryPullRequests = jest.fn().mockResolvedValue([]);

      const getAccessToken = jest.fn().mockResolvedValue(ACCESS_TOKEN);

      // Should not throw even though first project fails
      await expect(service.syncActiveProjects(getAccessToken)).resolves.toBeUndefined();
    });
  });

  // ─── getLinkedRepository ───────────────────────────────────────────────────

  describe('getLinkedRepository', () => {
    it('should return linked repository when one exists', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [MOCK_REPO_ROW] });

      const repo = await service.getLinkedRepository(PROJECT_ID);

      expect(repo).not.toBeNull();
      expect(repo!.fullName).toBe('owner/my-repo');
    });

    it('should return null when no repository is linked', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const repo = await service.getLinkedRepository(PROJECT_ID);

      expect(repo).toBeNull();
    });
  });
});
