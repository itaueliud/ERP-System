import React, { useState } from 'react';
import { Card, BarChart } from '../../../shared/components';
import type { CountryAchievement, AfricanRegion } from '../types';

interface Props {
  achievements: CountryAchievement[];
}

const REGIONS: AfricanRegion[] = ['East Africa', 'West Africa', 'North Africa', 'Southern Africa', 'Central Africa'];

const REGION_COLORS: Record<AfricanRegion, string> = {
  'East Africa': 'bg-blue-500',
  'West Africa': 'bg-green-500',
  'North Africa': 'bg-yellow-500',
  'Southern Africa': 'bg-purple-500',
  'Central Africa': 'bg-red-500',
};

export function CrossCountryAnalytics({ achievements }: Props) {
  const [selectedRegion, setSelectedRegion] = useState<AfricanRegion | 'All'>('All');

  const filtered = selectedRegion === 'All' ? achievements : achievements.filter((a) => a.region === selectedRegion);
  const sorted = [...filtered].sort((a, b) => b.achievementCount - a.achievementCount);
  const top10 = sorted.slice(0, 10);

  const chartData = {
    labels: top10.map((a) => a.country),
    datasets: [
      {
        label: 'Achievements',
        data: top10.map((a) => a.achievementCount),
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
      },
    ],
  };

  // NOTE: revenue intentionally excluded — COO and CTO cannot see financial data (spec §13, §22)
  const regionSummary = REGIONS.map((region) => {
    const regionData = achievements.filter((a) => a.region === region);
    return {
      region,
      countries: regionData.length,
      totalAchievements: regionData.reduce((s, a) => s + a.achievementCount, 0),
    };
  });

  return (
    <section aria-label="Cross-country analytics">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        Cross-Country Analytics — {achievements.length} African Countries
      </h2>

      {/* Region filter */}
      <div className="flex flex-wrap gap-2 mb-6" role="group" aria-label="Filter by region">
        <button
          onClick={() => setSelectedRegion('All')}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${selectedRegion === 'All' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          All Regions
        </button>
        {REGIONS.map((r) => (
          <button
            key={r}
            onClick={() => setSelectedRegion(r)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${selectedRegion === r ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Region summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {regionSummary.map((rs) => (
          <Card key={rs.region} variant="elevated" padding="sm" className="hover:shadow-md transition-shadow">
            <button
              type="button"
              onClick={() => setSelectedRegion(rs.region)}
              className="w-full text-left cursor-pointer"
              aria-label={`Filter by ${rs.region}`}
            >
              <div className={`w-3 h-3 rounded-full ${REGION_COLORS[rs.region]} mb-2`} />
              <p className="text-xs font-semibold text-gray-700">{rs.region}</p>
              <p className="text-lg font-bold text-gray-900">{rs.totalAchievements}</p>
              <p className="text-xs text-gray-500">{rs.countries} countries</p>
            </button>
          </Card>
        ))}
      </div>

      {/* Bar chart */}
      <Card variant="elevated" padding="md" className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Top 10 Countries by Achievements</h3>
        <BarChart data={chartData} height={250} aria-label="Top 10 countries by achievements bar chart" />
      </Card>

      {/* Country table */}
      <Card variant="elevated" padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Country achievements table">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Country</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Region</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Achievements</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Active Clients</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Top Achievement</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((a, i) => (
                <tr key={a.country} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 font-medium text-gray-900">{a.country}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1`}>
                      <span className={`w-2 h-2 rounded-full ${REGION_COLORS[a.region]}`} />
                      {a.region}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{a.achievementCount}</td>
                  <td className="px-4 py-3 text-right">{a.activeClients}</td>
                  <td className="px-4 py-3 text-gray-600">{a.topAchievementType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
