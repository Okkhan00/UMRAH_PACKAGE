/* =========================================================================
   UMRAH PACKAGE DESIGN STUDIO
   Vanilla JS. Package data is fully independent from visual template.
   Pipeline: PACKAGE DATA -> TEMPLATE RENDERER (1 of 10) -> SIZE/FORMAT -> PREVIEW -> EXPORT
   ========================================================================= */

/* ---------------------------- UTILITIES ---------------------------- */
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const uid = () => Math.random().toString(36).slice(2,9) + Date.now().toString(36).slice(-4);
function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }
function escapeHtml(str){ return (str||'').toString().replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }
function sanitizeFilenamePart(s){ return (s||'').toString().trim().toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-+|-+$/g,''); }

/* --------------------------- DATA MODEL ----------------------------- */
function makeHotel(){ return { name:'', distance:'', unit:'m', location:'', image:'', icon:'', rating:4, mapsLink:'', nights:'', transport:'' }; }
function makePackage(title, color){
  return {
    id: uid(), title, subtitle:'', color, badge:'', description:'',
    makkah: makeHotel(), madinah: makeHotel(),
    pricing: [ { id: uid(), roomType:'Quad', price:'', currency:'', label:'', visible:true },
               { id: uid(), roomType:'Triple', price:'', currency:'', label:'', visible:true },
               { id: uid(), roomType:'Double', price:'', currency:'', label:'', visible:true } ]
  };
}
function defaultServices(){
  return ['Visa Processing','Hotel Accommodation','Air Tickets','Transport','24/7 Support','Ziyarat']
    .map(n => ({ id: uid(), icon:'auto', title:n, subtitle:'', description:'' }));
}
function defaultTerms(){
  return [
    'Package is non-refundable.', 'Package is non-changeable.',
    'Payment must be made in full before ticket issuance.',
    'Hotel allocation is subject to availability.',
    'Flight schedule may change without prior notice.'
  ].map(t => ({ id: uid(), text: t }));
}
function defaultState(name){
  return {
    id: uid(), modified: Date.now(),
    templateId: 'royal-green',
    general: {
      packageName: name || 'Premium Umrah Package', subtitle: 'A blessed journey to the Holy Cities',
      duration: '10 Days', nights: '9', travelDates: '', travelMonth: '', hijriMonth: '',
      currency: 'USD', status: 'Available', offerLabel: ''
    },
    airline: { name:'', fullName:'', code:'', logo:'', primaryColor:'#0F5132', secondaryColor:'#1B2A4A' },
    header: { image:'', position:'center', height:150, overlayOpacity:0.35, show:true, title:'Umrah Package', subtitle:'Makkah · Madinah' },
    packages: [ makePackage('Economy Package', '#0F5132'), makePackage('Premium Package', '#1B2A4A') ],
    flights: [],
    child: { price:'', label:'Child (without bed)', icon:'', show:true },
    infant: { price:'', label:'Infant (under 2 yrs)', icon:'', show:true },
    services: defaultServices(),
    termsShow: true,
    terms: defaultTerms(),
    contact: { agency:'', phone:'', whatsapp:'', email:'', website:'', address:'', social:'', logo:'' },
    media: {},
    theme: {
      primary:'#0F5132', secondary:'#1B2A4A', accent:'#B8892E', text:'#23201A',
      background:'#FEFDFB', card:'#FFFFFF', border:'#E6E0D2',
      headingFont:'Fraunces', bodyFont:'Work Sans', priceFont:'Fraunces',
      headingSize:30, bodySize:13, priceSize:17
    },
    layout: { visibility: { header:true, packages:true, flights:true, child:true, services:true, terms:true, footer:true } },
    exportSettings: { format:'pdf', size:'a4p', quality:'high', customW:1080, customH:1350 }
  };
}
function vis(key){ return state.layout.visibility[key] !== false; }

let state = defaultState();
let activeTab = 'general';
let mobileEditorOpen = false;
let zoomPct = 100;
let galleryFilter = 'all';
let templateModalForSwitch = false;

/* ------------------- PERSISTENCE + PACKAGE LIBRARY ------------------ */
const LIB_KEY = 'umrah_studio_library_v2';
const CURRENT_KEY = 'umrah_studio_current_v2';
const OLD_LIB_KEY = 'umrah_studio_library_v1';
const OLD_CURRENT_KEY = 'umrah_studio_current_v1';

function migrateOldStorage(){
  // Preserve any data saved by the earlier version of the app (v1 keys) so nothing is lost.
  if (!localStorage.getItem(LIB_KEY) && localStorage.getItem(OLD_LIB_KEY)){
    try {
      const old = JSON.parse(localStorage.getItem(OLD_LIB_KEY)) || [];
      old.forEach(entry => { if (!entry.state.templateId) entry.state.templateId = 'royal-green'; if (!entry.state.exportSettings) entry.state.exportSettings = defaultState().exportSettings; });
      setLibrary(old);
    } catch(e){ /* ignore */ }
  }
}
function getLibrary(){ try { return JSON.parse(localStorage.getItem(LIB_KEY)) || []; } catch(e){ return []; } }
function setLibrary(list){ localStorage.setItem(LIB_KEY, JSON.stringify(list)); }

function saveCurrentToLibrary(showToast=true){
  setAutosave('saving');
  state.modified = Date.now();
  let lib = getLibrary();
  const idx = lib.findIndex(p => p.id === state.id);
  const entry = { id: state.id, name: state.general.packageName || 'Untitled Package', modified: state.modified, templateId: state.templateId, state: JSON.parse(JSON.stringify(state)) };
  if (idx >= 0) lib[idx] = entry; else lib.push(entry);
  setLibrary(lib);
  localStorage.setItem(CURRENT_KEY, JSON.stringify(state));
  setTimeout(() => setAutosave('saved'), 260);
  if (showToast) toast('Package saved', 'success');
}
const autosave = debounce(() => saveCurrentToLibrary(false), 900);
function setAutosave(mode){
  const el = $('#autosaveIndicator'); if (!el) return;
  el.textContent = mode === 'saving' ? 'Saving…' : 'Saved ✓';
  el.style.opacity = mode === 'saving' ? '0.7' : '1';
}
function loadPackageById(id){
  const found = getLibrary().find(p => p.id === id);
  if (found){ state = JSON.parse(JSON.stringify(found.state)); if(!state.exportSettings) state.exportSettings = defaultState().exportSettings; openStudio(); }
}
function deletePackageById(id){ setLibrary(getLibrary().filter(p => p.id !== id)); renderLibraryList(); toast('Package deleted', 'success'); }
function duplicatePackageById(id){
  const lib = getLibrary();
  const found = lib.find(p => p.id === id);
  if (!found) return;
  const copy = JSON.parse(JSON.stringify(found.state));
  copy.id = uid(); copy.general.packageName = (copy.general.packageName || 'Package') + ' (Copy)'; copy.modified = Date.now();
  lib.push({ id: copy.id, name: copy.general.packageName, modified: copy.modified, templateId: copy.templateId, state: copy });
  setLibrary(lib); renderLibraryList(); toast('Package duplicated', 'success');
}

/* --------------------------- TOAST SYSTEM --------------------------- */
function toast(msg, type=''){
  const host = $('#toastHost');
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

/* --------------------------- IMAGE HANDLING -------------------------- */
function resizeImageFile(file, maxDim=900, quality=0.82){
  return new Promise((resolve, reject) => {
    const validTypes = ['image/png','image/jpeg','image/jpg','image/webp','image/svg+xml'];
    if (!validTypes.includes(file.type)){ reject(new Error('Unsupported file type. Use PNG, JPG, WEBP or SVG.')); return; }
    if (file.type === 'image/svg+xml'){
      const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); return;
    }
    const img = new Image(); const r = new FileReader();
    r.onload = () => {
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim){ const scale = maxDim / Math.max(width, height); width = Math.round(width*scale); height = Math.round(height*scale); }
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Could not read image.'));
      img.src = r.result;
    };
    r.onerror = reject; r.readAsDataURL(file);
  });
}
function bindUpload(inputEl, onLoaded){
  inputEl.addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try { const dataUrl = await resizeImageFile(file); onLoaded(dataUrl); }
    catch(err){ toast(err.message || 'Upload failed', 'error'); }
  });
}

/* ---------------------------- ICON LIBRARY ---------------------------- */
const ICONS = {
  visa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 14h4"/></svg>',
  hotel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 21V9l6-4 6 4v12"/><path d="M9 21v-6h6v6M15 9h6v12"/></svg>',
  flight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M10.5 21l1.5-6 8-5-1-1.7-8.3 2.9L4 8 2 9l4.5 4L5 20l1.5.7L9 17l1.5 4z"/></svg>',
  transport: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="7" width="18" height="10" rx="2"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/></svg>',
  support: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M8 12a4 4 0 118 0"/><path d="M5 12v3M19 12v3"/></svg>',
  ziyarat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3s3 3 3 6-1.5 4-3 4-3-1-3-4 3-6 3-6z"/><path d="M6 21v-6a6 6 0 0112 0v6"/></svg>',
  breakfast: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4v9a5 5 0 0010 0V4"/><path d="M14 8h3a3 3 0 010 6h-1"/></svg>',
  transfer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 12h13M12 6l4 6-4 6"/><path d="M21 12h-4"/></svg>',
  laundry: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="13" r="4"/><circle cx="7.5" cy="6" r=".7" fill="currentColor" stroke="none"/></svg>',
  guide: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="3.2"/><path d="M5 21c0-4 3.1-6.5 7-6.5s7 2.5 7 6.5"/></svg>',
  default: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20 6L9 17l-5-5"/></svg>'
};
function iconFor(title){
  const t = (title||'').toLowerCase();
  if (t.includes('visa')) return ICONS.visa;
  if (t.includes('hotel') || t.includes('accommodation')) return ICONS.hotel;
  if (t.includes('ticket') || t.includes('flight') || t.includes('air')) return ICONS.flight;
  if (t.includes('transport') || t.includes('bus')) return ICONS.transport;
  if (t.includes('support')) return ICONS.support;
  if (t.includes('ziyarat')) return ICONS.ziyarat;
  if (t.includes('breakfast') || t.includes('meal') || t.includes('food')) return ICONS.breakfast;
  if (t.includes('transfer') || t.includes('airport')) return ICONS.transfer;
  if (t.includes('laundry')) return ICONS.laundry;
  if (t.includes('guide')) return ICONS.guide;
  return ICONS.default;
}
function starString(rating){
  const full = Math.round(rating || 0);
  return '★'.repeat(clamp(full,0,5)) + '☆'.repeat(5 - clamp(full,0,5));
}

/* ============================================================================
   TEMPLATE ENGINE — 10 independently composed layouts.
   Each template gets: id, name, categories (for filters), a default palette +
   fonts (applied like a preset when chosen), and a render(state) function that
   returns the inner HTML of the poster. Composition, hierarchy, decoration and
   section order genuinely differ per template — not just color swaps.
   ============================================================================ */
