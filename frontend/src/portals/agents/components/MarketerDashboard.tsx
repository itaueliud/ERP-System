/**
 * MarketerDashboard — TST PlotConnect section inside the Agent Portal
 * Implements Tabs 2–5 from the Agent portal spec:
 *   Tab 2 — Add Property (default landing)
 *   Tab 3 — My Properties
 *   Tab 4 — Map View
 *   Tab 5 — M-Pesa Messages
 *
 * Doc: Agent Portal spec — Sections TAB 2, TAB 3, TAB 4, TAB 5, SECTION 14
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PortalButton, StatusBadge, SectionHeader } from '../../../shared/components/layout/PortalLayout';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface MarketerProperty {
  id: string;
  ownerName: string;
  ownerPhone: string;
  ownerPhone2?: string;
  ownerWhatsapp?: string;
  propertyName: string;
  county: string;
  area: string;
  mapLink?: string;
  bookingType: 'MONTHLY' | 'DAILY' | 'BOTH';
  propertyTypes: string[];
  rooms: RoomRow[];
  package: 'BASIC' | 'STANDARD' | 'ADVANCED';
  // Section 14: Student Single Rooms use a separate package pricing path
  isStudentType?: boolean;
  contactPerson?: string;
  description?: string;
  websiteLink?: string;
  numberOfRooms?: string;
  pricePerRoom?: string;
  status: string;
  paymentStatus: 'PAID' | 'AWAITING_CONFIRMATION' | 'FAILED' | 'UNPAID';
  paymentConfirmedAt?: string;
  images?: string[];
  createdAt: string;
  updatedAt?: string;
}

interface RoomRow {
  type: string;
  price: string;
  availability: string;
  selected: boolean;
}

interface MpesaMessage {
  id: string;
  message: string;
  status: string;
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
// All 47 Kenya counties
const COUNTIES = [
  'Baringo','Bomet','Bungoma','Busia','Elgeyo Marakwet','Embu','Garissa',
  'Homa Bay','Isiolo','Kajiado','Kakamega','Kericho','Kiambu','Kilifi',
  'Kirinyaga','Kisii','Kisumu','Kitui','Kwale','Laikipia','Lamu','Machakos',
  'Makueni','Mandera','Marsabit','Meru','Migori','Mombasa',"Murang'a",
  'Nairobi','Nakuru','Nandi','Narok','Nyamira','Nyandarua','Nyeri','Samburu',
  'Siaya','Taita Taveta','Tana River','Tharaka Nithi','Trans Nzoia','Turkana',
  'Uasin Gishu','Vihiga','Wajir','West Pokot',
];

// Section C — Property Type Selection (doc Tab 2 §C)
const PROPERTY_TYPES = [
  { key: 'RENTAL_ROOMS',   label: 'Rental Rooms',         note: 'Standard rental room option' },
  { key: 'STUDENT_SINGLE', label: 'Student Single Rooms', note: 'Activates student pricing path', isStudent: true },
  { key: 'HOSTEL',         label: 'Hostel',               note: 'Shared accommodation' },
  { key: 'APARTMENTS',     label: 'Apartments',           note: 'Self-contained living units' },
  { key: 'LODGE',          label: 'Lodge / Guest Rooms',  note: 'Temporary accommodation' },
  { key: 'SHORT_STAY',     label: 'Short Stay Rooms',     note: 'Daily or weekly stay' },
];

// Section D — Room rows, driven by property type selection (doc Tab 2 §D)
const ROOM_TYPE_MAP: { type: string; forTypes: string[] }[] = [
  { type: 'Rental Rooms',      forTypes: ['RENTAL_ROOMS'] },
  { type: 'Hostel',            forTypes: ['HOSTEL'] },
  { type: 'Apartments',        forTypes: ['APARTMENTS'] },
  { type: 'Lodge / Guest Rooms', forTypes: ['LODGE'] },
  { type: 'Short Stay Rooms',  forTypes: ['SHORT_STAY'] },
  { type: 'Single Rooms (Student)', forTypes: ['STUDENT_SINGLE'] },
  { type: 'Executive Room',    forTypes: ['RENTAL_ROOMS','LODGE','SHORT_STAY','HOSTEL','APARTMENTS'] },
  { type: 'Other',             forTypes: ['RENTAL_ROOMS','HOSTEL','APARTMENTS','LODGE','SHORT_STAY','STUDENT_SINGLE'] },
];

// Section E — Standard packages (doc Tab 2 §E)
// Note: amounts are editable by EA only — agents see live amounts, cannot edit
const STD_PACKAGES = [
  { key: 'BASIC',    label: 'Basic',    price: 4000,  desc: 'Starter visibility for the listing' },
  { key: 'STANDARD', label: 'Standard', price: 8000,  desc: 'More reach and additional features' },
  { key: 'ADVANCED', label: 'Advanced', price: 12000, desc: 'Top placement and highest priority visibility' },
];

// Doc Tab 3 — Payment status badges
const PAYMENT_META: Record<string, { label: string; cls: string; desc: string }> = {
  PAID: {
    label: 'Paid',
    cls: 'bg-green-100 text-green-800',
    desc: 'Payment received and confirmed — property is live on TST PlotConnect Properties.',
  },
  AWAITING_CONFIRMATION: {
    label: 'Awaiting Confirmation',
    cls: 'bg-amber-100 text-amber-800',
    desc: 'STK push sent — polling for result.',
  },
  FAILED: {
    label: 'Failed',
    cls: 'bg-red-100 text-red-700',
    desc: 'Payment initiated but transaction did not complete.',
  },
  UNPAID: {
    label: 'Unpaid',
    cls: 'bg-slate-100 text-slate-600',
    desc: 'No payment initiated yet.',
  },
};

const BOOKING_LABELS: Record<string, string> = {
  MONTHLY: 'Monthly Rental',
  DAILY:   'Daily Stay',
  BOTH:    'Monthly Rental & Daily Stay',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const inp = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all';
const lbl = 'block text-sm font-medium text-gray-700 mb-1.5';

function fieldErr(msg?: string) {
  return msg ? <p className="text-xs text-red-500 mt-1">{msg}</p> : null;
}

function errCls(hasErr?: string) {
  return hasErr ? 'border-red-400 ring-1 ring-red-300' : '';
}

// Doc Tab 3: colour-coded payment badge with optional pulse for awaiting
function PayBadge({ status, polling }: { status: string; polling?: boolean }) {
  const m = PAYMENT_META[status] || { label: status, cls: 'bg-slate-100 text-slate-600', desc: '' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold ${m.cls}`}>
      {polling && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
      {m.label}
    </span>
  );
}

// Doc Tab 2: tab counter card — active highlighted with theme border
function TabCard({ label, count, active, onClick, themeHex }: {
  id: string; label: string; count: number | null; active: boolean;
  onClick: () => void; themeHex: string;
}) {
  return (
    <button onClick={onClick}
      className={`flex-1 min-w-[130px] rounded-xl border-2 p-4 text-left transition-all cursor-pointer
        ${active ? 'bg-white shadow-sm' : 'border-transparent bg-slate-50 hover:bg-white hover:shadow-sm'}`}
      style={active ? { borderColor: themeHex } : {}}>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1" style={active ? { color: themeHex } : { color: '#64748b' }}>
        {count === null ? '—' : count}
      </p>
    </button>
  );
}

// Doc §3 / Section 14: compress images before upload
function compressImage(file: File, maxPx = 1280, quality = 0.82): Promise<Blob> {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width  = Math.round(img.width  * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => resolve(b || file), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

function visibleRooms(propTypes: string[]): RoomRow[] {
  return ROOM_TYPE_MAP
    .filter(r => r.forTypes.some(t => propTypes.includes(t)))
    .map(r => ({ type: r.type, price: '', availability: '', selected: false }));
}

// ─── TAB 2 — Add Property (doc Tab 2, Section 14) ────────────────────────────
// Default landing tab. Sections A–F.
function AddPropertyForm({ themeHex, onSuccess }: { themeHex: string; onSuccess: () => void }) {
  // Section A — Basic Info
  const [ownerName,   setOwnerName]   = useState('');
  const [ownerPhone,  setOwnerPhone]  = useState('');
  const [ownerPhone2, setOwnerPhone2] = useState('');
  const [ownerWa,     setOwnerWa]     = useState('');
  const [propName,    setPropName]    = useState('');
  // Section B — Location
  const [county,      setCounty]      = useState('');
  const [area,        setArea]        = useState('');
  const [mapLink,     setMapLink]     = useState('');
  const [bookingType, setBookingType] = useState<'MONTHLY'|'DAILY'|'BOTH'>('MONTHLY');
  const [images,      setImages]      = useState<File[]>([]);
  // Section C — Property Types
  const [propTypes,   setPropTypes]   = useState<string[]>([]);
  // Section D — Rooms table (auto-populated from propTypes)
  const [rooms,       setRooms]       = useState<RoomRow[]>([]);
  // Section 14 Type 2 extra fields
  const [contactPerson, setContactPerson] = useState('');
  const [description,   setDescription]   = useState('');
  const [websiteLink,   setWebsiteLink]   = useState('');
  // Section 14 Type 1 (Student) extra fields
  const [numberOfRooms, setNumberOfRooms] = useState('');
  const [pricePerRoom,  setPricePerRoom]  = useState('');
  // Section E — Package
  const [pkg, setPkg] = useState<'BASIC'|'STANDARD'|'ADVANCED'>('BASIC');
  // Packages loaded from API (EA-editable amounts)
  const [livePackages, setLivePackages] = useState(STD_PACKAGES);
  // Form state
  const [busy,   setBusy]   = useState(false);
  const [msg,    setMsg]    = useState('');
  const [ok,     setOk]     = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const hasStudent    = propTypes.includes('STUDENT_SINGLE');
  const hasOther      = propTypes.some(t => t !== 'STUDENT_SINGLE');

  // Load live package amounts from API (EA-editable, CEO-confirmed)
  useEffect(() => {
    (async () => {
      try {
        const { apiClient } = await import('../../../shared/api/apiClient');
        const res = await apiClient.get('/api/v1/marketer/packages');
        const pkgs = (res.data as any)?.data || (res.data as any)?.packages;
        if (Array.isArray(pkgs) && pkgs.length) setLivePackages(pkgs);
      } catch { /* use defaults */ }
    })();
  }, []);

  // Section D: room rows update when property types change
  useEffect(() => {
    setRooms(visibleRooms(propTypes));
  }, [propTypes.join(',')]); // eslint-disable-line

  const toggleType = (key: string) => {
    setPropTypes(p => p.includes(key) ? p.filter(x => x !== key) : [...p, key]);
    setErrors(e => { const n = { ...e }; delete n.propTypes; return n; });
  };

  const updateRoom = (i: number, field: keyof RoomRow, val: string | boolean) =>
    setRooms(r => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row));

  const handleImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 8);
    setImages(files);
    setErrors(er => { const n = { ...er }; delete n.images; return n; });
  };

  const clearForm = () => {
    setOwnerName(''); setOwnerPhone(''); setOwnerPhone2(''); setOwnerWa('');
    setPropName(''); setCounty(''); setArea(''); setMapLink('');
    setBookingType('MONTHLY'); setImages([]); setPropTypes([]); setRooms([]);
    setContactPerson(''); setDescription(''); setWebsiteLink('');
    setNumberOfRooms(''); setPricePerRoom('');
    setPkg('BASIC'); setMsg(''); setOk(false); setErrors({});
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    // Section F: validate all required fields before submit
    const errs: Record<string, string> = {};
    if (!ownerName.trim())      errs.ownerName  = 'Owner name is required.';
    if (!ownerPhone.trim())     errs.ownerPhone = 'Phone number is required.';
    if (!propName.trim())       errs.propName   = 'Property name is required.';
    if (!county)                errs.county     = 'County is required.';
    if (!area.trim())           errs.area       = 'Area is required.';
    if (propTypes.length === 0) errs.propTypes  = 'Select at least one property type.';
    if (hasStudent && !numberOfRooms.trim()) errs.numberOfRooms = 'Number of rooms is required for student type.';
    if (hasStudent && !pricePerRoom.trim())  errs.pricePerRoom  = 'Price per room is required for student type.';
    if (hasStudent && !contactPerson.trim()) errs.contactPerson = 'Contact person is required.';
    if (Object.keys(errs).length) {
      setErrors(errs);
      setMsg('Please fix the highlighted fields before submitting.');
      setOk(false);
      return;
    }

    setBusy(true); setMsg('');
    try {
      const { apiClient } = await import('../../../shared/api/apiClient');
      const selectedRooms = rooms.filter(r => r.selected);

      // Section 14: compress images before upload
      const formData = new FormData();
      formData.append('ownerName',     ownerName.trim());
      formData.append('ownerPhone',    ownerPhone.trim());
      formData.append('ownerPhone2',   ownerPhone2.trim());
      formData.append('ownerWhatsapp', ownerWa.trim());
      formData.append('propertyName',  propName.trim());
      formData.append('county',        county);
      formData.append('area',          area.trim());
      formData.append('mapLink',       mapLink.trim());
      formData.append('bookingType',   bookingType);
      formData.append('propertyTypes', JSON.stringify(propTypes));
      formData.append('rooms',         JSON.stringify(selectedRooms));
      formData.append('package',       pkg);
      formData.append('contactPerson', contactPerson.trim());
      formData.append('description',   description.trim());
      formData.append('websiteLink',   websiteLink.trim());
      formData.append('numberOfRooms', numberOfRooms.trim());
      formData.append('pricePerRoom',  pricePerRoom.trim());

      for (const file of images) {
        const compressed = await compressImage(file);
        formData.append('images', compressed, file.name.replace(/\.[^.]+$/, '.jpg'));
      }

      await apiClient.post('/api/v1/marketer/properties', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setOk(true);
      setMsg('✓ Property submitted successfully. It is now in the admin review queue. Complete payment from My Properties to go live.');
      clearForm();
      onSuccess();
    } catch (err: any) {
      setOk(false);
      setMsg(err?.response?.data?.error || err?.message || 'Failed to submit property.');
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl pb-10">
      {/* Section F intro — shown when Add Property tab is active */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
        <p className="text-sm font-semibold text-slate-700 mb-1">Submit New Property</p>
        <p className="text-sm text-slate-500">
          Use this form to submit a new property listing. All submissions go through admin review before going live.
          Fields marked <span className="text-red-500 font-semibold">*</span> are required.
        </p>
      </div>

      {msg && (
        <div className={`p-3 rounded-xl text-sm ${ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg}
        </div>
      )}

      {/* Section A — Basic Info */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">Section A — Basic Info</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Owner Name <span className="text-red-500">*</span></label>
            <input className={`${inp} ${errCls(errors.ownerName)}`} value={ownerName}
              onChange={e => setOwnerName(e.target.value)}
              onBlur={e => !e.target.value.trim() && setErrors(p => ({ ...p, ownerName: 'Required.' }))}
              placeholder="Full name" />
            {fieldErr(errors.ownerName)}
          </div>
          <div>
            <label className={lbl}>Phone Number (primary) <span className="text-red-500">*</span></label>
            <input className={`${inp} ${errCls(errors.ownerPhone)}`} value={ownerPhone}
              onChange={e => setOwnerPhone(e.target.value)}
              onBlur={e => !e.target.value.trim() && setErrors(p => ({ ...p, ownerPhone: 'Required.' }))}
              placeholder="07XXXXXXXX" />
            {fieldErr(errors.ownerPhone)}
          </div>
          <div>
            <label className={lbl}>Phone Number (secondary)</label>
            <input className={inp} value={ownerPhone2} onChange={e => setOwnerPhone2(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label className={lbl}>WhatsApp Number</label>
            <input className={inp} value={ownerWa} onChange={e => setOwnerWa(e.target.value)} placeholder="07XXXXXXXX" />
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>Property Name <span className="text-red-500">*</span></label>
            <input className={`${inp} ${errCls(errors.propName)}`} value={propName}
              onChange={e => setPropName(e.target.value)}
              onBlur={e => !e.target.value.trim() && setErrors(p => ({ ...p, propName: 'Required.' }))}
              placeholder="e.g. Sunrise Apartments" />
            {fieldErr(errors.propName)}
          </div>
        </div>
      </div>

      {/* Section B — Location Details */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">Section B — Location Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={lbl}>County <span className="text-red-500">*</span></label>
            <select className={`${inp} ${errCls(errors.county)}`} value={county}
              onChange={e => { setCounty(e.target.value); setErrors(p => { const n = { ...p }; delete n.county; return n; }); }}>
              <option value="">Select county…</option>
              {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {fieldErr(errors.county)}
          </div>
          <div>
            <label className={lbl}>Area / Neighbourhood <span className="text-red-500">*</span></label>
            <input className={`${inp} ${errCls(errors.area)}`} value={area}
              onChange={e => setArea(e.target.value)}
              onBlur={e => !e.target.value.trim() && setErrors(p => ({ ...p, area: 'Required.' }))}
              placeholder="e.g. Westlands, Kilimani" />
            {fieldErr(errors.area)}
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>Property Map Link</label>
            <input className={inp} value={mapLink} onChange={e => setMapLink(e.target.value)}
              placeholder="Paste a Google Maps or OpenStreetMap link (optional)" />
            <p className="text-xs text-slate-400 mt-1">
              Supports Google Maps and OpenStreetMap links. Geocoding fallback applied for non-coordinate links.
            </p>
          </div>
        </div>

        {/* Images — up to 8, compressed before submission */}
        <div>
          <label className={lbl}>Property Images (up to 8)</label>
          <input type="file" accept="image/*" multiple onChange={handleImages}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer" />
          {images.length > 0 && (
            <p className="text-xs text-slate-500 mt-1">
              {images.length} file(s) selected — images will be compressed before upload.
            </p>
          )}
          {fieldErr(errors.images)}
        </div>

        {/* Booking Type */}
        <div>
          <label className={lbl}>Booking Type <span className="text-red-500">*</span></label>
          <div className="flex gap-5 flex-wrap">
            {(['MONTHLY','DAILY','BOTH'] as const).map(bt => (
              <label key={bt} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                <input type="radio" name="bookingType" value={bt} checked={bookingType === bt}
                  onChange={() => setBookingType(bt)} style={{ accentColor: themeHex }} />
                {BOOKING_LABELS[bt]}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Section C — Property Type Selection */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">Section C — Property Type</h3>
          <p className="text-xs text-slate-400 mt-1">
            Select all that apply. At least one must be selected. Your selection determines which room types appear below.
          </p>
        </div>
        {fieldErr(errors.propTypes)}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PROPERTY_TYPES.map(pt => (
            <label key={pt.key}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all
                ${propTypes.includes(pt.key) ? 'border-current bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}
              style={propTypes.includes(pt.key) ? { borderColor: themeHex + '80' } : {}}>
              <input type="checkbox" checked={propTypes.includes(pt.key)}
                onChange={() => toggleType(pt.key)}
                style={{ accentColor: themeHex }} className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-800">{pt.label}</p>
                <p className="text-xs text-slate-400">{pt.note}</p>
                {pt.isStudent && (
                  <span className="inline-block mt-1 text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                    Student pricing path
                  </span>
                )}
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Section 14 Type 1 — Student Single Rooms extra fields */}
      {hasStudent && (
        <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-indigo-800 text-sm uppercase tracking-wide">Student Single Rooms — Details</h3>
            <p className="text-xs text-indigo-600 mt-1">
              Student Single Rooms use a separate package pricing path. Amounts are configured by EA.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Number of Rooms <span className="text-red-500">*</span></label>
              <input className={`${inp} ${errCls(errors.numberOfRooms)}`} type="number" min="1"
                value={numberOfRooms} onChange={e => setNumberOfRooms(e.target.value)} placeholder="e.g. 20" />
              {fieldErr(errors.numberOfRooms)}
            </div>
            <div>
              <label className={lbl}>Price per Room (KSh) <span className="text-red-500">*</span></label>
              <input className={`${inp} ${errCls(errors.pricePerRoom)}`} type="number" min="0"
                value={pricePerRoom} onChange={e => setPricePerRoom(e.target.value)} placeholder="e.g. 3500" />
              {fieldErr(errors.pricePerRoom)}
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Contact Person <span className="text-red-500">*</span></label>
              <input className={`${inp} ${errCls(errors.contactPerson)}`}
                value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="Name of contact person" />
              {fieldErr(errors.contactPerson)}
            </div>
          </div>
        </div>
      )}

      {/* Section 14 Type 2 — Other property types extra fields */}
      {hasOther && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">Additional Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!hasStudent && (
              <div className="sm:col-span-2">
                <label className={lbl}>Contact Person</label>
                <input className={inp} value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="Name of contact person" />
              </div>
            )}
            <div className="sm:col-span-2">
              <label className={lbl}>Description</label>
              <textarea className={`${inp} resize-none`} rows={3}
                value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Brief description of the property…" />
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Website Link</label>
              <input className={inp} value={websiteLink} onChange={e => setWebsiteLink(e.target.value)}
                placeholder="https://… (if available)" />
            </div>
          </div>
        </div>
      )}

      {/* Section D — Rooms Table */}
      {propTypes.length > 0 && rooms.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <div>
            <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">Section D — Rooms Table</h3>
            <p className="text-xs text-slate-400 mt-1">Tick the checkbox to include a room type. Enter price and typical availability.</p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase">Select</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase">Room Type</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase">Price (KSh)</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase">Typical Availability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rooms.map((row, i) => (
                  <tr key={row.type} className={row.selected ? 'bg-blue-50/40' : 'hover:bg-slate-50'}>
                    <td className="px-3 py-2.5">
                      <input type="checkbox" checked={row.selected}
                        onChange={e => updateRoom(i, 'selected', e.target.checked)}
                        style={{ accentColor: themeHex }} />
                    </td>
                    <td className="px-3 py-2.5 text-slate-700 font-medium whitespace-nowrap">{row.type}</td>
                    <td className="px-3 py-2.5">
                      <input type="number" min="0"
                        className="w-28 px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 disabled:bg-slate-50 disabled:text-slate-400"
                        placeholder="0" value={row.price} disabled={!row.selected}
                        onChange={e => updateRoom(i, 'price', e.target.value)} />
                    </td>
                    <td className="px-3 py-2.5">
                      <input type="number" min="0"
                        className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 disabled:bg-slate-50 disabled:text-slate-400"
                        placeholder="0" value={row.availability} disabled={!row.selected}
                        onChange={e => updateRoom(i, 'availability', e.target.value)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section E — Package Selection */}
      {propTypes.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">Section E — Select Package</h3>
            <p className="text-xs text-slate-400 mt-1">
              The package determines your property's visibility and placement on TST PlotConnect.
              {hasStudent && ' Student Single Rooms follow a separate pricing path — amounts shown are configured by EA.'}
              {' '}Package cannot be changed after submission — only a Trainer can modify it.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {livePackages.map(p => (
              <div key={p.key}
                role="radio" aria-checked={pkg === p.key} tabIndex={0}
                onClick={() => setPkg(p.key as any)}
                onKeyDown={e => (e.key === ' ' || e.key === 'Enter') && setPkg(p.key as any)}
                className={`rounded-xl border-2 p-4 cursor-pointer transition-all
                  ${pkg === p.key ? 'bg-white shadow-sm' : 'border-slate-200 bg-slate-50 hover:bg-white hover:shadow-sm'}`}
                style={pkg === p.key ? { borderColor: themeHex } : {}}>
                <p className="font-semibold text-slate-800">{p.label}</p>
                <p className="text-xl font-bold mt-1" style={pkg === p.key ? { color: themeHex } : { color: '#64748b' }}>
                  KSh {p.price.toLocaleString()}
                </p>
                <p className="text-xs text-slate-500 mt-1">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section F — Form Actions */}
      <div className="flex gap-3">
        <PortalButton color={themeHex} type="submit" disabled={busy}>
          {busy ? 'Submitting…' : 'Submit Property'}
        </PortalButton>
        <PortalButton variant="secondary" type="button" onClick={clearForm} disabled={busy}>
          Clear Form
        </PortalButton>
      </div>
    </form>
  );
}

// ─── TAB 3 — My Properties: per-property payment panel (doc Tab 3) ────────────
function PropertyPaymentPanel({ prop, themeHex, onRefetch }: {
  prop: MarketerProperty; themeHex: string; onRefetch: () => void;
}) {
  const [mpesa,      setMpesa]      = useState('');
  const [payMsg,     setPayMsg]     = useState('');
  const [payOk,      setPayOk]      = useState(false);
  const [payBusy,    setPayBusy]    = useState(false);
  const [polling,    setPolling]    = useState(false);
  const [countdown,  setCountdown]  = useState(0); // seconds until resend is allowed
  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setPolling(false);
  };
  const stopCountdown = () => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    setCountdown(0);
  };
  useEffect(() => () => { stopPoll(); stopCountdown(); }, []);

  // Start a 60-second countdown — after it hits 0 the "Resend" button appears
  const startCountdown = () => {
    stopCountdown();
    setCountdown(60);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { stopCountdown(); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  // Live payment polling — actively queries Safaricom for the result every 5s
  const startPoll = (propId: string) => {
    stopPoll();
    setPolling(true);
    pollRef.current = setInterval(async () => {
      try {
        const { apiClient } = await import('../../../shared/api/apiClient');
        const res = await apiClient.post(`/api/v1/marketer/properties/${propId}/query-payment`, {});
        const status = (res.data as any)?.paymentStatus;
        if (status === 'PAID' || status === 'FAILED') { stopPoll(); stopCountdown(); onRefetch(); }
      } catch { stopPoll(); }
    }, 5000);
  };

  const sendStk = async () => {
    if (!mpesa.trim()) { setPayMsg('Enter the M-Pesa number first.'); setPayOk(false); return; }
    setPayBusy(true); setPayMsg('');
    try {
      const { apiClient } = await import('../../../shared/api/apiClient');
      const pkgPrice = STD_PACKAGES.find(p => p.key === prop.package)?.price || 4000;
      const payRes = await apiClient.post('/api/v1/payments/mpesa', {
        phoneNumber: mpesa.trim(),
        amount: pkgPrice,
        currency: 'KES',
        reference: `PROP-${prop.id}-${Date.now()}`,
        description: `TST PlotConnect — ${prop.package} package`,
        propertyId: prop.id,
      });
      const checkoutRequestId = (payRes.data as any)?.transactionId;

      // Sandbox auto-complete: payment already done, no polling needed
      if ((payRes.data as any)?.autoCompleted) {
        setPayOk(true);
        setPayMsg('✓ Payment completed (sandbox test mode — no real money charged).');
        stopPoll();
        stopCountdown();
        onRefetch();
        return;
      }

      // Reset status to AWAITING and store the new CheckoutRequestID
      await apiClient.post(`/api/v1/marketer/properties/${prop.id}/initiate-payment`, {
        checkoutRequestId,
        reset: true, // allow resend even if already AWAITING
      }).catch(() => {});
      setPayOk(true);
      setPayMsg('STK Push sent — ask the client to check their phone and enter their M-Pesa PIN.');
      stopPoll();
      startPoll(prop.id);
      startCountdown();
      onRefetch();
    } catch (err: any) {
      setPayOk(false);
      setPayMsg(err?.response?.data?.error || 'Failed to send STK Push.');
    } finally { setPayBusy(false); }
  };

  const isPaid      = prop.paymentStatus === 'PAID';
  const isAwaiting  = prop.paymentStatus === 'AWAITING_CONFIRMATION' || polling;
  const meta        = PAYMENT_META[prop.paymentStatus] || PAYMENT_META.UNPAID;

  return (
    <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-slate-600">Payment Status:</span>
        <PayBadge status={prop.paymentStatus || 'UNPAID'} polling={isAwaiting} />
        {isAwaiting && <span className="text-xs text-amber-600 animate-pulse">Waiting for PIN…</span>}
      </div>
      <p className="text-xs text-slate-400">{meta.desc}</p>

      {isPaid && prop.paymentConfirmedAt && (
        <p className="text-xs text-green-600 font-medium">
          Confirmed: {new Date(prop.paymentConfirmedAt).toLocaleString()}
        </p>
      )}

      {!isPaid && (
        <div className="space-y-2">
          <div className="flex gap-2 items-end flex-wrap">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Client M-Pesa Number
              </label>
              <input
                className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 w-48"
                placeholder="07XXXXXXXX" value={mpesa}
                onChange={e => setMpesa(e.target.value)} />
            </div>

            {/* First send — shown when not yet awaiting */}
            {!isAwaiting && (
              <PortalButton color={themeHex} disabled={payBusy} onClick={sendStk}>
                {payBusy ? 'Sending…' : 'Send STK Push'}
              </PortalButton>
            )}

            {/* Awaiting state — show countdown or resend */}
            {isAwaiting && (
              countdown > 0 ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 bg-slate-100 px-3 py-2 rounded-xl">
                    Waiting… resend in {countdown}s
                  </span>
                </div>
              ) : (
                <PortalButton color={themeHex} disabled={payBusy} onClick={sendStk}>
                  {payBusy ? 'Sending…' : 'Resend STK Push'}
                </PortalButton>
              )
            )}
          </div>

          {isAwaiting && countdown > 0 && (
            <p className="text-xs text-slate-400">
              Client has {countdown}s to enter their PIN. If they miss it, resend will appear automatically.
            </p>
          )}
        </div>
      )}

      {payMsg && (
        <p className={`text-xs ${payOk ? 'text-green-600' : 'text-red-600'}`}>{payMsg}</p>
      )}
    </div>
  );
}

// ─── TAB 3 — My Properties list (doc Tab 3) ───────────────────────────────────
function MyPropertiesSection({ properties, themeHex, onRefetch, onAddNew }: {
  properties: MarketerProperty[]; themeHex: string;
  onRefetch: () => void; onAddNew: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (properties.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
        <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </div>
        <p className="text-slate-600 text-sm font-medium mb-1">No listings yet</p>
        <p className="text-slate-400 text-xs mb-5">
          Submitted listings appear here with status and payment details.
        </p>
        {/* Doc Tab 3: shortcut button switches to Add Property tab */}
        <PortalButton color={themeHex} onClick={onAddNew}>Add Your First Property</PortalButton>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {properties.map(prop => (
        <div key={prop.id} className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800 truncate">{prop.propertyName}</p>
              {/* Doc Tab 3: location, approval status, payment state, package, dates */}
              <p className="text-xs text-slate-500 mt-0.5">{prop.area}, {prop.county}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {BOOKING_LABELS[prop.bookingType] || prop.bookingType}
                {prop.propertyTypes?.length > 0 && (
                  <> · {prop.propertyTypes.map(t => PROPERTY_TYPES.find(p => p.key === t)?.label || t).join(', ')}</>
                )}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <StatusBadge status={prop.paymentStatus === 'PAID' && prop.status === 'PENDING' ? 'UNDER_REVIEW' : (prop.status || 'PENDING')} />
                <PayBadge status={prop.paymentStatus || 'UNPAID'}
                  polling={prop.paymentStatus === 'AWAITING_CONFIRMATION'} />
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700">
                  {prop.package} — KSh {(STD_PACKAGES.find(p => p.key === prop.package)?.price || 0).toLocaleString()}
                </span>
              </div>
            </div>
            <div className="text-right text-xs text-slate-400 flex-shrink-0 space-y-1">
              <p>Submitted {new Date(prop.createdAt).toLocaleDateString()}</p>
              {/* Doc Tab 3: date payment confirmed if paid */}
              {prop.paymentConfirmedAt && (
                <p className="text-green-600 font-medium">
                  Paid {new Date(prop.paymentConfirmedAt).toLocaleDateString()}
                </p>
              )}
              <button
                onClick={() => setOpenId(openId === prop.id ? null : prop.id)}
                className="text-xs font-semibold underline block"
                style={{ color: themeHex }}>
                {openId === prop.id ? 'Hide Payment' : 'Open Payment'}
              </button>
            </div>
          </div>

          {openId === prop.id && (
            <PropertyPaymentPanel prop={prop} themeHex={themeHex} onRefetch={onRefetch} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── TAB 4 — Map View (doc Tab 4) ────────────────────────────────────────────

/** Extract lat/lng from any common Google Maps or OSM URL format */
function extractCoords(link: string): [number, number] | null {
  const atMatch    = link.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return [parseFloat(atMatch[1]), parseFloat(atMatch[2])];
  const qMatch     = link.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) return [parseFloat(qMatch[1]), parseFloat(qMatch[2])];
  const osmMatch   = link.match(/#map=\d+\/(-?\d+\.\d+)\/(-?\d+\.\d+)/);
  if (osmMatch) return [parseFloat(osmMatch[1]), parseFloat(osmMatch[2])];
  const placeMatch = link.match(/\/place\/[^/]+\/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (placeMatch) return [parseFloat(placeMatch[1]), parseFloat(placeMatch[2])];
  const llMatch    = link.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (llMatch) return [parseFloat(llMatch[1]), parseFloat(llMatch[2])];
  return null;
}

/**
 * Convert any map link into an embeddable iframe src.
 *
 * Strategy:
 *  1. If the link has coordinates → use OSM embed (no API key needed, always works)
 *  2. If it's a Google Maps link without coords → use Google Maps embed with the
 *     raw URL as the `q` parameter (works for place names and short links)
 *  3. Otherwise → return null (show fallback)
 */
function toEmbedUrl(link: string): string | null {
  const coords = extractCoords(link);
  if (coords) {
    const [lat, lng] = coords;
    // OpenStreetMap embed — no API key, works everywhere
    return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}&layer=mapnik&marker=${lat},${lng}`;
  }

  // Google Maps links (maps.google.com, maps.app.goo.gl, goo.gl/maps, etc.)
  const isGoogle = /google\.com\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(link);
  if (isGoogle) {
    // Use the Google Maps embed API with the original URL as the query
    // This handles short links, place names, and full URLs
    const q = encodeURIComponent(link);
    return `https://maps.google.com/maps?q=${q}&output=embed&z=15`;
  }

  // OpenStreetMap direct links without hash coords
  if (/openstreetmap\.org/i.test(link)) {
    return link.replace('openstreetmap.org', 'openstreetmap.org/export/embed.html') + '&layer=mapnik';
  }

  return null;
}

/** Single property map card — shows an embedded map inside the system */
function PropertyMapCard({
  prop,
  themeHex,
}: {
  prop: MarketerProperty;
  themeHex: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const embedUrl = prop.mapLink ? toEmbedUrl(prop.mapLink) : null;
  const coords   = prop.mapLink ? extractCoords(prop.mapLink) : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: themeHex }}
          />
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 text-sm truncate">{prop.propertyName}</p>
            <p className="text-xs text-slate-400">{prop.area}, {prop.county}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          {/* Open full-screen in new tab */}
          {prop.mapLink && (
            <a
              href={prop.mapLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-1"
              title="Open in Google Maps / OSM"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Full screen
            </a>
          )}
          {/* Toggle inline map */}
          {embedUrl && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
              style={{
                backgroundColor: expanded ? themeHex : undefined,
                color: expanded ? '#fff' : themeHex,
                border: `1.5px solid ${themeHex}`,
              }}
            >
              {expanded ? 'Hide Map' : 'View Map'}
            </button>
          )}
        </div>
      </div>

      {/* Inline embedded map — shown when expanded */}
      {expanded && embedUrl && (
        <div className="relative" style={{ height: 380 }}>
          <iframe
            src={embedUrl}
            title={`Map — ${prop.propertyName}`}
            className="w-full h-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
          {/* OSM attribution overlay */}
          {coords && (
            <a
              href={`https://www.openstreetmap.org/?mlat=${coords[0]}&mlon=${coords[1]}#map=15/${coords[0]}/${coords[1]}`}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-1 right-1 text-[10px] bg-white/80 px-1.5 py-0.5 rounded text-slate-500 hover:text-blue-600"
            >
              © OpenStreetMap
            </a>
          )}
        </div>
      )}

      {/* No embed possible — show a clear message with the raw link */}
      {expanded && !embedUrl && prop.mapLink && (
        <div className="px-4 py-6 text-center bg-slate-50">
          <p className="text-sm text-slate-500 mb-3">
            This link can't be embedded directly. Open it in your browser:
          </p>
          <a
            href={prop.mapLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 text-sm underline break-all"
          >
            {prop.mapLink}
          </a>
        </div>
      )}
    </div>
  );
}

/** Leaflet multi-pin map — only shown when at least 2 properties have parseable coordinates */
function LeafletMultiMap({
  plottable,
  themeHex: _themeHex,
}: {
  plottable: MarketerProperty[];
  themeHex: string;
}) {
  const mapRef     = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<any>(null);
  const plottableKey = plottable.map(p => p.id).join(',');

  useEffect(() => {
    if (plottable.length === 0) return;

    // Inject Leaflet CSS once
    const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel  = 'stylesheet';
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }

    let cancelled = false;
    const init = async () => {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      if (cancelled || !mapRef.current) return;
      try {
        const L = (await import('leaflet')).default;
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });
        if (leafletRef.current) { leafletRef.current.remove(); leafletRef.current = null; }

        const map = L.map(mapRef.current!, { scrollWheelZoom: true });
        leafletRef.current = map;
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        const bounds: [number, number][] = [];
        for (const prop of plottable) {
          const coords = extractCoords(prop.mapLink!);
          if (!coords) continue;
          bounds.push(coords);
          L.marker(coords).addTo(map).bindPopup(
            `<b>${prop.propertyName}</b><br>${prop.area}, ${prop.county}<br>` +
            `<span style="color:#64748b;font-size:11px">${BOOKING_LABELS[prop.bookingType] || prop.bookingType}</span>`
          );
        }
        if (bounds.length === 1)      map.setView(bounds[0], 14);
        else if (bounds.length > 1)   map.fitBounds(bounds as any, { padding: [40, 40] });
        else                          map.setView([-1.286389, 36.817223], 7);

        setTimeout(() => { if (!cancelled) map.invalidateSize(); }, 200);
      } catch { /* leaflet unavailable */ }
    };
    init();
    return () => {
      cancelled = true;
      if (leafletRef.current) { leafletRef.current.remove(); leafletRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plottableKey]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <p className="text-sm font-semibold text-slate-700">All Properties — Overview Map</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {plottable.length} pinned location{plottable.length !== 1 ? 's' : ''} · click a pin for details
        </p>
      </div>
      <div ref={mapRef} style={{ height: 420 }} />
    </div>
  );
}

function MapSection({ properties, themeHex }: { properties: MarketerProperty[]; themeHex: string }) {
  const withLinks  = properties.filter(p => p.mapLink);
  const plottable  = properties.filter(p => p.mapLink && extractCoords(p.mapLink));

  if (withLinks.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <p className="text-slate-500 text-sm font-medium">No map links yet</p>
        <p className="text-slate-400 text-xs mt-1">
          Add a Google Maps or OpenStreetMap link when submitting a property to see it here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center gap-2 text-sm text-slate-500 flex-wrap">
        <span className="font-bold text-lg" style={{ color: themeHex }}>{withLinks.length}</span>
        <span>propert{withLinks.length !== 1 ? 'ies' : 'y'} with map links.</span>
        {plottable.length > 0 && (
          <span className="text-green-600 text-xs">
            · {plottable.length} with exact coordinates (pinnable on overview map)
          </span>
        )}
      </div>

      {/* Overview Leaflet map — only when 2+ properties have parseable coords */}
      {plottable.length >= 2 && (
        <LeafletMultiMap plottable={plottable} themeHex={themeHex} />
      )}

      {/* Per-property embedded map cards */}
      <div className="space-y-3">
        {withLinks.map(prop => (
          <PropertyMapCard key={prop.id} prop={prop} themeHex={themeHex} />
        ))}
      </div>
    </div>
  );
}

// ─── TAB 5 — M-Pesa Messages (doc Tab 5) ─────────────────────────────────────
function MpesaMessagesSection({ messages, themeHex, onRefetch }: {
  messages: MpesaMessage[]; themeHex: string; onRefetch: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg,  setMsg]  = useState('');
  const [ok,   setOk]   = useState(false);

  const send = async () => {
    if (!text.trim()) { setMsg('Paste an M-Pesa message first.'); setOk(false); return; }
    setBusy(true); setMsg('');
    try {
      const { apiClient } = await import('../../../shared/api/apiClient');
      await apiClient.post('/api/v1/marketer/mpesa-messages', { message: text.trim() });
      setOk(true);
      setMsg('✓ Message forwarded to admin successfully.');
      setText('');
      onRefetch();
    } catch (err: any) {
      setOk(false);
      setMsg(err?.response?.data?.error || 'Failed to send message.');
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Doc Tab 5: section intro */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <p className="font-semibold mb-1">Manual M-Pesa Message Forwarding</p>
        <p>
          Package payments should be started from the <strong>My Properties</strong> tab.
          Use this section only when you need to forward a manual M-Pesa confirmation text to the admin team
          for a payment that was not captured automatically through the STK Push flow.
        </p>
      </div>

      {/* Doc Tab 5: textarea + send button */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <label className="block text-sm font-medium text-slate-700">M-Pesa Transaction Message</label>
        <textarea
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all resize-none"
          rows={6} placeholder="Paste the full M-Pesa transaction message received on your phone…"
          value={text} onChange={e => setText(e.target.value)} />
        {msg && <p className={`text-sm ${ok ? 'text-green-600' : 'text-red-600'}`}>{msg}</p>}
        <PortalButton color={themeHex} disabled={busy || !text.trim()} onClick={send}>
          {busy ? 'Sending…' : 'Send Message'}
        </PortalButton>
      </div>

      {/* Doc Tab 5: sent messages history table */}
      <div>
        <h3 className="font-semibold text-slate-800 mb-3">My Sent MPesa Messages</h3>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Message</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase w-28">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase w-36">Date Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {messages.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-10 text-slate-400 text-sm">
                    No messages sent yet.
                  </td>
                </tr>
              ) : messages.map((m, i) => (
                <tr key={m.id || i} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700 text-xs whitespace-pre-wrap break-words max-w-xs">
                    {m.message}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={m.status || 'PENDING'} /></td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                    {m.createdAt ? new Date(m.createdAt).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main MarketerDashboard — Tabs 2–5 (doc Tab 2–5) ─────────────────────────
// Default landing tab is Tab 2 — Add Property
export default function MarketerDashboard({ themeHex }: { themeHex: string }) {
  // Default to 'add' — Tab 2 is the default landing tab per spec
  const [tab, setTab]               = useState<'add'|'properties'|'map'|'mpesa'>('add');
  const [properties, setProperties] = useState<MarketerProperty[]>([]);
  const [messages,   setMessages]   = useState<MpesaMessage[]>([]);
  const [loading,    setLoading]    = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { apiClient } = await import('../../../shared/api/apiClient');
      const [propsRes, msgsRes] = await Promise.allSettled([
        apiClient.get('/api/v1/marketer/properties'),
        apiClient.get('/api/v1/marketer/mpesa-messages'),
      ]);
      if (propsRes.status === 'fulfilled') {
        const d = (propsRes.value.data as any);
        setProperties(Array.isArray(d) ? d : (d?.data || d?.properties || []));
      }
      if (msgsRes.status === 'fulfilled') {
        const d = (msgsRes.value.data as any);
        setMessages(Array.isArray(d) ? d : (d?.data || d?.messages || []));
      }
    } catch { /* silent — show empty state */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const plottableCount = properties.filter(p => p.mapLink).length;

  // Doc: tab counter cards — Add Property shows —, others show live counts
  const tabs: { id: 'add'|'properties'|'map'|'mpesa'; label: string; count: number | null }[] = [
    { id: 'add',        label: 'Add Property',  count: null },
    { id: 'properties', label: 'My Properties', count: properties.length },
    { id: 'map',        label: 'Map View',       count: plottableCount },
    { id: 'mpesa',      label: 'MPesa Messages', count: messages.length },
  ];

  return (
    <div>
      {/* Tab counter navigation cards */}
      <div className="flex flex-wrap gap-3 mb-6">
        {tabs.map(t => (
          <TabCard key={t.id} id={t.id} label={t.label} count={t.count}
            active={tab === t.id} onClick={() => setTab(t.id)} themeHex={themeHex} />
        ))}
      </div>

      {/* Tab content */}
      {loading && tab !== 'add' ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-slate-200 rounded-full animate-spin"
            style={{ borderTopColor: themeHex }} />
        </div>
      ) : (
        <>
          {/* Tab 2 — Add Property (default landing) */}
          {tab === 'add' && (
            <AddPropertyForm themeHex={themeHex}
              onSuccess={() => { fetchData(); setTab('properties'); }} />
          )}

          {/* Tab 3 — My Properties */}
          {tab === 'properties' && (
            <div>
              <SectionHeader
                title="My Properties"
                subtitle="All listings submitted by your account — with status and payment details"
              />
              <MyPropertiesSection
                properties={properties} themeHex={themeHex}
                onRefetch={fetchData} onAddNew={() => setTab('add')}
              />
            </div>
          )}

          {/* Tab 4 — Map View */}
          {tab === 'map' && (
            <div>
              <SectionHeader
                title="Map View"
                subtitle="Your submitted property locations as pins on an interactive map"
              />
              <MapSection properties={properties} themeHex={themeHex} />
            </div>
          )}

          {/* Tab 5 — M-Pesa Messages */}
          {tab === 'mpesa' && (
            <div>
              <SectionHeader
                title="M-Pesa Messages"
                subtitle="Forward manual M-Pesa confirmation texts to the admin team"
              />
              <MpesaMessagesSection messages={messages} themeHex={themeHex} onRefetch={fetchData} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
