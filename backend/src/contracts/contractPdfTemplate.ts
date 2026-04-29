/**
 * TechSwiftTrix Contract PDF Template
 * - Real TST logo (inline SVG matching brand identity)
 * - Fixed footer on every page via @page + position:fixed
 * - Puppeteer-compatible layout
 */

export interface ContractPdfData {
  referenceNumber: string;
  contractDate: string;
  contractType: 'CLIENT_SYSTEM' | 'CLIENT_PLOTCONNECT' | 'DEVELOPER';
  companyName: string;
  companyAddress: string;
  companyEmail: string;
  companyPhone: string;
  companyWebsite: string;
  companyRegNumber: string;
  partyName: string;
  partyEmail: string;
  partyPhone: string;
  partyAddress: string;
  partyIdNumber?: string;
  partyOrganization?: string;
  projectRef?: string;
  serviceDescription: string;
  industryCategory?: string;
  paymentPlan: string;
  serviceAmount: number;
  currency: string;
  commitmentAmount?: number;
  transactionId?: string;
  paymentDate?: string;
  startDate?: string;
  deliveryDate?: string;
  propertyName?: string;
  propertyLocation?: string;
  placementTier?: string;
  developerTeam?: string;
  assignedProject?: string;
  stampDataUrl?: string;
}

// ── TST Logo as inline SVG (matches real brand: dark navy bg, green-blue gradient TST,
//    orbital ellipse ring, globe icon, tagline) ──────────────────────────────────────
const TST_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 80" width="180" height="65">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a1628"/>
      <stop offset="100%" style="stop-color:#0d2044"/>
    </linearGradient>
    <linearGradient id="tstGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#00e5ff"/>
      <stop offset="50%" style="stop-color:#39ff14"/>
      <stop offset="100%" style="stop-color:#00bfff"/>
    </linearGradient>
    <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#00e5ff;stop-opacity:0.9"/>
      <stop offset="50%" style="stop-color:#39ff14;stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#00bfff;stop-opacity:0.9"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
      <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="220" height="80" rx="6" fill="url(#bgGrad)"/>

  <!-- Orbital ring (ellipse) -->
  <ellipse cx="40" cy="38" rx="30" ry="14" fill="none" stroke="url(#ringGrad)" stroke-width="2.5" opacity="0.85"/>
  <!-- Ring tilt line -->
  <ellipse cx="40" cy="38" rx="30" ry="14" fill="none" stroke="url(#ringGrad)" stroke-width="1.2"
    transform="rotate(-20 40 38)" opacity="0.5"/>

  <!-- Globe icon (top of ring) -->
  <circle cx="40" cy="24" r="4" fill="none" stroke="#00e5ff" stroke-width="1.5" opacity="0.9"/>
  <line x1="40" y1="20" x2="40" y2="28" stroke="#00e5ff" stroke-width="1" opacity="0.7"/>
  <line x1="36" y1="24" x2="44" y2="24" stroke="#00e5ff" stroke-width="1" opacity="0.7"/>

  <!-- TST letters -->
  <text x="18" y="47" font-family="Arial Black, Arial" font-weight="900" font-size="22"
    fill="url(#tstGrad)" filter="url(#glow)" letter-spacing="-1">TST</text>

  <!-- Shine streak -->
  <line x1="55" y1="28" x2="68" y2="22" stroke="#ffffff" stroke-width="1.5" opacity="0.4" stroke-linecap="round"/>

  <!-- Company name -->
  <text x="78" y="32" font-family="Arial, sans-serif" font-weight="700" font-size="13"
    fill="#ffffff" letter-spacing="0.3">TechSwiftTrix (TST)</text>

  <!-- Tagline line 1 -->
  <text x="78" y="46" font-family="Arial, sans-serif" font-size="7" fill="#39ff14" letter-spacing="1.5">WEB · MOBILE · SOLUTIONS</text>
  <!-- Tagline line 2 -->
  <text x="78" y="57" font-family="Arial, sans-serif" font-size="7" fill="#00bfff" letter-spacing="1.5">REMOTE · DIGITAL · GLOBAL</text>

  <!-- Bottom accent line -->
  <line x1="78" y1="62" x2="210" y2="62" stroke="url(#ringGrad)" stroke-width="1" opacity="0.6"/>
