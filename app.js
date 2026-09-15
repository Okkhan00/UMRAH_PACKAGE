/* =========================================================================
   UMRAH PACKAGE STUDIO — ENHANCED EDITION
   Features: 24+ templates, undo/redo, zoom, import/export JSON,
   keyboard shortcuts, enhanced library, and more.
   ========================================================================= */

/* ---------------------------- 1. UTILITIES ---------------------------- */
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const uid = () => Math.random().toString(36).slice(2,9) + Date.now().toString(36).slice(-4);
function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }
function escapeHtml(str){ return (str||'').toString().replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }
function download(filename, content, type='application/json'){
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* --------------------- 2. DATA MODEL + DEFAULTS ------------------------ */
function makeHotel(){
  return { name:'', distance:'', unit:'m', location:'', image:'', icon:'', rating:4, mapsLink:'' };
}
function makePackage(title, color, subtitle=''){
  return {
    id: uid(), title, subtitle, color, badge:'', description:'',
    makkah: makeHotel(), madinah: makeHotel(),
    pricing: [ 
      { id: uid(), roomType:'Quad', price:'', currency:'', label:'', visible:true },
      { id: uid(), roomType:'Triple', price:'', currency:'', label:'', visible:true },
      { id: uid(), roomType:'Double', price:'', currency:'', label:'', visible:true }
    ]
  };
}
function defaultServices(){
  const names = ['Visa Processing','Hotel Accommodation','Air Tickets','Transport','24/7 Support','Ziyarat'];
  return names.map(n => ({ id: uid(), icon:'auto', title:n, subtitle:'', description:'' }));
}
function defaultTerms(){
  return [
    'Package is non-refundable.',
    'Package is non-changeable.',
    'Payment must be made in full before ticket issuance.',
    'Hotel allocation is subject to availability.',
    'Flight schedule may change without prior notice.'
  ].map(t => ({ id: uid(), text: t }));
}
function defaultState(name){
  return {
    id: uid(),
    modified: Date.now(),
    general: {
      packageName: name || 'Premium Umrah Package',
      subtitle: 'A blessed journey to the Holy Cities',
      duration: '10 Days', nights: '9', travelDates: '', travelMonth: '',
      hijriMonth: '', currency: 'USD', status: 'Available'
    },
    airline: { name:'', fullName:'', code:'', logo:'', primaryColor:'#0F5132', secondaryColor:'#1B2A4A' },
    header: { image:'', position:'center', height:150, overlayOpacity:0.35, show:true,
              title:'Umrah Package', subtitle:'Makkah · Madinah' },
    packages: [ makePackage('Economy Package', '#0F5132', 'Essential journey'), makePackage('Premium Package', '#1B2A4A', 'Elevated experience') ],
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
      headingSize:30, bodySize:13, priceSize:17, preset:'Classic Green'
    },
    layout: {
      order: ['header','packages','flights','child','services','terms','footer'],
      visibility: { header:true, packages:true, flights:true, child:true, services:true, terms:true, footer:true }
    }
  };
}

let state = defaultState();
let activeTab = 'general';
let mobileEditorOpen = false;
let currentZoom = 1;
let galleryFilter = 'all';

/* --------------- UNDO / REDO SYSTEM --------------- */
const history = { stack: [], index: -1, maxSize: 50 };
function pushHistory(){
  const snapshot = JSON.stringify(state);
  if (history.index >= 0 && history.stack[history.index] === snapshot) return;
  history.stack = history.stack.slice(0, history.index + 1);
  history.stack.push(snapshot);
  if (history.stack.length > history.maxSize) history.stack.shift();
  history.index = history.stack.length - 1;
  updateUndoRedoButtons();
}
function undo(){
  if (history.index <= 0) return;
  history.index--;
  state = JSON.parse(history.stack[history.index]);
  renderAll(); renderEditorTabs(); renderEditorBody();
  updateUndoRedoButtons();
  toast('Undone', '');
}
function redo(){
  if (history.index >= history.stack.length - 1) return;
  history.index++;
  state = JSON.parse(history.stack[history.index]);
  renderAll(); renderEditorTabs(); renderEditorBody();
  updateUndoRedoButtons();
  toast('Redone', '');
}
function updateUndoRedoButtons(){
  const u = $('#btnUndo'), r = $('#btnRedo');
  if (u) u.disabled = history.index <= 0;
  if (r) r.disabled = history.index >= history.stack.length - 1;
}

/* ------------------- 3. PERSISTENCE + PACKAGE LIBRARY ------------------ */
const LIB_KEY = 'umrah_studio_library_v1';
const CURRENT_KEY = 'umrah_studio_current_v1';

function getLibrary(){
  try { return JSON.parse(localStorage.getItem(LIB_KEY)) || []; }
  catch(e){ return []; }
}
function setLibrary(list){ localStorage.setItem(LIB_KEY, JSON.stringify(list)); }

function saveCurrentToLibrary(showToast=true){
  setAutosave('saving');
  state.modified = Date.now();
  let lib = getLibrary();
  const idx = lib.findIndex(p => p.id === state.id);
  const entry = { 
    id: state.id, 
    name: state.general.packageName || 'Untitled Package', 
    modified: state.modified, 
    preset: state.theme.preset || 'Custom',
    state: JSON.parse(JSON.stringify(state)) 
  };
  if (idx >= 0) lib[idx] = entry; else lib.push(entry);
  setLibrary(lib);
  localStorage.setItem(CURRENT_KEY, JSON.stringify(state));
  setTimeout(() => setAutosave('saved'), 260);
  if (showToast) toast('✓ Package saved', 'success');
}
const autosave = debounce(() => saveCurrentToLibrary(false), 900);

function setAutosave(mode){
  const el = $('#autosaveIndicator');
  if (!el) return;
  el.textContent = mode === 'saving' ? 'Saving…' : 'Saved ✓';
  el.style.opacity = mode === 'saving' ? '0.7' : '1';
}

function loadPackageById(id){
  const lib = getLibrary();
  const found = lib.find(p => p.id === id);
  if (found){ 
    state = JSON.parse(JSON.stringify(found.state)); 
    history.stack = []; history.index = -1;
    pushHistory();
    openStudio(); 
  }
}
function deletePackageById(id){
  if (!confirm('Delete this saved package? This cannot be undone.')) return;
  setLibrary(getLibrary().filter(p => p.id !== id));
  renderLibraryList();
  toast('Package deleted', 'success');
}
function duplicatePackageById(id){
  const lib = getLibrary();
  const found = lib.find(p => p.id === id);
  if (!found) return;
  const copy = JSON.parse(JSON.stringify(found.state));
  copy.id = uid(); 
  copy.general.packageName = (copy.general.packageName || 'Package') + ' (Copy)';
  copy.modified = Date.now();
  lib.push({ id: copy.id, name: copy.general.packageName, modified: copy.modified, preset: copy.theme?.preset || 'Custom', state: copy });
  setLibrary(lib);
  renderLibraryList();
  toast('✓ Package duplicated', 'success');
}
function renamePackageById(id){
  const lib = getLibrary();
  const found = lib.find(p => p.id === id);
  if (!found) return;
  const newName = prompt('Rename package:', found.name);
  if (!newName || newName === found.name) return;
  found.name = newName;
  found.state.general.packageName = newName;
  found.modified = Date.now();
  setLibrary(lib);
  renderLibraryList();
  toast('✓ Renamed', 'success');
}

