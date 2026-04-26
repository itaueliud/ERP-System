import React, { useState } from 'react';
import { useNavigate } from '../../shared/utils/router';
import { PortalLayout, StatCard, SectionHeader, DataTable, StatusBadge, PortalButton } from '../../shared/components/layout/PortalLayout';
import { PORTAL_THEMES } from '../../shared/theme/portalThemes';
import { useAuth } from '../../shared/components/auth/AuthContext';
import { useMultiPortalData } from '../../shared/utils/usePortalData';
import { AFRICAN_COUNTRIES, COUNTRIES_BY_REGION, AFRICAN_REGIONS, getCurrencyForCountry } from '../../shared/utils/africanCountries';
import ChatPanel from '../../shared/components/chat/ChatPanel';
import { SandboxBanner } from '../../shared/components/payments/SandboxBanner';
import { AGENTS_FAQS } from '../../shared/data/portalFAQs';

const theme = PORTAL_THEMES.agents;

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.75)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.6)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
};

// ─── Status label map — doc §10 Lead Status Table ─────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  NEW_LEAD:       'New Lead',       // Agent submits client information form
  CONVERTED:      'Converted',      // Agent selects product and service
  LEAD_ACTIVATED: 'Lead Activated', // Commitment payment confirmed (Full Payment)
  LEAD_QUALIFIED: 'Lead Qualified', // Commitment payment confirmed (50/50 or Milestone)
  NEGOTIATION:    'Negotiation',    // Trainer in active engagement
  CLOSED_WON:     'Closed Won',     // Full deposit received → Project
};
function clientStatusLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}

// ─── Industry services map ────────────────────────────────────────────────────
const INDUSTRY_SERVICES: Record<string, string[]> = {
  SCHOOLS:     ['School Portal / LMS', 'Fee Management System', 'Custom Website'],
  CHURCHES:    ['Member Management System', 'Online Giving System', 'Custom Website'],
  HOTELS:      ['Booking System', 'Room Management System', 'Hotel Billing System', 'Custom Website'],
  HOSPITALS:   ['Patient Management System', 'Appointment Booking System', 'Pharmacy Stock System', 'Custom Website'],
  COMPANIES:   ['HR & Payroll System', 'CRM System', 'Inventory Management System', 'Custom Website'],
  REAL_ESTATE: ['Rent Management System', 'Property Listing Platform', 'Tenant Management System', 'Custom Website'],
  SHOPS:       ['POS System', 'E-commerce Website', 'Inventory System', 'Custom Website'],
};

