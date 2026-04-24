import React, { useState } from 'react';
import { Card } from '../../../shared/components';
import type { GitHubRepo, GitHubCommit, DeveloperContribution } from '../types';

interface Props {
  repos: GitHubRepo[];
  commits: GitHubCommit[];
  contributions: DeveloperContribution[];
}

type Tab = 'repos' | 'commits' | 'contributors';

export function GitHubIntegration({ repos, commits, contributions }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('repos');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'repos', label: 'Repositories' },
    { id: 'commits', label: 'Recent Commits' },
    { id: 'contributors', label: 'Contributors' },
  ];

  return (
    <section aria-label="GitHub integration">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">GitHub Integration</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card variant="elevated" padding="md">
          <p className="text-sm text-gray-500">Repositories</p>
          <p className="text-2xl font-bold text-gray-900">{repos.length}</p>
        </Card>
        <Card variant="elevated" padding="md">
          <p className="text-sm text-gray-500">Total Commits</p>
          <p className="text-2xl font-bold text-gray-900">
            {repos.reduce((s, r) => s + r.commitCount, 0).toLocaleString()}
          </p>
        </Card>
        <Card variant="elevated" padding="md">
          <p className="text-sm text-gray-500">Open Issues</p>
          <p className="text-2xl font-bold text-orange-600">
            {repos.reduce((s, r) => s + r.openIssues, 0)}
          </p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-4">
        <nav className="flex gap-4" role="tablist" aria-label="GitHub tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'repos' && (
        <div role="tabpanel" aria-label="Repositories">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                  <th className="pb-2 font-medium">Repository</th>
                  <th className="pb-2 font-medium">Language</th>
                  <th className="pb-2 font-medium text-right">Stars</th>
                  <th className="pb-2 font-medium text-right">Open Issues</th>
                  <th className="pb-2 font-medium text-right">Commits</th>
                  <th className="pb-2 font-medium text-right">Last Commit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {repos.map((repo) => (
                  <tr key={repo.id} className="hover:bg-gray-50">
                    <td className="py-3">
                      <p className="font-medium text-blue-700">{repo.name}</p>
                      <p className="text-xs text-gray-400">{repo.description}</p>
                    </td>
                    <td className="py-3">
                      <span className="flex items-center gap-1 text-xs">
                        <span className="w-2 h-2 rounded-full bg-yellow-400" />
                        {repo.language}
                      </span>
                    </td>
                    <td className="py-3 text-right">⭐ {repo.stars}</td>
                    <td className="py-3 text-right">
                      <span className={repo.openIssues > 5 ? 'text-orange-600 font-medium' : 'text-gray-700'}>
                        {repo.openIssues}
                      </span>
                    </td>
                    <td className="py-3 text-right text-gray-700">{repo.commitCount.toLocaleString()}</td>
                    <td className="py-3 text-right text-gray-400 text-xs">
                      {new Date(repo.lastCommit).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                <div className="text-right text-xs shrink-0">
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
        <div role="tabpanel" aria-label="Contributors">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                  <th className="pb-2 font-medium">#</th>
                  <th className="pb-2 font-medium">Developer</th>
                  <th className="pb-2 font-medium text-right">Commits</th>
                  <th className="pb-2 font-medium text-right">PRs</th>
                  <th className="pb-2 font-medium text-right">Reviews</th>
                  <th className="pb-2 font-medium text-right">Lines Added</th>
                  <th className="pb-2 font-medium text-right">Lines Removed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {contributions.map((c, i) => (
                  <tr key={c.developer} className="hover:bg-gray-50">
                    <td className="py-3 text-gray-400 font-bold">#{i + 1}</td>
                    <td className="py-3 font-medium text-gray-900">{c.developer}</td>
                    <td className="py-3 text-right text-gray-700">{c.commits}</td>
                    <td className="py-3 text-right text-gray-700">{c.pullRequests}</td>
                    <td className="py-3 text-right text-gray-700">{c.reviews}</td>
                    <td className="py-3 text-right text-green-600">+{c.linesAdded.toLocaleString()}</td>
                    <td className="py-3 text-right text-red-600">-{c.linesRemoved.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