/* ------------------------- 4. THEME PRESETS ----------------------------- */
const THEME_PRESETS = {
  'Classic Green': { primary:'#0F5132', secondary:'#1B2A4A', accent:'#B8892E', background:'#FEFDFB' },
  'Green & Blue':  { primary:'#0F5132', secondary:'#1B4F91', accent:'#C9A227', background:'#F8FAF8' },
  'Luxury Gold':   { primary:'#2B2118', secondary:'#B8892E', accent:'#EFD9A6', background:'#FBF6EA' },
  'Royal Blue':    { primary:'#1B2A4A', secondary:'#3B5EA8', accent:'#C9A227', background:'#F6F8FB' },
  'Emerald':       { primary:'#0B6E4F', secondary:'#0A3A24', accent:'#A9D6C4', background:'#F3FAF6' },
  'Modern':        { primary:'#1E1E1E', secondary:'#4A4A4A', accent:'#D97757', background:'#FFFFFF' },
  'Minimal':       { primary:'#23201A', secondary:'#6B665A', accent:'#23201A', background:'#FFFFFF' },
  'Ramadan':       { primary:'#0A3A24', secondary:'#B8892E', accent:'#F3D27A', background:'#0F241B' },
  'Premium Umrah': { primary:'#0F5132', secondary:'#B8892E', accent:'#1B2A4A', background:'#FDFBF5' },
  'Desert Sand':   { primary:'#8B6914', secondary:'#5C4A1E', accent:'#D4A843', background:'#FDF8ED' },
  'Ocean Breeze':  { primary:'#0C4A6E', secondary:'#0369A1', accent:'#38BDF8', background:'#F0F9FF' },
  'Rose Gold':     { primary:'#9F1239', secondary:'#BE123C', accent:'#FDA4AF', background:'#FFF1F2' },
  'Midnight':      { primary:'#0F172A', secondary:'#1E293B', accent:'#94A3B8', background:'#F8FAFC' },
  'Forest':        { primary:'#166534', secondary:'#15803D', accent:'#86EFAC', background:'#F0FDF4' },
  'Burgundy':      { primary:'#7F1D1D', secondary:'#991B1B', accent:'#FCA5A5', background:'#FEF2F2' },
  'Teal':          { primary:'#134E4A', secondary:'#0F766E', accent:'#5EEAD4', background:'#F0FDFA' }
};
const FONT_OPTIONS = ['Fraunces','Playfair Display','Work Sans','Inter','Poppins','Merriweather','Montserrat','Cormorant Garamond'];
const loadedFonts = new Set(['Fraunces','Work Sans','Playfair Display','Cormorant Garamond','Inter','Poppins','Montserrat']);
function ensureFontLoaded(family){
  if (loadedFonts.has(family)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
  loadedFonts.add(family);
}
function applyPreset(name){
  const p = THEME_PRESETS[name];
  if (!p) return;
  Object.assign(state.theme, p, { preset: name });
  renderAll(); autosave(); pushHistory();
  toast(`Applied "${name}" theme`, 'success');
}

/* ------------------------- 5. ICON LIBRARY (SVG) ------------------------ */
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
  default: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20 6L9 17l-5-5"/></svg>',
  star: '★'
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

/* ---------------------------- 6. TOAST SYSTEM --------------------------- */
function toast(msg, type=''){
  const host = $('#toastHost');
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

/* --------------------------- IMAGE HANDLING ------------------------------ */
function resizeImageFile(file, maxDim=1200, quality=0.85){
  return new Promise((resolve, reject) => {
    const validTypes = ['image/png','image/jpeg','image/jpg','image/webp','image/svg+xml'];
    if (!validTypes.includes(file.type)){ reject(new Error('Unsupported file type. Use PNG, JPG, WEBP or SVG.')); return; }
    if (file.type === 'image/svg+xml'){
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
      return;
    }
    const img = new Image();
    const r = new FileReader();
    r.onload = () => {
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim){
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale); height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Could not read image.'));
      img.src = r.result;
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
function bindUpload(inputEl, onLoaded){
  if (!inputEl) return;
  inputEl.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try { 
      const dataUrl = await resizeImageFile(file); 
      onLoaded(dataUrl); 
      pushHistory();
    }
    catch(err){ toast(err.message || 'Upload failed', 'error'); }
  });
}

/* ============================ 7. GALLERY ================================ */
const TEMPLATE_DEFS = [
  // Classic
  { key:'classic-green', name:'Classic Green', desc:'Traditional Islamic design with emerald tones', preset:'Classic Green', category:'classic', tags:['Popular','Traditional'] },
  { key:'classic-emerald', name:'Emerald Elegance', desc:'Deep emerald with gold accents', preset:'Emerald', category:'classic', tags:['Elegant'] },
  { key:'classic-forest', name:'Forest Serenity', desc:'Natural green tones for a calm feel', preset:'Forest', category:'classic', tags:['Nature'] },
  { key:'classic-teal', name:'Teal Tranquility', desc:'Modern teal with soft accents', preset:'Teal', category:'classic', tags:['Fresh'] },
  
  // Luxury
  { key:'luxury-gold', name:'Luxury Gold', desc:'Premium gold and dark brown palette', preset:'Luxury Gold', category:'luxury', tags:['Premium','Gold'] },
  { key:'luxury-rose', name:'Rose Gold Luxe', desc:'Elegant rose gold and cream', preset:'Rose Gold', category:'luxury', tags:['Feminine','Elegant'] },
  { key:'luxury-burgundy', name:'Burgundy Royale', desc:'Rich burgundy for a regal feel', preset:'Burgundy', category:'luxury', tags:['Royal'] },
  { key:'luxury-desert', name:'Desert Sand', desc:'Warm sand tones inspired by Arabia', preset:'Desert Sand', category:'luxury', tags:['Warm'] },
  
  // Modern
  { key:'modern-midnight', name:'Midnight Modern', desc:'Sleek dark mode design', preset:'Midnight', category:'modern', tags:['Dark','Sleek'] },
  { key:'modern-ocean', name:'Ocean Breeze', desc:'Cool blue modern aesthetic', preset:'Ocean Breeze', category:'modern', tags:['Cool'] },
  { key:'modern-premium', name:'Premium Umrah', desc:'Contemporary with gold accents', preset:'Premium Umrah', category:'modern', tags:['Premium'] },
  { key:'modern-royal', name:'Royal Blue Modern', desc:'Bold navy with clean lines', preset:'Royal Blue', category:'modern', tags:['Bold'] },
  
  // Minimal
  { key:'minimal-white', name:'Pure Minimal', desc:'Clean white with black typography', preset:'Minimal', category:'minimal', tags:['Clean'] },
  { key:'minimal-modern', name:'Modern Minimal', desc:'Simple and sophisticated', preset:'Modern', category:'minimal', tags:['Simple'] },
  
  // Seasonal
  { key:'seasonal-ramadan', name:'Ramadan Special', desc:'Dark theme with golden crescent accents', preset:'Ramadan', category:'seasonal', tags:['Ramadan','Special'] },
  { key:'seasonal-hajj', name:'Hajj Season', desc:'Traditional Hajj colors', preset:'Classic Green', category:'seasonal', tags:['Hajj'] },
  
  // Airline
  { key:'airline-saudia', name:'Saudia Style', desc:'Inspired by Saudia airlines', preset:'Emerald', category:'airline', tags:['Airline'] },
  { key:'airline-emirates', name:'Emirates Style', desc:'Red and gold airline aesthetic', preset:'Burgundy', category:'airline', tags:['Airline'] },
  { key:'airline-qatar', name:'Qatar Airways Style', desc:'Burgundy and grey premium', preset:'Burgundy', category:'airline', tags:['Airline'] },
  { key:'airline-emirates-blue', name:'Emirates Blue', desc:'Blue and gold airline style', preset:'Royal Blue', category:'airline', tags:['Airline'] },
  
  // Extra
  { key:'extra-green-blue', name:'Green & Blue', desc:'Dual-tone classic combination', preset:'Green & Blue', category:'classic', tags:['Dual-tone'] },
  { key:'extra-forest-gold', name:'Forest & Gold', desc:'Nature meets luxury', preset:'Forest', category:'luxury', tags:['Nature','Gold'] },
  { key:'extra-ocean-gold', name:'Ocean & Gold', desc:'Cool blue with warm accents', preset:'Ocean Breeze', category:'modern', tags:['Contrast'] },
  { key:'extra-midnight-gold', name:'Midnight Gold', desc:'Dark elegance with gold', preset:'Midnight', category:'luxury', tags:['Dark','Gold'] }
];

function renderGalleryCards(){
  const grid = $('#galleryGrid');
  const filtered = galleryFilter === 'all' ? TEMPLATE_DEFS : TEMPLATE_DEFS.filter(t => t.category === galleryFilter);
  
  if (!filtered.length){
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><h3>No templates found</h3><p>Try a different filter</p></div>';
    return;
  }
  
  grid.innerHTML = filtered.map(t => {
    const p = THEME_PRESETS[t.preset];
    return `<button class="gallery-card" data-preset="${t.preset}" data-key="${t.key}">
      <div class="gallery-card-thumb" style="background:${p.background}">
        <span class="mini-badge" style="color:${p.primary}">${t.category}</span>
        <div class="template-preview">
          <div class="template-preview-bar" style="background:${p.primary};height:18px;"></div>
          <div class="template-preview-card">
            <div style="background:${p.primary};opacity:.85;"></div>
            <div style="background:${p.secondary};opacity:.85;"></div>
          </div>
          <div class="template-preview-card" style="height:24px;">
            <div style="background:${p.primary};opacity:.3;"></div>
            <div style="background:${p.secondary};opacity:.3;"></div>
            <div style="background:${p.primary};opacity:.3;"></div>
          </div>
          <div class="template-preview-bar" style="background:${p.accent};height:6px;margin-top:auto;"></div>
        </div>
      </div>
      <div class="gallery-card-body">
        <h3>${t.name}</h3>
        <span>${t.desc}</span>
        <div class="card-tags">${t.tags.map(tag => `<span class="card-tag">${tag}</span>`).join('')}</div>
      </div>
    </button>`;
  }).join('');
  
  $$('.gallery-card', grid).forEach(card => {
    card.addEventListener('click', () => {
      state = defaultState();
      applyPresetOnFreshState(card.dataset.preset);
      history.stack = []; history.index = -1;
      pushHistory();
      openStudio();
      toast(`Starting with "${card.querySelector('h3').textContent}" template`, 'success');
    });
  });
}
function applyPresetOnFreshState(presetName){
  const p = THEME_PRESETS[presetName];
  Object.assign(state.theme, p, { preset: presetName });
}
function renderLibraryList(){
  const lib = getLibrary().sort((a,b) => b.modified - a.modified);
  $('#libraryCount').textContent = lib.length ? `${lib.length} saved` : '';
  const host = $('#libraryList');
  if (!lib.length){ 
    host.innerHTML = '<div class="lib-empty">No saved packages yet — create one from a template above.</div>'; 
    return; 
  }
  host.innerHTML = lib.map(p => `
    <div class="lib-item" data-id="${p.id}">
      <div class="lib-item-info">
        <b>${escapeHtml(p.name)}</b>
        <span>${new Date(p.modified).toLocaleDateString()} · ${p.preset || 'Custom'}</span>
      </div>
      <div class="lib-item-actions">
        <button data-act="edit">✏️ Edit</button>
        <button data-act="rename">Rename</button>
        <button data-act="dup">📋 Copy</button>
        <button data-act="del">🗑️</button>
      </div>
    </div>`).join('');
  $$('.lib-item', host).forEach(row => {
    const id = row.dataset.id;
    row.querySelector('[data-act=edit]').addEventListener('click', () => loadPackageById(id));
    row.querySelector('[data-act=rename]').addEventListener('click', () => renamePackageById(id));
    row.querySelector('[data-act=dup]').addEventListener('click', () => duplicatePackageById(id));
    row.querySelector('[data-act=del]').addEventListener('click', () => deletePackageById(id));
  });
}
function openGallery(){
  $('#studio').classList.add('hidden');
  $('#gallery').classList.remove('hidden');
  renderGalleryCards();
  renderLibraryList();
}
function openStudio(){
  $('#gallery').classList.add('hidden');
  $('#studio').classList.remove('hidden');
  activeTab = 'general';
  renderEditorTabs();
  renderEditorBody();
  renderAll();
  applyPageSize();
  pushHistory();
}

/* ============================ 8. EDITOR ================================= */
const TABS = [
  ['general','General'], ['airline','Airline'], ['header','Header'], ['packages','Packages'],
  ['flights','Flights'], ['services','Services'], ['terms','Terms'], ['contact','Contact'],
  ['media','Media'], ['theme','Theme'], ['layout','Layout']
];

function renderEditorTabs(){
  $('#editorTabs').innerHTML = TABS.map(([key,label]) =>
    `<button class="editor-tab ${key===activeTab?'active':''}" data-tab="${key}">${label}</button>`).join('');
  $$('.editor-tab').forEach(b => b.addEventListener('click', () => {
    activeTab = b.dataset.tab; renderEditorTabs(); renderEditorBody();
  }));
}

function field(label, inputHtml){ return `<div class="field"><label>${label}</label>${inputHtml}</div>`; }
function uploadBox(id, currentValue, label){
  return `<div class="field"><label>${label}</label>
    <div class="upload-box" id="${id}_box">
      ${currentValue ? `<img src="${currentValue}" />` : ''}
      <div>${currentValue ? 'Click to replace' : 'Click or drop to upload'}</div>
      <input type="file" id="${id}" accept=".png,.jpg,.jpeg,.webp,.svg" />
    </div></div>`;
}

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
    case 'theme': body.innerHTML = tplTheme(); bindTheme(); break;
    case 'layout': body.innerHTML = tplLayout(); bindLayout(); break;
  }
}

function onChange(){ 
  renderAll(); 
  autosave(); 
  pushHistory();
}

/* ---- GENERAL ---- */
function tplGeneral(){
  const g = state.general;
  return `<div class="field-group"><h4>Package identity</h4>
    ${field('Package Name', `<input type="text" id="g_name" value="${escapeHtml(g.packageName)}">`)}
    ${field('Subtitle', `<input type="text" id="g_subtitle" value="${escapeHtml(g.subtitle)}">`)}
    <div class="field-row">
      ${field('Duration', `<input type="text" id="g_duration" value="${escapeHtml(g.duration)}">`)}
      ${field('Nights', `<input type="text" id="g_nights" value="${escapeHtml(g.nights)}">`)}
    </div>
    <div class="field-row">
      ${field('Travel Dates', `<input type="text" id="g_dates" placeholder="e.g. 12 – 22 Jan" value="${escapeHtml(g.travelDates)}">`)}
      ${field('Travel Month', `<input type="text" id="g_month" value="${escapeHtml(g.travelMonth)}">`)}
    </div>
    <div class="field-row">
      ${field('Hijri Month', `<input type="text" id="g_hijri" value="${escapeHtml(g.hijriMonth)}">`)}
      ${field('Currency', `<input type="text" id="g_currency" value="${escapeHtml(g.currency)}">`)}
    </div>
    ${field('Package Status', `<select id="g_status">${['Available','Limited Seats','Sold Out','Coming Soon'].map(s=>`<option ${g.status===s?'selected':''}>${s}</option>`).join('')}</select>`)}
  </div>`;
}
function bindGeneral(){
  const map = { g_name:'packageName', g_subtitle:'subtitle', g_duration:'duration', g_nights:'nights', g_dates:'travelDates', g_month:'travelMonth', g_hijri:'hijriMonth', g_currency:'currency', g_status:'status' };
  Object.entries(map).forEach(([id,key]) => {
    $('#'+id).addEventListener('input', e => { 
      state.general[key] = e.target.value; 
      if(id==='g_name'){ $('#packageNameTop').value = e.target.value; } 
      onChange(); 
    });
  });
}

/* ---- AIRLINE ---- */
function tplAirline(){
  const a = state.airline;
  return `<div class="field-group"><h4>Airline details</h4>
    ${field('Airline Name', `<input type="text" id="a_name" value="${escapeHtml(a.name)}">`)}
    ${field('Airline Full Name', `<input type="text" id="a_full" value="${escapeHtml(a.fullName)}">`)}
    ${field('Airline Code', `<input type="text" id="a_code" placeholder="e.g. SV" value="${escapeHtml(a.code)}">`)}
    ${uploadBox('a_logo', a.logo, 'Airline Logo')}
    <div class="field-row">
      ${field('Primary Color', `<input type="color" id="a_primary" value="${a.primaryColor}">`)}
      ${field('Secondary Color', `<input type="color" id="a_secondary" value="${a.secondaryColor}">`)}
    </div>
  </div>`;
}
function bindAirline(){
  $('#a_name').addEventListener('input', e => { state.airline.name = e.target.value; onChange(); });
  $('#a_full').addEventListener('input', e => { state.airline.fullName = e.target.value; onChange(); });
  $('#a_code').addEventListener('input', e => { state.airline.code = e.target.value; onChange(); });
  $('#a_primary').addEventListener('input', e => { state.airline.primaryColor = e.target.value; onChange(); });
  $('#a_secondary').addEventListener('input', e => { state.airline.secondaryColor = e.target.value; onChange(); });
  bindUpload($('#a_logo'), dataUrl => { state.airline.logo = dataUrl; renderEditorBody(); onChange(); });
}

/* ---- HEADER ---- */
function tplHeader(){
  const h = state.header;
  return `<div class="field-group"><h4>Header</h4>
    <div class="checkbox-row"><input type="checkbox" id="h_show" ${h.show?'checked':''}><label>Show header image</label></div>
    ${uploadBox('h_image', h.image, 'Header Image')}
    ${field('Image Position', `<select id="h_pos">${['top','center','bottom'].map(p=>`<option ${h.position===p?'selected':''}>${p}</option>`).join('')}</select>`)}
    ${field('Image Height (px)', `<input type="number" id="h_height" value="${h.height}" min="80" max="400">`)}
    ${field('Overlay Opacity', `<input type="number" id="h_overlay" value="${h.overlayOpacity}" min="0" max="1" step="0.05">`)}
    ${field('Header Title', `<input type="text" id="h_title" value="${escapeHtml(h.title)}">`)}
    ${field('Header Subtitle', `<input type="text" id="h_subtitle" value="${escapeHtml(h.subtitle)}">`)}
  </div>`;
}
function bindHeader(){
  $('#h_show').addEventListener('change', e => { state.header.show = e.target.checked; onChange(); });
  $('#h_pos').addEventListener('change', e => { state.header.position = e.target.value; onChange(); });
  $('#h_height').addEventListener('input', e => { state.header.height = +e.target.value; onChange(); });
  $('#h_overlay').addEventListener('input', e => { state.header.overlayOpacity = clamp(+e.target.value,0,1); onChange(); });
  $('#h_title').addEventListener('input', e => { state.header.title = e.target.value; onChange(); });
  $('#h_subtitle').addEventListener('input', e => { state.header.subtitle = e.target.value; onChange(); });
  bindUpload($('#h_image'), dataUrl => { state.header.image = dataUrl; renderEditorBody(); onChange(); });
}

/* ---- PACKAGES ---- */
function tplPackages(){
  const ci = `<div class="field-group"><h4>Child &amp; Infant Pricing</h4>
    <div class="checkbox-row"><input type="checkbox" id="ci_show" ${state.child.show?'checked':''}><label>Show child / infant section</label></div>
    <div class="field-row">
      ${field('Child Label', `<input type="text" id="ci_child_label" value="${escapeHtml(state.child.label)}">`)}
      ${field('Child Price', `<input type="number" id="ci_child_price" value="${escapeHtml(state.child.price)}">`)}
    </div>
    <div class="field-row">
      ${field('Infant Label', `<input type="text" id="ci_infant_label" value="${escapeHtml(state.infant.label)}">`)}
      ${field('Infant Price', `<input type="number" id="ci_infant_price" value="${escapeHtml(state.infant.price)}">`)}
    </div>
  </div>`;

  const pkgCards = state.packages.map((p, i) => `
    <div class="editor-item-card" data-pid="${p.id}">
      <div class="editor-item-head">
        <span>Package ${i+1}</span>
        <div class="editor-item-actions">
          <button class="mini-btn" data-act="up" ${i===0?'disabled':''}>↑</button>
          <button class="mini-btn" data-act="down" ${i===state.packages.length-1?'disabled':''}>↓</button>
          <button class="mini-btn" data-act="dup">Duplicate</button>
          <button class="mini-btn danger" data-act="del">Delete</button>
        </div>
      </div>
      ${field('Title', `<input type="text" data-k="title" value="${escapeHtml(p.title)}">`)}
      ${field('Subtitle', `<input type="text" data-k="subtitle" value="${escapeHtml(p.subtitle)}">`)}
      <div class="field-row">
        ${field('Badge', `<input type="text" data-k="badge" placeholder="e.g. Best Value" value="${escapeHtml(p.badge)}">`)}
        ${field('Color', `<input type="color" data-k="color" value="${p.color}">`)}
      </div>
      ${field('Description', `<textarea data-k="description">${escapeHtml(p.description)}</textarea>`)}

      <h4 style="margin-top:14px;font-size:11px;letter-spacing:.04em;color:var(--emerald);">Makkah Hotel</h4>
      ${field('Hotel Name', `<input type="text" data-hk="makkah.name" value="${escapeHtml(p.makkah.name)}">`)}
      <div class="field-row">
        ${field('Distance', `<input type="text" data-hk="makkah.distance" value="${escapeHtml(p.makkah.distance)}">`)}
        ${field('Unit', `<select data-hk="makkah.unit">${['m','km','meters from Haram'].map(u=>`<option ${p.makkah.unit===u?'selected':''}>${u}</option>`).join('')}</select>`)}
      </div>
      ${field('Road / Location', `<input type="text" data-hk="makkah.location" value="${escapeHtml(p.makkah.location)}">`)}
      <div class="field-row">
        ${field('Rating (0-5)', `<input type="number" min="0" max="5" step="0.5" data-hk="makkah.rating" value="${p.makkah.rating}">`)}
        ${field('Maps Link', `<input type="url" data-hk="makkah.mapsLink" value="${escapeHtml(p.makkah.mapsLink)}">`)}
      </div>
      ${uploadBox(`mk_img_${p.id}`, p.makkah.image, 'Hotel Image')}

      <h4 style="margin-top:14px;font-size:11px;letter-spacing:.04em;color:var(--emerald);">Madinah Hotel</h4>
      ${field('Hotel Name', `<input type="text" data-hk="madinah.name" value="${escapeHtml(p.madinah.name)}">`)}
      <div class="field-row">
        ${field('Distance', `<input type="text" data-hk="madinah.distance" value="${escapeHtml(p.madinah.distance)}">`)}
        ${field('Unit', `<select data-hk="madinah.unit">${['m','km','meters from Haram'].map(u=>`<option ${p.madinah.unit===u?'selected':''}>${u}</option>`).join('')}</select>`)}
      </div>
      ${field('Location', `<input type="text" data-hk="madinah.location" value="${escapeHtml(p.madinah.location)}">`)}
      <div class="field-row">
        ${field('Rating (0-5)', `<input type="number" min="0" max="5" step="0.5" data-hk="madinah.rating" value="${p.madinah.rating}">`)}
        ${field('Maps Link', `<input type="url" data-hk="madinah.mapsLink" value="${escapeHtml(p.madinah.mapsLink)}">`)}
      </div>
      ${uploadBox(`md_img_${p.id}`, p.madinah.image, 'Hotel Image')}

      <h4 style="margin-top:14px;font-size:11px;letter-spacing:.04em;color:var(--emerald);">Pricing</h4>
      <div class="pricing-editor">
        ${p.pricing.map(pr => `
          <div class="editor-item-card" data-prid="${pr.id}" style="margin-bottom:8px;">
            <div class="field-row">
              ${field('Room Type', `<input type="text" data-pk="roomType" value="${escapeHtml(pr.roomType)}">`)}
              ${field('Price', `<input type="number" data-pk="price" value="${escapeHtml(pr.price)}">`)}
            </div>
            <div class="field-row">
              ${field('Label', `<input type="text" data-pk="label" placeholder="optional" value="${escapeHtml(pr.label)}">`)}
              <div class="field" style="display:flex;align-items:center;gap:6px;padding-top:20px;">
                <input type="checkbox" data-pk="visible" ${pr.visible?'checked':''}><label style="margin:0;">Visible</label>
              </div>
            </div>
            <button class="mini-btn danger" data-act="del-price">Remove room type</button>
          </div>`).join('')}
        <button class="add-btn" data-act="add-price">+ Add Room Type</button>
      </div>
    </div>`).join('');

  return `${ci}<div class="field-group"><h4>Packages</h4>${pkgCards}
    <button class="add-btn" id="addPackageBtn">+ Add Package</button></div>`;
}
function bindPackages(){
  $('#ci_show').addEventListener('change', e => { state.child.show = state.infant.show = e.target.checked; onChange(); });
  $('#ci_child_label').addEventListener('input', e => { state.child.label = e.target.value; onChange(); });
  $('#ci_child_price').addEventListener('input', e => { state.child.price = e.target.value; onChange(); });
  $('#ci_infant_label').addEventListener('input', e => { state.infant.label = e.target.value; onChange(); });
  $('#ci_infant_price').addEventListener('input', e => { state.infant.price = e.target.value; onChange(); });

  $('#addPackageBtn').addEventListener('click', () => {
    state.packages.push(makePackage('New Package', '#0F5132'));
    renderEditorBody(); onChange();
  });

  $$('.editor-item-card[data-pid]').forEach(card => {
    const pid = card.dataset.pid;
    const pkg = state.packages.find(p => p.id === pid);
    if (!pkg) return;

    $$('input[data-k], textarea[data-k]', card).forEach(inp => {
      inp.addEventListener('input', () => { pkg[inp.dataset.k] = inp.value; onChange(); });
    });
    $$('[data-hk]', card).forEach(inp => {
      inp.addEventListener('input', () => {
        const [hotel, key] = inp.dataset.hk.split('.');
        let v = inp.value;
        if (key === 'rating') v = clamp(parseFloat(v) || 0, 0, 5);
        pkg[hotel][key] = v; onChange();
      });
    });
    const mkUp = $('#mk_img_' + pid); if (mkUp) bindUpload(mkUp, dataUrl => { pkg.makkah.image = dataUrl; renderEditorBody(); onChange(); });
    const mdUp = $('#md_img_' + pid); if (mdUp) bindUpload(mdUp, dataUrl => { pkg.madinah.image = dataUrl; renderEditorBody(); onChange(); });

    card.querySelector('[data-act=up]')?.addEventListener('click', () => { moveItem(state.packages, pkg.id, -1); renderEditorBody(); onChange(); });
    card.querySelector('[data-act=down]')?.addEventListener('click', () => { moveItem(state.packages, pkg.id, 1); renderEditorBody(); onChange(); });
    card.querySelector('[data-act=dup]')?.addEventListener('click', () => {
      const copy = JSON.parse(JSON.stringify(pkg)); copy.id = uid(); copy.title += ' (Copy)';
      copy.pricing.forEach(pr => pr.id = uid());
      state.packages.splice(state.packages.indexOf(pkg)+1, 0, copy);
      renderEditorBody(); onChange();
    });
    card.querySelector('[data-act=del]')?.addEventListener('click', () => {
      if (state.packages.length <= 1){ toast('At least one package is required', 'error'); return; }
      state.packages = state.packages.filter(p => p.id !== pid);
      renderEditorBody(); onChange();
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
          else if (k === 'price'){
            if (inp.value !== '' && isNaN(+inp.value)){ toast('Price must be numeric', 'error'); return; }
            pr.price = inp.value;
          } else pr[k] = inp.value;
          onChange();
        });
      });
      prCard.querySelector('[data-act=del-price]').addEventListener('click', () => {
        pkg.pricing = pkg.pricing.filter(x => x.id !== prid);
        renderEditorBody(); onChange();
      });
    });
    card.querySelector('[data-act=add-price]').addEventListener('click', () => {
      pkg.pricing.push({ id: uid(), roomType:'Single', price:'', currency:'', label:'', visible:true });
      renderEditorBody(); onChange();
    });
  });
}
function moveItem(arr, id, dir){
  const i = arr.findIndex(x => x.id === id);
  const j = i + dir;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
}

