/**
 * Shared contract generator form — used by CEO and EA portals.
 * Accepts projects, clients, teams lists for dropdowns.
 */
import React, { useState } from 'react';
import { apiClient } from '../../api/apiClient';

const TYPES = [
  { v: 'CLIENT_SYSTEM',      l: 'Software Services' },
  { v: 'CLIENT_PLOTCONNECT', l: 'TST PlotConnect' },
  { v: 'DEVELOPER',          l: 'Developer / Team' },
];
const INDUSTRIES = ['SCHOOLS','CHURCHES','HOTELS','HOSPITALS','COMPANIES','REAL_ESTATE','SHOPS'];
const CURRENCIES = ['KES','UGX','TZS','RWF','ETB','GHS','NGN','ZAR','USD','EUR','GBP'];
const PLANS = ['Full Payment','50% Deposit + 50% on Delivery','Milestone Plan (40-20-20-20)'];
const TIERS = ['Top Placement','Medium Placement','Basic Placement'];

const BLANK = {
  contractType: 'CLIENT_SYSTEM',
  projectId: '',
  clientName: '', clientEmail: '', clientPhone: '',
  clientAddress: '', clientIdNumber: '', clientOrganization: '',
  serviceDescription: '', industryCategory: '',
  startDate: '', deliveryDate: '',
  propertyName: '', propertyLocation: '', placementTier: '',
  developerTeamId: '', developerTeam: '', assignedProject: '',
  serviceAmount: '', currency: 'KES', paymentPlan: 'Full Payment',
  commitmentAmount: '', transactionId: '', paymentDate: '',
};

interface Props {
  projects: any[];
  clients: any[];
  teams: any[];
  accentColor?: string;
  onGenerated?: (contract: any, pdfUrl: string) => void;
}