const PLAN_AMOUNTS: Record<string, number> = { FULL: 500, '50_50': 750, MILESTONE: 1000 };
const PLAN_LABELS: Record<string, string> = {
  FULL:      'Full Payment (KSh 500 commitment)',
  '50_50':   '50% Deposit + 50% on Delivery (KSh 750 commitment)',
  MILESTONE: 'Milestone Plan 40-20-20-20 (KSh 1000 commitment)',
};

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepIndicator({ step }: { step: 1 | 2 | '3a' | '3b' }) {
  const steps = ['Client Info', 'Product', 'Details'];
  const active = step === 1 ? 0 : step === 2 ? 1 : 2;
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((label, i) => (
        <React.Fragment key={label}>
          <div className={`flex items-center gap-1.5 text-xs font-medium ${i <= active ? 'text-gray-800' : 'text-gray-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < active ? 'bg-green-500 text-white' : i === active ? 'text-white' : 'bg-gray-100 text-gray-400'}`}
              style={i === active ? { backgroundColor: theme.hex } : {}}>
              {i < active ? '✓' : i + 1}
            </span>
            {label}
          </div>
          {i < steps.length - 1 && <div className={`flex-1 h-px ${i < active ? 'bg-green-400' : 'bg-gray-200'}`} />}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Capture Wizard ───────────────────────────────────────────────────────────
function CaptureWizard({ themeHex, onClientSaved }: { themeHex: string; onClientSaved?: () => void }) {
  const [captureStep, setCaptureStep] = useState<1 | 2 | '3a' | '3b'>(1);
  const [captureProduct, setCaptureProduct] = useState<'SYSTEM' | 'PLOTCONNECT' | null>(null);
  const [captureInfo, setCaptureInfo] = useState({ clientName: '', organizationName: '', phone: '', email: '', location: '', notes: '' });
  const [captureIndustry, setCaptureIndustry] = useState('');
  const [captureServices, setCaptureServices] = useState<string[]>([]);
  const [capturePlan, setCapturePlan] = useState<'FULL' | '50_50' | 'MILESTONE'>('FULL');
  const [captureMpesa, setCaptureMpesa] = useState('');
  const [capturePropType, setCapturePropType] = useState<'STUDENT' | 'OTHERS'>('STUDENT');
  const [capturePropForm, setCapturePropForm] = useState({ propertyName: '', location: '', numberOfRooms: '', pricePerRoom: '', contactPerson: '', numberOfUnits: '', stayType: 'Monthly', description: '', websiteLink: '' });
  const [capturePlacementTier, setCapturePlacementTier] = useState<'TOP' | 'MEDIUM' | 'BASIC'>('BASIC');
  const [captureSubmitting, setCaptureSubmitting] = useState(false);
  const [captureMsg, setCaptureMsg] = useState('');
  const [captureSuccess, setCaptureSuccess] = useState(false);

  const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!captureInfo.clientName.trim() || !captureInfo.phone.trim() || !captureInfo.email.trim()) {
      setCaptureMsg('Please fill in Client Name, Phone, and Email before continuing.');
      setCaptureSuccess(false);
      return;
    }
    setCaptureMsg('');
    setCaptureStep(2);
  };

  const handleProductSelect = (p: 'SYSTEM' | 'PLOTCONNECT') => {
    setCaptureProduct(p);
    setCaptureStep(p === 'SYSTEM' ? '3a' : '3b');
  };

  const handleSystemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Pre-submit validation
    if (!captureInfo.clientName.trim()) { setCaptureMsg('Client name is required.'); setCaptureSuccess(false); return; }
    if (!captureInfo.phone.trim())      { setCaptureMsg('Phone number is required.'); setCaptureSuccess(false); return; }
    if (!captureInfo.email.trim())      { setCaptureMsg('Email is required.'); setCaptureSuccess(false); return; }
    if (!captureIndustry)               { setCaptureMsg('Please select an industry.'); setCaptureSuccess(false); return; }
    if (captureServices.length === 0)   { setCaptureMsg('Please select at least one service.'); setCaptureSuccess(false); return; }
    if (!captureMpesa.trim())           { setCaptureMsg('M-Pesa number is required.'); setCaptureSuccess(false); return; }

    setCaptureSubmitting(true);
    setCaptureMsg('');
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      const commitmentAmount = PLAN_AMOUNTS[capturePlan];
      // Get agent's country from their profile (spec §7: country inherited from trainer's assignment)
      let agentCountry = 'Kenya'; // default fallback
      try {
        const profileRes = await apiClient.get('/api/v1/users/me');
        agentCountry = (profileRes.data as any)?.data?.country || (profileRes.data as any)?.country || 'Kenya';
      } catch { /* use default */ }

      // Step 1 — Save client (always succeeds independently of payment)
      const clientRes = await apiClient.post('/api/v1/clients', {
        name: captureInfo.clientName.trim(),
        organizationName: captureInfo.organizationName.trim(),
        phone: captureInfo.phone.trim(),
        email: captureInfo.email.trim(),
        country: agentCountry,
        location: captureInfo.location.trim(),
        notes: captureInfo.notes.trim(),
        industryCategory: captureIndustry,
        serviceDescription: captureServices.join(', '),
        paymentPlan: capturePlan,
        mpesaNumber: captureMpesa.trim(),
        commitmentAmount,
      });
      const clientId = (clientRes.data as any).id;

      // Step 2 — Attempt M-Pesa STK Push (non-blocking — client is already saved)
      let paymentMsg = '';
      try {
        await apiClient.post('/api/v1/payments/mpesa', {
          phoneNumber: captureMpesa.trim(),
          amount: commitmentAmount,
          currency: 'KES',
          reference: `CLIENT-${Date.now()}`,
          description: `Commitment payment - ${capturePlan}`,
          clientId,
        });
        paymentMsg = `M-Pesa STK Push sent to ${captureMpesa}. Ask client to approve on their phone.`;
      } catch {
        paymentMsg = `Client saved. M-Pesa payment pending — initiate manually when ready.`;
      }

      setCaptureSuccess(true);
      setCaptureMsg(`✓ Client registered successfully! ${paymentMsg}`);
      onClientSaved?.();
    } catch (err: any) {
      setCaptureSuccess(false);
      const errMsg = err?.response?.data?.error || err?.message || 'Failed to register client';
      setCaptureMsg(`Error: ${errMsg}`);
    } finally {
      setCaptureSubmitting(false);
    }
  };

  const handlePlotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Pre-submit validation
    if (!captureInfo.clientName.trim()) { setCaptureMsg('Client name is required.'); setCaptureSuccess(false); return; }
    if (!captureInfo.phone.trim())      { setCaptureMsg('Phone number is required.'); setCaptureSuccess(false); return; }
    if (!captureInfo.email.trim())      { setCaptureMsg('Email is required.'); setCaptureSuccess(false); return; }
    if (!capturePropForm.propertyName.trim()) { setCaptureMsg('Property name is required.'); setCaptureSuccess(false); return; }
    if (!captureMpesa.trim())           { setCaptureMsg('M-Pesa number is required.'); setCaptureSuccess(false); return; }
    setCaptureSubmitting(true);
    setCaptureMsg('');
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      const commitmentAmount = PLAN_AMOUNTS[capturePlan];
      let agentCountry = 'Kenya';
      try {
        const profileRes = await apiClient.get('/api/v1/users/me');
        agentCountry = (profileRes.data as any)?.data?.country || (profileRes.data as any)?.country || 'Kenya';
      } catch { /* use default */ }
      const clientRes = await apiClient.post('/api/v1/clients', {
        name: captureInfo.clientName.trim(),
        organizationName: captureInfo.organizationName.trim(),
        phone: captureInfo.phone.trim(),
        email: captureInfo.email.trim(),
        country: agentCountry,
        notes: captureInfo.notes.trim(),
        product: 'TST_PLOTCONNECT',
        propertyType: capturePropType,
        serviceDescription: `TST PlotConnect — ${capturePropType === 'STUDENT' ? 'Student Residence' : 'Property Listing'}`,
        industryCategory: 'REAL_ESTATE',
        ...capturePropForm,
        location: captureInfo.location.trim() || capturePropForm.location,
        placementTier: capturePlacementTier,
        paymentPlan: capturePlan,
        mpesaNumber: captureMpesa.trim(),
        commitmentAmount,
      });
      const clientId = (clientRes.data as any).id;

      // Attempt payment — non-blocking
      let paymentMsg = '';
      try {
        await apiClient.post('/api/v1/payments/mpesa', {
          phoneNumber: captureMpesa,
          amount: commitmentAmount,
          currency: 'KES',
          reference: `CLIENT-${Date.now()}`,
          description: `Commitment payment - ${capturePlan}`,
          clientId,
        });
        paymentMsg = `M-Pesa STK Push sent to ${captureMpesa}. Ask client to approve on their phone.`;
      } catch {
        paymentMsg = `Client saved. M-Pesa payment pending — initiate manually when ready.`;
      }

      setCaptureSuccess(true);
      setCaptureMsg(`✓ Client registered successfully! ${paymentMsg}`);
      onClientSaved?.();
    } catch (err: any) {
      setCaptureSuccess(false);
      const errMsg = err?.response?.data?.error || err?.message || 'Failed to register client';
      setCaptureMsg(`Error: ${errMsg}`);
    } finally {
      setCaptureSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-10">
      <StepIndicator step={captureStep} />
      {captureMsg && (
        <div className={`p-3 rounded-xl text-sm mb-4 ${captureSuccess ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>          {captureMsg}
        </div>
      )}

      {/* Step 1 — Client Info */}
      {captureStep === 1 && (
        <form onSubmit={handleStep1Submit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className={labelCls}>Client Name *</label>
              <input type="text" required placeholder="CLIENT FULL NAME" value={captureInfo.clientName} onChange={e => setCaptureInfo(f => ({ ...f, clientName: e.target.value.toUpperCase() }))} style={{ textTransform: 'uppercase' }} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Organization Name</label>
              <input type="text" placeholder="ORGANIZATION (OPTIONAL)" value={captureInfo.organizationName} onChange={e => setCaptureInfo(f => ({ ...f, organizationName: e.target.value.toUpperCase() }))} style={{ textTransform: 'uppercase' }} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Phone Number *</label>
              <input type="tel" required placeholder="+254 7XX XXX XXX" value={captureInfo.phone} onChange={e => setCaptureInfo(f => ({ ...f, phone: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email *</label>
              <input type="email" required placeholder="client@example.com" value={captureInfo.email} onChange={e => setCaptureInfo(f => ({ ...f, email: e.target.value }))} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Location (Town / County) <span className="text-xs text-gray-400 font-normal">— No country needed — scoped to your trainer's region</span></label>
              <input type="text" required placeholder="Kenya" value={captureInfo.location} onChange={e => setCaptureInfo(f => ({ ...f, location: e.target.value }))} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Notes</label>
              <textarea rows={3} value={captureInfo.notes} onChange={e => setCaptureInfo(f => ({ ...f, notes: e.target.value }))} className={`${inputCls} resize-none`} />
            </div>
          </div>
          <div className="sticky bottom-0 bg-white pt-3 pb-1 -mx-6 px-6 border-t border-gray-100 mt-2">
            <PortalButton color={themeHex} fullWidth>Next: Select Product →</PortalButton>
          </div>
        </form>
      )}

      {/* Step 2 — Product Selection */}
      {captureStep === 2 && (
        <div>
          <button onClick={() => setCaptureStep(1)} className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">← Back</button>
          <p className="text-sm font-medium text-gray-700 mb-4">Select a product for this client:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { id: 'SYSTEM' as const, title: 'SYSTEM', desc: 'ERP/software systems' },
              { id: 'PLOTCONNECT' as const, title: 'TST PlotConnect', desc: 'Property listings' },
            ].map(p => (
              <button key={p.id} onClick={() => handleProductSelect(p.id)}
                className={`p-6 rounded-2xl border-2 text-left transition-all hover:shadow-md ${captureProduct === p.id ? 'border-current' : 'border-gray-200'}`}
                style={captureProduct === p.id ? { borderColor: themeHex } : {}}>
                <p className="font-bold text-gray-800 text-lg mb-1">{p.title}</p>
                <p className="text-sm text-gray-500">{p.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3a — SYSTEM */}
      {captureStep === '3a' && (
        <form onSubmit={handleSystemSubmit}>
          <button type="button" onClick={() => setCaptureStep(2)} className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">← Back</button>
          <div className="mb-5">
            <label className={labelCls}>Select Industry *</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.keys(INDUSTRY_SERVICES).map(ind => (
                <button type="button" key={ind} onClick={() => { setCaptureIndustry(ind); setCaptureServices([]); }}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${captureIndustry === ind ? 'text-white border-transparent' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                  style={captureIndustry === ind ? { backgroundColor: themeHex } : {}}>
                  {ind.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
          {captureIndustry && (
            <div className="mb-5">
              <label className={labelCls}>Select Services *</label>
              <div className="space-y-2">
                {INDUSTRY_SERVICES[captureIndustry].map(svc => (
                  <label key={svc} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={captureServices.includes(svc)}
                      onChange={e => setCaptureServices(prev => e.target.checked ? [...prev, svc] : prev.filter(s => s !== svc))}
                      className="rounded" />
                    <span className="text-sm text-gray-700">{svc}</span>
                  </label>
                ))}
              </div>
              {captureServices.length > 1 && (
                <p className="mt-2 text-sm text-green-600 font-medium">10% multi-service discount applied ✓</p>
              )}
            </div>
          )}
          <div className="mb-5">
            <label className={labelCls}>Payment Plan *</label>
            <div className="space-y-2">
              {(Object.keys(PLAN_LABELS) as Array<'FULL' | '50_50' | 'MILESTONE'>).map(plan => (
                <label key={plan} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="plan" value={plan} checked={capturePlan === plan} onChange={() => setCapturePlan(plan)} />
                  <span className="text-sm text-gray-700">{PLAN_LABELS[plan]}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="mb-6">
            <SandboxBanner />
            <label className={labelCls}>M-Pesa Number for commitment payment *</label>
            <input type="tel" required value={captureMpesa} onChange={e => setCaptureMpesa(e.target.value)} className={inputCls} placeholder="e.g. 0712345678" />
          </div>
          <div className="sticky bottom-0 bg-white pt-3 pb-1 -mx-6 px-6 border-t border-gray-100 mt-2">
            <PortalButton color={themeHex} fullWidth disabled={captureSubmitting || !captureIndustry || captureServices.length === 0}>
              {captureSubmitting ? 'Registering…' : 'Register Client & Initiate Payment'}
            </PortalButton>
          </div>
        </form>
      )}

      {/* Step 3b — TST PlotConnect */}
      {captureStep === '3b' && (
        <form onSubmit={handlePlotSubmit}>
          <button type="button" onClick={() => setCaptureStep(2)} className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">← Back</button>
          <div className="mb-5">
            <label className={labelCls}>Property Type *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { id: 'STUDENT' as const, label: 'Student Residence / Single Rooms' },
                { id: 'OTHERS' as const, label: 'Others (Apartments, Airbnb, Lodges, Rental Flats)' },
              ].map(pt => (
                <button type="button" key={pt.id} onClick={() => setCapturePropType(pt.id)}
                  className={`p-4 rounded-xl border-2 text-left text-sm font-medium transition-all ${capturePropType === pt.id ? 'text-white border-transparent' : 'border-gray-200 text-gray-700'}`}
                  style={capturePropType === pt.id ? { backgroundColor: themeHex } : {}}>
                  {pt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className={labelCls}>Property Name *</label>
              <input type="text" required value={capturePropForm.propertyName} onChange={e => setCapturePropForm(f => ({ ...f, propertyName: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Location (County/Town/Area) *</label>
              <input type="text" required value={capturePropForm.location} onChange={e => setCapturePropForm(f => ({ ...f, location: e.target.value }))} className={inputCls} />
            </div>
            {capturePropType === 'STUDENT' ? (
              <>
                <div>
                  <label className={labelCls}>Number of Rooms *</label>
                  <input type="number" required min={1} value={capturePropForm.numberOfRooms} onChange={e => setCapturePropForm(f => ({ ...f, numberOfRooms: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Price Per Room (KSh) *</label>
                  <input type="number" required min={0} value={capturePropForm.pricePerRoom} onChange={e => setCapturePropForm(f => ({ ...f, pricePerRoom: e.target.value }))} className={inputCls} />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className={labelCls}>Number of Units *</label>
                  <input type="number" required min={1} value={capturePropForm.numberOfUnits} onChange={e => setCapturePropForm(f => ({ ...f, numberOfUnits: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Stay Type *</label>
                  <select required value={capturePropForm.stayType} onChange={e => setCapturePropForm(f => ({ ...f, stayType: e.target.value }))} className={inputCls}>
                    <option value="Monthly">Monthly</option>
                    <option value="Daily">Daily</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Description</label>
                  <textarea rows={3} value={capturePropForm.description} onChange={e => setCapturePropForm(f => ({ ...f, description: e.target.value }))} className={`${inputCls} resize-none`} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Website Link</label>
                  <input type="url" value={capturePropForm.websiteLink} onChange={e => setCapturePropForm(f => ({ ...f, websiteLink: e.target.value }))} className={inputCls} placeholder="https://" />
                </div>
              </>
            )}
            <div className="sm:col-span-2">
              <label className={labelCls}>Contact Person *</label>
              <input type="text" required value={capturePropForm.contactPerson} onChange={e => setCapturePropForm(f => ({ ...f, contactPerson: e.target.value }))} className={inputCls} />
            </div>
          </div>
          {/* Placement Tier Selection — doc §11: Top/Medium/Basic placement */}
          <div className="mb-5">
            <label className={labelCls}>Placement Tier * <span className="text-xs text-gray-400 font-normal">— Only a Trainer can modify this after submission</span></label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {([
                { id: 'TOP'    as const, label: 'Top Placement',    desc: 'Maximum visibility' },
                { id: 'MEDIUM' as const, label: 'Medium Placement', desc: 'Standard visibility' },
                { id: 'BASIC'  as const, label: 'Basic Placement',  desc: 'Entry level' },
              ]).map(tier => (
                <button type="button" key={tier.id} onClick={() => setCapturePlacementTier(tier.id)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${capturePlacementTier === tier.id ? 'text-white border-transparent' : 'border-gray-200 text-gray-700'}`}
                  style={capturePlacementTier === tier.id ? { backgroundColor: themeHex } : {}}>
                  <p className="text-sm font-semibold">{tier.label}</p>
                  <p className="text-xs opacity-75 mt-0.5">{tier.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="mb-5">
            <label className={labelCls}>Payment Plan *</label>
            <div className="space-y-2">
              {(Object.keys(PLAN_LABELS) as Array<'FULL' | '50_50' | 'MILESTONE'>).map(plan => (
                <label key={plan} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="plotplan" value={plan} checked={capturePlan === plan} onChange={() => setCapturePlan(plan)} />
                  <span className="text-sm text-gray-700">{PLAN_LABELS[plan]}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="mb-6">
            <SandboxBanner />
            <label className={labelCls}>M-Pesa Number for commitment payment *</label>
            <input type="tel" required value={captureMpesa} onChange={e => setCaptureMpesa(e.target.value)} className={inputCls} placeholder="e.g. 0712345678" />
          </div>
          <div className="sticky bottom-0 bg-white pt-3 pb-1 -mx-6 px-6 border-t border-gray-100 mt-2">
            <PortalButton color={themeHex} fullWidth disabled={captureSubmitting}>
              {captureSubmitting ? 'Registering…' : 'Register Client & Initiate Payment'}
            </PortalButton>
          </div>
        </form>
      )}
    </div>
  );
}

// ─── Communication Form ───────────────────────────────────────────────────────
function CommunicationForm({ themeHex }: { themeHex: string }) {
  const [clientId, setClientId] = useState('');
  const [type, setType] = useState('EMAIL');
  const [communicationDate, setCommunicationDate] = useState(new Date().toISOString().split('T')[0]);
  const [durationMinutes, setDurationMinutes] = useState('');
  const [summary, setSummary] = useState('');
  const [outcome, setOutcome] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg('');
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      await apiClient.post(`/api/v1/clients/${clientId}/communications`, {
        type, communicationDate, durationMinutes: parseInt(durationMinutes) || undefined, summary, outcome,
      });
      setIsSuccess(true);
      setMsg('Communication logged successfully!');
      setClientId(''); setType('EMAIL'); setCommunicationDate(new Date().toISOString().split('T')[0]);
      setDurationMinutes(''); setSummary(''); setOutcome('');
    } catch (err: any) {
      setIsSuccess(false);
      setMsg(err?.response?.data?.error || 'Failed to log communication');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';

  return (
    <div className="max-w-2xl bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
      {msg && <div className={`p-3 rounded-xl text-sm mb-4 ${isSuccess ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg}</div>}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelCls}>Client ID *</label>
            <input type="text" required value={clientId} onChange={e => setClientId(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Type *</label>
            <select required value={type} onChange={e => setType(e.target.value)} className={inputCls}>
              {['EMAIL', 'PHONE', 'MEETING', 'CHAT', 'SMS'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Date *</label>
            <input type="date" required value={communicationDate} onChange={e => setCommunicationDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Duration (minutes)</label>
            <input type="number" min={0} value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="mb-4">
          <label className={labelCls}>Summary</label>
          <textarea rows={3} value={summary} onChange={e => setSummary(e.target.value)} className={`${inputCls} resize-none`} />
        </div>
        <div className="mb-6">
          <label className={labelCls}>Outcome</label>
          <textarea rows={3} value={outcome} onChange={e => setOutcome(e.target.value)} className={`${inputCls} resize-none`} />
        </div>
        <PortalButton color={themeHex} fullWidth disabled={submitting}>
          {submitting ? 'Logging…' : 'Log Communication'}
        </PortalButton>
      </form>
    </div>
  );
}

// ─── Daily Report Form ────────────────────────────────────────────────────────
function DailyReportForm({ themeHex }: { themeHex: string }) {
  const [accomplishments, setAccomplishments] = useState('');
  const [challenges, setChallenges] = useState('');
  const [tomorrowPlan, setTomorrowPlan] = useState('');
  const [hoursWorked, setHoursWorked] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg('');
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      await apiClient.post('/api/v1/reports', {
        accomplishments, challenges, tomorrowPlan,
        hoursWorked: parseFloat(hoursWorked) || undefined,
        reportDate: new Date().toISOString().split('T')[0],
      });
      setIsSuccess(true);
      setMsg('Report submitted successfully!');
      setAccomplishments(''); setChallenges(''); setTomorrowPlan(''); setHoursWorked('');
    } catch (err: any) {
      setIsSuccess(false);
      setMsg(err?.response?.data?.error || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all resize-none';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';

  return (
    <div className="max-w-2xl bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
      {msg && <div className={`p-3 rounded-xl text-sm mb-4 ${isSuccess ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg}</div>}
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className={labelCls}>What did you accomplish today? *</label>
          <textarea rows={3} required value={accomplishments} onChange={e => setAccomplishments(e.target.value)} className={inputCls} />
        </div>
        <div className="mb-4">
          <label className={labelCls}>Any challenges faced?</label>
          <textarea rows={3} value={challenges} onChange={e => setChallenges(e.target.value)} className={inputCls} />
        </div>
        <div className="mb-4">
          <label className={labelCls}>Plan for tomorrow</label>
          <textarea rows={3} value={tomorrowPlan} onChange={e => setTomorrowPlan(e.target.value)} className={inputCls} />
        </div>
        <div className="mb-6">
          <label className={labelCls}>Hours worked</label>
          <input type="number" min={0} max={24} value={hoursWorked} onChange={e => setHoursWorked(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all" />
        </div>
        <div className="flex gap-2">
          <PortalButton color={themeHex} fullWidth disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Report'}
          </PortalButton>
          <PortalButton variant="secondary" onClick={() => { setAccomplishments(''); setChallenges(''); setTomorrowPlan(''); setHoursWorked(''); setMsg(''); }} disabled={submitting}>Clear</PortalButton>
        </div>
      </form>
    </div>
  );
}

// ─── Clients Section ──────────────────────────────────────────────────────────
function ClientsSection({ clients, themeHex, refetch, setSection }: {
  clients: any[]; themeHex: string; refetch: () => void; setSection: (s: string) => void;
}) {
  const [selected, setSelected] = React.useState<any | null>(null);
  const [payClient, setPayClient] = React.useState<any | null>(null);
  const [mpesa, setMpesa] = React.useState('');
  const [payPlan, setPayPlan] = React.useState<'FULL' | '50_50' | 'MILESTONE'>('FULL');
  const [payMsg, setPayMsg] = React.useState('');
  const [payOk, setPayOk] = React.useState(false);
  const [payBusy, setPayBusy] = React.useState(false);
  const [statusBusy, setStatusBusy] = React.useState(false);
  const [statusMsg, setStatusMsg] = React.useState('');

  // Agent can only advance NEW_LEAD → CONVERTED (selecting product/service)
  // LEAD_ACTIVATED/LEAD_QUALIFIED happen automatically via payment webhook
  // NEGOTIATION is set by the Trainer
  // CLOSED_WON is set by Trainer/Operations
  const canAgentAdvance = (status: string) => status === 'NEW_LEAD';

  const advanceStatus = async (client: any) => {
    if (!canAgentAdvance(client.status)) return;
    setStatusBusy(true); setStatusMsg('');
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      await apiClient.patch(`/api/v1/clients/${client.id}/status`, { status: 'CONVERTED' });
      setStatusMsg('✓ Client marked as Converted — now initiate commitment payment');
      refetch();
      if (selected?.id === client.id) setSelected({ ...selected, status: 'CONVERTED' });
    } catch (err: any) {
      setStatusMsg(err?.response?.data?.error || 'Failed to update status');
    } finally { setStatusBusy(false); }
  };

  const PLAN_AMOUNTS: Record<string, number> = { FULL: 500, '50_50': 750, MILESTONE: 1000 };
  const PLAN_LABELS: Record<string, string> = {
    FULL: 'Full Payment — KSh 500 commitment',
    '50_50': '50% Deposit + 50% on Delivery — KSh 750',
    MILESTONE: 'Milestone Plan 40-20-20-20 — KSh 1,000',
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mpesa.trim()) { setPayMsg('Enter M-Pesa number.'); setPayOk(false); return; }
    setPayBusy(true); setPayMsg('');
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      const amount = PLAN_AMOUNTS[payPlan];
      await apiClient.post('/api/v1/payments/mpesa', {
        phoneNumber: mpesa.trim(),
        amount,
        currency: 'KES',
        reference: `CLIENT-${payClient.id}-${Date.now()}`,
        description: `Commitment payment — ${payPlan}`,
        clientId: payClient.id,
      });
      setPayMsg(`✓ M-Pesa STK Push sent to ${mpesa}. Ask client to approve on their phone.`);
      setPayOk(true);
      refetch();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Payment failed';
      // Client is already saved — payment failure is non-blocking
      setPayMsg(`Client saved. Payment pending: ${msg}`);
      setPayOk(true);
    } finally { setPayBusy(false); }
  };

  const inputCls = 'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 transition-all';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';

  return (
    <div>
      <SectionHeader title="My Clients" subtitle={`${clients.length} client${clients.length !== 1 ? 's' : ''} assigned to you`} />

      {clients.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: themeHex + '15' }}>
            <svg className="w-7 h-7" style={{ color: themeHex }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm mb-4">No clients yet. Add your first client to get started.</p>
          <PortalButton color={themeHex} onClick={() => setSection('capture')}>Add New Client</PortalButton>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Client', 'Phone', 'Location', 'Service', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {clients.map((c: any, i: number) => (
                <tr key={c.id || i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900">{c.name}</p>
                    {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.phone || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.location || c.country || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[160px]">
                    <span className="truncate block text-xs">{c.serviceDescription ? c.serviceDescription.slice(0, 40) + (c.serviceDescription.length > 40 ? '…' : '') : '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{
                        background: c.status === 'CLOSED_WON' ? '#f0fdf4' : c.status === 'NEW_LEAD' ? '#faf5ff' : '#eff6ff',
                        color: c.status === 'CLOSED_WON' ? '#15803d' : c.status === 'NEW_LEAD' ? '#7c3aed' : '#1d4ed8',
                      }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{
                        background: c.status === 'CLOSED_WON' ? '#16a34a' : c.status === 'NEW_LEAD' ? '#7c3aed' : '#2563eb'
                      }} />
                      {clientStatusLabel(c.status || 'NEW_LEAD')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => { setSelected(c); setStatusMsg(''); }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-[0.97]"
                        style={{ backgroundColor: themeHex }}>
                        View
                      </button>
                      {canAgentAdvance(c.status) && (
                        <button onClick={() => advanceStatus(c)} disabled={statusBusy}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:bg-gray-50 active:scale-[0.97] disabled:opacity-40"
                          style={{ borderColor: themeHex, color: themeHex }}>
                          {statusBusy ? '…' : '→ Convert'}
                        </button>
                      )}
                      {(c.status === 'NEW_LEAD' || c.status === 'CONVERTED') && (
                        <button onClick={() => { setPayClient(c); setMpesa(c.phone || ''); setPayMsg(''); setPayOk(false); }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:bg-gray-50 active:scale-[0.97]"
                          style={{ borderColor: '#16a34a', color: '#16a34a' }}>
                          Pay
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── View Client Modal ── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelected(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between"
              style={{ background: themeHex + '10' }}>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selected.name}</h2>
                <p className="text-xs text-gray-500">{selected.referenceNumber || selected.id}</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {/* Body */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Full Name',     value: selected.name },
                  { label: 'Email',         value: selected.email },
                  { label: 'Phone',         value: selected.phone },
                  { label: 'Location',      value: selected.location || selected.country },
                  { label: 'Organization',  value: selected.organizationName },
                  { label: 'Industry',      value: selected.industryCategory?.replace(/_/g, ' ') },
                  { label: 'Status',        value: clientStatusLabel(selected.status || 'NEW_LEAD') },
                  { label: 'Payment Plan',  value: selected.paymentPlan },
                  { label: 'Date Added',    value: selected.createdAt ? new Date(selected.createdAt).toLocaleDateString() : '—' },
                ].filter(f => f.value).map(f => (
                  <div key={f.label}>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{f.label}</p>
                    <p className="text-sm font-medium text-gray-800 mt-0.5">{f.value}</p>
                  </div>
                ))}
              </div>
              {selected.serviceDescription && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Service Description</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3">{selected.serviceDescription}</p>
                </div>
              )}
              {selected.notes && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3">{selected.notes}</p>
                </div>
              )}
            </div>
            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100">
              {statusMsg && (
                <div className={`p-2.5 rounded-xl text-xs mb-3 ${statusMsg.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{statusMsg}</div>
              )}
              <div className="flex gap-3">
                {canAgentAdvance(selected.status) && (
                  <button onClick={() => advanceStatus(selected)} disabled={statusBusy}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: themeHex }}>
                    {statusBusy ? 'Updating…' : '→ Mark as Converted'}
                  </button>
                )}
                {(selected.status === 'NEW_LEAD' || selected.status === 'CONVERTED') && (
                  <button onClick={() => { setPayClient(selected); setSelected(null); setMpesa(selected.phone || ''); setPayMsg(''); setPayOk(false); }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all hover:bg-gray-50"
                    style={{ borderColor: '#16a34a', color: '#16a34a' }}>
                    Initiate Payment
                  </button>
                )}
                <button onClick={() => { setSelected(null); setStatusMsg(''); }}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Pay Modal ── */}
      {payClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => { if (!payBusy) setPayClient(null); }} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between"
              style={{ background: themeHex + '10' }}>
              <div>
                <h2 className="text-base font-bold text-gray-900">Initiate Commitment Payment</h2>
                <p className="text-xs text-gray-500">{payClient.name}</p>
              </div>
              <button onClick={() => { if (!payBusy) setPayClient(null); }} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handlePay} className="p-6 space-y-4">
              {payMsg && (
                <div className={`flex items-start gap-2 p-3.5 rounded-xl text-sm ${payOk ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {payOk
                    ? <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    : <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  }
                  {payMsg}
                </div>
              )}
              <div>
                <label className={labelCls}>Payment Plan</label>
                <div className="space-y-2">
                  {(Object.keys(PLAN_LABELS) as Array<'FULL' | '50_50' | 'MILESTONE'>).map(plan => (
                    <label key={plan} className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all"
                      style={payPlan === plan ? { borderColor: themeHex, background: themeHex + '08' } : { borderColor: '#e5e7eb' }}>
                      <input type="radio" name="plan" value={plan} checked={payPlan === plan} onChange={() => setPayPlan(plan)} className="flex-shrink-0" />
                      <span className="text-sm text-gray-700">{PLAN_LABELS[plan]}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <SandboxBanner />
                <label className={labelCls}>Client M-Pesa Number *</label>
                <input type="tel" required value={mpesa} onChange={e => setMpesa(e.target.value)}
                  className={inputCls} placeholder="e.g. 0712345678" />
                <p className="text-xs text-gray-400 mt-1">An STK Push will be sent to this number for KSh {PLAN_AMOUNTS[payPlan].toLocaleString()}</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={payBusy}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: themeHex }}>
                  {payBusy
                    ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Sending…</>
                    : 'Send M-Pesa STK Push'
                  }
                </button>
                {!payBusy && (
                  <button type="button" onClick={() => setPayClient(null)}
                    className="px-5 py-3 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all">
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── NAV — doc §6 Portal 6: Overview, Add New Client, My Client List, Lead Status Tracker, Personal Profile ──────────────────────────────────────────────────────────────────────────────────
const NAV = [
  { id: 'overview',     label: 'Overview',          icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg> },
  { id: 'capture',      label: 'Add New Client',    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg> },
  { id: 'clients',      label: 'My Clients',        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
  { id: 'lead-status',  label: 'Lead Status',       icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
  { id: 'profile',      label: 'My Profile',        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> },
  { id: 'daily-report', label: 'Daily Report',      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> },
  // doc §18: Agents have no chat — personal dashboard only
];

// ─── Notifications section (proper component — hooks can't be in IIFE) ────────
function PortalNotificationsSection({ notifs, refetch, themeHex, subtitle }: {
  notifs: any[]; refetch: (keys?: string[]) => void;
  themeHex: string; subtitle?: string;
}) {
  const [localNotifs, setLocalNotifs] = React.useState<any[]>(notifs);
  React.useEffect(() => setLocalNotifs(notifs), [notifs]);
  const markRead = async (id: string) => {
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      await apiClient.patch(`/api/v1/notifications/${id}/read`);
      setLocalNotifs(p => p.map(n => n.id === id ? { ...n, read: true } : n));
      refetch(['notifications']);
    } catch { /* silent */ }
  };
  const markAll = async () => {
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      await Promise.all(localNotifs.filter(n => !n.read).map(n => apiClient.patch(`/api/v1/notifications/${n.id}/read`)));
      setLocalNotifs(p => p.map(n => ({ ...n, read: true })));
      refetch(['notifications']);
    } catch { /* silent */ }
  };
  const unread = localNotifs.filter(n => !n.read).length;
  return (
    <div>
      <SectionHeader title="Notifications" subtitle={subtitle} />
      <div className="space-y-3">
        {unread > 0 && (
          <div className="flex justify-end">
            <PortalButton size="sm" variant="secondary" onClick={markAll}>Mark all as read ({unread})</PortalButton>
          </div>
        )}
        {(Array.isArray(localNotifs) ? localNotifs : []).map((n: any, i: number) => (
          <div key={n.id || i} className={`bg-white rounded-2xl border p-4 flex items-start gap-4 ${n.read ? 'border-gray-100' : 'border-blue-100 bg-blue-50/30'}`}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: themeHex + '22' }}>
              <svg className="w-5 h-5" style={{ color: themeHex }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900 text-sm">{n.title || 'Notification'}</p>
              <p className="text-xs text-gray-500 mt-0.5">{n.message || n.description || ''}</p>
              {n.createdAt && <p className="text-xs text-gray-400 mt-1">{new Date(n.createdAt).toLocaleDateString()}</p>}
            </div>
            {!n.read && (
              <button onClick={() => markRead(n.id)} className="text-xs text-blue-600 hover:underline flex-shrink-0 mt-1">Mark read</button>
            )}
          </div>
        ))}
        {!localNotifs.length && <div className="text-center py-12 text-gray-400 text-sm">No notifications yet</div>}
      </div>
    </div>
  );
}

// ─── Main Portal ──────────────────────────────────────────────────────────────
export default function AgentsPortal() {
  const [section, setSection] = useState('overview');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const { data, loading, isLive, refetch } = useMultiPortalData([
    { key: 'performance',   endpoint: '/api/v1/dashboard/agent-metrics', fallback: {},
      transform: (r: any) => r?.data || r || {} },
    { key: 'clients',       endpoint: '/api/v1/clients',                 fallback: [],
      transform: (r: any) => Array.isArray(r) ? r : (r.data || r.clients || []) },
    { key: 'commissions',   endpoint: '/api/v1/commissions/me',          fallback: [],
      transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'training',      endpoint: '/api/v1/training/assignments',    fallback: [],
      transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'notifications', endpoint: '/api/v1/notifications',           fallback: [],
      transform: (r: any) => Array.isArray(r) ? r : (r?.notifications || r?.data || []) },
  ] as any, [
    'data:client:created', 'data:client:updated', 'data:client:status_changed',
    'data:notification:new', 'data:metrics:updated',
  ]);

  const perf        = (data as any).performance?.data || (data as any).performance || {};
  const clients     = (data as any).clients?.data     || (data as any).clients     || [];
  const commissions = (data as any).commissions?.data || (data as any).commissions || [];
  const training    = (data as any).training?.data    || (data as any).training    || [];
  const notifs      = (data as any).notifications?.data || (data as any).notifications || [];

  const nav = NAV;

  const handleLogout = () => { logout(); navigate('/login'); };
  const portalUser = { name: user?.name || 'Agent', email: user?.email || 'agent@tst.com', role: 'Sales Agent' };

  return (
    <PortalLayout theme={theme} user={portalUser} navItems={nav} activeSection={section} onSectionChange={setSection} onLogout={handleLogout} notifications={notifs} onNotificationRead={async (id) => { try { const { apiClient } = await import('../../shared/api/apiClient'); await apiClient.patch(`/api/v1/notifications/${id}/read`); refetch(['notifications']); } catch { /* silent */ } }} faqs={AGENTS_FAQS} portalName="Agents Portal">

      {section === 'overview' && (
        <div>
          <SectionHeader title="Agent Dashboard" subtitle="Your performance metrics and activity" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="KPI Score"         value={(perf as any).kpiScore != null ? `${(perf as any).kpiScore}%` : '—'}                          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>} color={theme.hex} />
            <StatCard label="My Clients"        value={(perf as any).totalClients ?? (Array.isArray(clients) ? clients.length : '—')} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} color={theme.hex} />
            <StatCard label="Closed Won"      value={(perf as any).closedDeals ?? (Array.isArray(clients) ? clients.filter((c: any) => c.status === 'CLOSED_WON').length : '—')}                             icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>} color={theme.hex} />
            <StatCard label="Commissions (KSh)" value={(perf as any).totalCommissions != null ? Number((perf as any).totalCommissions).toLocaleString() : '—'}  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} color={theme.hex} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl p-5" style={cardStyle}>
              <h3 className="font-semibold text-gray-800 mb-4">Performance Metrics</h3>
              {[
                { label: 'Training Progress',   value: (perf as any).trainingProgress },
                { label: 'Closed Deal Rate', value: (() => { const total = (perf as any).totalClients ?? clients.length; const closed = (perf as any).closedDeals ?? clients.filter((c: any) => c.status === 'CLOSED_WON').length; return total > 0 ? Math.round((closed / total) * 100) : null; })() },
                { label: 'Client Satisfaction', value: (perf as any).clientSatisfaction },
              ].map((m) => (
                <div key={m.label} className="mb-4 last:mb-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">{m.label}</span>
                    <span className="text-sm font-semibold" style={{ color: theme.hex }}>{m.value != null ? `${m.value}%` : '—'}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${m.value ?? 0}%`, backgroundColor: theme.hex }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl p-5" style={cardStyle}>
              <h3 className="font-semibold text-gray-800 mb-4">Recent Clients</h3>
              {(Array.isArray(clients) ? clients : []).slice(0, 5).map((c: any, i: number) => (
                <div key={c.id || i} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.location || c.town}</p>
                  </div>
                  {/* Revenue data intentionally excluded — visible only to CEO, CFO, CoS */}
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">
                    {clientStatusLabel(c.status || 'LEAD')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Always mounted — hidden when not active — preserves wizard state across nav */}
      <div style={{ display: section === 'capture' ? 'block' : 'none' }} className="pb-20">
        <SectionHeader title="Capture New Client" subtitle="Register a new client — 3-step wizard" />
        <CaptureWizard themeHex={theme.hex} onClientSaved={() => refetch(['clients'])} />
      </div>

      {section === 'clients' && (
        <ClientsSection
          clients={Array.isArray(clients) ? clients : []}
          themeHex={theme.hex}
          refetch={() => refetch(['clients'])}
          setSection={setSection}
        />
      )}

      {/* LEAD STATUS TRACKER — doc §6: per-client real-time status tracker */}
      {section === 'lead-status' && (
        <div>
          <SectionHeader title="Lead Status Tracker" subtitle="Real-time status for each of your clients" />
          {/* Pipeline summary */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
            {Object.entries(STATUS_LABELS).map(([key, label]) => {
              const count = (Array.isArray(clients) ? clients : []).filter((c: any) => c.status === key).length;
              return (
                <div key={key} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </div>
              );
            })}
          </div>
          {/* Per-client status list */}
          <div className="space-y-3">
            {(Array.isArray(clients) ? clients : []).map((c: any, i: number) => {
              const statusOrder = ['NEW_LEAD', 'CONVERTED', 'LEAD_ACTIVATED', 'LEAD_QUALIFIED', 'NEGOTIATION', 'CLOSED_WON'];
              const currentIdx = statusOrder.indexOf(c.status || 'NEW_LEAD');
              return (
                <div key={c.id || i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-800">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.phone} · {c.location || c.town || '—'}</p>
                    </div>
                    <span className="text-xs px-3 py-1 rounded-full font-medium text-white" style={{ backgroundColor: theme.hex }}>
                      {clientStatusLabel(c.status || 'NEW_LEAD')}
                    </span>
                  </div>
                  {/* Progress bar through lifecycle */}
                  <div className="flex items-center gap-1">
                    {statusOrder.map((s, idx) => (
                      <div key={s} className="flex-1 flex flex-col items-center gap-1">
                        <div className={`w-full h-1.5 rounded-full ${idx <= currentIdx ? '' : 'bg-gray-100'}`}
                          style={idx <= currentIdx ? { backgroundColor: theme.hex } : {}} />
                        <span className="text-xs text-gray-400 hidden lg:block" style={{ fontSize: '9px' }}>
                          {STATUS_LABELS[s]}
                        </span>
                      </div>
                    ))}
                  </div>
                  {c.paymentStatus && (
                    <p className="text-xs text-gray-400 mt-2">Payment: <StatusBadge status={c.paymentStatus} /></p>
                  )}
                </div>
              );
            })}
            {!(Array.isArray(clients) && clients.length) && (
              <p className="text-sm text-gray-400 text-center py-8">No clients yet — add your first client to start tracking</p>
            )}
          </div>
        </div>
      )}

      {section === 'commissions' && (
        <div>
          <SectionHeader title="My Commissions" subtitle="Earned and pending commission payments" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard label="Total Earned (KSh)"  value={(perf as any).totalCommissions ? (perf as any).totalCommissions.toLocaleString() : '—'}  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} color={theme.hex} />
            <StatCard label="Pending (KSh)"        value={(perf as any).pendingCommissions ? (perf as any).pendingCommissions.toLocaleString() : '—'} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} color={theme.hex} />
            <StatCard label="This Month (KSh)"     value={commissions.filter((c: any) => { const d = new Date(c.createdAt || 0); const n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); }).reduce((s: number, c: any) => s + (c.amount || 0), 0).toLocaleString() || '—'} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} color={theme.hex} />
          </div>
          <DataTable
            columns={[
              { key: 'clientName',     label: 'Client' },
              { key: 'amount',         label: 'Amount (KSh)', render: (v) => Number(v || 0).toLocaleString() },
              { key: 'commissionRate', label: 'Rate',         render: (v) => v ? `${v}%` : '—' },
              { key: 'status',         label: 'Status',       render: (v) => <StatusBadge status={v || 'PENDING'} /> },
              { key: 'paidAt',         label: 'Paid',         render: (v) => v ? new Date(v).toLocaleDateString() : '—' },
            ]}
            rows={Array.isArray(commissions) ? commissions : []}
            emptyMessage="No commissions yet — commissions are earned when a deal is closed"
          />
        </div>
      )}

      {section === 'communications' && (
        <div>
          <SectionHeader title="Log Communication" subtitle="Record a client interaction" />
          <CommunicationForm themeHex={theme.hex} />
        </div>
      )}

      {section === 'daily-report' && (
        <div>
          <SectionHeader title="Daily Report" subtitle="Submit your end-of-day report" />
          <DailyReportForm themeHex={theme.hex} />
        </div>
      )}

      {section === 'training' && (
        <div>
          <SectionHeader title="My Training" subtitle="Assigned courses and completion status" />
          <div className="space-y-4">
            {(Array.isArray(training) && training.length > 0) ? training.map((t: any, i: number) => (
              <div key={t.id || i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-xl"
                  style={{ backgroundColor: theme.hex }}>📚</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-semibold text-gray-800">{t.courseTitle || t.courseName || `Course ${i + 1}`}</h4>
                    <StatusBadge status={(t.status || 'NOT_STARTED').toUpperCase().replace(/-/g, '_')} />
                  </div>
                  {t.description && <p className="text-xs text-gray-400 mb-1">{t.description}</p>}
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
                    <div className="h-full rounded-full transition-all" style={{ width: `${t.progress || 0}%`, backgroundColor: theme.hex }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{t.progress || 0}% complete{t.dueDate ? ` · Due ${new Date(t.dueDate).toLocaleDateString()}` : ''}</p>
                </div>
                <PortalButton size="sm" color={theme.hex}>
                  {t.status === 'COMPLETED' ? 'Review' : 'Continue'}
                </PortalButton>
              </div>
            )) : (
              <p className="text-sm text-gray-400 text-center py-10">No training courses assigned yet — your trainer will assign courses to you.</p>
            )}
          </div>
        </div>
      )}

      {/* doc §18: Agents have no chat — section intentionally omitted */}
    </PortalLayout>
  );
}