/* ---- FLIGHTS ---- */
function tplFlights(){
  const rows = state.flights.map((f,i) => `
    <div class="editor-item-card" data-fid="${f.id}">
      <div class="editor-item-head">
        <span>${f.direction.toUpperCase()} · Flight ${i+1}</span>
        <div class="editor-item-actions"><button class="mini-btn danger" data-act="del">Delete</button></div>
      </div>
      ${field('Direction', `<select data-fk="direction">${['departure','return','connecting'].map(d=>`<option ${f.direction===d?'selected':''}>${d}</option>`).join('')}</select>`)}
      <div class="field-row">
        ${field('Airline', `<input type="text" data-fk="airline" value="${escapeHtml(f.airline)}">`)}
        ${field('Flight Number', `<input type="text" data-fk="flightNo" value="${escapeHtml(f.flightNo)}">`)}
      </div>
      <div class="field-row">
        ${field('Date', `<input type="date" data-fk="date" value="${escapeHtml(f.date)}">`)}
        ${field('Terminal', `<input type="text" data-fk="terminal" value="${escapeHtml(f.terminal)}">`)}
      </div>
      <div class="field-row">
        ${field('From', `<input type="text" data-fk="from" value="${escapeHtml(f.from)}">`)}
        ${field('To', `<input type="text" data-fk="to" value="${escapeHtml(f.to)}">`)}
      </div>
      <div class="field-row">
        ${field('Departure Time', `<input type="text" data-fk="depTime" placeholder="14:30" value="${escapeHtml(f.depTime)}">`)}
        ${field('Arrival Time', `<input type="text" data-fk="arrTime" placeholder="18:10" value="${escapeHtml(f.arrTime)}">`)}
      </div>
      <div class="field-row">
        ${field('Baggage', `<input type="text" data-fk="baggage" placeholder="30kg" value="${escapeHtml(f.baggage)}">`)}
        ${field('Meal', `<input type="text" data-fk="meal" placeholder="Included" value="${escapeHtml(f.meal)}">`)}
      </div>
      ${field('Notes', `<textarea data-fk="notes">${escapeHtml(f.notes)}</textarea>`)}
    </div>`).join('');
  return `<div class="field-group"><h4>Flights</h4>
    ${rows || '<div class="empty-hint">No flights added yet.</div>'}
    <button class="add-btn" id="addFlightBtn">+ Add Flight</button></div>`;
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
      inp.addEventListener(evt, () => {
        f[inp.dataset.fk] = inp.value; onChange();
        if (inp.dataset.fk === 'direction') renderEditorBody();
      });
    });
    card.querySelector('[data-act=del]').addEventListener('click', () => {
      state.flights = state.flights.filter(x => x.id !== fid); renderEditorBody(); onChange();
    });
  });
}

