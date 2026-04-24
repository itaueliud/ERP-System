import { db } from '../database/connection';
import { githubClient } from '../services/github/client';
import type { GitHubRepository, GitHubCommit, GitHubPullRequest } from '../services/github/client';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface LinkedRepository {
  id: string;
  githubRepoId: string;
  name: string;
  fullName: string;
  url: string;
  metadata: GitHubRepository | null;
  lastSynced: Date | null;
  createdAt: Date;
}

export interface RepositoryData {
  repository: LinkedRepository;
  commits: GitHubCommit[];
  pullRequests: GitHubPullRequest[];
}

export interface LinkRepositoryInput {
  projectId: string;
  githubRepoFullName: string;
  userId: string;
  accessToken: string;
}

// ============================================================================
// GitHub Integration Service
// Requirements: 12.3-12.10
// ============================================================================

export class GitHubIntegrationService {
  /**
   * Link a GitHub repository to a project
   * Requirement 12.3: Allow linking Projects to GitHub repositories
   * Requirement 12.4: Fetch repository metadata via GitHub API when linked
   */
  async linkRepository(
    projectId: string,
    githubRepoFullName: string,
    userId: string,
    accessToken: string
  ): Promise<LinkedRepository> {
    try {
      // Verify project exists
      const projectResult = await db.query(
        `SELECT id, status FROM projects WHERE id = $1`,
        [projectId]
      );
      if (projectResult.rows.length === 0) {
        throw new Error('Project not found');
      }

      // Parse owner/repo from full name
      const [owner, repo] = githubRepoFullName.split('/');
      if (!owner || !repo) {
        throw new Error('Invalid repository name. Expected format: owner/repo');
      }

      // Fetch repository metadata from GitHub API
      const metadata = await githubClient.getRepositoryMetadata(owner, repo, accessToken);

      // Upsert into github_repositories table
      const repoResult = await db.query(
        `INSERT INTO github_repositories (github_repo_id, name, full_name, url, metadata, last_synced)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (github_repo_id) DO UPDATE
           SET name = EXCLUDED.name,
               full_name = EXCLUDED.full_name,
               url = EXCLUDED.url,
               metadata = EXCLUDED.metadata,
               last_synced = NOW()
         RETURNING id, github_repo_id, name, full_name, url, metadata, last_synced, created_at`,
        [
          String(metadata.id),
          metadata.name,
          metadata.fullName,
          metadata.url,
          JSON.stringify(metadata),
        ]
      );

      const repoRow = repoResult.rows[0];

      // Link project to repository
      await db.query(
        `UPDATE projects SET github_repo_id = $1, updated_at = NOW() WHERE id = $2`,
        [repoRow.id, projectId]
      );

      // Log to activity timeline
      await this.logTimelineEvent(projectId, userId, 'GITHUB_REPO_LINKED', {
        repoFullName: githubRepoFullName,
        repoUrl: metadata.url,
      });

      logger.info('GitHub repository linked to project', {
        projectId,
        repoFullName: githubRepoFullName,
        userId,
      });

      return this.mapRepoFromDb(repoRow);
    } catch (error) {
      logger.error('Failed to link GitHub repository', { error, projectId, githubRepoFullName });
      throw error;
    }
  }

  /**
   * Unlink a GitHub repository from a project
   * Requirement 12.3: Allow linking/unlinking Projects to GitHub repositories
   */
  async unlinkRepository(projectId: string, userId: string): Promise<void> {
    try {
      const projectResult = await db.query(
        `SELECT id, github_repo_id FROM projects WHERE id = $1`,
        [projectId]
      );
      if (projectResult.rows.length === 0) {
        throw new Error('Project not found');
      }

      if (!projectResult.rows[0].github_repo_id) {
        throw new Error('Project has no linked GitHub repository');
      }

      await db.query(
        `UPDATE projects SET github_repo_id = NULL, updated_at = NOW() WHERE id = $1`,
        [projectId]
      );

      // Log to activity timeline
      await this.logTimelineEvent(projectId, userId, 'GITHUB_REPO_UNLINKED', {});

      logger.info('GitHub repository unlinked from project', { projectId, userId });
    } catch (error) {
      logger.error('Failed to unlink GitHub repository', { error, projectId });
      throw error;
    }
  }

  /**
   * Get repository data (metadata, commits, PRs) for a project
   * Requirement 12.4: Fetch repository metadata
   * Requirement 12.5: Display commit history
   * Requirement 12.6: Fetch pull request status
   */
  async getRepositoryData(projectId: string, accessToken: string): Promise<RepositoryData> {
    try {
      const repo = await this.getLinkedRepository(projectId);
      if (!repo) {
        throw new Error('No GitHub repository linked to this project');
      }

      const [owner, repoName] = repo.fullName.split('/');

      const [commits, pullRequests] = await Promise.all([
        githubClient.getRepositoryCommits(owner, repoName, accessToken, { per_page: 30 }),
        githubClient.getRepositoryPullRequests(owner, repoName, accessToken, 'all'),
      ]);

      return { repository: repo, commits, pullRequests };
    } catch (error) {
      logger.error('Failed to get repository data', { error, projectId });
      throw error;
    }
  }

