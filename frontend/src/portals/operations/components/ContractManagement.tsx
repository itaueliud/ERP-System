import { useState, useEffect } from 'react';
import { DataTable, StatusBadge, PortalButton, SectionHeader } from '../../../shared/components/layout/PortalLayout';

interface Contract {
  id: string;
  referenceNumber: string;
  projectId?: string;
  projectReference?: string;
  version: number;
  status: string;
  pdfUrl?: string;
  createdAt: string;
  createdBy: string;
  content?: any;
}

interface ContractVersion {
  id: string;
  version: number;
  createdAt: string;
  createdBy: string;
  pdfUrl?: string;
}

export default function ContractManagement({ themeHex }: { themeHex: string }) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContract, setSelectedContract] = useState<string | null>(null);
  const [versions, setVersions] = useState<ContractVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [viewContract, setViewContract] = useState<Contract | null>(null);

  const loadContracts = async () => {
    setLoading(true);
    try {
      const { apiClient } = await import('../../../shared/api/apiClient');
      const res = await apiClient.get('/api/v1/contracts');
      setContracts(res.data?.contracts || res.data?.data || res.data || []);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  useEffect(() => { loadContracts(); }, []);

  const downloadContract = async (contractId: string) => {
    try {
      const { apiClient } = await import('../../../shared/api/apiClient');
      const res = await apiClient.get(`/api/v1/contracts/${contractId}/download`);
      const url = res.data?.downloadUrl || res.data?.pdfUrl;
      if (url) {
        window.open(url, '_blank');
      }
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to download contract');
    }
  };

  const loadVersions = async (contractId: string) => {
    setLoadingVersions(true);
    try {
      const { apiClient } = await import('../../../shared/api/apiClient');
      const res = await apiClient.get(`/api/v1/contracts/${contractId}/versions`);
      setVersions(res.data?.versions || res.data?.data || res.data || []);
    } catch { /* silent */ } finally { setLoadingVersions(false); }
  };

  const viewContractDetails = async (contractId: string) => {
    try {
      const { apiClient } = await import('../../../shared/api/apiClient');
      const res = await apiClient.get(`/api/v1/contracts/${contractId}`);
      setViewContract(res.data?.contract || res.data?.data || res.data);
    } catch { /* silent */ }
  };

  return (
    <div>
      <SectionHeader
        title="Contract Management"
        subtitle="View and manage contracts with version history"
      />

      {loading ? (
        <p className="text-sm text-gray-400">Loading contracts...</p>
      ) : (
        <>
          <DataTable
            columns={[
              { key: 'referenceNumber', label: 'Contract #' },
              { key: 'projectReference', label: 'Project', render: v => v || '—' },
              { key: 'version', label: 'Version' },
              { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'ACTIVE'} /> },
              { key: 'createdAt', label: 'Created', render: v => v ? new Date(v).toLocaleDateString() : '—' },
              { key: 'id', label: 'Actions', render: (id) => (
                <div className="flex gap-2">
                  <PortalButton size="sm" color={themeHex} onClick={() => downloadContract(id)}>
                    Download
                  </PortalButton>
                  <PortalButton size="sm" variant="secondary" onClick={() => { setSelectedContract(id); loadVersions(id); }}>
                    Versions
                  </PortalButton>
                  <PortalButton size="sm" variant="secondary" onClick={() => viewContractDetails(id)}>
                    View
                  </PortalButton>
                </div>
              )},
            ]}
            rows={contracts}
            emptyMessage="No contracts found"
          />

          {/* Version History Modal */}
          {selectedContract && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">Version History</h3>
                  <button onClick={() => setSelectedContract(null)} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="p-6">
                  {loadingVersions ? (
                    <p className="text-sm text-gray-400">Loading versions...</p>
                  ) : (
                    <div className="space-y-3">
                      {versions.map((v) => (
                        <div key={v.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                          <div>
                            <p className="font-semibold text-gray-800">Version {v.version}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(v.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <PortalButton size="sm" color={themeHex} onClick={() => downloadContract(v.id)}>
                            Download
                          </PortalButton>
                        </div>
                      ))}
                      {versions.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No versions found</p>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Contract Details Modal */}
          {viewContract && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">Contract Details</h3>
                  <button onClick={() => setViewContract(null)} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Contract Number</p>
                      <p className="font-semibold text-gray-800">{viewContract.referenceNumber}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Version</p>
                      <p className="font-semibold text-gray-800">{viewContract.version}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Status</p>
                      <StatusBadge status={viewContract.status} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Created</p>
                      <p className="text-sm text-gray-700">{new Date(viewContract.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  {viewContract.content && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                      <p className="text-xs text-gray-500 mb-2">Contract Content</p>
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap">{JSON.stringify(viewContract.content, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