/* ---- SERVICES ---- */
function tplServices(){
  const rows = state.services.map((s,i) => `
    <div class="editor-item-card" data-sid="${s.id}">
      <div class="editor-item-head">
        <span>Service ${i+1}</span>
        <div class="editor-item-actions">
          <button class="mini-btn" data-act="up" ${i===0?'disabled':''}>↑</button>
          <button class="mini-btn" data-act="down" ${i===state.services.length-1?'disabled':''}>↓</button>
          <button class="mini-btn danger" data-act="del">Delete</button>
        </div>
      </div>
      ${field('Title', `<input type="text" data-sk="title" value="${escapeHtml(s.title)}">`)}
      ${field('Subtitle', `<input type="text" data-sk="subtitle" value="${escapeHtml(s.subtitle)}">`)}
      ${field('Description', `<textarea data-sk="description">${escapeHtml(s.description)}</textarea>`)}
    </div>`).join('');
  return `<div class="field-group"><h4>Services</h4>${rows}
    <button class="add-btn" id="addServiceBtn">+ Add Service</button></div>`;
}
function bindServices(){
  $('#addServiceBtn').addEventListener('click', () => {
    state.services.push({ id: uid(), icon:'auto', title:'New Service', subtitle:'', description:'' });
    renderEditorBody(); onChange();
  });
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
  const rows = state.terms.map((t,i) => `
    <div class="field-row" data-tid="${t.id}" style="align-items:center;">
      <div class="field" style="flex:1;"><input type="text" data-tk="text" value="${escapeHtml(t.text)}"></div>
      <button class="mini-btn danger" data-act="del" style="height:38px;">✕</button>
    </div>`).join('');
  return `<div class="field-group"><h4>Terms &amp; Conditions</h4>
    <div class="checkbox-row"><input type="checkbox" id="terms_show" ${state.termsShow?'checked':''}><label>Show terms section</label></div>
    <div id="termsList">${rows}</div>
    <button class="add-btn" id="addTermBtn">+ Add Bullet Point</button></div>`;
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
    <div class="field-row">
      ${field('Phone', `<input type="tel" id="c_phone" value="${escapeHtml(c.phone)}">`)}
      ${field('WhatsApp', `<input type="tel" id="c_whatsapp" value="${escapeHtml(c.whatsapp)}">`)}
    </div>
    <div class="field-row">
      ${field('Email', `<input type="email" id="c_email" value="${escapeHtml(c.email)}">`)}
      ${field('Website', `<input type="text" id="c_website" value="${escapeHtml(c.website)}">`)}
    </div>
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
    ['Hotel Images', state.packages.flatMap(p => [p.makkah.image, p.madinah.image].filter(Boolean))],
  ];
  return `<div class="field-group"><h4>Media Manager</h4>
    <div class="empty-hint">Uploads made in other tabs appear here for a quick overview. Replace or remove them from their original section.</div>
    ${categories.map(([label, imgs]) => `
      <div style="margin-bottom:16px;">
        <div style="font-size:12.5px;font-weight:600;margin-bottom:6px;">${label} (${imgs.length})</div>
        ${imgs.length ? `<div style="display:flex;gap:8px;flex-wrap:wrap;">${imgs.map(i=>`<img src="${i}" style="width:56px;height:56px;object-fit:cover;border-radius:6px;border:1px solid var(--line);">`).join('')}</div>` : `<div class="empty-hint">None uploaded</div>`}
      </div>`).join('')}
  </div>`;
}

