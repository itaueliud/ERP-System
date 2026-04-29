import { useState, useEffect } from 'react';
import { DataTable, PortalButton, SectionHeader } from '../../../shared/components/layout/PortalLayout';

interface Repository {
  id: string;
  name: string;
  language?: string;
  stars?: number;
  openPRs?: number;
  lastCommit?: string;
}

interface Commit {
  sha: string;
  message: string;
  author?: string;
  date?: string;
  repo?: string;
}

export default function GitHubIntegration({ themeHex }: { themeHex: string }) {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRepo, setSelectedRepo] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    try {
      const { apiClient } = await import('../../../shared/api/apiClient');
      const [reposRes, commitsRes] = await Promise.all([
        apiClient.get('/api/v1/github/repos'),
        apiClient.get('/api/v1/github/commits')
      ]);
      setRepos(reposRes.data?.repos || reposRes.data?.data || reposRes.data || []);
      setCommits(commitsRes.data?.commits || commitsRes.data?.data || commitsRes.data || []);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const filteredCommits = selectedRepo
    ? commits.filter(c => c.repo === selectedRepo)
    : commits;

  return (
    <div>
      <SectionHeader
        title="GitHub Integration"
        subtitle="Repository activity and commits"
        action={<PortalButton size="sm" variant="secondary" onClick={loadData}>Refresh</PortalButton>}
      />

      <div className="mb-6">
        <h3 className="font-semibold text-gray-800 mb-3">Repositories</h3>
        {loading ? (
          <p className="text-sm text-gray-400">Loading repositories...</p>
        ) : (
          <DataTable
            columns={[
              { key: 'name', label: 'Repository' },
              { key: 'language', label: 'Language', render: v => v || '—' },
              { key: 'stars', label: '⭐ Stars', render: v => v || 0 },
              { key: 'openPRs', label: 'Open PRs', render: v => v || 0 },
              { key: 'lastCommit', label: 'Last Commit', render: v => v ? new Date(v).toLocaleDateString() : '—' },
              { key: 'name', label: 'Actions', render: (name) => (
                <PortalButton size="sm" color={themeHex} onClick={() => setSelectedRepo(name)}>
                  View Commits
                </PortalButton>
              )},
            ]}
            rows={repos}
            emptyMessage="No repositories found"
          />
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">
            Recent Commits {selectedRepo && `— ${selectedRepo}`}
          </h3>
          {selectedRepo && (
            <button
              onClick={() => setSelectedRepo('')}
              className="text-sm text-gray-500 hover:text-gray-800"
            >
              Clear filter
            </button>
          )}
        </div>
        {loading ? (
          <p className="text-sm text-gray-400">Loading commits...</p>
        ) : (
          <DataTable
            columns={[
              { key: 'sha', label: 'SHA', render: v => (v || 'abc1234').slice(0, 7) },
              { key: 'message', label: 'Message' },
              { key: 'author', label: 'Author', render: v => v || '—' },
              { key: 'repo', label: 'Repository', render: v => v || '—' },
              { key: 'date', label: 'Date', render: v => v ? new Date(v).toLocaleDateString() : '—' },
            ]}
            rows={filteredCommits}
            emptyMessage="No commits found"
          />
        )}
      </div>
    </div>
  );
}