export function ContractGeneratorForm({ projects, clients, teams, accentColor = '#2563eb', onGenerated }: Props) {
  const [form, setForm] = useState(BLANK);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dlUrl, setDlUrl] = useState('');

  const set = (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const autoFillClient = (clientId: string) => {
    const c = clients.find((x: any) => x.id === clientId);
    if (!c) return;
    setForm(f => ({
      ...f,
      clientName:         c.name               || f.clientName,
      clientEmail:        c.email              || f.clientEmail,
      clientPhone:        c.phone              || f.clientPhone,
      clientAddress:      c.country            || f.clientAddress,
      clientOrganization: c.organizationName   || f.clientOrganization,
      serviceDescription: c.serviceDescription || f.serviceDescription,
      industryCategory:   c.industryCategory   || f.industryCategory,
      serviceAmount:      c.estimatedValue ? String(c.estimatedValue) : f.serviceAmount,
    }));
  };

  const autoFillTeam = async (teamId: string) => {
    const team = teams.find((t: any) => t.id === teamId);
    if (!team) { setTeamMembers([]); return; }
    setForm(f => ({ ...f, developerTeamId: teamId, developerTeam: team.name, clientOrganization: 'TechSwiftTrix' }));
    try {
      const res = await apiClient.get(`/api/v1/organization/teams/${teamId}/members`);
      const members: any[] = Array.isArray((res.data as any)?.data) ? (res.data as any).data : [];
      setTeamMembers(members);
      const leader = members.find((m: any) => m.isTeamLeader) || members[0];
      if (leader) setForm(f => ({ ...f, clientName: leader.fullName || f.clientName, clientEmail: leader.email || f.clientEmail, clientAddress: leader.country || f.clientAddress }));
    } catch { setTeamMembers([]); }
  };

  const openDataUrl = (dataUrl: string) => {
    try {
      const [header, b64] = dataUrl.split(',');
      const mime = header.match(/:(.*?);/)?.[1] || 'application/pdf';
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });
      window.open(URL.createObjectURL(blob), '_blank');
    } catch { window.open(dataUrl, '_blank'); }
  };

  const download = (url: string) => {
    if (!url) return;
    if (url.startsWith('data:')) { openDataUrl(url); return; }
    window.open(url, '_blank');
  };

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientName.trim())         { setMsg('Client name is required.');         setOk(false); return; }
    if (!form.serviceDescription.trim()) { setMsg('Service description is required.'); setOk(false); return; }
    if (!form.serviceAmount)             { setMsg('Service amount is required.');       setOk(false); return; }
    setBusy(true); setMsg(''); setDlUrl('');
    try {
      const payload: Record<string, any> = {
        contractType:       form.contractType,
        clientName:         form.clientName.trim(),
        clientEmail:        form.clientEmail.trim()         || undefined,
        clientPhone:        form.clientPhone.trim()         || undefined,
        clientAddress:      form.clientAddress.trim()       || undefined,
        clientIdNumber:     form.clientIdNumber.trim()      || undefined,
        clientOrganization: form.clientOrganization.trim()  || undefined,
        serviceDescription: form.serviceDescription.trim(),
        industryCategory:   form.industryCategory           || undefined,
        serviceAmount:      parseFloat(form.serviceAmount),
        currency:           form.currency,
        paymentPlan:        form.paymentPlan,
        commitmentAmount:   form.commitmentAmount ? parseFloat(form.commitmentAmount) : undefined,
        transactionId:      form.transactionId.trim()   || undefined,
        paymentDate:        form.paymentDate            || undefined,
        startDate:          form.startDate              || undefined,
        deliveryDate:       form.deliveryDate           || undefined,
        propertyName:       form.propertyName.trim()    || undefined,
        propertyLocation:   form.propertyLocation.trim()|| undefined,
        placementTier:      form.placementTier          || undefined,
        developerTeam:      form.developerTeam.trim()   || undefined,
        assignedProject:    form.assignedProject.trim() || undefined,
      };
      if (form.projectId) payload.projectId = form.projectId;

      const res = await apiClient.post('/api/v1/contracts/generate-direct', payload);
      const d = res.data as any;
      const url = d.pdfDataUrl || d.pdfUrl || '';
      setMsg(`Contract ${d.referenceNumber} generated successfully!`);
      setOk(true);
      setDlUrl(url);
      setForm(BLANK);
      setTeamMembers([]);
      onGenerated?.(d, url);
    } catch (err: any) {
      setMsg(err?.response?.data?.error || 'Failed to generate contract.');
      setOk(false);
    } finally { setBusy(false); }
  };

  return (
    <div>
      <style>{`
        .cf-input{width:100%;padding:11px 14px;border-radius:10px;border:1.5px solid #e2e8f0;font-size:14px;color:#0f172a;background:#fff;transition:border-color .15s,box-shadow .15s;outline:none;box-sizing:border-box;}
        .cf-input:focus{border-color:${accentColor};box-shadow:0 0 0 3px ${accentColor}22;}
        .cf-input::placeholder{color:#94a3b8;}
        .cf-label{display:block;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;}
        .cf-section{border-radius:16px;border:1.5px solid #e2e8f0;overflow:hidden;margin-bottom:20px;}
        .cf-section-head{display:flex;align-items:center;gap:12px;padding:14px 20px;border-bottom:1.5px solid #e2e8f0;}
        .cf-section-body{padding:20px;}
        .cf-grid{display:grid;gap:16px;}
        .cf-grid-2{grid-template-columns:1fr 1fr;}
        .cf-grid-3{grid-template-columns:1fr 1fr 1fr;}
        @media(max-width:768px){.cf-grid-2,.cf-grid-3{grid-template-columns:1fr;}}
        .cf-hint{font-size:11px;color:#94a3b8;margin-top:5px;}
        .cf-req{color:#ef4444;margin-left:2px;}
      `}</style>

      {msg && (
        <div className={`flex items-center gap-3 text-sm px-4 py-3.5 rounded-2xl mb-6 ${ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-white ${ok ? 'bg-green-500' : 'bg-red-500'}`}>
            {ok
              ? <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
              : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>
            }
          </span>
          <span className="flex-1 font-medium">{msg}</span>
          {ok && dlUrl && (
            <button type="button" onClick={() => download(dlUrl)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-600 text-white border-none cursor-pointer hover:bg-green-700 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              Download PDF
            </button>
          )}
        </div>
      )}

      <form onSubmit={generate}>
        {/* Step 1 — Contract Type */}
        <div className="cf-section">
          <div className="cf-section-head" style={{ background:'#eff6ff' }}>
            <span style={{ width:28,height:28,borderRadius:'50%',background:'#2563eb',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,flexShrink:0 }}>1</span>
            <div>
              <p style={{ margin:0,fontSize:14,fontWeight:700,color:'#1e3a5f' }}>Contract Type</p>
              <p style={{ margin:0,fontSize:11,color:'#64748b' }}>Choose the type and optionally link to an existing client</p>
            </div>
          </div>
          <div className="cf-section-body">
            <div className="cf-grid" style={{ marginBottom:16 }}>
              <div>
                <label className="cf-label">Select Contract Type <span className="cf-req">*</span></label>
                <select value={form.contractType} onChange={e => setForm(f => ({ ...f, contractType: e.target.value }))} className="cf-input">
                  {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
                <p className="cf-hint">
                  {form.contractType==='CLIENT_SYSTEM'&&'Software system clients — service scope, payment plan and T&Cs.'}
                  {form.contractType==='CLIENT_PLOTCONNECT'&&'TST PlotConnect property listings — placement tier and listing terms.'}
                  {form.contractType==='DEVELOPER'&&'Internal developer teams — team members, project scope and deliverables.'}
                </p>
              </div>
            </div>
            <div className="cf-grid cf-grid-2">
              <div>
                <label className="cf-label">Link to Project <span style={{ color:'#94a3b8',fontWeight:400,textTransform:'none',fontSize:11 }}>(optional)</span></label>
                <select value={form.projectId} onChange={set('projectId')} className="cf-input">
                  <option value="">— Manual entry —</option>
                  {projects.map((p: any) => <option key={p.id} value={p.id}>{[p.referenceNumber || p.id, p.clientName, p.serviceAmount ? `KSh ${Number(p.serviceAmount).toLocaleString()}` : null].filter(Boolean).join(' · ')}</option>)}
                </select>
              </div>
              <div>
                <label className="cf-label">Auto-fill from Existing Client</label>
                <select onChange={e => autoFillClient(e.target.value)} defaultValue="" className="cf-input">
                  <option value="">— {clients.length} clients available —</option>
                  {clients.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}{c.phone?` · ${c.phone}`:''}{c.agentName?` (${c.agentName})`:''}</option>
                  ))}
                </select>
                <p className="cf-hint">Selecting a client auto-fills the fields below</p>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2 — Party Details */}
        <div className="cf-section">
          <div className="cf-section-head" style={{ background:'#f0fdf4' }}>
            <span style={{ width:28,height:28,borderRadius:'50%',background:'#16a34a',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,flexShrink:0 }}>2</span>
            <div>
              <p style={{ margin:0,fontSize:14,fontWeight:700,color:'#14532d' }}>{form.contractType==='DEVELOPER'?'Developer / Team Details':'Client Details'}</p>
              <p style={{ margin:0,fontSize:11,color:'#64748b' }}>Legal name and contact information for the contract</p>
            </div>
          </div>
          <div className="cf-section-body">
            <div className="cf-grid cf-grid-2">
              <div><label className="cf-label">Full Name <span className="cf-req">*</span></label><input required value={form.clientName} onChange={set('clientName')} className="cf-input" placeholder="Full legal name as it appears on ID" /></div>
              <div><label className="cf-label">Organization / Company</label><input value={form.clientOrganization} onChange={set('clientOrganization')} className="cf-input" placeholder="Company or organization name" /></div>
              <div><label className="cf-label">Email Address</label><input type="email" value={form.clientEmail} onChange={set('clientEmail')} className="cf-input" placeholder="email@example.com" /></div>
              <div><label className="cf-label">Phone Number</label><input type="tel" value={form.clientPhone} onChange={set('clientPhone')} className="cf-input" placeholder="+254 7XX XXX XXX" /></div>
              <div><label className="cf-label">Address / Location</label><input value={form.clientAddress} onChange={set('clientAddress')} className="cf-input" placeholder="City, Country" /></div>
              <div><label className="cf-label">ID / Registration Number</label><input value={form.clientIdNumber} onChange={set('clientIdNumber')} className="cf-input" placeholder="National ID or Company Reg. No." /></div>
            </div>
          </div>
        </div>

        {/* Step 3 — Service Details */}
        <div className="cf-section">
          <div className="cf-section-head" style={{ background:'#fffbeb' }}>
            <span style={{ width:28,height:28,borderRadius:'50%',background:'#d97706',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,flexShrink:0 }}>3</span>
            <div>
              <p style={{ margin:0,fontSize:14,fontWeight:700,color:'#78350f' }}>Service / Project Details</p>
              <p style={{ margin:0,fontSize:11,color:'#64748b' }}>Describe what is being delivered and the timeline</p>
            </div>
          </div>
          <div className="cf-section-body">
            <div className="cf-grid" style={{ marginBottom:16 }}>
              <div>
                <label className="cf-label">Service Description <span className="cf-req">*</span></label>
                <textarea required rows={4} value={form.serviceDescription} onChange={set('serviceDescription')}
                  className="cf-input" style={{ resize:'vertical',minHeight:100 }}
                  placeholder="Describe the service or project in detail…" />
              </div>
            </div>
            <div className="cf-grid cf-grid-3">
              <div>
                <label className="cf-label">Industry Category</label>
                <select value={form.industryCategory} onChange={set('industryCategory')} className="cf-input">
                  <option value="">— Select industry —</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i.replace(/_/g,' ')}</option>)}
                </select>
              </div>
              <div><label className="cf-label">Start Date</label><input type="date" value={form.startDate} onChange={set('startDate')} className="cf-input" /></div>
              <div><label className="cf-label">Expected Delivery Date</label><input type="date" value={form.deliveryDate} onChange={set('deliveryDate')} className="cf-input" /></div>
            </div>
            {form.contractType==='CLIENT_PLOTCONNECT' && (
              <div className="cf-grid cf-grid-3" style={{ marginTop:16,paddingTop:16,borderTop:'1px dashed #e2e8f0' }}>
                <div><label className="cf-label">Property Name</label><input value={form.propertyName} onChange={set('propertyName')} className="cf-input" placeholder="Property name" /></div>
                <div><label className="cf-label">Property Location</label><input value={form.propertyLocation} onChange={set('propertyLocation')} className="cf-input" placeholder="County / Town / Area" /></div>
                <div>
                  <label className="cf-label">Placement Tier</label>
                  <select value={form.placementTier} onChange={set('placementTier')} className="cf-input">
                    <option value="">— Select tier —</option>
                    {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            )}
            {form.contractType==='DEVELOPER' && (
              <div style={{ marginTop:16,paddingTop:16,borderTop:'1px dashed #e2e8f0' }}>
                <div className="cf-grid cf-grid-2">
                  <div>
                    <label className="cf-label">Developer Team</label>
                    <select value={form.developerTeamId} onChange={e => autoFillTeam(e.target.value)} className="cf-input">
                      <option value="">— Select team —</option>
                      {teams.map((t: any) => (
                        <option key={t.id} value={t.id}>{t.name}{t.leaderName?` · Lead: ${t.leaderName}`:''}{t.memberCount?` (${t.memberCount})`:''}</option>
                      ))}
                    </select>
                  </div>
                  <div><label className="cf-label">Assigned Project</label><input value={form.assignedProject} onChange={set('assignedProject')} className="cf-input" placeholder="Project name or reference" /></div>
                </div>
                {teamMembers.length > 0 && (
                  <div style={{ marginTop:12 }}>
                    <label className="cf-label">Team Members</label>
                    <div style={{ display:'flex',flexWrap:'wrap',gap:8,marginTop:6 }}>
                      {teamMembers.map((m: any) => (
                        <span key={m.id} style={{ display:'inline-flex',alignItems:'center',gap:6,padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:600,background:m.isTeamLeader?'#eff6ff':'#f8fafc',color:m.isTeamLeader?'#1d4ed8':'#475569',border:`1px solid ${m.isTeamLeader?'#bfdbfe':'#e2e8f0'}` }}>
                          {m.isTeamLeader&&<span style={{ width:6,height:6,borderRadius:'50%',background:'#2563eb',display:'inline-block' }}/>}
                          {m.fullName}{m.isTeamLeader?' · Lead':''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Step 4 — Financial Terms */}
        <div className="cf-section">
          <div className="cf-section-head" style={{ background:'#f5f3ff' }}>
            <span style={{ width:28,height:28,borderRadius:'50%',background:'#7c3aed',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,flexShrink:0 }}>4</span>
            <div>
              <p style={{ margin:0,fontSize:14,fontWeight:700,color:'#3b0764' }}>Financial Terms</p>
              <p style={{ margin:0,fontSize:11,color:'#64748b' }}>Service amount, payment plan and transaction details</p>
            </div>
          </div>
          <div className="cf-section-body">
            <div className="cf-grid cf-grid-3" style={{ marginBottom:16 }}>
              <div><label className="cf-label">Total Service Amount <span className="cf-req">*</span></label><input required type="number" min={0} step="0.01" value={form.serviceAmount} onChange={set('serviceAmount')} className="cf-input" placeholder="0.00" /></div>
              <div>
                <label className="cf-label">Currency</label>
                <select value={form.currency} onChange={set('currency')} className="cf-input">
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="cf-label">Payment Plan</label>
                <select value={form.paymentPlan} onChange={set('paymentPlan')} className="cf-input">
                  {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="cf-grid cf-grid-3">
              <div>
                <label className="cf-label">Commitment Amount Paid</label>
                <input type="number" min={0} step="0.01" value={form.commitmentAmount} onChange={set('commitmentAmount')} className="cf-input" placeholder="0.00" />
                <p className="cf-hint">Leave blank if not yet paid</p>
              </div>
              <div><label className="cf-label">Daraja Transaction ID (M-Pesa)</label><input value={form.transactionId} onChange={set('transactionId')} className="cf-input" placeholder="TXN-2026-XXXXXXXX" /></div>
              <div><label className="cf-label">Payment Date</label><input type="date" value={form.paymentDate} onChange={set('paymentDate')} className="cf-input" /></div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div style={{ display:'flex',alignItems:'center',gap:16,padding:'20px',background:'#f8fafc',borderRadius:16,border:'1.5px solid #e2e8f0' }}>
          <button type="submit" disabled={busy}
            style={{ display:'flex',alignItems:'center',gap:8,padding:'13px 28px',borderRadius:12,border:'none',background:busy?'#94a3b8':accentColor,color:'#fff',fontSize:14,fontWeight:700,cursor:busy?'not-allowed':'pointer',transition:'background .15s',flexShrink:0 }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            {busy ? 'Generating PDF…' : 'Generate Contract PDF'}
          </button>
          <div>
            <p style={{ margin:0,fontSize:13,fontWeight:600,color:'#374151' }}>Ready to generate</p>
            <p style={{ margin:0,fontSize:11,color:'#94a3b8' }}>PDF includes company logo, full T&Cs and signature blocks</p>
          </div>
        </div>
      </form>
    </div>
  );
}