/* ---- THEME ---- */
function tplTheme(){
  const t = state.theme;
  return `<div class="field-group"><h4>Presets</h4>
    <div class="preset-swatches">${Object.entries(THEME_PRESETS).map(([name,p]) => `
      <button class="preset-swatch ${t.preset===name?'active':''}" data-preset="${name}"><span class="preset-dot" style="background:${p.primary}"></span>${name}</button>`).join('')}</div>
  </div>
  <div class="field-group"><h4>Colors</h4>
    <div class="field-row">${field('Primary', `<input type="color" id="t_primary" value="${t.primary}">`)}${field('Secondary', `<input type="color" id="t_secondary" value="${t.secondary}">`)}</div>
    <div class="field-row">${field('Accent', `<input type="color" id="t_accent" value="${t.accent}">`)}${field('Text', `<input type="color" id="t_text" value="${t.text}">`)}</div>
    <div class="field-row">${field('Background', `<input type="color" id="t_bg" value="${t.background}">`)}${field('Card', `<input type="color" id="t_card" value="${t.card}">`)}</div>
    ${field('Border', `<input type="color" id="t_border" value="${t.border}">`)}
  </div>
  <div class="field-group"><h4>Typography</h4>
    ${field('Heading Font', `<select id="t_hfont">${FONT_OPTIONS.map(f=>`<option ${t.headingFont===f?'selected':''}>${f}</option>`).join('')}</select>`)}
    ${field('Body Font', `<select id="t_bfont">${FONT_OPTIONS.map(f=>`<option ${t.bodyFont===f?'selected':''}>${f}</option>`).join('')}</select>`)}
    ${field('Price Font', `<select id="t_pfont">${FONT_OPTIONS.map(f=>`<option ${t.priceFont===f?'selected':''}>${f}</option>`).join('')}</select>`)}
    <div class="field-row">
      ${field('Heading Size', `<input type="number" id="t_hsize" value="${t.headingSize}" min="18" max="48">`)}
      ${field('Body Size', `<input type="number" id="t_bsize" value="${t.bodySize}" min="10" max="18">`)}
      ${field('Price Size', `<input type="number" id="t_psize" value="${t.priceSize}" min="12" max="28">`)}
    </div>
  </div>`;
}
function bindTheme(){
  $$('.preset-swatch').forEach(b => b.addEventListener('click', () => applyPreset(b.dataset.preset)));
  const colorMap = { t_primary:'primary', t_secondary:'secondary', t_accent:'accent', t_text:'text', t_bg:'background', t_card:'card', t_border:'border' };
  Object.entries(colorMap).forEach(([id,key]) => $('#'+id).addEventListener('input', e => { state.theme[key] = e.target.value; onChange(); }));
  $('#t_hfont').addEventListener('change', e => { state.theme.headingFont = e.target.value; ensureFontLoaded(e.target.value); onChange(); });
  $('#t_bfont').addEventListener('change', e => { state.theme.bodyFont = e.target.value; ensureFontLoaded(e.target.value); onChange(); });
  $('#t_pfont').addEventListener('change', e => { state.theme.priceFont = e.target.value; ensureFontLoaded(e.target.value); onChange(); });
  $('#t_hsize').addEventListener('input', e => { state.theme.headingSize = +e.target.value; onChange(); });
  $('#t_bsize').addEventListener('input', e => { state.theme.bodySize = +e.target.value; onChange(); });
  $('#t_psize').addEventListener('input', e => { state.theme.priceSize = +e.target.value; onChange(); });
}

