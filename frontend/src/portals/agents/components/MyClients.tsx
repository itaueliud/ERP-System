import React, { useState } from 'react';
import type { AgentClient } from '../types';

interface MyClientsProps {
  clients: AgentClient[];
}

const STAGE_COLORS: Record<string, string> = {
  Prospect: 'bg-gray-100 text-gray-700',
  Lead: 'bg-blue-100 text-blue-700',
  Qualified_Lead: 'bg-indigo-100 text-indigo-700',
  Proposal: 'bg-yellow-100 text-yellow-700',
  Negotiation: 'bg-orange-100 text-orange-700',
  Closed_Won: 'bg-green-100 text-green-700',
  Closed_Lost: 'bg-red-100 text-red-700',
};

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function MyClients({ clients }: MyClientsProps) {
  const [search, setSearch] = useState('');

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.company.toLowerCase().includes(q) ||
      c.stage.toLowerCase().includes(q)
    );
  });

  return (
    <section aria-label="My clients">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">My Clients</h2>
        <span className="text-sm text-gray-500">{clients.length} total</span>
      </div>

      <div className="mb-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, company or stage..."
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Search clients"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">No clients match your search.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((client) => (
            <div
              key={client.id}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{client.name}</p>
                  <p className="text-sm text-gray-500 truncate">{client.company} · {client.country}</p>
                </div>
                <span
                  className={`flex-shrink-0 text-xs font-medium px-2 py-1 rounded-full ${
                    STAGE_COLORS[client.stage] ?? 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {client.stage.replace('_', ' ')}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                <span>{client.email}</span>
                <span>{client.phone}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="font-semibold text-green-700">{fmt.format(client.value)}</span>
                <span className="text-gray-400">Last contact: {client.lastContact}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
