/**
 * PlotConnectProperties — shared component for management portals
 * Used by: Operations, CEO, COO (C-Level), Trainers, Executive (EA)
 *
 * Props control what actions are available per role:
 *   canApprove   — COO, CEO, Operations: approve/reject/publish
 *   canSetTier   — TRAINER: modify placement tier
 *   canManagePkg — EA: edit package amounts (CEO confirms)
 *   showAgent    — show agent name column
 *   showRevenue  — show revenue/payment amounts (CEO, CFO, CoS only)
 */
import { useState, useEffect, useCallback } from 'react';
import { PortalButton, StatusBadge, DataTable, SectionHeader } from '../layout/PortalLayout';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PlotProperty {
  id: string;
  propertyName: string;
  ownerName: string;
  ownerPhone: string;
  county: string;
  area: string;
  bookingType: string;
  propertyTypes: string[];
  package: string;
  placementTier?: string;
  status: string;
  paymentStatus: string;
  paymentConfirmedAt?: string;
  agentName?: string;
  trainerName?: string;
  contactPerson?: string;
  description?: string;
  websiteLink?: string;
  numberOfRooms?: string;
  pricePerRoom?: string;
  rooms?: any[];
  mapLink?: string;
  createdAt: string;
}

interface Package {
  key: string;
  label: string;
  price: number;
  desc?: string;
  updated_by_name?: string;
  updated_at?: string;
}

interface Props {
  themeHex: string;
  canApprove?: boolean;
  canPublish?: boolean;
  canSetTier?: boolean;
  canManagePkg?: boolean;
  canEdit?: boolean;
  showAgent?: boolean;
  showRevenue?: boolean;
}

const BOOKING_LABELS: Record<string, string> = {
  MONTHLY: 'Monthly', DAILY: 'Daily', BOTH: 'Monthly & Daily',
};

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  RENTAL_ROOMS: 'Rental Rooms', STUDENT_SINGLE: 'Student Single',
  HOSTEL: 'Hostel', APARTMENTS: 'Apartments',
  LODGE: 'Lodge / Guest', SHORT_STAY: 'Short Stay',
};

const PAYMENT_CLS: Record<string, string> = {
  PAID:                  'bg-green-100 text-green-800',
  AWAITING_CONFIRMATION: 'bg-amber-100 text-amber-800',
  FAILED:                'bg-red-100 text-red-700',
  UNPAID:                'bg-slate-100 text-slate-600',
};

function PayBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold ${PAYMENT_CLS[status] || 'bg-slate-100 text-slate-600'}`}>
      {status?.replace(/_/g, ' ') || '—'}
    </span>
  );
}

// ─── Property Detail Modal ────────────────────────────────────────────────────
function PropertyModal({ prop, themeHex, canApprove, canPublish, canSetTier, canEdit, onClose, onRefetch }: {
  prop: PlotProperty; themeHex: string;
  canApprove?: boolean; canPublish?: boolean; canSetTier?: boolean; canEdit?: boolean;
  onClose: () => void; onRefetch: () => void;
}) {
  const [statusBusy, setStatusBusy] = useState(false);
  const [tierBusy,   setTierBusy]   = useState(false);
  const [newTier,    setNewTier]     = useState(prop.package || 'BASIC');
  const [msg,        setMsg]         = useState('');
  const [ok,         setOk]          = useState(false);
  const [editing,    setEditing]     = useState(false);
  const [editBusy,   setEditBusy]    = useState(false);
  const [images,     setImages]      = useState<{ url: string; filename: string }[]>([]);
  const [imgIdx,     setImgIdx]      = useState(0);
  const [editForm,   setEditForm]    = useState({
    propertyName:  prop.propertyName  || '',
    ownerName:     prop.ownerName     || '',
    ownerPhone:    prop.ownerPhone    || '',
    county:        prop.county        || '',
    area:          prop.area          || '',
    description:   prop.description   || '',
    websiteLink:   prop.websiteLink   || '',
    contactPerson: prop.contactPerson || '',
    mapLink:       prop.mapLink       || '',
  });

  // Load property images
  useEffect(() => {
    (async () => {
      try {
        const { apiClient } = await import('../../api/apiClient');
        const res = await apiClient.get(`/api/v1/plotconnect/properties/${prop.id}/images`);
        setImages((res.data as any)?.images || []);
      } catch { /* no images */ }
    })();
  }, [prop.id]);

  const saveEdit = async () => {
    setEditBusy(true); setMsg('');
    try {
      const { apiClient } = await import('../../api/apiClient');
      await apiClient.patch(`/api/v1/plotconnect/properties/${prop.id}`, editForm);
      setOk(true); setMsg('Property updated successfully.');
      setEditing(false);
      onRefetch();
    } catch (err: any) {
      setOk(false); setMsg(err?.response?.data?.error || 'Failed to update property.');
    } finally { setEditBusy(false); }
  };

  const updateStatus = async (status: string) => {
    setStatusBusy(true); setMsg('');
    try {
      const { apiClient } = await import('../../api/apiClient');
      await apiClient.patch(`/api/v1/plotconnect/properties/${prop.id}/status`, { status });
      setOk(true); setMsg(`Property ${status.toLowerCase()} successfully.`);
      onRefetch();
    } catch (err: any) {
      setOk(false); setMsg(err?.response?.data?.error || 'Failed to update status.');
    } finally { setStatusBusy(false); }
  };

  const updateTier = async () => {
    setTierBusy(true); setMsg('');
    try {
      const { apiClient } = await import('../../api/apiClient');
      await apiClient.patch(`/api/v1/plotconnect/properties/${prop.id}/placement-tier`, { tier: newTier });
      setOk(true); setMsg('Placement tier updated.');
      onRefetch();
    } catch (err: any) {
      setOk(false); setMsg(err?.response?.data?.error || 'Failed to update tier.');
    } finally { setTierBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="font-bold text-slate-900 text-lg">{prop.propertyName}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          {msg && (
            <div className={`p-3 rounded-xl text-sm ${ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {msg}
            </div>
          )}

          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={prop.status || 'PENDING'} />
            <PayBadge status={prop.paymentStatus || 'UNPAID'} />
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700">
              {prop.package}
            </span>
          </div>

          {/* Image gallery */}
          {images.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Property Images</p>
              <div className="relative rounded-xl overflow-hidden bg-slate-100" style={{ height: 220 }}>
                <img
                  src={images[imgIdx]?.url}
                  alt={images[imgIdx]?.filename}
                  className="w-full h-full object-cover"
                />
                {images.length > 1 && (
                  <>
                    <button onClick={() => setImgIdx(i => (i - 1 + images.length) % images.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors">‹</button>
                    <button onClick={() => setImgIdx(i => (i + 1) % images.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors">›</button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                      {images.map((_, i) => (
                        <button key={i} onClick={() => setImgIdx(i)}
                          className={`w-2 h-2 rounded-full transition-colors ${i === imgIdx ? 'bg-white' : 'bg-white/50'}`} />
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1">
                {images.map((img, i) => (
                  <button key={i} onClick={() => setImgIdx(i)}
                    className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${i === imgIdx ? 'border-current' : 'border-transparent'}`}
                    style={i === imgIdx ? { borderColor: themeHex } : {}}>
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Location',     `${prop.area}, ${prop.county}`],
              ['Booking',      BOOKING_LABELS[prop.bookingType] || prop.bookingType],
              ['Owner',        prop.ownerName],
              ['Phone',        prop.ownerPhone],
              ['Contact',      prop.contactPerson || '—'],
              ['Agent',        prop.agentName || '—'],
              ['Trainer',      prop.trainerName || '—'],
              ['Submitted',    new Date(prop.createdAt).toLocaleDateString()],
              ['Payment Date', prop.paymentConfirmedAt ? new Date(prop.paymentConfirmedAt).toLocaleDateString() : '—'],
              ['Types',        (prop.propertyTypes || []).map(t => PROPERTY_TYPE_LABELS[t] || t).join(', ') || '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
                <p className="text-slate-800 mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {prop.description && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Description</p>
              <p className="text-sm text-slate-700">{prop.description}</p>
            </div>
          )}

          {prop.websiteLink && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Website</p>
              <a href={prop.websiteLink} target="_blank" rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline">{prop.websiteLink}</a>
            </div>
          )}

          {/* Rooms table */}
          {prop.rooms && prop.rooms.filter((r: any) => r.selected).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Room Types</p>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Room Type</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Price (KSh)</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Availability</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {prop.rooms.filter((r: any) => r.selected).map((r: any, i: number) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-slate-700">{r.type}</td>
                        <td className="px-3 py-2 text-slate-700">{r.price ? Number(r.price).toLocaleString() : '—'}</td>
                        <td className="px-3 py-2 text-slate-700">{r.availability || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Approve / Reject / Publish actions */}
          {canApprove && (
            <div className="pt-3 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Actions</p>
              <div className="flex flex-wrap gap-2">
                {(prop.status === 'PENDING' || prop.status === 'REJECTED') && (
                  <PortalButton color={themeHex} disabled={statusBusy}
                    onClick={() => updateStatus('APPROVED')}>
                    Approve
                  </PortalButton>
                )}
                {(prop.status === 'PENDING' || prop.status === 'APPROVED') && (
                  <PortalButton variant="danger" disabled={statusBusy}
                    onClick={() => updateStatus('REJECTED')}>
                    Reject
                  </PortalButton>
                )}
                {canPublish && prop.status === 'APPROVED' && (
                  <PortalButton color={themeHex} disabled={statusBusy}
                    onClick={() => updateStatus('PUBLISHED')}>
                    Publish
                  </PortalButton>
                )}
                {canPublish && prop.status === 'PUBLISHED' && (
                  <PortalButton variant="secondary" disabled={statusBusy}
                    onClick={() => updateStatus('UNPUBLISHED')}>
                    Unpublish
                  </PortalButton>
                )}
              </div>
            </div>
          )}

          {/* Trainer: modify placement tier */}
          {canSetTier && (
            <div className="pt-3 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Modify Placement Tier
              </p>
              <p className="text-xs text-slate-400 mb-3">
                Only a Trainer can modify the placement tier after submission.
              </p>
              <div className="flex gap-2 items-center flex-wrap">
                <select value={newTier} onChange={e => setNewTier(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2">
                  <option value="BASIC">Basic — KSh 4,000</option>
                  <option value="STANDARD">Standard — KSh 8,000</option>
                  <option value="ADVANCED">Advanced — KSh 12,000</option>
                </select>
                <PortalButton color={themeHex} disabled={tierBusy || newTier === prop.package}
                  onClick={updateTier}>
                  {tierBusy ? 'Saving…' : 'Update Tier'}
                </PortalButton>
              </div>
            </div>
          )}

          {/* EA: edit property details */}
          {canEdit && (
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Edit Property</p>
                <button onClick={() => setEditing(e => !e)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                  {editing ? 'Cancel' : 'Edit'}
                </button>
              </div>
              {editing && (
                <div className="space-y-3">
                  {([
                    ['propertyName',  'Property Name'],
                    ['ownerName',     'Owner Name'],
                    ['ownerPhone',    'Owner Phone'],
                    ['county',        'County'],
                    ['area',          'Area / Neighbourhood'],
                    ['contactPerson', 'Contact Person'],
                    ['websiteLink',   'Website Link'],
                    ['mapLink',       'Map Link'],
                  ] as [keyof typeof editForm, string][]).map(([field, label]) => (
                    <div key={field}>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                      <input
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2"
                        value={editForm[field]}
                        onChange={e => setEditForm(f => ({ ...f, [field]: e.target.value }))}
                      />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                    <textarea rows={3}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 resize-none"
                      value={editForm.description}
                      onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                    />
                  </div>
                  <PortalButton color={themeHex} disabled={editBusy} onClick={saveEdit}>
                    {editBusy ? 'Saving…' : 'Save Changes'}
                  </PortalButton>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Package Amount Manager (EA only) ────────────────────────────────────────
function PackageManager({ themeHex }: { themeHex: string }) {
  const [packages, setPackages] = useState<Package[]>([]);
  const [editing,  setEditing]  = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState('');
  const [busy,     setBusy]     = useState(false);
  const [msg,      setMsg]      = useState('');
  const [ok,       setOk]       = useState(false);

  const load = useCallback(async () => {
    try {
      const { apiClient } = await import('../../api/apiClient');
      const res = await apiClient.get('/api/v1/plotconnect/packages');
      setPackages((res.data as any)?.data || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const propose = async (key: string) => {
    if (!newPrice || isNaN(Number(newPrice))) { setMsg('Enter a valid price.'); setOk(false); return; }
    setBusy(true); setMsg('');
    try {
      const { apiClient } = await import('../../api/apiClient');
      await apiClient.patch(`/api/v1/plotconnect/packages/${key}`, { price: Number(newPrice) });
      setOk(true); setMsg('Change proposed. Awaiting CEO confirmation.');
      setEditing(null); setNewPrice('');
      load();
    } catch (err: any) {
      setOk(false); setMsg(err?.response?.data?.error || 'Failed to propose change.');
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4 max-w-xl">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
        Package amounts are editable by EA only. Changes take effect after CEO confirms.
      </div>
      {msg && (
        <div className={`p-3 rounded-xl text-sm ${ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg}
        </div>
      )}
      <div className="space-y-3">
        {packages.map(pkg => (
          <div key={pkg.key} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-slate-800">{pkg.label}</p>
              <p className="text-xs text-slate-400">{pkg.desc}</p>
              {pkg.updated_by_name && (
                <p className="text-xs text-slate-400 mt-0.5">
                  Last updated by {pkg.updated_by_name}
                  {pkg.updated_at ? ` on ${new Date(pkg.updated_at).toLocaleDateString()}` : ''}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {editing === pkg.key ? (
                <>
                  <input type="number" min="0" value={newPrice} onChange={e => setNewPrice(e.target.value)}
                    className="w-28 px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1"
                    placeholder={String(pkg.price)} />
                  <PortalButton size="sm" color={themeHex} disabled={busy} onClick={() => propose(pkg.key)}>
                    {busy ? '…' : 'Propose'}
                  </PortalButton>
                  <PortalButton size="sm" variant="secondary" onClick={() => { setEditing(null); setNewPrice(''); }}>
                    Cancel
                  </PortalButton>
                </>
              ) : (
                <>
                  <span className="font-bold text-slate-800">KSh {pkg.price.toLocaleString()}</span>
                  <PortalButton size="sm" variant="secondary" onClick={() => { setEditing(pkg.key); setNewPrice(String(pkg.price)); }}>
                    Edit
                  </PortalButton>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main PlotConnectProperties component ────────────────────────────────────
export default function PlotConnectProperties({
  themeHex, canApprove = false, canPublish = false, canSetTier = false,
  canManagePkg = false, canEdit = false, showAgent = true, showRevenue = false,
}: Props) {
  const [properties, setProperties] = useState<PlotProperty[]>([]);
  const [stats,      setStats]      = useState<any>({});
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState<PlotProperty | null>(null);
  const [tab,        setTab]        = useState<'list' | 'packages'>('list');
  // Filters
  const [filterStatus,  setFilterStatus]  = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [filterSearch,  setFilterSearch]  = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { apiClient } = await import('../../api/apiClient');
      const params = new URLSearchParams();
      if (filterStatus)  params.set('status', filterStatus);
      if (filterPayment) params.set('paymentStatus', filterPayment);
      if (filterSearch)  params.set('search', filterSearch);

      const [propsRes, statsRes] = await Promise.allSettled([
        apiClient.get(`/api/v1/plotconnect/properties?${params}`),
        apiClient.get('/api/v1/plotconnect/stats'),
      ]);

      if (propsRes.status === 'fulfilled') {
        const d = (propsRes.value.data as any);
        setProperties(Array.isArray(d) ? d : (d?.data || []));
      }
      if (statsRes.status === 'fulfilled') {
        setStats((statsRes.value.data as any)?.data || {});
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [filterStatus, filterPayment, filterSearch]);

  useEffect(() => { load(); }, [load]);

  const inp = 'px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2';

  return (
    <div>
      <SectionHeader
        title="TST PlotConnect Properties"
        subtitle="Agent-submitted property listings"
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Total',     value: stats.total     || 0 },
          { label: 'Pending',   value: stats.pending   || 0 },
          { label: 'Approved',  value: stats.approved  || 0 },
          { label: 'Published', value: stats.published || 0 },
          { label: 'Paid',      value: stats.paid      || 0 },
          ...(showRevenue ? [{ label: 'Revenue (KSh)', value: stats.total_revenue ? Number(stats.total_revenue).toLocaleString() : '0' }] : []),
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
            <p className="text-xl font-bold text-slate-900">{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      {canManagePkg && (
        <div className="flex gap-1 mb-5 border-b border-slate-200">
          {(['list', 'packages'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all capitalize
                ${tab === t ? 'border-current text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              style={tab === t ? { borderColor: themeHex, color: themeHex } : {}}>
              {t === 'list' ? 'Properties' : 'Package Amounts'}
            </button>
          ))}
        </div>
      )}

      {tab === 'packages' && canManagePkg && (
        <PackageManager themeHex={themeHex} />
      )}

      {tab === 'list' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <input className={inp} placeholder="Search name / owner / area…"
              value={filterSearch} onChange={e => setFilterSearch(e.target.value)} />
            <select className={inp} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {['PENDING','APPROVED','REJECTED','PUBLISHED','UNPUBLISHED'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select className={inp} value={filterPayment} onChange={e => setFilterPayment(e.target.value)}>
              <option value="">All Payments</option>
              {['UNPAID','AWAITING_CONFIRMATION','PAID','FAILED'].map(s => (
                <option key={s} value={s}>{s.replace(/_/g,' ')}</option>
              ))}
            </select>
            {(filterStatus || filterPayment || filterSearch) && (
              <button onClick={() => { setFilterStatus(''); setFilterPayment(''); setFilterSearch(''); }}
                className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-slate-500 hover:bg-slate-50">
                Clear
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-slate-200 rounded-full animate-spin"
                style={{ borderTopColor: themeHex }} />
            </div>
          ) : (
            <DataTable
              columns={[
                { key: 'propertyName', label: 'Property' },
                { key: 'county',       label: 'Location', render: (v, r: any) => `${r.area}, ${v}` },
                { key: 'propertyTypes', label: 'Types',
                  render: (v: string[]) => (v || []).map(t => PROPERTY_TYPE_LABELS[t] || t).join(', ') || '—' },
                { key: 'package',      label: 'Package' },
                { key: 'status',       label: 'Status',  render: v => <StatusBadge status={v || 'PENDING'} /> },
                { key: 'paymentStatus', label: 'Payment', render: v => <PayBadge status={v || 'UNPAID'} /> },
                ...(showAgent ? [{ key: 'agentName', label: 'Agent', render: (v: any) => v || '—' }] : []),
                { key: 'createdAt',    label: 'Submitted', render: v => v ? new Date(v).toLocaleDateString() : '—' },
                {
                  key: 'id', label: 'Actions',
                  render: (_v: any, row: any) => (
                    <PortalButton size="sm" variant="secondary" onClick={() => setSelected(row)}>
                      View
                    </PortalButton>
                  ),
                },
              ]}
              rows={properties}
              emptyMessage="No properties found"
            />
          )}
        </>
      )}

      {selected && (
        <PropertyModal
          prop={selected} themeHex={themeHex}
          canApprove={canApprove} canPublish={canPublish} canSetTier={canSetTier} canEdit={canEdit}
          onClose={() => setSelected(null)} onRefetch={() => { load(); setSelected(null); }}
        />
      )}
    </div>
  );
}