/* ---- LAYOUT ---- */
const SECTION_LABELS = { header:'Header', packages:'Package Sections', flights:'Flight Section', child:'Child/Infant', services:'Services', terms:'Terms', footer:'Contact / Footer' };
function tplLayout(){
  const rows = state.layout.order.map(key => `
    <div class="layout-row" draggable="true" data-key="${key}">
      <span>⠿ ${SECTION_LABELS[key]}</span>
      <div class="layout-row-controls">
        <label style="font-size:11px;display:flex;align-items:center;gap:4px;">
          <input type="checkbox" data-vis="${key}" ${state.layout.visibility[key]?'checked':''}> Show
        </label>
      </div>
    </div>`).join('');
  return `<div class="field-group"><h4>Section Order &amp; Visibility</h4>
    <div class="empty-hint">Drag rows to reorder. Toggle to show or hide a section in the exported poster.</div>
    <div id="layoutList">${rows}</div>
  </div>`;
}
function bindLayout(){
  const list = $('#layoutList');
  $$('[data-vis]', list).forEach(cb => cb.addEventListener('change', () => { state.layout.visibility[cb.dataset.vis] = cb.checked; onChange(); }));
  let dragKey = null;
  $$('.layout-row', list).forEach(row => {
    row.addEventListener('dragstart', () => { dragKey = row.dataset.key; row.classList.add('dragging'); });
    row.addEventListener('dragend', () => row.classList.remove('dragging'));
    row.addEventListener('dragover', e => e.preventDefault());
    row.addEventListener('drop', () => {
      if (!dragKey || dragKey === row.dataset.key) return;
      const order = state.layout.order;
      const from = order.indexOf(dragKey), to = order.indexOf(row.dataset.key);
      order.splice(from,1); order.splice(to,0,dragKey);
      renderEditorBody(); onChange();
    });
  });
}