  /**
   * Sync latest data from GitHub API and update stored metadata
   * Requirement 12.4: Fetch repository metadata
   * Requirement 12.7: Log merge events to project timeline
   * Requirement 12.10: Refresh GitHub data every 15 minutes for active projects
   */
  async syncRepository(projectId: string, accessToken: string): Promise<LinkedRepository> {
    try {
      const repo = await this.getLinkedRepository(projectId);
      if (!repo) {
        throw new Error('No GitHub repository linked to this project');
      }

      const [owner, repoName] = repo.fullName.split('/');

      // Fetch fresh metadata
      const metadata = await githubClient.getRepositoryMetadata(owner, repoName, accessToken);

      // Fetch PRs to detect new merges since last sync
      const pullRequests = await githubClient.getRepositoryPullRequests(
        owner,
        repoName,
        accessToken,
        'closed'
      );

      // Log merge events for PRs merged since last sync
      if (repo.lastSynced) {
        const newlyMerged = pullRequests.filter(
          (pr) =>
            pr.state === 'merged' &&
            pr.mergedAt &&
            new Date(pr.mergedAt) > repo.lastSynced!
        );

        for (const pr of newlyMerged) {
          await this.logTimelineEvent(projectId, null, 'GITHUB_PR_MERGED', {
            prNumber: pr.number,
            prTitle: pr.title,
            prUrl: pr.url,
            mergedAt: pr.mergedAt,
            author: pr.author,
          });
        }
      }

      // Update stored metadata
      const updateResult = await db.query(
        `UPDATE github_repositories
         SET metadata = $1, last_synced = NOW()
         WHERE id = $2
         RETURNING id, github_repo_id, name, full_name, url, metadata, last_synced, created_at`,
        [JSON.stringify(metadata), repo.id]
      );

      logger.info('GitHub repository synced', { projectId, repoFullName: repo.fullName });

      return this.mapRepoFromDb(updateResult.rows[0]);
    } catch (error) {
      logger.error('Failed to sync GitHub repository', { error, projectId });
      throw error;
    }
  }

  /**
   * Get recent commit history for a project's linked repository
   * Requirement 12.5: Display commit history on project pages
   */
  async getCommitHistory(
    projectId: string,
    accessToken: string,
    limit: number = 30
  ): Promise<GitHubCommit[]> {
    try {
      const repo = await this.getLinkedRepository(projectId);
      if (!repo) {
        throw new Error('No GitHub repository linked to this project');
      }

      const [owner, repoName] = repo.fullName.split('/');

      return githubClient.getRepositoryCommits(owner, repoName, accessToken, {
        per_page: limit,
      });
    } catch (error) {
      logger.error('Failed to get commit history', { error, projectId });
      throw error;
    }
  }

  /**
   * Get pull requests for a project's linked repository
   * Requirement 12.6: Fetch pull request status
   */
  async getPullRequests(
    projectId: string,
    accessToken: string,
    state: 'open' | 'closed' | 'all' = 'all'
  ): Promise<GitHubPullRequest[]> {
    try {
      const repo = await this.getLinkedRepository(projectId);
      if (!repo) {
        throw new Error('No GitHub repository linked to this project');
      }

      const [owner, repoName] = repo.fullName.split('/');

      return githubClient.getRepositoryPullRequests(owner, repoName, accessToken, state);
    } catch (error) {
      logger.error('Failed to get pull requests', { error, projectId });
      throw error;
    }
  }

  /**
   * Sync all active projects — intended for the 15-minute scheduled job
   * Requirement 12.10: Refresh GitHub data every 15 minutes for active projects
   */
  async syncActiveProjects(getAccessToken: (projectId: string) => Promise<string | null>): Promise<void> {
    try {
      const result = await db.query(
        `SELECT p.id
         FROM projects p
         JOIN github_repositories gr ON gr.id = p.github_repo_id
         WHERE p.status = 'ACTIVE'`
      );

      logger.info('Syncing active projects with GitHub', { count: result.rows.length });

      for (const row of result.rows) {
        try {
          const accessToken = await getAccessToken(row.id);
          if (!accessToken) {
            logger.warn('No access token available for project sync', { projectId: row.id });
            continue;
          }
          await this.syncRepository(row.id, accessToken);
        } catch (err) {
          logger.error('Failed to sync project', { error: err, projectId: row.id });
          // Continue with other projects even if one fails
        }
      }
    } catch (error) {
      logger.error('Failed to sync active projects', { error });
      throw error;
    }
  }

  /**
   * Get the linked repository record for a project
   */
  async getLinkedRepository(projectId: string): Promise<LinkedRepository | null> {
    try {
      const result = await db.query(
        `SELECT gr.id, gr.github_repo_id, gr.name, gr.full_name, gr.url,
                gr.metadata, gr.last_synced, gr.created_at
         FROM projects p
         JOIN github_repositories gr ON gr.id = p.github_repo_id
         WHERE p.id = $1`,
        [projectId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRepoFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get linked repository', { error, projectId });
      throw error;
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async logTimelineEvent(
    projectId: string,
    actorId: string | null,
    eventType: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      const descriptions: Record<string, string> = {
        GITHUB_REPO_LINKED: `GitHub repository ${metadata.repoFullName} linked to project`,
        GITHUB_REPO_UNLINKED: 'GitHub repository unlinked from project',
        GITHUB_PR_MERGED: `Pull request #${metadata.prNumber} "${metadata.prTitle}" was merged`,
      };

      await db.query(
        `INSERT INTO activity_timeline (entity_type, entity_id, event_type, description, actor_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          'project',
          projectId,
          eventType,
          descriptions[eventType] || eventType,
          actorId,
          JSON.stringify(metadata),
        ]
      );
    } catch (error) {
      // Non-fatal — log but don't throw
      logger.error('Failed to log timeline event', { error, projectId, eventType });
    }
  }

  private mapRepoFromDb(row: any): LinkedRepository {
    return {
      id: row.id,
      githubRepoId: row.github_repo_id,
      name: row.name,
      fullName: row.full_name,
      url: row.url,
      metadata: row.metadata ?? null,
      lastSynced: row.last_synced ?? null,
      createdAt: row.created_at,
    };
  }
}

export const githubIntegrationService = new GitHubIntegrationService();
export default githubIntegrationService;
