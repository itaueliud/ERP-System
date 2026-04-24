import React from 'react';
import { Card, DocumentIcon } from '../../../shared/components';
import type { ComplianceReport } from '../types';

interface ComplianceReportsProps {
  reports: ComplianceReport[];
  onDownload?: (id: string) => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ComplianceReports({ reports, onDownload }: ComplianceReportsProps) {
  return (
    <section aria-label="Compliance reports and financial summaries">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Financial &amp; Compliance Reports</h2>
      {reports.length === 0 ? (
        <p className="text-gray-500 text-sm">No reports available.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {reports.map((report) => (
            <Card key={report.id} variant="elevated" padding="md">
              <div className="flex items-start gap-3">
                <DocumentIcon aria-hidden className="text-blue-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{report.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Period: {report.period}</p>
                  <p className="text-xs text-gray-400">Generated: {formatDate(report.generatedAt)}</p>
                </div>
                <div className="shrink-0">
                  {report.status === 'generating' ? (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                      Generating…
                    </span>
                  ) : (
                    <button
                      onClick={() => onDownload?.(report.id)}
                      aria-label={`Download ${report.title}`}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
                    >
                      Download
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

export default ComplianceReports;
