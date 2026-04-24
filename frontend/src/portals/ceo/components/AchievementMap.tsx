import React from 'react';
import { Card } from '../../../shared/components';
import type { CountryAchievement, AfricanRegion } from '../types';

interface AchievementMapProps {
  achievements: CountryAchievement[];
}

const REGION_ORDER: AfricanRegion[] = [
  'North Africa',
  'West Africa',
  'East Africa',
  'Central Africa',
  'Southern Africa',
];

const REGION_COLORS: Record<AfricanRegion, string> = {
  'North Africa': 'bg-blue-50 border-blue-200',
  'West Africa': 'bg-green-50 border-green-200',
  'East Africa': 'bg-yellow-50 border-yellow-200',
  'Central Africa': 'bg-purple-50 border-purple-200',
  'Southern Africa': 'bg-orange-50 border-orange-200',
};

const REGION_BADGE: Record<AfricanRegion, string> = {
  'North Africa': 'bg-blue-100 text-blue-700',
  'West Africa': 'bg-green-100 text-green-700',
  'East Africa': 'bg-yellow-100 text-yellow-700',
  'Central Africa': 'bg-purple-100 text-purple-700',
  'Southern Africa': 'bg-orange-100 text-orange-700',
};

export function AchievementMap({ achievements }: AchievementMapProps) {
  const byRegion = REGION_ORDER.reduce<Record<AfricanRegion, CountryAchievement[]>>(
    (acc, region) => {
      acc[region] = achievements.filter((a) => a.region === region);
      return acc;
    },
    {} as Record<AfricanRegion, CountryAchievement[]>
  );

  const totalAchievements = achievements.reduce((sum, a) => sum + a.achievementCount, 0);

  return (
    <section aria-label="Achievement map across African countries">
      <h2 className="text-lg font-semibold text-gray-800 mb-1">Achievement Map</h2>
      <p className="text-sm text-gray-500 mb-4">
        {achievements.length} countries &middot; {totalAchievements} total achievements
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {REGION_ORDER.map((region) => {
          const countries = byRegion[region];
          const regionTotal = countries.reduce((s, c) => s + c.achievementCount, 0);
          return (
            <Card
              key={region}
              variant="outlined"
              padding="md"
              className={`border ${REGION_COLORS[region]}`}
              title={region}
              subtitle={`${countries.length} countries · ${regionTotal} achievements`}
            >
              <ul className="mt-2 space-y-2" aria-label={`Countries in ${region}`}>
                {countries.map((c) => (
                  <li key={c.country} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-800">{c.country}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-xs">{c.topAchievementType}</span>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${REGION_BADGE[region]}`}
                        aria-label={`${c.achievementCount} achievements`}
                      >
                        {c.achievementCount}
                      </span>
                    </div>
                  </li>
                ))}
                {countries.length === 0 && (
                  <li className="text-xs text-gray-400">No data available</li>
                )}
              </ul>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

export default AchievementMap;