</svg>`;

export function buildContractHtml(d: ContractPdfData): string {
  const fmt = (n: number, cur: string) =>
    `${cur} ${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const typeLabel = {
    CLIENT_SYSTEM:      'Software Services Agreement',
    CLIENT_PLOTCONNECT: 'Property Listing Agreement',
    DEVELOPER:          'Developer Services Agreement',
  }[d.contractType];

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 11pt;
    color: #1a1a2e;
    background: #fff;
    /* bottom padding so content never hides behind fixed footer */
    padding-bottom: 56px;
  }

  /* ── Fixed footer on every printed page ── */
  @page {
    margin-top: 0;
    margin-bottom: 56px;
    margin-left: 0;
    margin-right: 0;
  }

  .footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 48px;
    background: #0a1628;
    color: rgba(255,255,255,0.65);
    padding: 0 36px;
    font-size: 8pt;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 3px solid;
    border-image: linear-gradient(90deg, #00e5ff, #39ff14, #00bfff) 1;
    z-index: 1000;
  }
  .footer-brand { color: #39ff14; font-weight: 700; font-size: 8.5pt; }
  .footer-center { text-align: center; }
  .footer-ref { color: #00bfff; font-weight: 600; }

  /* ── Header ── */
  .header {
    background: linear-gradient(135deg, #0a1628 0%, #0d2044 60%, #1d4ed8 100%);
    color: #fff;
    padding: 22px 36px 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .header-right { text-align: right; }
  .contract-type { font-size: 13pt; font-weight: 700; color: #fff; }
  .contract-ref { font-size: 8.5pt; color: rgba(255,255,255,0.65); margin-top: 3px; }

  /* ── Accent bar ── */
  .accent-bar {
    height: 4px;
    background: linear-gradient(90deg, #00e5ff 0%, #39ff14 50%, #1d4ed8 100%);
  }

  /* ── Body ── */
  .body { padding: 28px 36px; }

  /* ── Meta row ── */
  .meta-row { display: flex; gap: 10px; margin-bottom: 22px; flex-wrap: wrap; }
  .meta-pill {
    background: #eff6ff; border: 1px solid #bfdbfe;
    border-radius: 6px; padding: 5px 12px;
    font-size: 9pt; color: #1d4ed8; font-weight: 600;
  }
  .meta-pill span { color: #64748b; font-weight: 400; margin-left: 4px; }

  /* ── Section ── */
  .section { margin-bottom: 20px; }
  .section-title {
    font-size: 9.5pt; font-weight: 700; color: #0a1628;
    text-transform: uppercase; letter-spacing: 0.8px;
    border-bottom: 2px solid #1d4ed8;
    padding-bottom: 4px; margin-bottom: 10px;
  }

  /* ── Two-col grid ── */
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; }
  .field { margin-bottom: 5px; }
  .field-label { font-size: 7.5pt; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .field-value { font-size: 10pt; color: #1a1a2e; font-weight: 500; margin-top: 1px; }

  /* ── Parties ── */
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px; }
  .party-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; }
  .party-card.provider { border-left: 4px solid #1d4ed8; }
  .party-card.client   { border-left: 4px solid #39ff14; }
  .party-role { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 5px; }
  .party-name { font-size: 11.5pt; font-weight: 700; color: #0a1628; margin-bottom: 3px; }
  .party-detail { font-size: 8.5pt; color: #475569; line-height: 1.65; }

  /* ── Financial ── */
  .financial-box {
    background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;
    padding: 14px 18px; margin-bottom: 20px;
  }
  .amount-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; border-bottom: 1px solid #e2e8f0; }
  .amount-row:last-child { border-bottom: none; }
  .amount-label { font-size: 9.5pt; color: #475569; }
  .amount-value { font-size: 10.5pt; font-weight: 700; color: #0a1628; }
  .amount-total .amount-label { font-weight: 700; color: #0a1628; font-size: 10.5pt; }
  .amount-total .amount-value { font-size: 13pt; color: #1d4ed8; }

  /* ── Transaction ── */
  .txn-box {
    background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;
    padding: 10px 14px; margin-bottom: 20px;
  }
  .txn-label { font-size: 7.5pt; font-weight: 700; color: #15803d; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
  .txn-id { font-family: 'Courier New', monospace; font-size: 10pt; color: #166534; font-weight: 600; }

  /* ── T&Cs ── */
  .tnc-box {
    background: #fafafa; border: 1px solid #e2e8f0; border-radius: 8px;
    padding: 14px 18px; margin-bottom: 20px;
  }
  .tnc-list { counter-reset: item; padding-left: 0; list-style: none; }
  .tnc-list li {
    font-size: 8.5pt; color: #475569; line-height: 1.65;
    padding: 3px 0 3px 18px; position: relative;
    border-bottom: 1px solid #f1f5f9;
  }
  .tnc-list li:last-child { border-bottom: none; }
  .tnc-list li::before {
    content: counter(item);
    counter-increment: item;
    position: absolute; left: 0;
    font-weight: 700; color: #1d4ed8; font-size: 7.5pt;
  }

  /* ── Signatures ── */
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 6px; }
  .sig-line { border-bottom: 2px solid #1d4ed8; margin-bottom: 5px; height: 38px; position: relative; }
  .sig-name { font-size: 10pt; font-weight: 700; color: #0a1628; }
  .sig-role { font-size: 8pt; color: #64748b; }
  .sig-date { font-size: 8pt; color: #94a3b8; margin-top: 3px; }

  /* ── Stamp ── */
  .stamp-area { position: absolute; bottom: 2px; left: 4px; }
  .stamp-area img { max-width: 80px; max-height: 80px; opacity: 0.85; }

  /* ── Page break ── */
  .page-break { page-break-before: always; }

  /* ── Watermark ── */
  .watermark {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-35deg);
    font-size: 68pt; font-weight: 900;
    color: rgba(29,78,216,0.035);
    pointer-events: none; z-index: 0;
    white-space: nowrap;
  }
</style>
</head>
<body>

<div class="watermark">TECHSWIFTTRIX</div>

<!-- ── Fixed footer (renders on every page) ── -->
<div class="footer">
  <div><span class="footer-brand">TechSwiftTrix (TST)</span> &nbsp;·&nbsp; ${d.companyAddress}</div>
  <div class="footer-center">${d.companyEmail} &nbsp;·&nbsp; ${d.companyWebsite}</div>
  <div class="footer-ref">Ref: ${d.referenceNumber}</div>
</div>

<!-- ── Header ── -->
<div class="header">
  <div style="display:flex;align-items:center;gap:0;">
    ${TST_LOGO_SVG}
  </div>
  <div class="header-right">
    <div class="contract-type">${typeLabel}</div>
    <div class="contract-ref">Ref: ${d.referenceNumber}</div>
    <div class="contract-ref">Date: ${d.contractDate}</div>
  </div>
</div>
<div class="accent-bar"></div>

<!-- ── Body ── -->
<div class="body">

  <!-- Meta pills -->
  <div class="meta-row">
    <div class="meta-pill">Reference <span>${d.referenceNumber}</span></div>
    <div class="meta-pill">Date <span>${d.contractDate}</span></div>
    ${d.projectRef ? `<div class="meta-pill">Project <span>${d.projectRef}</span></div>` : ''}
    ${d.industryCategory ? `<div class="meta-pill">Industry <span>${d.industryCategory.replace(/_/g, ' ')}</span></div>` : ''}
  </div>

  <!-- Parties -->
  <div class="section">
    <div class="section-title">Parties to this Agreement</div>
    <div class="parties">
      <div class="party-card provider">
        <div class="party-role">Service Provider</div>
        <div class="party-name">${d.companyName}</div>
        <div class="party-detail">
          ${d.companyAddress}<br>
          ${d.companyEmail}<br>
          ${d.companyPhone}<br>
          ${d.companyWebsite}<br>
          Reg No: ${d.companyRegNumber}
        </div>
      </div>
      <div class="party-card client">
        <div class="party-role">${d.contractType === 'DEVELOPER' ? 'Developer / Team' : 'Client'}</div>
        <div class="party-name">${d.partyName}</div>
        <div class="party-detail">
          ${d.partyOrganization ? `${d.partyOrganization}<br>` : ''}
          ${d.partyEmail}<br>
          ${d.partyPhone}<br>
          ${d.partyAddress}<br>
          ${d.partyIdNumber ? `ID/Reg: ${d.partyIdNumber}` : ''}
        </div>
      </div>
    </div>
  </div>

  <!-- Service Details -->
  <div class="section">
    <div class="section-title">Service / Project Details</div>
    <div class="grid2">
      <div class="field">
        <div class="field-label">Service Description</div>
        <div class="field-value">${d.serviceDescription}</div>
      </div>
      ${d.industryCategory ? `<div class="field"><div class="field-label">Industry Category</div><div class="field-value">${d.industryCategory.replace(/_/g, ' ')}</div></div>` : ''}
      ${d.startDate ? `<div class="field"><div class="field-label">Start Date</div><div class="field-value">${d.startDate}</div></div>` : ''}
      ${d.deliveryDate ? `<div class="field"><div class="field-label">Expected Delivery</div><div class="field-value">${d.deliveryDate}</div></div>` : ''}
      ${d.propertyName ? `<div class="field"><div class="field-label">Property Name</div><div class="field-value">${d.propertyName}</div></div>` : ''}
      ${d.propertyLocation ? `<div class="field"><div class="field-label">Property Location</div><div class="field-value">${d.propertyLocation}</div></div>` : ''}
      ${d.placementTier ? `<div class="field"><div class="field-label">Placement Tier</div><div class="field-value">${d.placementTier}</div></div>` : ''}
      ${d.developerTeam ? `<div class="field"><div class="field-label">Developer Team</div><div class="field-value">${d.developerTeam}</div></div>` : ''}
      ${d.assignedProject ? `<div class="field"><div class="field-label">Assigned Project</div><div class="field-value">${d.assignedProject}</div></div>` : ''}
    </div>
  </div>

  <!-- Financial Terms -->
  <div class="section">
    <div class="section-title">Financial Terms</div>
    <div class="financial-box">
      <div class="amount-row">
        <span class="amount-label">Payment Plan</span>
        <span class="amount-value">${d.paymentPlan}</span>
      </div>
      ${d.commitmentAmount ? `<div class="amount-row"><span class="amount-label">Commitment Payment (Paid)</span><span class="amount-value">${fmt(d.commitmentAmount, d.currency)}</span></div>` : ''}
      <div class="amount-row amount-total">
        <span class="amount-label">Total Service Amount</span>
        <span class="amount-value">${fmt(d.serviceAmount, d.currency)}</span>
      </div>
    </div>
  </div>

  <!-- Transaction Reference -->
  ${d.transactionId ? `
  <div class="section">
    <div class="section-title">Payment Verification</div>
    <div class="txn-box">
      <div class="txn-label">Daraja Transaction ID (M-Pesa)</div>
      <div class="txn-id">${d.transactionId}</div>
      ${d.paymentDate ? `<div style="font-size:8.5pt;color:#166534;margin-top:3px;">Payment confirmed: ${d.paymentDate}</div>` : ''}
    </div>
  </div>` : ''}

  <!-- Terms & Conditions -->
  <div class="section page-break">
    <div class="section-title">Terms and Conditions</div>
    <div class="tnc-box">
      <ol class="tnc-list">
        <li><strong>Scope of Services.</strong> ${d.companyName} agrees to deliver the services described in this agreement. Any additional work outside the agreed scope requires a written change order signed by both parties.</li>
        <li><strong>Payment Obligations.</strong> The Client agrees to pay the total service amount of ${fmt(d.serviceAmount, d.currency)} as per the selected payment plan. All payments are non-refundable once work has commenced unless otherwise agreed in writing.</li>
        <li><strong>Commitment Payment.</strong> The commitment payment confirms the Client's intent to proceed and activates this agreement. It is deducted from the total service amount.</li>
        <li><strong>Delivery Timeline.</strong> ${d.companyName} will make reasonable efforts to deliver within the agreed timeline. Delays caused by the Client's failure to provide required information or access shall not be attributed to ${d.companyName}.</li>
        <li><strong>Intellectual Property.</strong> ${d.companyName} retains ownership of all proprietary tools and frameworks. The Client receives a perpetual, non-exclusive licence to use the deliverables. All client data and content remain the property of the Client.</li>
        <li><strong>Confidentiality.</strong> Both parties agree to keep confidential all proprietary information shared during the engagement. This obligation survives termination for two (2) years.</li>
        <li><strong>Data Protection.</strong> ${d.companyName} will handle all Client data in accordance with applicable data protection laws. Client data will not be shared with third parties without explicit written consent.</li>
        <li><strong>Warranties.</strong> ${d.companyName} warrants that services will be performed with reasonable skill and care. The Client warrants that all information provided is accurate and complete.</li>
        <li><strong>Limitation of Liability.</strong> ${d.companyName}'s total liability shall not exceed the total service amount paid. Neither party shall be liable for indirect, consequential, or incidental damages.</li>
        <li><strong>Termination.</strong> Either party may terminate this agreement with thirty (30) days written notice. The Client shall pay for all work completed up to the termination date.</li>
        <li><strong>Dispute Resolution.</strong> Disputes shall first be resolved through good-faith negotiation. If unresolved within thirty (30) days, disputes shall be referred to mediation before any legal proceedings.</li>
        <li><strong>Governing Law.</strong> This agreement is governed by the laws of Kenya. Any legal proceedings shall be conducted in the courts of Kenya.</li>
        <li><strong>Entire Agreement.</strong> This document constitutes the entire agreement between the parties and supersedes all prior discussions. Amendments must be in writing and signed by both parties.</li>
        <li><strong>Force Majeure.</strong> Neither party shall be liable for delays caused by circumstances beyond their reasonable control, including natural disasters, government actions, or internet outages.</li>
        <li><strong>Anti-Corruption.</strong> Both parties agree to conduct business ethically and in compliance with all applicable anti-corruption and anti-bribery laws.</li>
      </ol>
    </div>
  </div>

  <!-- Signatures -->
  <div class="section">
    <div class="section-title">Signatures</div>
    <p style="font-size:9pt;color:#475569;margin-bottom:14px;">
      By signing below, both parties acknowledge that they have read, understood, and agree to be bound by the terms and conditions of this agreement.
    </p>
    <div class="sig-grid">
      <div>
        <div class="sig-line">
          ${d.stampDataUrl ? `<div class="stamp-area"><img src="${d.stampDataUrl}" alt="Stamp" /></div>` : ''}
        </div>
        <div class="sig-name">${d.companyName}</div>
        <div class="sig-role">Authorised Representative</div>
        <div class="sig-date">Date: _______________________</div>
      </div>
      <div>
        <div class="sig-line"></div>
        <div class="sig-name">${d.partyName}</div>
        <div class="sig-role">${d.partyOrganization || 'Client'}</div>
        <div class="sig-date">Date: _______________________</div>
      </div>
    </div>
  </div>

</div><!-- /body -->

</body>
</html>`;
}
