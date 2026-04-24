import React, { useState } from 'react';
import { Card } from '../../../shared/components';
import type { GitHubRepo, GitHubCommit, DeveloperContribution } from '../types';

interface Props {
  repos: GitHubRepo[];
  commits: GitHubCommit[];
  contributions: DeveloperContribution[];
}

export function GitHubActivity({ repos, commits, contributions }: Props) {
  const [activeTab, setActiveTab] = useState<'repos' | 'commits' | 'contributors'>('repos');

  const tabs = [
    { id: 'repos' as const, label: 'Repositories' },
    { id: 'commits' as const, label: 'Recent Commits' },
    { id: 'contributors' as const, label: 'Contributors' },
  ];

  return (
    <section aria-label="GitHub activity">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">GitHub Activity (CTO View)</h2>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card variant="elevated" padding="md">
          <p className="text-sm text-gray-500">Repositories</p>
          <p className="text-2xl font-bold text-gray-900">{repos.length}</p>
        </Card>
        <Card variant="elevated" padding="md">
          <p className="text-sm text-gray-500">Total Commits</p>
          <p className="text-2xl font-bold text-gray-900">{repos.reduce((s, r) => s + r.commitCount, 0).toLocaleString()}</p>
        </Card>
        <Card variant="elevated" padding="md">
          <p className="text-sm text-gray-500">Open Issues</p>
          <p className="text-2xl font-bold text-orange-600">{repos.reduce((s, r) => s + r.openIssues, 0)}</p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-4">
        <nav className="flex gap-4" role="tablist" aria-label="GitHub activity tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'repos' && (
        <div className="space-y-3" role="tabpanel" aria-label="Repositories">
          {repos.map((repo) => (
            <Card key={repo.id} variant="elevated" padding="md">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-blue-700">{repo.name}</h3>
                  <p className="text-sm text-gray-600 mt-0.5">{repo.description}</p>
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-yellow-400" />
                      {repo.language}
                    </span>
                    <span>⭐ {repo.stars}</span>
                    <span>🔴 {repo.openIssues} issues</span>
                    <span>{repo.commitCount.toLocaleString()} commits</span>
                  </div>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(repo.lastCommit).toLocaleDateString()}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'commits' && (
        <div className="space-y-2" role="tabpanel" aria-label="Recent commits">
          {commits.map((commit) => (
            <Card key={commit.sha} variant="outlined" padding="sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{commit.message}</p>
                  <div className="flex gap-3 mt-1 text-xs text-gray-500">
                    <span className="font-mono text-blue-600">{commit.sha}</span>
                    <span>{commit.author}</span>
                    <span className="text-gray-400">{commit.repo}</span>
                  </div>
                </div>
                <div className="text-right text-xs">
                  <p className="text-green-600">+{commit.additions}</p>
                  <p className="text-red-600">-{commit.deletions}</p>
                  <p className="text-gray-400 mt-1">{new Date(commit.date).toLocaleDateString()}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'contributors' && (
        <div className="space-y-3" role="tabpanel" aria-label="Contributors">
          {contributions.map((c, i) => (
            <Card key={c.developer} variant="elevated" padding="md">
              <div className="flex items-center gap-4">
                <span className="text-lg font-bold text-gray-400 w-6">#{i + 1}</span>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{c.developer}</p>
                  <div className="grid grid-cols-5 gap-2 mt-2 text-xs text-gray-600">
                    <div><p className="font-medium text-gray-900">{c.commits}</p><p>Commits</p></div>
                    <div><p className="font-medium text-gray-900">{c.pullRequests}</p><p>PRs</p></div>
                    <div><p className="font-medium text-gray-900">{c.reviews}</p><p>Reviews</p></div>
                    <div><p className="font-medium text-green-600">+{c.linesAdded.toLocaleString()}</p><p>Added</p></div>
                    <div><p className="font-medium text-red-600">-{c.linesRemoved.toLocaleString()}</p><p>Removed</p></div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