/* ============================ 9. PREVIEW RENDERER ========================= */
function starString(rating){
  const full = Math.round(rating);
  return '★'.repeat(clamp(full,0,5)) + '☆'.repeat(5 - clamp(full,0,5));
}
function renderHeaderSection(){
  const h = state.header, t = state.theme;
  if (!h.show) return '';
  const bg = h.image ? `background-image:url('${h.image}');` : '';
  return `<div class="poster-header" style="${bg}min-height:${h.height}px;background-position:${h.position};">
    <div class="overlay" style="--overlay-opacity:${h.overlayOpacity}"></div>
    <div class="poster-header-content">
      <div>
        <h1>${escapeHtml(h.title || state.general.packageName)}</h1>
        <p>${escapeHtml(h.subtitle)} ${state.general.travelDates ? '· ' + escapeHtml(state.general.travelDates) : ''}</p>
      </div>
      ${state.airline.logo || state.airline.name ? `<div class="poster-airline-badge">
        ${state.airline.logo ? `<img src="${state.airline.logo}">` : ''}
        <span>${escapeHtml(state.airline.name)}${state.airline.code ? ' · ' + escapeHtml(state.airline.code) : ''}</span>
      </div>` : ''}
    </div>
  </div>
  <div class="poster-meta-strip">
    ${state.general.duration ? `<span class="meta-chip">${escapeHtml(state.general.duration)}${state.general.nights?', '+escapeHtml(state.general.nights)+' Nights':''}</span>` : ''}
    ${state.general.travelMonth ? `<span class="meta-chip">${escapeHtml(state.general.travelMonth)}</span>` : ''}
    ${state.general.hijriMonth ? `<span class="meta-chip">${escapeHtml(state.general.hijriMonth)}</span>` : ''}
    ${state.general.status ? `<span class="meta-chip">${escapeHtml(state.general.status)}</span>` : ''}
  </div>`;
}
function hotelCardHtml(hotel, label){
  if (!hotel.name && !hotel.image) return `<div class="hotel-card"><div class="hotel-card-info"><h5>${label}</h5><p>Not set</p></div></div>`;
  return `<div class="hotel-card">
    ${hotel.image ? `<img src="${hotel.image}">` : `<div style="width:52px;height:52px;border-radius:6px;background:rgba(255,255,255,.25);flex-shrink:0;"></div>`}
    <div class="hotel-card-info">
      <h5>${label}: ${escapeHtml(hotel.name || 'Hotel')}</h5>
      <p>${escapeHtml(hotel.distance)}${hotel.distance ? ' '+escapeHtml(hotel.unit) : ''} ${hotel.location ? '· '+escapeHtml(hotel.location) : ''}</p>
      <div class="hotel-rating">${starString(hotel.rating)}</div>
    </div>
  </div>`;
}
function renderPackagesSection(){
  if (!state.layout.visibility.packages) return '';
  const cur = state.general.currency || '';
  return state.packages.map(p => `
    <div class="package-block" style="background:${p.color};">
      ${p.badge ? `<span class="package-badge">${escapeHtml(p.badge)}</span>` : ''}
      <h2>${escapeHtml(p.title)}</h2>
      ${p.subtitle ? `<p class="pkg-sub">${escapeHtml(p.subtitle)}</p>` : ''}
      ${p.description ? `<p class="package-desc">${escapeHtml(p.description)}</p>` : ''}
      <div class="hotel-row">
        ${hotelCardHtml(p.makkah, 'Makkah')}
        ${hotelCardHtml(p.madinah, 'Madinah')}
      </div>
      <div class="pricing-row">
        ${p.pricing.filter(pr => pr.visible).map(pr => `
          <div class="price-pill">
            <span class="room-type">${escapeHtml(pr.roomType)}</span>
            <span class="room-price">${pr.price !== '' ? (pr.currency||cur)+' '+pr.price : '—'}</span>
            ${pr.label ? `<span class="room-label">${escapeHtml(pr.label)}</span>` : ''}
          </div>`).join('') || '<div class="room-label" style="color:rgba(255,255,255,.8)">No pricing added</div>'}
      </div>
    </div>`).join('');
}
function renderFlightsSection(){
  if (!state.layout.visibility.flights || !state.flights.length) return '';
  return `<div><h2 style="font-family:var(--poster-heading-font);font-size:16px;margin:0 0 8px;color:${state.theme.primary}">Flight Details</h2>
    ${state.flights.map(f => `
      <div class="flight-card">
        <div class="flight-card-top"><span>${f.direction.toUpperCase()}${f.airline ? ' · '+escapeHtml(f.airline) : ''}</span><span>${escapeHtml(f.flightNo)}</span></div>
        <div class="flight-route"><span>${escapeHtml(f.from)}</span><span class="arrow">→</span><span>${escapeHtml(f.to)}</span></div>
        <div class="flight-details">
          ${f.date ? `<span>${escapeHtml(f.date)}</span>` : ''}
          ${f.depTime ? `<span>Dep ${escapeHtml(f.depTime)}</span>` : ''}
          ${f.arrTime ? `<span>Arr ${escapeHtml(f.arrTime)}</span>` : ''}
          ${f.terminal ? `<span>Terminal ${escapeHtml(f.terminal)}</span>` : ''}
          ${f.baggage ? `<span>Baggage ${escapeHtml(f.baggage)}</span>` : ''}
          ${f.meal ? `<span>Meal: ${escapeHtml(f.meal)}</span>` : ''}
        </div>
        ${f.notes ? `<div class="flight-details">${escapeHtml(f.notes)}</div>` : ''}
      </div>`).join('')}
  </div>`;
}
function renderChildSection(){
  if (!state.layout.visibility.child || !state.child.show) return '';
  const cur = state.general.currency || '';
  return `<div class="child-infant-row">
    <div class="ci-card"><b>${escapeHtml(state.child.label)}</b><span class="ci-price">${state.child.price!==''?cur+' '+state.child.price:'—'}</span></div>
    <div class="ci-card"><b>${escapeHtml(state.infant.label)}</b><span class="ci-price">${state.infant.price!==''?cur+' '+state.infant.price:'—'}</span></div>
  </div>`;
}
function renderServicesSection(){
  if (!state.layout.visibility.services || !state.services.length) return '';
  return `<div><h2 style="font-family:var(--poster-heading-font);font-size:16px;margin:0 0 8px;color:${state.theme.primary}">Package Includes</h2>
    <div class="services-grid">
      ${state.services.map(s => `<div class="service-item">${iconFor(s.title)}<h6>${escapeHtml(s.title)}</h6>${s.subtitle?`<p>${escapeHtml(s.subtitle)}</p>`:''}</div>`).join('')}
    </div></div>`;
}
function renderTermsSection(){
  if (!state.layout.visibility.terms || !state.termsShow || !state.terms.length) return '';
  return `<div><h2 style="font-family:var(--poster-heading-font);font-size:14px;margin:0 0 6px;color:${state.theme.primary}">Terms &amp; Conditions</h2>
    <ul class="terms-list">${state.terms.map(t => `<li>${escapeHtml(t.text)}</li>`).join('')}</ul></div>`;
}
function renderFooter(){
  if (!state.layout.visibility.footer) return '';
  const c = state.contact;
  const contactLine = [c.phone, c.whatsapp && ('WA: '+c.whatsapp), c.email, c.website].filter(Boolean).map(escapeHtml).join(' · ');
  return `<div class="poster-footer">
    <div class="agency">${c.logo ? `<img src="${c.logo}">` : ''}<b>${escapeHtml(c.agency || 'Your Travel Agency')}</b></div>
    <div class="contacts">${contactLine}${c.address ? '<br>'+escapeHtml(c.address) : ''}</div>
  </div>`;
}
const SECTION_RENDERERS = {
  header: renderHeaderSection, packages: renderPackagesSection, flights: renderFlightsSection,
  child: renderChildSection, services: renderServicesSection, terms: renderTermsSection, footer: renderFooter
};

function applyThemeVars(el){
  const t = state.theme;
  ensureFontLoaded(t.headingFont); ensureFontLoaded(t.bodyFont); ensureFontLoaded(t.priceFont);
  el.style.setProperty('--poster-bg', t.background);
  el.style.setProperty('--poster-ink', t.text);
  el.style.setProperty('--poster-primary', t.primary);
  el.style.setProperty('--poster-primary-soft', t.primary + '22');
  el.style.setProperty('--poster-gold', t.accent);
  el.style.setProperty('--line-poster', t.border);
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
  applyThemeVars(poster);
  const sectionsHtml = state.layout.order.map(key => {
    const inner = SECTION_RENDERERS[key] ? SECTION_RENDERERS[key]() : '';
    return inner ? `<div class="poster-section" data-section="${key}">${inner}</div>` : '';
  }).join('');
  poster.innerHTML = sectionsHtml;
}

function renderAll(){
  renderPoster();
  $('#packageNameTop').value = state.general.packageName;
}