const TEMPLATE_META = [
  { id:'luxury-gold', name:'Luxury Gold', cats:['luxury'],
    palette:{ primary:'#C9A227', secondary:'#F3D27A', accent:'#F3D27A', text:'#F3EDE0', background:'#141110', card:'#1D1915', border:'#3A3226' },
    headingFont:'Fraunces', bodyFont:'Work Sans', priceFont:'Fraunces' },
  { id:'royal-green', name:'Royal Green', cats:['islamic','luxury'],
    palette:{ primary:'#F3D27A', secondary:'#B8892E', accent:'#F3D27A', text:'#F7F3E8', background:'#0B3A24', card:'#0F4A2E', border:'#1F5C3D' },
    headingFont:'Fraunces', bodyFont:'Work Sans', priceFont:'Fraunces' },
  { id:'makkah-madinah', name:'Makkah & Madinah', cats:['islamic'],
    palette:{ primary:'#1B2A4A', secondary:'#0F5132', accent:'#B8892E', text:'#20201A', background:'#FFFFFF', card:'#FFFFFF', border:'#E6E0D2' },
    headingFont:'Fraunces', bodyFont:'Work Sans', priceFont:'Fraunces' },
  { id:'airline-premium', name:'Airline Premium', cats:['airline','modern'],
    palette:{ primary:'#12233F', secondary:'#3B5EA8', accent:'#C9A227', text:'#16233B', background:'#F4F6FA', card:'#FFFFFF', border:'#D8E0EC' },
    headingFont:'Montserrat', bodyFont:'Montserrat', priceFont:'Montserrat' },
  { id:'modern-card', name:'Modern Card', cats:['modern','social'],
    palette:{ primary:'#0F5132', secondary:'#1B2A4A', accent:'#D97757', text:'#23201A', background:'#F7F5EF', card:'#FFFFFF', border:'#E6E0D2' },
    headingFont:'Poppins', bodyFont:'Work Sans', priceFont:'Poppins' },
  { id:'minimal-professional', name:'Minimal Professional', cats:['minimal'],
    palette:{ primary:'#23201A', secondary:'#6B665A', accent:'#0F5132', text:'#23201A', background:'#FFFFFF', card:'#FFFFFF', border:'#E2E2E2' },
    headingFont:'Inter', bodyFont:'Inter', priceFont:'Inter' },
  { id:'premium-brochure', name:'Premium Brochure', cats:['luxury','modern'],
    palette:{ primary:'#8A2E1F', secondary:'#1B2A4A', accent:'#C9A227', text:'#241D16', background:'#FBF8F2', card:'#FFFFFF', border:'#E9DFC8' },
    headingFont:'Playfair Display', bodyFont:'Work Sans', priceFont:'Playfair Display' },
  { id:'islamic-elegance', name:'Islamic Elegance', cats:['islamic'],
    palette:{ primary:'#0A3A24', secondary:'#B8892E', accent:'#EFD9A6', text:'#241D16', background:'#FBF7EC', card:'#FFFFFF', border:'#E3D6B4' },
    headingFont:'Cormorant Garamond', bodyFont:'Work Sans', priceFont:'Cormorant Garamond' },
  { id:'seasonal-special', name:'Seasonal Special', cats:['seasonal'],
    palette:{ primary:'#A3402E', secondary:'#0F5132', accent:'#F3D27A', text:'#241D16', background:'#FFF8EE', card:'#FFFFFF', border:'#F0DFC8' },
    headingFont:'Fraunces', bodyFont:'Work Sans', priceFont:'Fraunces' },
  { id:'social-media-premium', name:'Social Media Premium', cats:['social'],
    palette:{ primary:'#F3D27A', secondary:'#B8892E', accent:'#F3D27A', text:'#FFFFFF', background:'#0B2A1C', card:'#123826', border:'#1F5C3D' },
    headingFont:'Poppins', bodyFont:'Poppins', priceFont:'Poppins' }
];
function templateMeta(id){ return TEMPLATE_META.find(t => t.id === id) || TEMPLATE_META[1]; }
const FONT_OPTIONS = ['Fraunces','Playfair Display','Work Sans','Inter','Poppins','Merriweather','Montserrat','Cormorant Garamond'];
const loadedFonts = new Set(['Fraunces','Work Sans']);
function ensureFontLoaded(family){
  if (loadedFonts.has(family)) return;
  const link = document.createElement('link'); link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link); loadedFonts.add(family);
}
function applyTemplate(id, preserveTheme=false){
  const m = templateMeta(id);
  state.templateId = id;
  if (!preserveTheme){
    Object.assign(state.theme, m.palette, { headingFont:m.headingFont, bodyFont:m.bodyFont, priceFont:m.priceFont });
  }
}

/* ---- shared data helpers used across templates ---- */
function pkgPricing(pkg){ return pkg.pricing.filter(p => p.visible); }
function fmtPrice(pr, cur){ return pr.price !== '' ? `${pr.currency || cur} ${pr.price}` : ''; }
function hotelHasData(h){ return !!(h.name || h.image); }
function offerLabel(){ return state.general.offerLabel || 'SPECIAL PACKAGE'; }

