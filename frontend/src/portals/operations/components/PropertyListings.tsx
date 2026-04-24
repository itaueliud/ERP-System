import React, { useState } from 'react';
import type { Property, PropertyStatus } from '../types';

interface PropertyListingsProps {
  properties: Property[];
}

const statusColors: Record<PropertyStatus, string> = {
  Available: 'bg-green-100 text-green-700',
  Under_Offer: 'bg-yellow-100 text-yellow-700',
  Sold: 'bg-blue-100 text-blue-700',
  Withdrawn: 'bg-gray-100 text-gray-600',
};

const typeColors: Record<string, string> = {
  Residential: 'bg-purple-100 text-purple-700',
  Commercial: 'bg-orange-100 text-orange-700',
  Land: 'bg-lime-100 text-lime-700',
  Industrial: 'bg-slate-100 text-slate-700',
};

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

export function PropertyListings({ properties }: PropertyListingsProps) {
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  const types = ['All', 'Residential', 'Commercial', 'Land', 'Industrial'];
  const statuses = ['All', 'Available', 'Under_Offer', 'Sold', 'Withdrawn'];

  const filtered = properties.filter((p) => {
    const matchesType = typeFilter === 'All' || p.type === typeFilter;
    const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
    return matchesType && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-800">Property Listings (TST PlotConnect)</h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 font-medium">Type:</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Filter by property type"
          >
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 font-medium">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Filter by property status"
          >
            {statuses.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
        <span className="text-sm text-gray-500 self-center">{filtered.length} properties</span>
      </div>

      {/* Property cards */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
          No properties match the selected filters
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((property) => (
            <div key={property.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2 mb-3">
                <h3 className="font-semibold text-gray-900 text-sm leading-snug">{property.title}</h3>
                <span className={`flex-shrink-0 inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[property.status]}`}>
                  {property.status.replace('_', ' ')}
                </span>
              </div>

              <div className="space-y-1.5 text-sm text-gray-600">
                <div className="flex items-center gap-1.5">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${typeColors[property.type]}`}>
                    {property.type}
                  </span>
                </div>
                <p className="text-gray-500">{property.location}, {property.country}</p>
                <p className="text-gray-500">{property.area} m²
                  {property.bedrooms !== undefined && ` · ${property.bedrooms} bed`}
                  {property.bathrooms !== undefined && ` · ${property.bathrooms} bath`}
                </p>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(property.price, property.currency)}
                </p>
                <p className="text-xs text-gray-400">{property.agentName}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
