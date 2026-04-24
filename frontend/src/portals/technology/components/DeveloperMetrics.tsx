import React from 'react';
import { Card } from '../../../shared/components';
import type { DeveloperContribution } from '../types';

interface Props {
  contributions: DeveloperContribution[];
}

export function DeveloperMetrics({ contributions }: Props) {
  const sorted = [...contributions].sort((a, b) => b.commits - a.commits);

  const totalCommits = contributions.reduce((s, c) => s + c.commits, 0);
  const totalPRs = contributions.reduce((s, c) => s + c.pullRequests, 0);
  const totalReviews = contributions.reduce((s, c) => s + c.reviews, 0);

  return (
    <section aria-label="Developer metrics">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Developer Metrics</h2>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card variant="elevated" padding="md">
          <p className="text-sm text-gray-500">Total Commits</p>
          <p className="text-2xl font-bold text-gray-900">{totalCommits}</p>
        </Card>
        <Card variant="elevated" padding="md">
          <p className="text-sm text-gray-500">Pull Requests</p>
          <p className="text-2xl font-bold text-purple-600">{totalPRs}</p>
        </Card>
        <Card variant="elevated" padding="md">
          <p className="text-sm text-gray-500">Code Reviews</p>
          <p className="text-2xl font-bold text-blue-600">{totalReviews}</p>
        </Card>
      </div>

      {/* Leaderboard */}
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Contribution Leaderboard</h3>
      <div className="space-y-3">
        {sorted.map((c, i) => {
          const commitPct = totalCommits > 0 ? Math.round((c.commits / totalCommits) * 100) : 0;
          return (
            <Card key={c.developer} variant="elevated" padding="md">
              <div className="flex items-center gap-4">
                <span
                  className={`text-lg font-bold w-8 text-center ${
                    i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-600' : 'text-gray-300'
                  }`}
                >
                  #{i + 1}
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-gray-900">{c.developer}</p>
                    <span className="text-xs text-gray-400">{commitPct}% of commits</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2 text-xs text-gray-600">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{c.commits}</p>
                      <p>Commits</p>
                    </div>
                    <div>
                      <p className="font-semibold text-purple-700 text-sm">{c.pullRequests}</p>
                      <p>PRs</p>
                    </div>
                    <div>
                      <p className="font-semibold text-blue-700 text-sm">{c.reviews}</p>
                      <p>Reviews</p>
                    </div>
                    <div>
                      <p className="font-semibold text-green-600 text-sm">+{c.linesAdded.toLocaleString()}</p>
                      <p>Added</p>
                    </div>
                    <div>
                      <p className="font-semibold text-red-600 text-sm">-{c.linesRemoved.toLocaleString()}</p>
                      <p>Removed</p>
                    </div>
                  </div>
                  {/* Commit share bar */}
                  <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-blue-500"
                      style={{ width: `${commitPct}%` }}
                      role="progressbar"
                      aria-valuenow={commitPct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${c.developer} commit share`}
                    />
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