/* ======================= 10. TOOLBAR ACTIONS ========================= */
function wireToolbar(){
  $('#btnBack').addEventListener('click', () => {
    saveCurrentToLibrary(false);
    openGallery();
  });
  $('#packageNameTop').addEventListener('input', e => { state.general.packageName = e.target.value; onChange(); });

  $('#btnNew').addEventListener('click', () => {
    if (!confirm('Start a new blank package?')) return;
    saveCurrentToLibrary(false);
    state = defaultState(); 
    history.stack = []; history.index = -1;
    pushHistory();
    openStudio(); 
    toast('New package started', 'success');
  });
  
  $('#btnSave').addEventListener('click', () => saveCurrentToLibrary(true));
  
  $('#btnDuplicate').addEventListener('click', () => {
    saveCurrentToLibrary(false);
    const copy = JSON.parse(JSON.stringify(state));
    copy.id = uid(); 
    copy.general.packageName += ' (Copy)';
    state = copy; 
    history.stack = []; history.index = -1;
    pushHistory();
    saveCurrentToLibrary(false); 
    openStudio();
    toast('Duplicated as new package', 'success');
  });
  
  $('#btnPreviewToggle').addEventListener('click', () => {
    document.body.classList.toggle('preview-only');
  });
  
  $('#btnReset').addEventListener('click', () => {
    if (!confirm('Reset this package to a blank template? This cannot be undone.')) return;
    const name = state.general.packageName;
    state = defaultState(name); 
    history.stack = []; history.index = -1;
    pushHistory();
    renderEditorTabs(); 
    renderEditorBody(); 
    renderAll(); 
    autosave();
    toast('Package reset', 'success');
  });

  $('#btnUndo').addEventListener('click', undo);
  $('#btnRedo').addEventListener('click', redo);

  $('#btnExportMenu').addEventListener('click', (e) => { 
    e.stopPropagation(); 
    $('#exportMenu').classList.toggle('hidden'); 
  });
  document.addEventListener('click', () => $('#exportMenu')?.classList.add('hidden'));
  
  $$('#exportMenu button').forEach(b => b.addEventListener('click', () => {
    $('#exportMenu').classList.add('hidden');
    const action = b.dataset.action;
    if (action === 'print') openPrintPreview();
    else if (action === 'pdf') exportPDF();
    else if (action === 'png') exportImage('png');
    else if (action === 'jpg') exportImage('jpeg');
    else if (action === 'json') exportJSON();
  }));

  $('#drawerToggle').addEventListener('click', () => {
    mobileEditorOpen = !mobileEditorOpen;
    $('#editorPanel').classList.toggle('open', mobileEditorOpen);
    $('#drawerToggle').textContent = mobileEditorOpen ? 'Close ✕' : 'Edit ✎';
  });

  $('#pageSize').addEventListener('change', applyPageSize);
  $('#customW').addEventListener('input', applyPageSize);
  $('#customH').addEventListener('input', applyPageSize);

  $('#btnPrintPreview').addEventListener('click', openPrintPreview);
  $('#closePrintModal').addEventListener('click', () => $('#printModal').classList.add('hidden'));
  $('#closePrintModal2').addEventListener('click', () => $('#printModal').classList.add('hidden'));
  $('#doActualPrint').addEventListener('click', () => window.print());

  // Zoom controls
  $('#btnZoomIn').addEventListener('click', () => setZoom(currentZoom + 0.1));
  $('#btnZoomOut').addEventListener('click', () => setZoom(currentZoom - 0.1));
  $('#btnZoomFit').addEventListener('click', () => {
    currentZoom = 0.6;
    setZoom(0.6);
  });

  // Gallery filters
  $$('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      galleryFilter = btn.dataset.filter;
      renderGalleryCards();
    });
  });

  // Import/Export
  $('#createFromScratch').addEventListener('click', () => {
    state = defaultState('Untitled Package'); 
    history.stack = []; history.index = -1;
    pushHistory();
    openStudio();
  });
  
  $('#importPackageBtn').addEventListener('click', () => $('#importFileInput').click());
  $('#importFileInput').addEventListener('change', importJSON);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
      else if (e.key === 's') { e.preventDefault(); saveCurrentToLibrary(true); }
      else if (e.key === 'p') { e.preventDefault(); openPrintPreview(); }
    }
  });
}

function setZoom(level){
  currentZoom = clamp(level, 0.3, 2);
  const poster = $('#poster');
  poster.style.transform = `scale(${currentZoom})`;
  poster.style.transformOrigin = 'top center';
  $('#zoomLevel').textContent = Math.round(currentZoom * 100) + '%';
}

const PAGE_SIZES = {
  a4p: { w: 794, h: 1123 }, a4l: { w: 1123, h: 794 }, a3: { w: 1123, h: 1587 },
  '1080x1350': { w: 1080, h: 1350 }, '1080x1920': { w: 1080, h: 1920 },
  '1200x628': { w: 1200, h: 628 }
};
function applyPageSize(){
  const sel = $('#pageSize').value;
  $('#customSizeInputs').classList.toggle('hidden', sel !== 'custom');
  let size;
  if (sel === 'custom'){
    size = { w: +$('#customW').value || 794, h: +$('#customH').value || 1123 };
  } else size = PAGE_SIZES[sel];
  const poster = $('#poster');
  poster.style.width = size.w + 'px';
  poster.style.minHeight = size.h + 'px';
}

/* ======================= 11. EXPORT SYSTEM ============================ */
function validateBeforeExport(){
  const errs = [];
  if (!state.general.packageName?.trim()) errs.push('Package name is empty.');
  state.packages.forEach((p,i) => { if (!p.title?.trim()) errs.push(`Package ${i+1} has no title.`); });
  if (errs.length){ errs.forEach(e => toast(e, 'error')); }
  return true;
}
function openPrintPreview(){
  validateBeforeExport();
  const frame = $('#printFrame');
  frame.innerHTML = $('#poster').outerHTML;
  applyThemeVars(frame.firstElementChild);
  frame.firstElementChild.style.width = '794px';
  frame.firstElementChild.style.minHeight = '1123px';
  frame.firstElementChild.style.transform = 'none';
  $('#printModal').classList.remove('hidden');
}
async function exportImage(type){
  validateBeforeExport();
  toast('Preparing export…');
  try {
    const canvas = await html2canvas($('#poster'), { scale: 2, useCORS: true, backgroundColor: state.theme.background });
    const link = document.createElement('a');
    link.download = `${(state.general.packageName||'umrah-package').replace(/\s+/g,'-').toLowerCase()}.${type === 'jpeg' ? 'jpg' : 'png'}`;
    link.href = canvas.toDataURL(type === 'jpeg' ? 'image/jpeg' : 'image/png', 0.95);
    link.click();
    toast('Export ready', 'success');
  } catch(err){ toast('Export failed: ' + err.message, 'error'); }
}
async function exportPDF(){
  validateBeforeExport();
  toast('Building PDF…');
  try {
    const posterEl = $('#poster');
    const canvas = await html2canvas(posterEl, { scale: 2, useCORS: true, backgroundColor: state.theme.background });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageW = 210, pageH = 297;
    const imgRatio = canvas.height / canvas.width;
    let renderW = pageW, renderH = pageW * imgRatio;
    if (renderH > pageH){ renderH = pageH; renderW = pageH / imgRatio; }
    const x = (pageW - renderW) / 2, y = 0;
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', x, y, renderW, renderH);
    pdf.save(`${(state.general.packageName||'umrah-package').replace(/\s+/g,'-').toLowerCase()}.pdf`);
    toast('PDF exported', 'success');
  } catch(err){ toast('PDF export failed: ' + err.message, 'error'); }
}
function exportJSON(){
  const data = JSON.stringify(state, null, 2);
  download(`${(state.general.packageName||'umrah-package').replace(/\s+/g,'-').toLowerCase()}.json`, data);
  toast('JSON exported', 'success');
}
function importJSON(e){
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (!imported.general || !imported.packages) throw new Error('Invalid package file');
      imported.id = uid();
      imported.modified = Date.now();
      state = imported;
      history.stack = []; history.index = -1;
      pushHistory();
      openStudio();
      toast('Package imported', 'success');
    } catch(err){ toast('Import failed: ' + err.message, 'error'); }
  };
  reader.readAsText(file);
  e.target.value = '';
}

/* ============================== 12. INIT =============================== */
function init(){
  wireToolbar();

  const saved = localStorage.getItem(CURRENT_KEY);
  if (saved){
    try { state = JSON.parse(saved); } catch(e){ /* ignore */ }
  }
  openGallery();
}
document.addEventListener('DOMContentLoaded', init);
