import React, { useState, useMemo } from 'react';

export interface TableColumn<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
  className?: string;
}

export interface TableProps<T extends object> {
  columns: TableColumn<T>[];
  data: T[];
  rowKey: keyof T | ((row: T) => string);
  pageSize?: number;
  emptyMessage?: string;
  className?: string;
  caption?: string;
}

type SortDir = 'asc' | 'desc';

export function Table<T extends object>({
  columns,
  data,
  rowKey,
  pageSize = 10,
  emptyMessage = 'No data available.',
  className = '',
  caption,
}: TableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortKey];
      const bv = (b as Record<string, unknown>)[sortKey];
      const cmp = String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  const getKey = (row: T): string => {
    if (typeof rowKey === 'function') return rowKey(row);
    return String(row[rowKey as keyof T]);
  };

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => {
              const key = String(col.key);
              const isSorted = sortKey === key;
              return (
                <th
                  key={key}
                  scope="col"
                  className={`px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap ${col.sortable ? 'cursor-pointer select-none hover:bg-gray-100' : ''} ${col.className ?? ''}`}
                  onClick={col.sortable ? () => handleSort(key) : undefined}
                  aria-sort={col.sortable ? (isSorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
                >
                  <span className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <span aria-hidden="true" className="text-gray-400">
                        {isSorted ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {paged.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            paged.map((row) => (
              <tr key={getKey(row)} className="hover:bg-gray-50 transition-colors">
                {columns.map((col) => {
                  const key = String(col.key);
                  const value = (row as Record<string, unknown>)[key];
                  return (
                    <td key={key} className={`px-4 py-3 text-gray-700 ${col.className ?? ''}`}>
                      {col.render ? col.render(value, row) : String(value ?? '')}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white">
          <span className="text-xs text-gray-500">
            Page {page} of {totalPages} ({sorted.length} items)
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Previous page"
              className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              aria-label="Next page"
              className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Table;
