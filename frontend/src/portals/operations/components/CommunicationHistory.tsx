import React from 'react';
import type { Communication } from '../types';

interface CommunicationHistoryProps {
  communications: Communication[];
}

const typeColors: Record<string, string> = {
  Email: 'bg-blue-100 text-blue-700',
  Call: 'bg-green-100 text-green-700',
  Meeting: 'bg-purple-100 text-purple-700',
  SMS: 'bg-yellow-100 text-yellow-700',
  WhatsApp: 'bg-emerald-100 text-emerald-700',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CommunicationHistory({ communications }: CommunicationHistoryProps) {
  const sorted = [...communications].sort(
    (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
  );

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-800">Communication History</h2>

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Client', 'Type', 'Subject', 'Date', 'Agent'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">No communications found</td>
              </tr>
            ) : (
              sorted.map((comm) => (
                <tr key={comm.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{comm.clientName}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[comm.type] ?? 'bg-gray-100 text-gray-600'}`}>
                      {comm.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 max-w-xs">
                    <p className="font-medium truncate">{comm.subject}</p>
                    <p className="text-xs text-gray-400 truncate">{comm.content}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(comm.sentAt)}</td>
                  <td className="px-4 py-3 text-gray-600">{comm.sentBy}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
