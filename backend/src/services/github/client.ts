import axios, { AxiosInstance } from 'axios';
import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { config } from '../../config';
import logger from '../../utils/logger';

export interface GitHubUser {
  id: string;
  username: string;
  email: string;
  name: string;
  avatarUrl: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  fullName: string;
  description: string;
  url: string;
  defaultBranch: string;
  private: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  url: string;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  createdAt: string;
  updatedAt: string;
  mergedAt?: string;
  author: string;
  url: string;
}

export class GitHubAPIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.github.com',
      timeout: 30000,
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'TechSwiftTrix-ERP',
      },
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.info('GitHub API Request', {
          method: config.method,
          url: config.url,
        });
        return config;
      },
      (error) => {
        logger.error('GitHub API Request Error', { error });
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.info('GitHub API Response', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error) => {
        logger.error('GitHub API Response Error', {
          status: error.response?.status,
          url: error.config?.url,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Configure GitHub OAuth strategy
   */
  configureOAuth(): void {
    // Skip if GitHub OAuth is not configured (dev environment without credentials)
    if (!config.github.clientId || !config.github.clientSecret) {
      logger.warn('GitHub OAuth not configured — skipping strategy registration');
      return;
    }
    passport.use(
      new GitHubStrategy(
        {
          clientID: config.github.clientId,
          clientSecret: config.github.clientSecret,
          callbackURL: config.github.callbackUrl,
          scope: ['user:email', 'read:user', 'repo'],
        },
        (accessToken: string, _refreshToken: string, profile: any, done: any) => {
          const user: GitHubUser = {
            id: profile.id,
            username: profile.username,
            email: profile.emails?.[0]?.value || '',
            name: profile.displayName || profile.username,
            avatarUrl: profile.photos?.[0]?.value || '',
          };
          done(null, { user, accessToken });
        }
      )
    );

    passport.serializeUser((user: any, done) => {
      done(null, user);
    });

    passport.deserializeUser((user: any, done) => {
      done(null, user);
    });
  }

  /**
   * Get user repositories
   */
  async getUserRepositories(username: string, accessToken: string): Promise<GitHubRepository[]> {
    try {
      const response = await this.client.get(`/users/${username}/repos`, {
        headers: {
          Authorization: `token ${accessToken}`,
        },
        params: {
          sort: 'updated',
          per_page: 100,
        },
      });

      return response.data.map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description || '',
        url: repo.html_url,
        defaultBranch: repo.default_branch,
        private: repo.private,
        createdAt: repo.created_at,
        updatedAt: repo.updated_at,
      }));
    } catch (error: any) {
      logger.error('Failed to fetch user repositories', { error, username });
      throw new Error(`Failed to fetch repositories: ${error.message}`);
    }
  }

  /**
   * Get repository commits
   */
  async getRepositoryCommits(
    owner: string,
    repo: string,
    accessToken: string,
    options?: {
      since?: string;
      until?: string;
      per_page?: number;
    }
  ): Promise<GitHubCommit[]> {
    try {
      const response = await this.client.get(`/repos/${owner}/${repo}/commits`, {
        headers: {
          Authorization: `token ${accessToken}`,
        },
        params: {
          since: options?.since,
          until: options?.until,
          per_page: options?.per_page || 30,
        },
      });

      return response.data.map((commit: any) => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: {
          name: commit.commit.author.name,
          email: commit.commit.author.email,
          date: commit.commit.author.date,
        },
        url: commit.html_url,
      }));
    } catch (error: any) {
      logger.error('Failed to fetch repository commits', { error, owner, repo });
      throw new Error(`Failed to fetch commits: ${error.message}`);
    }
  }

  /**
   * Get repository pull requests
   */
  async getRepositoryPullRequests(
    owner: string,
    repo: string,
    accessToken: string,
    state: 'open' | 'closed' | 'all' = 'all'
  ): Promise<GitHubPullRequest[]> {
    try {
      const response = await this.client.get(`/repos/${owner}/${repo}/pulls`, {
        headers: {
          Authorization: `token ${accessToken}`,
        },
        params: {
          state,
          per_page: 100,
        },
      });

      return response.data.map((pr: any) => ({
        id: pr.id,
        number: pr.number,
        title: pr.title,
        state: pr.merged_at ? 'merged' : pr.state,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        mergedAt: pr.merged_at,
        author: pr.user.login,
        url: pr.html_url,
      }));
    } catch (error: any) {
      logger.error('Failed to fetch repository pull requests', { error, owner, repo });
      throw new Error(`Failed to fetch pull requests: ${error.message}`);
    }
  }

  /**
   * Get repository metadata
   */
  async getRepositoryMetadata(
    owner: string,
    repo: string,
    accessToken: string
  ): Promise<GitHubRepository> {
    try {
      const response = await this.client.get(`/repos/${owner}/${repo}`, {
        headers: {
          Authorization: `token ${accessToken}`,
        },
      });

      return {
        id: response.data.id,
        name: response.data.name,
        fullName: response.data.full_name,
        description: response.data.description || '',
        url: response.data.html_url,
        defaultBranch: response.data.default_branch,
        private: response.data.private,
        createdAt: response.data.created_at,
        updatedAt: response.data.updated_at,
      };
    } catch (error: any) {
      logger.error('Failed to fetch repository metadata', { error, owner, repo });
      throw new Error(`Failed to fetch repository metadata: ${error.message}`);
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile(username: string, accessToken: string): Promise<GitHubUser> {
    try {
      const response = await this.client.get(`/users/${username}`, {
        headers: {
          Authorization: `token ${accessToken}`,
        },
      });

      return {
        id: response.data.id,
        username: response.data.login,
        email: response.data.email || '',
        name: response.data.name || response.data.login,
        avatarUrl: response.data.avatar_url,
      };
    } catch (error: any) {
      logger.error('Failed to fetch user profile', { error, username });
      throw new Error(`Failed to fetch user profile: ${error.message}`);
    }
  }
}

export const githubClient = new GitHubAPIClient();