function svgHotelIcon(){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="16" height="16"><path d="M3 21V9l6-4 6 4v12"/><path d="M9 21v-6h6v6M15 9h6v12"/></svg>'; }
function svgFlightIcon(){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="16" height="16"><path d="M10.5 21l1.5-6 8-5-1-1.7-8.3 2.9L4 8 2 9l4.5 4L5 20l1.5.7L9 17l1.5 4z"/></svg>'; }

function servicesRow(){
  if (!vis('services') || !state.services.length) return '';
  return `<div class="blk-services"><div class="services-grid">
    ${state.services.map(s => `<div class="service-item">${iconFor(s.title)}<h6>${escapeHtml(s.title)}</h6>${s.subtitle?`<p>${escapeHtml(s.subtitle)}</p>`:''}</div>`).join('')}
  </div></div>`;
}
function termsBlock(){
  if (!vis('terms') || !state.termsShow || !state.terms.length) return '';
  return `<div class="blk-terms"><h6 class="blk-heading">Terms &amp; Conditions</h6>
    <ul class="terms-list">${state.terms.map(t => `<li>${escapeHtml(t.text)}</li>`).join('')}</ul></div>`;
}
function childInfantInline(){
  if (!vis('child') || !state.child.show) return '';
  const cur = state.general.currency || '';
  return `<div class="blk-child-infant">
    <div class="ci-card"><b>${escapeHtml(state.child.label)}</b><span class="ci-price">${state.child.price!==''?cur+' '+state.child.price:'—'}</span></div>
    <div class="ci-card"><b>${escapeHtml(state.infant.label)}</b><span class="ci-price">${state.infant.price!==''?cur+' '+state.infant.price:'—'}</span></div>
  </div>`;
}
function metaChips(){
  const g = state.general;
  const chips = [g.duration && `${escapeHtml(g.duration)}${g.nights?', '+escapeHtml(g.nights)+' Nights':''}`, g.travelMonth && escapeHtml(g.travelMonth), g.hijriMonth && escapeHtml(g.hijriMonth), g.status && escapeHtml(g.status)].filter(Boolean);
  return chips.map(c => `<span class="meta-chip">${c}</span>`).join('');
}
function footerBlock(variant){
  if (!vis('footer')) return '';
  const c = state.contact;
  const lines = [c.phone, c.whatsapp && ('WhatsApp: '+c.whatsapp), c.email, c.website].filter(Boolean).map(escapeHtml).join(' &nbsp;·&nbsp; ');
  if (variant === 'bold'){
    return `<div class="blk-footer footer-bold">
      <div class="footer-agency">${c.logo?`<img src="${c.logo}">`:''}<b>${escapeHtml(c.agency||'Your Travel Agency')}</b></div>
      <div class="footer-big-contact">${lines || 'Add your contact details'}</div>
    </div>`;
  }
  return `<div class="blk-footer">
    <div class="footer-agency">${c.logo?`<img src="${c.logo}">`:''}<b>${escapeHtml(c.agency||'Your Travel Agency')}</b></div>
    <div class="footer-contacts">${lines}${c.address?'<br>'+escapeHtml(c.address):''}</div>
  </div>`;
}
function flightsBlock(variant){
  if (!vis('flights') || !state.flights.length) return '';
  if (variant === 'route'){
    return `<div class="blk-flights flights-route">
      ${state.flights.map(f => `
        <div class="route-card">
          <div class="route-top"><span>${escapeHtml(f.airline||state.airline.name||'')}</span><span>${escapeHtml(f.flightNo)}</span><span class="route-dir">${f.direction.toUpperCase()}</span></div>
          <div class="route-line"><span class="route-code">${escapeHtml(f.from)}</span><span class="route-dash"></span>${svgFlightIcon()}<span class="route-dash"></span><span class="route-code">${escapeHtml(f.to)}</span></div>
          <div class="route-times"><span>${escapeHtml(f.date)}</span><span>${escapeHtml(f.depTime)} → ${escapeHtml(f.arrTime)}</span>${f.terminal?`<span>T${escapeHtml(f.terminal)}</span>`:''}</div>
        </div>`).join('')}
    </div>`;
  }
  if (variant === 'timeline'){
    return `<div class="blk-flights flights-timeline">
      ${state.flights.map(f => `<div class="tl-item"><span class="tl-dot"></span><div class="tl-body"><b>${f.direction.toUpperCase()} · ${escapeHtml(f.from)} → ${escapeHtml(f.to)}</b><span>${escapeHtml(f.date)} · ${escapeHtml(f.depTime)}-${escapeHtml(f.arrTime)} ${f.flightNo?'· '+escapeHtml(f.flightNo):''}</span></div></div>`).join('')}
    </div>`;
  }
  // default compact cards
  return `<div class="blk-flights flights-compact">
    ${state.flights.map(f => `<div class="flight-card">
      <div class="flight-card-top"><span>${f.direction.toUpperCase()}${f.airline?' · '+escapeHtml(f.airline):''}</span><span>${escapeHtml(f.flightNo)}</span></div>
      <div class="flight-route"><span>${escapeHtml(f.from)}</span><span class="arrow">→</span><span>${escapeHtml(f.to)}</span></div>
      <div class="flight-details">${[f.date,f.depTime&&('Dep '+f.depTime),f.arrTime&&('Arr '+f.arrTime),f.terminal&&('T'+f.terminal),f.baggage,f.meal].filter(Boolean).map(escapeHtml).join(' · ')}</div>
    </div>`).join('')}
  </div>`;
}
function hotelPhotoCard(hotel, label){
  return `<div class="hp-card">
    <div class="hp-img" style="${hotel.image?`background-image:url('${hotel.image}')`:''}">${!hotel.image?`<span class="hp-ph">${label}</span>`:''}</div>
    <div class="hp-body"><h5>${label}${hotel.name?': '+escapeHtml(hotel.name):''}</h5>
      <p>${[hotel.distance && (escapeHtml(hotel.distance)+' '+escapeHtml(hotel.unit)), hotel.location, hotel.nights && (hotel.nights+' Nights'), hotel.transport].filter(Boolean).map(escapeHtml).join(' · ')}</p>
      <div class="hp-rating">${starString(hotel.rating)}</div>
    </div></div>`;
}
function hotelTextRow(hotel, label){
  if (!hotelHasData(hotel)) return '';
  return `<div class="ht-row">${svgHotelIcon()}<div><b>${label}${hotel.name?': '+escapeHtml(hotel.name):''}</b>
    <span>${[hotel.distance && (escapeHtml(hotel.distance)+' '+escapeHtml(hotel.unit)), hotel.location, hotel.nights && (hotel.nights+' Nights'), hotel.transport].filter(Boolean).map(escapeHtml).join(' · ')}</span></div></div>`;
}
function pricingPills(pkg, cur){
  const rows = pkgPricing(pkg);
  if (!rows.length) return '';
  return `<div class="pr-pills">${rows.map(pr => `<div class="pr-pill"><span class="pr-type">${escapeHtml(pr.roomType)}</span><span class="pr-amt">${fmtPrice(pr,cur)||'—'}</span>${pr.label?`<span class="pr-label">${escapeHtml(pr.label)}</span>`:''}</div>`).join('')}</div>`;
}
function pricingTable(pkg, cur){
  const rows = pkgPricing(pkg);
  if (!rows.length) return '';
  return `<table class="pr-table"><tbody>${rows.map(pr => `<tr><td>${escapeHtml(pr.roomType)}${pr.label?' <span class="pr-label-inline">('+escapeHtml(pr.label)+')</span>':''}</td><td>${fmtPrice(pr,cur)||'—'}</td></tr>`).join('')}</tbody></table>`;
}
function pricingTicket(pkg, cur){
  const rows = pkgPricing(pkg);
  if (!rows.length) return '';
  return `<div class="pr-ticket">${rows.map(pr => `<div class="pr-stub"><span>${escapeHtml(pr.roomType)}</span><b>${fmtPrice(pr,cur)||'—'}</b></div>`).join('')}</div>`;
}

/* ============================ 10 TEMPLATE RENDERERS ======================= */

/* 1. LUXURY GOLD — dark, centered hero, framed gold panels, ticket-strip pricing */
function renderTpl_luxuryGold(){
  const g = state.general, a = state.airline, h = state.header, cur = g.currency;
  return `
  <div class="lux-frame">
    ${vis('header') ? `<div class="lux-hero" style="${h.image?`background-image:url('${h.image}')`:''}">
      <div class="lux-hero-overlay"></div>
      <div class="lux-hero-content">
        <span class="lux-kicker">◆ ${escapeHtml(a.name || 'PREMIUM TRAVEL')} ◆</span>
        <h1>${escapeHtml(h.title || g.packageName)}</h1>
        <p>${escapeHtml(h.subtitle)}</p>
        <div class="lux-meta">${metaChips()}</div>
      </div>
    </div>` : ''}
    ${vis('packages') ? state.packages.map(p => `
      <div class="lux-package">
        <div class="lux-pkg-head"><h2>${escapeHtml(p.title)}</h2>${p.badge?`<span class="lux-badge">${escapeHtml(p.badge)}</span>`:''}</div>
        ${p.description?`<p class="lux-desc">${escapeHtml(p.description)}</p>`:''}
        <div class="lux-hotel-row">
          <div class="lux-hotel-panel">${hotelPhotoCard(p.makkah,'Makkah')}</div>
          <div class="lux-hotel-panel">${hotelPhotoCard(p.madinah,'Madinah')}</div>
        </div>
        ${pricingTicket(p, cur)}
      </div>`).join('') : ''}
    ${flightsBlock('route')}
    ${childInfantInline()}
    ${servicesRow()}
    ${termsBlock()}
    ${footerBlock()}
  </div>`;
}

/* 2. ROYAL GREEN — centered title banner, side-by-side big photo blocks, strip pricing */
function renderTpl_royalGreen(){
  const g = state.general, cur = g.currency, h = state.header;
  return `
  <div class="rg-frame">
    ${vis('header') ? `<div class="rg-title-band">
      <h1>${escapeHtml(h.title || g.packageName)}</h1>
      <p>${escapeHtml(h.subtitle)}</p>
      <div class="rg-meta">${metaChips()}</div>
    </div>` : ''}
    ${vis('packages') ? state.packages.map(p => `
      <div class="rg-package">
        <div class="rg-pkg-title"><h2>${escapeHtml(p.title)}</h2>${p.badge?`<span class="rg-badge">${escapeHtml(p.badge)}</span>`:''}</div>
        <div class="rg-photo-split">
          ${hotelPhotoCard(p.makkah,'Makkah')}
          ${hotelPhotoCard(p.madinah,'Madinah')}
        </div>
        ${pricingPills(p, cur)}
      </div>`).join('') : ''}
    ${flightsBlock('compact')}
    ${childInfantInline()}
    ${servicesRow()}
    ${termsBlock()}
    ${footerBlock()}
  </div>`;
}

/* 3. MAKKAH & MADINAH — photography split screen with floating info card */
function renderTpl_makkahMadinah(){
  const g = state.general, cur = g.currency, h = state.header;
  const p0 = state.packages[0] || makePackage('Package','#1B2A4A');
  return `
  <div class="mm-frame">
    <div class="mm-split">
      <div class="mm-half" style="${p0.makkah.image?`background-image:url('${p0.makkah.image}')`:''}"><span class="mm-cap">Makkah</span></div>
      <div class="mm-half" style="${p0.madinah.image?`background-image:url('${p0.madinah.image}')`:''}"><span class="mm-cap">Madinah</span></div>
    </div>
    ${vis('header') ? `<div class="mm-float-card">
      <h1>${escapeHtml(h.title || g.packageName)}</h1>
      <p>${escapeHtml(h.subtitle)}</p>
      <div class="mm-meta">${metaChips()}</div>
    </div>` : ''}
    ${vis('packages') ? state.packages.map(p => `
      <div class="mm-package">
        <div class="mm-pkg-head"><h3>${escapeHtml(p.title)}</h3>${p.badge?`<span class="mm-badge">${escapeHtml(p.badge)}</span>`:''}</div>
        <div class="mm-hotel-lines">${hotelTextRow(p.makkah,'Makkah')}${hotelTextRow(p.madinah,'Madinah')}</div>
        ${pricingTable(p, cur)}
      </div>`).join('') : ''}
    ${flightsBlock('compact')}
    ${childInfantInline()}
    ${servicesRow()}
    ${termsBlock()}
    ${footerBlock()}
  </div>`;
}

/* 4. AIRLINE PREMIUM — boarding-pass style route centerpiece + hotel timeline + ticket-stub pricing */
function renderTpl_airlinePremium(){
  const g = state.general, a = state.airline, cur = g.currency;
  return `
  <div class="ap-frame">
    ${vis('header') ? `<div class="ap-ticket-head">
      <div class="ap-ticket-left"><span class="ap-eyebrow">BOARDING PACKAGE</span><h1>${escapeHtml(g.packageName)}</h1><p>${escapeHtml(state.header.subtitle)}</p></div>
      ${a.logo || a.name ? `<div class="ap-airline-box">${a.logo?`<img src="${a.logo}">`:''}<span>${escapeHtml(a.name)}</span></div>` : ''}
    </div>
    <div class="ap-perforation"></div>` : ''}
    ${flightsBlock('route')}
    ${vis('packages') ? state.packages.map(p => `
      <div class="ap-package">
        <div class="ap-pkg-head"><h3>${escapeHtml(p.title)}</h3>${p.badge?`<span class="ap-badge">${escapeHtml(p.badge)}</span>`:''}</div>
        <div class="ap-timeline">${hotelTextRow(p.makkah,'Makkah')}${hotelTextRow(p.madinah,'Madinah')}</div>
        ${pricingTicket(p, cur)}
      </div>`).join('') : ''}
    ${childInfantInline()}
    ${servicesRow()}
    ${termsBlock()}
    ${footerBlock('bold')}
  </div>`;
}

/* 5. MODERN CARD — dashboard-like grid of independent rounded cards */
function renderTpl_modernCard(){
  const g = state.general, h = state.header, a = state.airline, cur = g.currency;
  return `
  <div class="mc-frame">
    ${vis('header') ? `<div class="mc-header-card">
      ${a.logo?`<img class="mc-logo" src="${a.logo}">`:''}
      <div><h1>${escapeHtml(h.title || g.packageName)}</h1><p>${escapeHtml(h.subtitle)}</p></div>
    </div>
    <div class="mc-chip-row">${metaChips()}</div>` : ''}
    <div class="mc-grid">
      ${vis('flights') && state.flights.length ? `<div class="mc-card mc-flight-card">${flightsBlock('compact')}</div>` : ''}
      ${vis('packages') ? state.packages.map(p => `
        <div class="mc-card mc-package-card" style="--pkg-color:${p.color}">
          <div class="mc-pkg-top"><h3>${escapeHtml(p.title)}</h3>${p.badge?`<span class="mc-badge">${escapeHtml(p.badge)}</span>`:''}</div>
          <div class="mc-hotel-mini">${hotelTextRow(p.makkah,'Makkah')}${hotelTextRow(p.madinah,'Madinah')}</div>
          ${pricingPills(p, cur)}
        </div>`).join('') : ''}
    </div>
    ${childInfantInline()}
    ${servicesRow()}
    ${termsBlock()}
    <div class="mc-card">${footerBlock()}</div>
  </div>`;
}

/* 6. MINIMAL PROFESSIONAL — plain document style, label:value rows, thin rules */
function renderTpl_minimal(){
  const g = state.general, h = state.header, cur = g.currency;
  return `
  <div class="mn-frame">
    ${vis('header') ? `<div class="mn-head"><h1>${escapeHtml(h.title || g.packageName)}</h1><p>${escapeHtml(h.subtitle)}</p>
      <div class="mn-meta-line">${[g.duration, g.nights&&(g.nights+' nights'), g.travelDates, g.status].filter(Boolean).map(escapeHtml).join('   |   ')}</div>
    </div><hr>` : ''}
    ${vis('packages') ? state.packages.map(p => `
      <div class="mn-package">
        <h3>${escapeHtml(p.title)}${p.badge?' — '+escapeHtml(p.badge):''}</h3>
        ${p.description?`<p class="mn-desc">${escapeHtml(p.description)}</p>`:''}
        <div class="mn-row"><span>Makkah Hotel</span><span>${escapeHtml(p.makkah.name)||'—'} ${p.makkah.distance?`(${escapeHtml(p.makkah.distance)} ${escapeHtml(p.makkah.unit)})`:''}</span></div>
        <div class="mn-row"><span>Madinah Hotel</span><span>${escapeHtml(p.madinah.name)||'—'} ${p.madinah.distance?`(${escapeHtml(p.madinah.distance)} ${escapeHtml(p.madinah.unit)})`:''}</span></div>
        ${pkgPricing(p).map(pr => `<div class="mn-row"><span>${escapeHtml(pr.roomType)}</span><span class="mn-price">${fmtPrice(pr,cur)||'—'}</span></div>`).join('')}
        <hr>
      </div>`).join('') : ''}
    ${vis('flights') && state.flights.length ? `<div class="mn-flights"><h4>Flight Information</h4>
      ${state.flights.map(f => `<div class="mn-row"><span>${f.direction.toUpperCase()} ${escapeHtml(f.flightNo)}</span><span>${escapeHtml(f.from)} → ${escapeHtml(f.to)}, ${escapeHtml(f.date)} ${escapeHtml(f.depTime)}-${escapeHtml(f.arrTime)}</span></div>`).join('')}<hr></div>` : ''}
    ${childInfantInline()}
    ${vis('services') && state.services.length ? `<div class="mn-services"><h4>Included Services</h4><p>${state.services.map(s=>escapeHtml(s.title)).join(' · ')}</p><hr></div>` : ''}
    ${termsBlock()}
    ${footerBlock()}
  </div>`;
}

/* 7. PREMIUM BROCHURE — magazine hero + two-column body */
function renderTpl_brochure(){
  const g = state.general, h = state.header, cur = g.currency;
  const p0 = state.packages[0] || makePackage('Package','#8A2E1F');
  return `
  <div class="pb-frame">
    ${vis('header') ? `<div class="pb-hero" style="${h.image?`background-image:url('${h.image}')`:''}">
      <div class="pb-hero-overlay"></div>
      <div class="pb-hero-text"><h1>${escapeHtml(h.title || g.packageName)}</h1><p>${escapeHtml(h.subtitle)}</p></div>
    </div>
    <div class="pb-deck">${metaChips()}</div>` : ''}
    <div class="pb-cols">
      <div class="pb-col-main">
        ${vis('packages') ? state.packages.map(p => `<div class="pb-package"><h3>${escapeHtml(p.title)}${p.badge?` <span class="pb-badge">${escapeHtml(p.badge)}</span>`:''}</h3>${p.description?`<p>${escapeHtml(p.description)}</p>`:''}</div>`).join('') : ''}
        ${servicesRow()}
        ${flightsBlock('compact')}
      </div>
      <div class="pb-col-side">
        ${vis('packages') ? state.packages.map(p => `<div class="pb-side-card">${hotelTextRow(p.makkah,'Makkah')}${hotelTextRow(p.madinah,'Madinah')}${pricingTable(p, cur)}</div>`).join('') : ''}
        ${childInfantInline()}
      </div>
    </div>
    ${termsBlock()}
    ${footerBlock()}
  </div>`;
}

/* 8. ISLAMIC ELEGANCE — arch-framed hero, geometric borders, centered narrow column */
function renderTpl_islamicElegance(){
  const g = state.general, h = state.header, cur = g.currency;
  return `
  <div class="ie-frame">
    <div class="ie-geo-strip"></div>
    ${vis('header') ? `<div class="ie-arch" style="${h.image?`background-image:url('${h.image}')`:''}">
      <div class="ie-arch-overlay"></div>
      <div class="ie-arch-text"><h1>${escapeHtml(h.title || g.packageName)}</h1><p>${escapeHtml(h.subtitle)}</p></div>
    </div>` : ''}
    <div class="ie-meta">${metaChips()}</div>
    <div class="ie-narrow">
      ${vis('packages') ? state.packages.map(p => `
        <div class="ie-panel">
          <h3>${escapeHtml(p.title)}${p.badge?` · ${escapeHtml(p.badge)}`:''}</h3>
          <div class="ie-hotels">${hotelTextRow(p.makkah,'Makkah')}${hotelTextRow(p.madinah,'Madinah')}</div>
          <div class="ie-price-board">${pricingPills(p, cur)}</div>
        </div>`).join('') : ''}
      ${flightsBlock('timeline')}
      ${childInfantInline()}
      ${servicesRow()}
      ${termsBlock()}
    </div>
    <div class="ie-geo-strip"></div>
    ${footerBlock()}
  </div>`;
}

/* 9. SEASONAL SPECIAL — ribbon banner, diagonal accent, emphasized single price */
function renderTpl_seasonal(){
  const g = state.general, h = state.header, cur = g.currency;
  return `
  <div class="ss-frame">
    <div class="ss-diagonal"></div>
    ${vis('header') ? `<div class="ss-head">
      <span class="ss-ribbon">${escapeHtml(offerLabel())}</span>
      <h1>${escapeHtml(h.title || g.packageName)}</h1>
      <p>${escapeHtml(h.subtitle)}</p>
      <div class="ss-meta">${metaChips()}</div>
    </div>` : ''}
    ${vis('packages') ? state.packages.map(p => {
      const prices = pkgPricing(p);
      const hero = prices[0], rest = prices.slice(1);
      return `<div class="ss-package">
        <div class="ss-pkg-head"><h3>${escapeHtml(p.title)}</h3>${p.badge?`<span class="ss-badge">${escapeHtml(p.badge)}</span>`:''}</div>
        <div class="ss-body">
          <div class="ss-hero-price">${hero?`<span class="ss-hp-type">${escapeHtml(hero.roomType)}</span><span class="ss-hp-amt">${fmtPrice(hero,cur)}</span>`:'<span class="ss-hp-type">Contact for pricing</span>'}</div>
          <div class="ss-hotel-icons">${hotelTextRow(p.makkah,'Makkah')}${hotelTextRow(p.madinah,'Madinah')}</div>
          ${rest.length?`<div class="ss-other-prices">${rest.map(pr=>`<span>${escapeHtml(pr.roomType)}: ${fmtPrice(pr,cur)||'—'}</span>`).join('')}</div>`:''}
        </div>
      </div>`;
    }).join('') : ''}
    ${flightsBlock('compact')}
    ${childInfantInline()}
    ${servicesRow()}
    ${termsBlock()}
    ${footerBlock()}
  </div>`;
}

/* 10. SOCIAL MEDIA PREMIUM — vertical, huge title, single hero image, floating price badge */
function renderTpl_social(){
  const g = state.general, h = state.header, cur = g.currency;
  const p0 = state.packages[0] || makePackage('Package','#0F5132');
  const heroPrice = pkgPricing(p0)[0];
  return `
  <div class="sm-frame">
    ${vis('header') ? `<div class="sm-title-block"><h1>${escapeHtml(h.title || g.packageName)}</h1><p>${escapeHtml(h.subtitle)}</p></div>` : ''}
    <div class="sm-hero" style="${h.image?`background-image:url('${h.image}')`:(p0.makkah.image?`background-image:url('${p0.makkah.image}')`:'')}">
      ${heroPrice ? `<div class="sm-price-badge"><span>${escapeHtml(heroPrice.roomType)}</span><b>${fmtPrice(heroPrice,cur)}</b></div>` : ''}
    </div>
    <div class="sm-meta">${metaChips()}</div>
    ${vis('packages') ? `<div class="sm-hotel-rows">${hotelTextRow(p0.makkah,'Makkah')}${hotelTextRow(p0.madinah,'Madinah')}</div>` : ''}
    ${vis('flights') && state.flights.length ? flightsBlock('compact') : ''}
    ${childInfantInline()}
    ${servicesRow()}
    <div class="sm-contact-bar">${footerBlock('bold')}</div>
  </div>`;
}

const TEMPLATE_RENDERERS = {
  'luxury-gold': renderTpl_luxuryGold, 'royal-green': renderTpl_royalGreen, 'makkah-madinah': renderTpl_makkahMadinah,
  'airline-premium': renderTpl_airlinePremium, 'modern-card': renderTpl_modernCard, 'minimal-professional': renderTpl_minimal,
  'premium-brochure': renderTpl_brochure, 'islamic-elegance': renderTpl_islamicElegance, 'seasonal-special': renderTpl_seasonal,
  'social-media-premium': renderTpl_social
};
function renderTemplateHtml(){ const fn = TEMPLATE_RENDERERS[state.templateId] || renderTpl_royalGreen; return fn(); }

/* ---- demo data used to render real thumbnails before a package has content ---- */
function demoState(templateId){
  const d = defaultState('Premium Umrah Package');
  applyTemplate(templateId, false);
  d.templateId = templateId;
  Object.assign(d.theme, templateMeta(templateId).palette, templateMeta(templateId));
  d.general = Object.assign(d.general, { subtitle:'Makkah · Madinah · 5-Star Hotels', duration:'14 Days', nights:'13', travelMonth:'January', status:'Available' });
  d.header.title = 'Umrah Package';
  d.header.subtitle = 'Makkah · Madinah';
  d.packages[0].title = 'Economy Package'; d.packages[0].badge='Best Value';
  d.packages[0].makkah = Object.assign(makeHotel(), { name:'Al Marwa Rayhaan', distance:'250', unit:'m', nights:'6' });
  d.packages[0].madinah = Object.assign(makeHotel(), { name:'Dar Al Taqwa', distance:'400', unit:'m', nights:'7' });
  d.packages[0].pricing = [ {id:uid(),roomType:'Quad',price:'1450',currency:'$',label:'',visible:true}, {id:uid(),roomType:'Triple',price:'1650',currency:'$',label:'',visible:true}, {id:uid(),roomType:'Double',price:'1950',currency:'$',label:'',visible:true} ];
  d.contact.agency = 'Your Travel Agency';
  d.contact.phone = '+1 555 0100';
  d.flights = [{ id:uid(), direction:'departure', airline:'Featured Air', flightNo:'FA 101', date:'12 Jan', from:'JFK', to:'JED', depTime:'22:05', arrTime:'14:20', terminal:'2', baggage:'', meal:'', notes:'' }];
  return d;
}
function renderPosterHtmlFor(s){
  const prevState = state; state = s;
  const html = renderTemplateHtml();
  state = prevState;
  return html;
}
function themeVarsStyleFor(s){
  const t = s.theme;
  return `--poster-bg:${t.background};--poster-ink:${t.text};--poster-primary:${t.primary};--poster-primary-soft:${t.primary}22;--poster-gold:${t.accent};--line-poster:${t.border};--poster-card:${t.card};--poster-heading-font:'${t.headingFont}';--poster-body-font:'${t.bodyFont}';--poster-price-font:'${t.priceFont}';--heading-size:${t.headingSize}px;--price-size:${t.priceSize}px;font-size:${t.bodySize}px;`;
}

/* ============================ TEMPLATE CHOOSER (GALLERY + IN-STUDIO MODAL) ================== */
const FILTERS = ['all','luxury','islamic','airline','modern','minimal','social','seasonal'];
function templateThumbHtml(id){
  const s = demoState(id);
  return `<div class="thumb-scale" style="${themeVarsStyleFor(s)}background:${s.theme.background};">
    <div class="poster tpl-${id}">${renderPosterHtmlFor(s)}</div>
  </div>`;
}
function buildTemplateGridHtml(filter){
  const list = TEMPLATE_META.filter(t => filter === 'all' || t.cats.includes(filter));
  return list.map(t => `
    <div class="tpl-card" data-tpl="${t.id}">
      <div class="tpl-thumb-frame">${templateThumbHtml(t.id)}</div>
      <div class="tpl-card-body"><h3>${t.name}</h3><button class="tpl-use-btn" data-tpl="${t.id}">Use Layout</button></div>
    </div>`).join('') || '<div class="lib-empty">No templates in this category.</div>';
}
function wireTemplateGrid(gridEl, onPick){
  $$('.tpl-card', gridEl).forEach(card => {
    card.addEventListener('click', () => onPick(card.dataset.tpl));
  });
}
function renderFilterBar(hostEl, onFilter){
  hostEl.innerHTML = FILTERS.map(f => `<button class="filter-chip ${f===galleryFilter?'active':''}" data-f="${f}">${f[0].toUpperCase()+f.slice(1)}</button>`).join('');
  $$('.filter-chip', hostEl).forEach(b => b.addEventListener('click', () => { galleryFilter = b.dataset.f; onFilter(); }));
}

function renderGalleryCards(){
  renderFilterBar($('#galleryFilters'), renderGalleryCards);
  $('#galleryGrid').innerHTML = buildTemplateGridHtml(galleryFilter);
  wireTemplateGrid($('#galleryGrid'), (tplId) => {
    state = defaultState(); applyTemplate(tplId); openStudio();
  });
}
function renderLibraryList(){
  const lib = getLibrary().sort((a,b) => b.modified - a.modified);
  $('#libraryCount').textContent = lib.length ? `${lib.length} saved` : '';
  const host = $('#libraryList');
  if (!lib.length){ host.innerHTML = '<div class="lib-empty">No saved packages yet — create one from a template above.</div>'; return; }
  host.innerHTML = lib.map(p => `
    <div class="lib-item" data-id="${p.id}">
      <div class="lib-item-info"><b>${escapeHtml(p.name)}</b><span>${templateMeta(p.templateId||'royal-green').name} · ${new Date(p.modified).toLocaleDateString()}</span></div>
      <div class="lib-item-actions"><button data-act="edit">Edit</button><button data-act="dup">Duplicate</button><button data-act="del">Delete</button></div>
    </div>`).join('');
  $$('.lib-item', host).forEach(row => {
    const id = row.dataset.id;
    row.querySelector('[data-act=edit]').addEventListener('click', () => loadPackageById(id));
    row.querySelector('[data-act=dup]').addEventListener('click', () => duplicatePackageById(id));
    row.querySelector('[data-act=del]').addEventListener('click', () => { if (confirm('Delete this saved package?')) deletePackageById(id); });
  });
}
function openGallery(){
  $('#studio').classList.add('hidden'); $('#gallery').classList.remove('hidden');
  galleryFilter = 'all';
  renderGalleryCards(); renderLibraryList();
}
function openStudio(){
  $('#gallery').classList.add('hidden'); $('#studio').classList.remove('hidden');
  activeTab = 'general'; zoomPct = 100;
  renderEditorTabs(); renderEditorBody(); renderAll();
}

/* in-studio "Change Design" modal — switching preserves all package data */
function openTemplateSwitchModal(){
  const modal = $('#templateModal');
  modal.classList.remove('hidden');
  galleryFilter = 'all';
  const paint = () => {
    renderFilterBar($('#templateModalFilters'), paint);
    $('#templateModalGrid').innerHTML = buildTemplateGridHtml(galleryFilter);
    $$('.tpl-card', $('#templateModalGrid')).forEach(card => {
      if (card.dataset.tpl === state.templateId) card.classList.add('selected');
      card.addEventListener('click', () => {
        applyTemplate(card.dataset.tpl);
        renderEditorBody(); renderAll(); autosave();
        modal.classList.add('hidden');
        toast(`Switched to ${templateMeta(card.dataset.tpl).name} — your data was kept`, 'success');
      });
    });
  };
  paint();
}

/* ============================ EDITOR (SIDEBAR) ================================= */
const TABS = [
  ['general','Package Info'], ['airline','Airline'], ['header','Header'], ['packages','Packages'],
  ['flights','Flights'], ['services','Services'], ['terms','Terms'], ['contact','Contact'],
  ['media','Media'], ['design','Design'], ['sections','Sections']
];
function renderEditorTabs(){
  $('#editorTabs').innerHTML = TABS.map(([key,label]) => `<button class="editor-tab ${key===activeTab?'active':''}" data-tab="${key}">${label}</button>`).join('');
  $$('.editor-tab').forEach(b => b.addEventListener('click', () => { activeTab = b.dataset.tab; renderEditorTabs(); renderEditorBody(); }));
}
function field(label, inputHtml){ return `<div class="field"><label>${label}</label>${inputHtml}</div>`; }
function uploadBox(id, currentValue, label){
  return `<div class="field"><label>${label}</label><div class="upload-box" id="${id}_box">
    ${currentValue ? `<img src="${currentValue}" />` : ''}
    <div>${currentValue ? 'Replace image' : 'Click or drop to upload (PNG, JPG, WEBP, SVG)'}</div>
    <input type="file" id="${id}" accept=".png,.jpg,.jpeg,.webp,.svg" /></div></div>`;
}
function onChange(){ renderAll(); autosave(); }

function renderEditorBody(){
  const body = $('#editorBody');
  switch(activeTab){
    case 'general': body.innerHTML = tplGeneral(); bindGeneral(); break;
    case 'airline': body.innerHTML = tplAirline(); bindAirline(); break;
    case 'header': body.innerHTML = tplHeader(); bindHeader(); break;
    case 'packages': body.innerHTML = tplPackages(); bindPackages(); break;
    case 'flights': body.innerHTML = tplFlights(); bindFlights(); break;
    case 'services': body.innerHTML = tplServices(); bindServices(); break;
    case 'terms': body.innerHTML = tplTerms(); bindTerms(); break;
    case 'contact': body.innerHTML = tplContact(); bindContact(); break;
    case 'media': body.innerHTML = tplMedia(); break;
    case 'design': body.innerHTML = tplDesign(); bindDesign(); break;
    case 'sections': body.innerHTML = tplSections(); bindSections(); break;
  }
}

/* ---- GENERAL ---- */
function tplGeneral(){
  const g = state.general;
  return `<div class="field-group"><h4>Package identity</h4>
    ${field('Package Name', `<input type="text" id="g_name" value="${escapeHtml(g.packageName)}">`)}
    ${field('Subtitle', `<input type="text" id="g_subtitle" value="${escapeHtml(g.subtitle)}">`)}
    <div class="field-row">${field('Duration', `<input type="text" id="g_duration" value="${escapeHtml(g.duration)}">`)}${field('Nights', `<input type="text" id="g_nights" value="${escapeHtml(g.nights)}">`)}</div>
    <div class="field-row">${field('Travel Dates', `<input type="text" id="g_dates" placeholder="e.g. 12 – 22 Jan" value="${escapeHtml(g.travelDates)}">`)}${field('Travel Month', `<input type="text" id="g_month" value="${escapeHtml(g.travelMonth)}">`)}</div>
    <div class="field-row">${field('Hijri Month', `<input type="text" id="g_hijri" value="${escapeHtml(g.hijriMonth)}">`)}${field('Currency', `<input type="text" id="g_currency" value="${escapeHtml(g.currency)}">`)}</div>
    ${field('Package Status', `<select id="g_status">${['Available','Limited Seats','Sold Out','Coming Soon'].map(s=>`<option ${g.status===s?'selected':''}>${s}</option>`).join('')}</select>`)}
    ${field('Offer / Season Label', `<input type="text" id="g_offer" placeholder="e.g. RAMADAN SPECIAL (used by Seasonal Special design)" value="${escapeHtml(g.offerLabel)}">`)}
  </div>`;
}
function bindGeneral(){
  const map = { g_name:'packageName', g_subtitle:'subtitle', g_duration:'duration', g_nights:'nights', g_dates:'travelDates', g_month:'travelMonth', g_hijri:'hijriMonth', g_currency:'currency', g_status:'status', g_offer:'offerLabel' };
  Object.entries(map).forEach(([id,key]) => $('#'+id).addEventListener('input', e => { state.general[key] = e.target.value; if(id==='g_name'){ $('#packageNameTop').value = e.target.value; } onChange(); }));
}

/* ---- AIRLINE ---- */
function tplAirline(){
  const a = state.airline;
  return `<div class="field-group"><h4>Airline details</h4>
    ${field('Airline Name', `<input type="text" id="a_name" value="${escapeHtml(a.name)}">`)}
    ${field('Airline Full Name', `<input type="text" id="a_full" value="${escapeHtml(a.fullName)}">`)}
    ${field('Airline Code', `<input type="text" id="a_code" placeholder="e.g. SV" value="${escapeHtml(a.code)}">`)}
    ${uploadBox('a_logo', a.logo, 'Airline Logo')}
  </div>`;
}
function bindAirline(){
  $('#a_name').addEventListener('input', e => { state.airline.name = e.target.value; onChange(); });
  $('#a_full').addEventListener('input', e => { state.airline.fullName = e.target.value; onChange(); });
  $('#a_code').addEventListener('input', e => { state.airline.code = e.target.value; onChange(); });
  bindUpload($('#a_logo'), dataUrl => { state.airline.logo = dataUrl; renderEditorBody(); onChange(); });
}

/* ---- HEADER ---- */
function tplHeader(){
  const h = state.header;
  return `<div class="field-group"><h4>Header</h4>
    <div class="checkbox-row"><input type="checkbox" id="h_show" ${h.show?'checked':''}><label>Show header</label></div>
    ${uploadBox('h_image', h.image, 'Header / Hero Image')}
    ${field('Overlay Opacity', `<input type="number" id="h_overlay" value="${h.overlayOpacity}" min="0" max="1" step="0.05">`)}
    ${field('Header Title', `<input type="text" id="h_title" value="${escapeHtml(h.title)}">`)}
    ${field('Header Subtitle', `<input type="text" id="h_subtitle" value="${escapeHtml(h.subtitle)}">`)}
  </div>`;
}
function bindHeader(){
  $('#h_show').addEventListener('change', e => { state.header.show = e.target.checked; onChange(); });
  $('#h_overlay').addEventListener('input', e => { state.header.overlayOpacity = clamp(+e.target.value,0,1); onChange(); });
  $('#h_title').addEventListener('input', e => { state.header.title = e.target.value; onChange(); });
  $('#h_subtitle').addEventListener('input', e => { state.header.subtitle = e.target.value; onChange(); });
  bindUpload($('#h_image'), dataUrl => { state.header.image = dataUrl; renderEditorBody(); onChange(); });
}

/* ---- PACKAGES (incl. hotels + pricing) ---- */
function tplPackages(){
  const ci = `<div class="field-group"><h4>Child &amp; Infant Pricing</h4>
    <div class="checkbox-row"><input type="checkbox" id="ci_show" ${state.child.show?'checked':''}><label>Show child / infant section</label></div>
    <div class="field-row">${field('Child Label', `<input type="text" id="ci_child_label" value="${escapeHtml(state.child.label)}">`)}${field('Child Price', `<input type="number" id="ci_child_price" value="${escapeHtml(state.child.price)}">`)}</div>
    <div class="field-row">${field('Infant Label', `<input type="text" id="ci_infant_label" value="${escapeHtml(state.infant.label)}">`)}${field('Infant Price', `<input type="number" id="ci_infant_price" value="${escapeHtml(state.infant.price)}">`)}</div>
  </div>`;
  const hotelFields = (p, key, label) => {
    const h = p[key];
    return `<h4 style="margin-top:14px;font-size:11px;letter-spacing:.04em;color:var(--emerald);">${label} Hotel</h4>
      ${field('Hotel Name', `<input type="text" data-hk="${key}.name" value="${escapeHtml(h.name)}">`)}
      <div class="field-row">${field('Distance', `<input type="text" data-hk="${key}.distance" value="${escapeHtml(h.distance)}">`)}${field('Unit', `<select data-hk="${key}.unit">${['m','km','meters from Haram'].map(u=>`<option ${h.unit===u?'selected':''}>${u}</option>`).join('')}</select>`)}</div>
      ${field('Road / Location', `<input type="text" data-hk="${key}.location" value="${escapeHtml(h.location)}">`)}
      <div class="field-row">${field('Nights', `<input type="text" data-hk="${key}.nights" value="${escapeHtml(h.nights)}">`)}${field('Transport', `<input type="text" data-hk="${key}.transport" placeholder="Shuttle / Walking" value="${escapeHtml(h.transport)}">`)}</div>
      <div class="field-row">${field('Rating (0-5)', `<input type="number" min="0" max="5" step="0.5" data-hk="${key}.rating" value="${h.rating}">`)}${field('Maps Link', `<input type="url" data-hk="${key}.mapsLink" value="${escapeHtml(h.mapsLink)}">`)}</div>
      ${uploadBox(`${key}_img_${p.id}`, h.image, 'Hotel Image')}`;
  };
  const pkgCards = state.packages.map((p, i) => `
    <div class="editor-item-card" data-pid="${p.id}">
      <div class="editor-item-head"><span>Package ${i+1}</span>
        <div class="editor-item-actions">
          <button class="mini-btn" data-act="up" ${i===0?'disabled':''}>↑</button>
          <button class="mini-btn" data-act="down" ${i===state.packages.length-1?'disabled':''}>↓</button>
          <button class="mini-btn" data-act="dup">Duplicate</button>
          <button class="mini-btn danger" data-act="del">Delete</button>
        </div></div>
      ${field('Title', `<input type="text" data-k="title" value="${escapeHtml(p.title)}">`)}
      ${field('Subtitle', `<input type="text" data-k="subtitle" value="${escapeHtml(p.subtitle)}">`)}
      <div class="field-row">${field('Badge', `<input type="text" data-k="badge" placeholder="e.g. Best Value" value="${escapeHtml(p.badge)}">`)}${field('Color', `<input type="color" data-k="color" value="${p.color}">`)}</div>
      ${field('Description', `<textarea data-k="description">${escapeHtml(p.description)}</textarea>`)}
      ${hotelFields(p, 'makkah', 'Makkah')}
      ${hotelFields(p, 'madinah', 'Madinah')}
      <h4 style="margin-top:14px;font-size:11px;letter-spacing:.04em;color:var(--emerald);">Pricing</h4>
      <div class="pricing-editor">
        ${p.pricing.map(pr => `
          <div class="editor-item-card" data-prid="${pr.id}" style="margin-bottom:8px;">
            <div class="field-row">${field('Room Type', `<input type="text" data-pk="roomType" value="${escapeHtml(pr.roomType)}">`)}${field('Price', `<input type="number" data-pk="price" value="${escapeHtml(pr.price)}">`)}</div>
            <div class="field-row">${field('Label', `<input type="text" data-pk="label" placeholder="optional" value="${escapeHtml(pr.label)}">`)}
              <div class="field" style="display:flex;align-items:center;gap:6px;padding-top:20px;"><input type="checkbox" data-pk="visible" ${pr.visible?'checked':''}><label style="margin:0;">Visible</label></div></div>
            <button class="mini-btn danger" data-act="del-price">Remove room type</button>
          </div>`).join('')}
        <button class="add-btn" data-act="add-price">+ Add Room Type</button>
      </div>
    </div>`).join('');
  return `${ci}<div class="field-group"><h4>Packages</h4>${pkgCards}<button class="add-btn" id="addPackageBtn">+ Add Package</button></div>`;
}
function bindPackages(){
  $('#ci_show').addEventListener('change', e => { state.child.show = state.infant.show = e.target.checked; onChange(); });
  $('#ci_child_label').addEventListener('input', e => { state.child.label = e.target.value; onChange(); });
  $('#ci_child_price').addEventListener('input', e => { state.child.price = e.target.value; onChange(); });
  $('#ci_infant_label').addEventListener('input', e => { state.infant.label = e.target.value; onChange(); });
  $('#ci_infant_price').addEventListener('input', e => { state.infant.price = e.target.value; onChange(); });
  $('#addPackageBtn').addEventListener('click', () => { state.packages.push(makePackage('New Package', '#0F5132')); renderEditorBody(); onChange(); });

  $$('.editor-item-card[data-pid]').forEach(card => {
    const pid = card.dataset.pid;
    const pkg = state.packages.find(p => p.id === pid);
    if (!pkg) return;
    $$('input[data-k], textarea[data-k]', card).forEach(inp => inp.addEventListener('input', () => { pkg[inp.dataset.k] = inp.value; onChange(); }));
    $$('[data-hk]', card).forEach(inp => inp.addEventListener('input', () => {
      const [hotel, key] = inp.dataset.hk.split('.'); let v = inp.value;
      if (key === 'rating') v = clamp(parseFloat(v) || 0, 0, 5);
      pkg[hotel][key] = v; onChange();
    }));
    const mkUp = $(`#makkah_img_${pid}`); if (mkUp) bindUpload(mkUp, dataUrl => { pkg.makkah.image = dataUrl; renderEditorBody(); onChange(); });
    const mdUp = $(`#madinah_img_${pid}`); if (mdUp) bindUpload(mdUp, dataUrl => { pkg.madinah.image = dataUrl; renderEditorBody(); onChange(); });
    card.querySelector('[data-act=up]')?.addEventListener('click', () => { moveItem(state.packages, pkg.id, -1); renderEditorBody(); onChange(); });
    card.querySelector('[data-act=down]')?.addEventListener('click', () => { moveItem(state.packages, pkg.id, 1); renderEditorBody(); onChange(); });
    card.querySelector('[data-act=dup]')?.addEventListener('click', () => {
      const copy = JSON.parse(JSON.stringify(pkg)); copy.id = uid(); copy.title += ' (Copy)'; copy.pricing.forEach(pr => pr.id = uid());
      state.packages.splice(state.packages.indexOf(pkg)+1, 0, copy); renderEditorBody(); onChange();
    });
    card.querySelector('[data-act=del]')?.addEventListener('click', () => {
      if (state.packages.length <= 1){ toast('At least one package is required', 'error'); return; }
      state.packages = state.packages.filter(p => p.id !== pid); renderEditorBody(); onChange();
    });
    $$('.pricing-editor .editor-item-card', card).forEach(prCard => {
      const prid = prCard.dataset.prid;
      const pr = pkg.pricing.find(x => x.id === prid);
      if (!pr) return;
      $$('[data-pk]', prCard).forEach(inp => {
        const evt = inp.type === 'checkbox' ? 'change' : 'input';
        inp.addEventListener(evt, () => {
          const k = inp.dataset.pk;
          if (k === 'visible') pr.visible = inp.checked;
          else if (k === 'price'){ if (inp.value !== '' && isNaN(+inp.value)){ toast('Price must be numeric', 'error'); return; } pr.price = inp.value; }
          else pr[k] = inp.value;
          onChange();
        });
      });
      prCard.querySelector('[data-act=del-price]').addEventListener('click', () => { pkg.pricing = pkg.pricing.filter(x => x.id !== prid); renderEditorBody(); onChange(); });
    });
    card.querySelector('[data-act=add-price]').addEventListener('click', () => { pkg.pricing.push({ id: uid(), roomType:'Single', price:'', currency:'', label:'', visible:true }); renderEditorBody(); onChange(); });
  });
}
function moveItem(arr, id, dir){ const i = arr.findIndex(x => x.id === id); const j = i + dir; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; }

/* ---- FLIGHTS ---- */
function tplFlights(){
  const rows = state.flights.map((f,i) => `
    <div class="editor-item-card" data-fid="${f.id}">
      <div class="editor-item-head"><span>${f.direction.toUpperCase()} · Flight ${i+1}</span><div class="editor-item-actions"><button class="mini-btn danger" data-act="del">Delete</button></div></div>
      ${field('Direction', `<select data-fk="direction">${['departure','return','connecting'].map(d=>`<option ${f.direction===d?'selected':''}>${d}</option>`).join('')}</select>`)}
      <div class="field-row">${field('Airline', `<input type="text" data-fk="airline" value="${escapeHtml(f.airline)}">`)}${field('Flight Number', `<input type="text" data-fk="flightNo" value="${escapeHtml(f.flightNo)}">`)}</div>
      <div class="field-row">${field('Date', `<input type="date" data-fk="date" value="${escapeHtml(f.date)}">`)}${field('Terminal', `<input type="text" data-fk="terminal" value="${escapeHtml(f.terminal)}">`)}</div>
      <div class="field-row">${field('From', `<input type="text" data-fk="from" value="${escapeHtml(f.from)}">`)}${field('To', `<input type="text" data-fk="to" value="${escapeHtml(f.to)}">`)}</div>
      <div class="field-row">${field('Departure Time', `<input type="text" data-fk="depTime" placeholder="14:30" value="${escapeHtml(f.depTime)}">`)}${field('Arrival Time', `<input type="text" data-fk="arrTime" placeholder="18:10" value="${escapeHtml(f.arrTime)}">`)}</div>
      <div class="field-row">${field('Baggage', `<input type="text" data-fk="baggage" placeholder="30kg" value="${escapeHtml(f.baggage)}">`)}${field('Meal', `<input type="text" data-fk="meal" placeholder="Included" value="${escapeHtml(f.meal)}">`)}</div>
      ${field('Notes', `<textarea data-fk="notes">${escapeHtml(f.notes)}</textarea>`)}
    </div>`).join('');
  return `<div class="field-group"><h4>Flights</h4>${rows || '<div class="empty-hint">No flights added yet.</div>'}<button class="add-btn" id="addFlightBtn">+ Add Flight</button></div>`;
}
function bindFlights(){
  $('#addFlightBtn').addEventListener('click', () => {
    state.flights.push({ id: uid(), direction:'departure', airline: state.airline.name || '', flightNo:'', date:'', from:'', to:'', depTime:'', arrTime:'', terminal:'', baggage:'', meal:'', notes:'' });
    renderEditorBody(); onChange();
  });
  $$('.editor-item-card[data-fid]').forEach(card => {
    const fid = card.dataset.fid;
    const f = state.flights.find(x => x.id === fid);
    $$('[data-fk]', card).forEach(inp => {
      const evt = inp.tagName === 'SELECT' ? 'change' : 'input';
      inp.addEventListener(evt, () => { f[inp.dataset.fk] = inp.value; onChange(); if (inp.dataset.fk === 'direction') renderEditorBody(); });
    });
    card.querySelector('[data-act=del]').addEventListener('click', () => { state.flights = state.flights.filter(x => x.id !== fid); renderEditorBody(); onChange(); });
  });
}

/* ---- SERVICES ---- */
function tplServices(){
  const rows = state.services.map((s,i) => `
    <div class="editor-item-card" data-sid="${s.id}">
      <div class="editor-item-head"><span>Service ${i+1}</span>
        <div class="editor-item-actions"><button class="mini-btn" data-act="up" ${i===0?'disabled':''}>↑</button><button class="mini-btn" data-act="down" ${i===state.services.length-1?'disabled':''}>↓</button><button class="mini-btn danger" data-act="del">Delete</button></div></div>
      ${field('Title', `<input type="text" data-sk="title" value="${escapeHtml(s.title)}">`)}
      ${field('Subtitle', `<input type="text" data-sk="subtitle" value="${escapeHtml(s.subtitle)}">`)}
      ${field('Description', `<textarea data-sk="description">${escapeHtml(s.description)}</textarea>`)}
    </div>`).join('');
  return `<div class="field-group"><h4>Services</h4>${rows}<button class="add-btn" id="addServiceBtn">+ Add Service</button></div>`;
}
function bindServices(){
  $('#addServiceBtn').addEventListener('click', () => { state.services.push({ id: uid(), icon:'auto', title:'New Service', subtitle:'', description:'' }); renderEditorBody(); onChange(); });
  $$('.editor-item-card[data-sid]').forEach(card => {
    const sid = card.dataset.sid;
    const s = state.services.find(x => x.id === sid);
    $$('[data-sk]', card).forEach(inp => inp.addEventListener('input', () => { s[inp.dataset.sk] = inp.value; onChange(); }));
    card.querySelector('[data-act=up]')?.addEventListener('click', () => { moveItem(state.services, sid, -1); renderEditorBody(); onChange(); });
    card.querySelector('[data-act=down]')?.addEventListener('click', () => { moveItem(state.services, sid, 1); renderEditorBody(); onChange(); });
    card.querySelector('[data-act=del]').addEventListener('click', () => { state.services = state.services.filter(x => x.id !== sid); renderEditorBody(); onChange(); });
  });
}

/* ---- TERMS ---- */
function tplTerms(){
  const rows = state.terms.map((t) => `
    <div class="field-row" data-tid="${t.id}" style="align-items:center;">
      <div class="field" style="flex:1;"><input type="text" data-tk="text" value="${escapeHtml(t.text)}"></div>
      <button class="mini-btn danger" data-act="del" style="height:38px;">✕</button>
    </div>`).join('');
  return `<div class="field-group"><h4>Terms &amp; Conditions</h4>
    <div class="checkbox-row"><input type="checkbox" id="terms_show" ${state.termsShow?'checked':''}><label>Show terms section</label></div>
    <div id="termsList">${rows}</div><button class="add-btn" id="addTermBtn">+ Add Bullet Point</button></div>`;
}
function bindTerms(){
  $('#terms_show').addEventListener('change', e => { state.termsShow = e.target.checked; onChange(); });
  $('#addTermBtn').addEventListener('click', () => { state.terms.push({ id: uid(), text:'New condition' }); renderEditorBody(); onChange(); });
  $$('#termsList [data-tid]').forEach(row => {
    const tid = row.dataset.tid;
    const t = state.terms.find(x => x.id === tid);
    row.querySelector('[data-tk]').addEventListener('input', e => { t.text = e.target.value; onChange(); });
    row.querySelector('[data-act=del]').addEventListener('click', () => { state.terms = state.terms.filter(x => x.id !== tid); renderEditorBody(); onChange(); });
  });
}

/* ---- CONTACT ---- */
function tplContact(){
  const c = state.contact;
  return `<div class="field-group"><h4>Contact / Agency</h4>
    ${field('Agency Name', `<input type="text" id="c_agency" value="${escapeHtml(c.agency)}">`)}
    <div class="field-row">${field('Phone', `<input type="tel" id="c_phone" value="${escapeHtml(c.phone)}">`)}${field('WhatsApp', `<input type="tel" id="c_whatsapp" value="${escapeHtml(c.whatsapp)}">`)}</div>
    <div class="field-row">${field('Email', `<input type="email" id="c_email" value="${escapeHtml(c.email)}">`)}${field('Website', `<input type="text" id="c_website" value="${escapeHtml(c.website)}">`)}</div>
    ${field('Address', `<textarea id="c_address">${escapeHtml(c.address)}</textarea>`)}
    ${field('Social Links', `<input type="text" id="c_social" placeholder="Instagram, Facebook…" value="${escapeHtml(c.social)}">`)}
    ${uploadBox('c_logo', c.logo, 'Agency Logo')}
  </div>`;
}
function bindContact(){
  const map = { c_agency:'agency', c_phone:'phone', c_whatsapp:'whatsapp', c_email:'email', c_website:'website', c_address:'address', c_social:'social' };
  Object.entries(map).forEach(([id,key]) => $('#'+id).addEventListener('input', e => { state.contact[key] = e.target.value; onChange(); }));
  bindUpload($('#c_logo'), dataUrl => { state.contact.logo = dataUrl; renderEditorBody(); onChange(); });
}

/* ---- MEDIA ---- */
function tplMedia(){
  const categories = [
    ['Airline Logos', state.airline.logo ? [state.airline.logo] : []],
    ['Agency Logos', state.contact.logo ? [state.contact.logo] : []],
    ['Header Images', state.header.image ? [state.header.image] : []],
    ['Hotel Images', state.packages.flatMap(p => [p.makkah.image, p.madinah.image].filter(Boolean))]
  ];
  return `<div class="field-group"><h4>Media Manager</h4>
    <div class="empty-hint">Uploads made in other tabs appear here for a quick overview. Replace or remove them from their original section.</div>
    ${categories.map(([label, imgs]) => `<div style="margin-bottom:16px;"><div style="font-size:12.5px;font-weight:600;margin-bottom:6px;">${label}</div>
      ${imgs.length ? `<div style="display:flex;gap:8px;flex-wrap:wrap;">${imgs.map(i=>`<img src="${i}" style="width:56px;height:56px;object-fit:cover;border-radius:6px;border:1px solid var(--line);">`).join('')}</div>` : `<div class="empty-hint">None uploaded</div>`}</div>`).join('')}
  </div>`;
}

/* ---- DESIGN (template + palette/typography overrides) ---- */
function tplDesign(){
  const t = state.theme, m = templateMeta(state.templateId);
  return `<div class="field-group"><h4>Current Design</h4>
    <div class="current-tpl-card"><b>${m.name}</b><button class="tb-btn tb-primary" id="changeDesignBtn" style="margin-top:8px;">Change Design</button></div>
    <div class="empty-hint">Switching designs keeps every field you've entered — only the visual layout changes.</div>
  </div>
  <div class="field-group"><h4>Color Overrides</h4>
    <div class="field-row">${field('Primary', `<input type="color" id="t_primary" value="${t.primary}">`)}${field('Secondary', `<input type="color" id="t_secondary" value="${t.secondary}">`)}</div>
    <div class="field-row">${field('Accent', `<input type="color" id="t_accent" value="${t.accent}">`)}${field('Text', `<input type="color" id="t_text" value="${t.text}">`)}</div>
    <div class="field-row">${field('Background', `<input type="color" id="t_bg" value="${t.background}">`)}${field('Card', `<input type="color" id="t_card" value="${t.card}">`)}</div>
    ${field('Border', `<input type="color" id="t_border" value="${t.border}">`)}
    <button class="mini-btn" id="resetPaletteBtn" style="margin-top:6px;">Reset to design default</button>
  </div>
  <div class="field-group"><h4>Typography</h4>
    ${field('Heading Font', `<select id="t_hfont">${FONT_OPTIONS.map(f=>`<option ${t.headingFont===f?'selected':''}>${f}</option>`).join('')}</select>`)}
    ${field('Body Font', `<select id="t_bfont">${FONT_OPTIONS.map(f=>`<option ${t.bodyFont===f?'selected':''}>${f}</option>`).join('')}</select>`)}
    ${field('Price Font', `<select id="t_pfont">${FONT_OPTIONS.map(f=>`<option ${t.priceFont===f?'selected':''}>${f}</option>`).join('')}</select>`)}
    <div class="field-row">${field('Heading Size', `<input type="number" id="t_hsize" value="${t.headingSize}" min="18" max="48">`)}${field('Body Size', `<input type="number" id="t_bsize" value="${t.bodySize}" min="10" max="18">`)}${field('Price Size', `<input type="number" id="t_psize" value="${t.priceSize}" min="12" max="28">`)}</div>
  </div>`;
}
function bindDesign(){
  $('#changeDesignBtn').addEventListener('click', openTemplateSwitchModal);
  $('#resetPaletteBtn').addEventListener('click', () => { Object.assign(state.theme, templateMeta(state.templateId).palette); renderEditorBody(); onChange(); });
  const colorMap = { t_primary:'primary', t_secondary:'secondary', t_accent:'accent', t_text:'text', t_bg:'background', t_card:'card', t_border:'border' };
  Object.entries(colorMap).forEach(([id,key]) => $('#'+id).addEventListener('input', e => { state.theme[key] = e.target.value; onChange(); }));
  $('#t_hfont').addEventListener('change', e => { state.theme.headingFont = e.target.value; ensureFontLoaded(e.target.value); onChange(); });
  $('#t_bfont').addEventListener('change', e => { state.theme.bodyFont = e.target.value; ensureFontLoaded(e.target.value); onChange(); });
  $('#t_pfont').addEventListener('change', e => { state.theme.priceFont = e.target.value; ensureFontLoaded(e.target.value); onChange(); });
  $('#t_hsize').addEventListener('input', e => { state.theme.headingSize = +e.target.value; onChange(); });
  $('#t_bsize').addEventListener('input', e => { state.theme.bodySize = +e.target.value; onChange(); });
  $('#t_psize').addEventListener('input', e => { state.theme.priceSize = +e.target.value; onChange(); });
}

/* ---- SECTIONS (show/hide only — composition/order is defined by the chosen design) ---- */
const SECTION_LABELS = { header:'Header', packages:'Package Details', flights:'Flight Information', child:'Child/Infant Pricing', services:'Services', terms:'Terms & Conditions', footer:'Contact / Footer' };
function tplSections(){
  const rows = Object.keys(state.layout.visibility).map(key => `
    <div class="layout-row"><span>${SECTION_LABELS[key] || key}</span>
      <label style="font-size:11px;display:flex;align-items:center;gap:4px;"><input type="checkbox" data-vis="${key}" ${state.layout.visibility[key]?'checked':''}> Show</label>
    </div>`).join('');
  return `<div class="field-group"><h4>Section Visibility</h4>
    <div class="empty-hint">Each of the 10 designs has its own fixed composition. Use these toggles to include or omit a section from the export.</div>
    ${rows}</div>`;
}
function bindSections(){ $$('[data-vis]').forEach(cb => cb.addEventListener('change', () => { state.layout.visibility[cb.dataset.vis] = cb.checked; onChange(); })); }

/* ============================ PREVIEW RENDERER ================================= */
function applyThemeVars(el){
  const t = state.theme;
  ensureFontLoaded(t.headingFont); ensureFontLoaded(t.bodyFont); ensureFontLoaded(t.priceFont);
  el.style.setProperty('--poster-bg', t.background);
  el.style.setProperty('--poster-ink', t.text);
  el.style.setProperty('--poster-primary', t.primary);
  el.style.setProperty('--poster-secondary', t.secondary);
  el.style.setProperty('--poster-primary-soft', t.primary + '22');
  el.style.setProperty('--poster-gold', t.accent);
  el.style.setProperty('--line-poster', t.border);
  el.style.setProperty('--poster-card', t.card);
  el.style.setProperty('--poster-heading-font', `'${t.headingFont}'`);
  el.style.setProperty('--poster-body-font', `'${t.bodyFont}'`);
  el.style.setProperty('--poster-price-font', `'${t.priceFont}'`);
  el.style.setProperty('--heading-size', t.headingSize + 'px');
  el.style.setProperty('--price-size', t.priceSize + 'px');
  el.style.fontSize = t.bodySize + 'px';
}
function renderPoster(){
  const poster = $('#poster');
  if (!poster) return;
  poster.className = `poster tpl-${state.templateId}`;
  applyThemeVars(poster);
  poster.innerHTML = renderTemplateHtml();
}
function renderAll(){
  renderPoster();
  $('#packageNameTop').value = state.general.packageName;
  if (activeTab === 'design'){ const card = $('.current-tpl-card b'); if (card) card.textContent = templateMeta(state.templateId).name; }
}

/* ============================ ZOOM / FIT / FULLSCREEN =========================== */
function applyZoom(){
  $('#posterFrame').style.transform = `scale(${zoomPct/100})`;
  $('#zoomLabel').textContent = Math.round(zoomPct) + '%';
}
function fitToScreen(){
  const wrap = $('#previewScroll');
  const posterW = $('#poster').offsetWidth || 794;
  const available = wrap.clientWidth - 48;
  zoomPct = clamp(Math.floor((available / posterW) * 100), 20, 200);
  applyZoom();
}
function toggleFullscreen(){
  const el = $('.preview-wrap');
  if (!document.fullscreenElement){ el.requestFullscreen?.().catch(()=>toast('Fullscreen not supported here','error')); }
  else document.exitFullscreen?.();
}

/* ============================ EXPORT SIZES ====================================== */
const PAGE_SIZES = {
  a4p:      { w:794,  h:1123, label:'A4 Portrait (210×297mm)', pdf:{format:'a4', orientation:'portrait'} },
  a4l:      { w:1123, h:794,  label:'A4 Landscape (297×210mm)', pdf:{format:'a4', orientation:'landscape'} },
  a5p:      { w:559,  h:794,  label:'A5 Portrait (148×210mm)', pdf:{format:'a5', orientation:'portrait'} },
  a5l:      { w:794,  h:559,  label:'A5 Landscape (210×148mm)', pdf:{format:'a5', orientation:'landscape'} },
  igp:      { w:1080, h:1350, label:'Instagram Portrait (1080×1350)', pdf:null },
  igsq:     { w:1080, h:1080, label:'Instagram Square (1080×1080)', pdf:null },
  igstory:  { w:1080, h:1920, label:'Instagram Story (1080×1920)', pdf:null },
  wastatus: { w:1080, h:1920, label:'WhatsApp Status (1080×1920)', pdf:null },
  wapost:   { w:1080, h:1080, label:'WhatsApp Post (1080×1080)', pdf:null },
  custom:   { w:1080, h:1350, label:'Custom', pdf:null }
};
function currentSizeSpec(){
  const s = state.exportSettings;
  if (s.size === 'custom') return { w: s.customW || 1080, h: s.customH || 1350, label:'Custom', pdf:null };
  return PAGE_SIZES[s.size] || PAGE_SIZES.a4p;
}
function applyPosterSizeForPreview(){
  const spec = currentSizeSpec();
  const poster = $('#poster');
  poster.style.width = spec.w + 'px';
  poster.style.minHeight = spec.h + 'px';
}

/* ============================ FILENAME ========================================== */
function buildFilename(ext){
  const parts = [ state.contact.agency || state.general.packageName || 'UMRAH', 'PACKAGE', state.general.duration, state.general.travelMonth ]
    .filter(Boolean).map(sanitizeFilenamePart).filter(Boolean);
  return (parts.join('-') || 'UMRAH-PACKAGE') + '.' + ext;
}

/* ============================ VALIDATION ========================================= */
function validateBeforeExport(){
  const errs = [];
  if (!state.general.packageName?.trim()) errs.push('Package name is empty.');
  state.packages.forEach((p,i) => { if (!p.title?.trim()) errs.push(`Package ${i+1} has no title.`); });
  errs.forEach(e => toast(e, 'error'));
  return true; // warn, never block
}

/* ============================ EXPORT CENTER ====================================== */
function openExportCenter(){
  const modal = $('#exportModal');
  modal.classList.remove('hidden');
  paintExportCenter();
}
function paintExportCenter(){
  const es = state.exportSettings;
  $$('input[name=exFormat]').forEach(r => r.checked = (r.value === es.format));
  $$('input[name=exSize]').forEach(r => r.checked = (r.value === es.size));
  $('#exQuality').value = es.quality;
  $('#exCustomWrap').classList.toggle('hidden', es.size !== 'custom');
  $('#exCustomW').value = es.customW; $('#exCustomH').value = es.customH;
  const spec = currentSizeSpec();
  $('#exEstimate').textContent = `Output size: ${spec.w} × ${spec.h}px${spec.pdf ? ' · ' + spec.pdf.format.toUpperCase() + ' ' + spec.pdf.orientation : ''}`;
}
function wireExportCenter(){
  $$('input[name=exFormat]').forEach(r => r.addEventListener('change', () => { state.exportSettings.format = r.value; paintExportCenter(); }));
  $$('input[name=exSize]').forEach(r => r.addEventListener('change', () => { state.exportSettings.size = r.value; paintExportCenter(); }));
  $('#exQuality').addEventListener('change', e => { state.exportSettings.quality = e.target.value; });
  $('#exCustomW').addEventListener('input', e => { state.exportSettings.customW = +e.target.value || 1080; paintExportCenter(); });
  $('#exCustomH').addEventListener('input', e => { state.exportSettings.customH = +e.target.value || 1350; paintExportCenter(); });
  $('#closeExportModal').addEventListener('click', () => $('#exportModal').classList.add('hidden'));
  $('#exPreviewBtn').addEventListener('click', () => { $('#exportModal').classList.add('hidden'); applyPosterSizeForPreview(); fitToScreen(); toast('Preview updated to export size'); });
  $('#exExportBtn').addEventListener('click', runExport);
}
async function runExport(){
  validateBeforeExport();
  const es = state.exportSettings;
  const spec = currentSizeSpec();
  const progress = $('#exProgress');
  progress.textContent = 'Preparing design…'; progress.classList.remove('hidden');
  const poster = $('#poster');
  const prevW = poster.style.width, prevH = poster.style.minHeight;
  poster.style.width = spec.w + 'px'; poster.style.minHeight = spec.h + 'px';
  await sleep(120);
  try {
    progress.textContent = 'Rendering…';
    await sleep(80);
    const scale = es.quality === 'high' ? 2 : 1.25;
    const canvas = await html2canvas(poster, { scale, useCORS:true, backgroundColor: state.theme.background });
    if (es.format === 'pdf'){
      progress.textContent = 'Generating PDF…';
      const { jsPDF } = window.jspdf;
      let pdf;
      if (spec.pdf){ pdf = new jsPDF({ unit:'mm', format: spec.pdf.format, orientation: spec.pdf.orientation }); }
      else { pdf = new jsPDF({ unit:'px', format:[spec.w, spec.h], orientation: spec.w > spec.h ? 'landscape':'portrait' }); }
      const pageW = pdf.internal.pageSize.getWidth(), pageH = pdf.internal.pageSize.getHeight();
      const ratio = canvas.height / canvas.width;
      let rw = pageW, rh = pageW * ratio;
      if (rh > pageH){ rh = pageH; rw = pageH / ratio; }
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', (pageW-rw)/2, 0, rw, rh);
      pdf.save(buildFilename('pdf'));
    } else {
      progress.textContent = es.format === 'png' ? 'Generating PNG…' : 'Generating JPG…';
      await sleep(60);
      const link = document.createElement('a');
      link.download = buildFilename(es.format === 'jpg' ? 'jpg' : 'png');
      link.href = canvas.toDataURL(es.format === 'jpg' ? 'image/jpeg' : 'image/png', 0.95);
      link.click();
    }
    progress.textContent = 'Done ✓';
    toast('Export ready', 'success');
    await sleep(700);
  } catch(err){
    console.error('Export error:', err);
    toast('Export failed. Please try again.', 'error');
  } finally {
    poster.style.width = prevW; poster.style.minHeight = prevH;
    progress.classList.add('hidden');
  }
}

/* ============================ PRINT ============================================= */
function openPrintPreview(){
  validateBeforeExport();
  const frame = $('#printFrame');
  const clone = $('#poster').cloneNode(true);
  clone.style.width = '794px'; clone.style.minHeight = '1123px';
  frame.innerHTML = ''; frame.appendChild(clone);
  applyThemeVars(clone);
  $('#printModal').classList.remove('hidden');
}

/* ============================ TOOLBAR / MODALS WIRING ============================ */
function wireToolbar(){
  $('#btnBack').addEventListener('click', () => openGallery());
  $('#packageNameTop').addEventListener('input', e => { state.general.packageName = e.target.value; onChange(); });

  $('#btnNew').addEventListener('click', () => {
    if (!confirm('Start a new blank package? Your current package stays saved in the library.')) return;
    saveCurrentToLibrary(false);
    state = defaultState(); openStudio(); toast('New package started', 'success');
  });
  $('#btnSave').addEventListener('click', () => saveCurrentToLibrary(true));
  $('#btnDuplicate').addEventListener('click', () => {
    saveCurrentToLibrary(false);
    const copy = JSON.parse(JSON.stringify(state));
    copy.id = uid(); copy.general.packageName += ' (Copy)';
    state = copy; saveCurrentToLibrary(false); openStudio();
    toast('Duplicated as new package', 'success');
  });
  $('#btnChangeDesign').addEventListener('click', openTemplateSwitchModal);
  $('#btnPreviewToggle').addEventListener('click', () => { $('#editorPanel').classList.toggle('hidden'); });
  $('#btnReset').addEventListener('click', () => {
    if (!confirm('Reset this package to a blank template? This cannot be undone.')) return;
    const name = state.general.packageName, tid = state.templateId;
    state = defaultState(name); applyTemplate(tid);
    renderEditorTabs(); renderEditorBody(); renderAll(); autosave();
    toast('Package reset', 'success');
  });

  $('#btnExportCenter').addEventListener('click', openExportCenter);
  $('#btnPrint').addEventListener('click', openPrintPreview);
  wireExportCenter();

  $('#drawerToggle').addEventListener('click', () => {
    mobileEditorOpen = !mobileEditorOpen;
    $('#editorPanel').classList.toggle('open', mobileEditorOpen);
    $('#drawerToggle').textContent = mobileEditorOpen ? 'Close ✕' : 'Edit ✎';
  });

  $('#zoomOut').addEventListener('click', () => { zoomPct = clamp(zoomPct - 10, 20, 200); applyZoom(); });
  $('#zoomIn').addEventListener('click', () => { zoomPct = clamp(zoomPct + 10, 20, 200); applyZoom(); });
  $('#zoom100').addEventListener('click', () => { zoomPct = 100; applyZoom(); });
  $('#zoomFit').addEventListener('click', fitToScreen);
  $('#btnFullscreen').addEventListener('click', toggleFullscreen);

  $('#btnPrintPreview').addEventListener('click', openPrintPreview);
  $('#closePrintModal').addEventListener('click', () => $('#printModal').classList.add('hidden'));
  $('#doActualPrint').addEventListener('click', () => window.print());
  $('#closeTemplateModal').addEventListener('click', () => $('#templateModal').classList.add('hidden'));
}

/* ============================== INIT =============================== */
function init(){
  migrateOldStorage();
  $('#createCustomBtn').addEventListener('click', () => { state = defaultState('Untitled Package'); openStudio(); });
  wireToolbar();

  const saved = localStorage.getItem(CURRENT_KEY);
  if (saved){ try { state = JSON.parse(saved); if(!state.exportSettings) state.exportSettings = defaultState().exportSettings; } catch(e){ /* ignore */ } }

  window.addEventListener('resize', debounce(() => { if (!$('#studio').classList.contains('hidden')) fitToScreen(); }, 200));
  openGallery();
}
document.addEventListener('DOMContentLoaded', init);
