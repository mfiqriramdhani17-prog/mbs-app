/* ============================================================
   MBS ADMIN PANEL — core.js
   Supabase client, Auth, utilities, settings store
   ============================================================ */

/* ── Supabase credentials ── */
let SUPABASE_URL = localStorage.getItem('mbs_sb_url') || 'https://bqldulitnfsnappevuqv.supabase.co';
let SUPABASE_KEY = localStorage.getItem('mbs_sb_key') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxbGR1bGl0bmZzbmFwcGV2dXF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MTI2ODAsImV4cCI6MjA5NjQ4ODY4MH0.wVYk1TkI0nT3PZMh7fOvSR-Yq9hSHtk6Ni0JS9FWvpc';

/* ── Auth state ── */
let currentUser = null;
let authToken = null;

/* ── Supabase REST client ── */
const sb = {
  ready() {
    return SUPABASE_URL.startsWith('https://') && SUPABASE_KEY.length > 20;
  },
  _h(useAuth = false) {
    const h = { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY };
    if (SUPABASE_KEY.startsWith('eyJ')) h['Authorization'] = 'Bearer ' + SUPABASE_KEY;
    // Override with user token if available (RLS per user)
    if (useAuth && authToken) h['Authorization'] = 'Bearer ' + authToken;
    return h;
  },
  async _err(res, label) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 200); } catch(e) {}
    return new Error(`${label} HTTP ${res.status}${detail ? ' — ' + detail : ''}`);
  },
  async select(table, query = '') {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&order=created_at.desc${query}`, { headers: this._h() });
    if (!r.ok) throw await this._err(r, `select[${table}]`);
    return r.json();
  },
  async upsert(table, data) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...this._h(), 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(data)
    });
    if (!r.ok) throw await this._err(r, `upsert[${table}]`);
  },
  async remove(table, id) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE', headers: this._h()
    });
    if (!r.ok) throw await this._err(r, `delete[${table}]`);
  },

  /* ── Auth methods ── */
  async signIn(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
      body: JSON.stringify({ email, password })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error_description || data.msg || 'Login gagal');
    return data; // { access_token, refresh_token, user }
  },
  async signOut(token) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + token }
    }).catch(() => {});
  },
  async refreshToken(refresh_token) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
      body: JSON.stringify({ refresh_token })
    });
    const data = await r.json();
    if (!r.ok) throw new Error('Token expired');
    return data;
  },

  /* ── Storage ── */
  // Upload file ke Supabase Storage, return public URL
  async uploadImage(file, bucket = 'mbs-images', folder = 'items') {
    // Compress dulu sebelum upload
    const b64 = await compressImage(file, 1200, 0.85);
    // Convert base64 → Blob
    const [meta, data] = b64.split(',');
    const mime = meta.match(/:(.*?);/)[1];
    const bytes = atob(data);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const blob = new Blob([arr], { type: mime });
    const ext = mime === 'image/png' ? 'png' : 'jpg';
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': mime, 'x-upsert': 'true' },
      body: blob
    });
    if (!r.ok) {
      const err = await r.text();
      throw new Error('Upload gagal: ' + err.slice(0, 100));
    }
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
  },

  // Hapus file dari Storage berdasarkan public URL
  async deleteImage(url, bucket = 'mbs-images') {
    try {
      const marker = `/object/public/${bucket}/`;
      const idx = url.indexOf(marker);
      if (idx < 0) return;
      const path = url.slice(idx + marker.length);
      await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
      });
    } catch(e) { console.warn('deleteImage error:', e); }
  }
};

/* ── Auth persistence ── */
const AUTH_KEY = 'mbs_auth_session';

function saveSession(session) {
  try { localStorage.setItem(AUTH_KEY, JSON.stringify(session)); } catch(e) {}
}
function loadSession() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch(e) { return null; }
}
function clearSession() {
  localStorage.removeItem(AUTH_KEY);
  currentUser = null;
  authToken = null;
}

async function checkAuth() {
  const session = loadSession();
  if (!session) return false;

  // Check if token is still valid (Supabase JWT exp)
  try {
    const payload = JSON.parse(atob(session.access_token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp > now + 60) {
      // Still valid
      currentUser = session.user;
      authToken = session.access_token;
      return true;
    }
    // Try refresh
    if (session.refresh_token) {
      const fresh = await sb.refreshToken(session.refresh_token);
      const newSession = { ...fresh, user: fresh.user || session.user };
      saveSession(newSession);
      currentUser = newSession.user;
      authToken = newSession.access_token;
      return true;
    }
  } catch(e) {}
  clearSession();
  return false;
}

/* ── Login UI ── */
async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn = document.getElementById('loginBtn');
  const errEl = document.getElementById('loginError');

  if (!email || !password) {
    showLoginError('Email dan password wajib diisi');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Masuk...';
  errEl.style.display = 'none';

  try {
    const session = await sb.signIn(email, password);
    saveSession(session);
    currentUser = session.user;
    authToken = session.access_token;
    showApp();
  } catch(e) {
    showLoginError(e.message.includes('Invalid') || e.message.includes('invalid')
      ? 'Email atau password salah'
      : e.message
    );
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg> Masuk`;
  }
}

function showLoginError(msg) {
  const el = document.getElementById('loginError');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function togglePw() {
  const inp = document.getElementById('loginPassword');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

async function doLogout() {
  if (!confirm('Yakin ingin keluar?')) return;
  const session = loadSession();
  if (session?.access_token) await sb.signOut(session.access_token);
  clearSession();
  showLogin();
}

function showLogin() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('appScreen').style.display = 'none';
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginError').style.display = 'none';
}

async function showApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appScreen').style.display = 'block';
  updateUserUI();
  // Load settings from Supabase first (syncs across devices)
  await loadSettingsFromSupabase();
  // Migrasi data lama: pastikan invoice punya field nilaiTagihan
  await migrateInvoiceNilaiTagihan();
  // Init app modules (buildNav, router, etc.)
  if (typeof initApp === 'function') initApp();
}

// Migrasi global: isi nilaiTagihan untuk invoice lama yang belum punya field ini
async function migrateInvoiceNilaiTagihan() {
  try {
    let rows;
    if (sb.ready()) {
      const res = await sb.select('mbs_invoices');
      rows = res.map(r => ({ __id: r.id, ...(r.data || {}) })).filter(r => r.nomorDok);
    } else {
      rows = cache.get('invoices') || [];
    }
    let changed = false;
    rows.forEach(r => {
      if (r.nilaiTagihan == null) {
        if (r.termin && r.termin !== 'PELUNASAN') {
          r.nilaiTagihan = r.dpAmt ?? r.grandTotal ?? 0;
        } else if (r.termin === 'PELUNASAN') {
          r.nilaiTagihan = (r.useSudah && r.pelSisa != null) ? r.pelSisa : (r.grandTotal ?? 0);
        } else {
          r.nilaiTagihan = r.grandTotal ?? 0;
        }
        changed = true;
      }
    });
    if (changed) {
      cache.set('invoices', rows);
      if (sb.ready()) {
        for (const r of rows) {
          const { __id, ...data } = r;
          try { await sb.upsert('mbs_invoices', { id: __id, data }); } catch(e) {}
        }
      }
    }
  } catch(e) { console.warn('migrateInvoiceNilaiTagihan error:', e); }
}

function updateUserUI() {
  if (!currentUser) return;
  const email = currentUser.email || '';
  const initials = email.slice(0, 2).toUpperCase();
  const el = document.getElementById('topbarAvatar');
  if (el) el.textContent = initials;
  const sideEmail = document.getElementById('sideUserEmail');
  if (sideEmail) sideEmail.textContent = email;
  const sideAvatar = document.getElementById('sideUserAvatar');
  if (sideAvatar) sideAvatar.textContent = initials;
}

/* ── Sidebar toggle (desktop collapse) ── */
const SIDEBAR_STATE_KEY = 'mbs_sidebar_collapsed';

function toggleSidebar() {
  // Sidebar is always overlay — toggle open/close
  if (document.body.classList.contains('nav-open')) {
    closeNav();
  } else {
    openNav();
  }
}

function restoreSidebarState() {
  // Sidebar always starts hidden (overlay mode)
  // No restore needed
}

/* ── Settings store ── */
const MBS_SETTINGS_KEY = 'mbs_settings_local';
let mbsSettings = {
  namaPerusahaan: 'CV Mahkota Berkah Semesta',
  tagline: 'Konveksi · Percetakan · Pengadaan',
  alamat: '',
  telepon: '',
  email: '',
  npwp: '',
  isPkp: true,
  logo: '',
  ttd: '',
  namaTtd: 'Vety Wijayanti',
  jabatanTtd: 'Direktur',
  ttdList: [],
  banks: [],
  invCounter: 0,
  quoCounter: 0,
  poCounter: 0,
  sjCounter: 0,
  daCounter: 0,
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(MBS_SETTINGS_KEY);
    if (raw) mbsSettings = { ...mbsSettings, ...JSON.parse(raw) };
  } catch(e) {}
}
function saveSettings(partial) {
  mbsSettings = { ...mbsSettings, ...partial };
  localStorage.setItem(MBS_SETTINGS_KEY, JSON.stringify(mbsSettings));
  // Sync to Supabase (fire and forget)
  if (sb.ready()) {
    sb.upsert('mbs_settings', { id: 'mbs_settings', data: mbsSettings })
      .catch(e => console.warn('Settings sync error:', e.message));
  }
}

async function loadSettingsFromSupabase() {
  if (!sb.ready()) return;
  try {
    const rows = await sb.select('mbs_settings', '&id=eq.mbs_settings');
    if (rows && rows.length && rows[0].data) {
      mbsSettings = { ...mbsSettings, ...rows[0].data };
      localStorage.setItem(MBS_SETTINGS_KEY, JSON.stringify(mbsSettings));
      // Update Supabase credentials if stored in settings
      if (mbsSettings.supabaseUrl) { SUPABASE_URL = mbsSettings.supabaseUrl; localStorage.setItem('mbs_sb_url', SUPABASE_URL); }
      if (mbsSettings.supabaseKey) { SUPABASE_KEY = mbsSettings.supabaseKey; localStorage.setItem('mbs_sb_key', SUPABASE_KEY); }
    }
  } catch(e) {
    console.warn('Load settings from Supabase error:', e.message);
  }
}
// Hitung jumlah dokumen yang sudah ada di bulan & tahun tertentu
// prefix format: "bulan" = angka bulan yg diawali nomor dokumen
function countDocsThisMonth(cacheKey, month, year) {
  try {
    const rows = JSON.parse(localStorage.getItem('mbs_' + cacheKey) || '[]');
    // Nomor format: {bulan}{urut}-TYPE/MBS/RomanMonth/Year
    // atau cek field tanggal jika ada
    return rows.filter(r => {
      if (r.tanggal) {
        const d = new Date(r.tanggal + 'T00:00:00');
        return d.getMonth() + 1 === month && d.getFullYear() === year;
      }
      // fallback: cek awalan nomor dokumen
      const no = r.nomorDok || r.id || '';
      return no.startsWith(String(month));
    }).length;
  } catch(e) { return 0; }
}

function nextDocNo(type) {
  const map = { inv: 'invCounter', quo: 'quoCounter', po: 'poCounter', sj: 'sjCounter', da: 'daCounter' };
  const key = map[type]; if (!key) return '';
  const now = new Date();
  const mo = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][now.getMonth()];
  const yr = now.getFullYear();
  const prefixes = { inv:'INV', quo:'QUO', po:'PO', sj:'SJ', da:'DA' };
  const n = (mbsSettings[key] || 0) + 1;
  saveSettings({ [key]: n });
  return `${n}/${prefixes[type]}/MBS/${mo}/${yr}`;
}

/* ── TTD helper ── */
function getTtdSlots() {
  if (mbsSettings.ttdList && mbsSettings.ttdList.length) return mbsSettings.ttdList;
  return [{ label:'Admin', nama: mbsSettings.namaTtd||'', jabatan: mbsSettings.jabatanTtd||'', img: mbsSettings.ttd||'' }];
}

/* ── Utilities ── */
const rp = n => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
const rpNoLabel = n => Math.round(Number(n) || 0).toLocaleString('id-ID');
const onlyNum = s => (s + '').replace(/[^\d]/g, '');
const parseNum = s => Number(onlyNum(s)) || 0;
const uid = (p = 'i') => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => (s + '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = d => { if (!d) return '-'; const [y,m,dd] = d.split('-'); return `${dd}/${m}/${y}`; };
const monthLabel = ym => { if (!ym) return ''; const [y,m] = ym.split('-'); return ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][+m-1] + ' ' + y; };

function fmtInput(el) {
  const v = onlyNum(el.value);
  el.value = v ? Number(v).toLocaleString('id-ID') : '';
}

/* ── Toast ── */
function toast(msg, type = '') {
  const wrap = document.getElementById('toastWrap');
  if (!wrap) return;
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 3400);
}

/* ── DB status chip ── */
function setDbStatus(state, text) {
  const el = document.getElementById('dbChip');
  if (!el) return;
  el.className = 'db-chip ' + state;
  const txt = el.querySelector('#dbText');
  if (txt) txt.textContent = text;
}

/* ── Image compress ── */
function compressImage(file, maxPx = 600, quality = 0.82) {
  // Detect if PNG to preserve transparency
  const isPng = file.type === 'image/png';
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let { width: w, height: h } = img;
        if (w > h && w > maxPx) { h = h * maxPx / w; w = maxPx; }
        else if (h > maxPx) { w = w * maxPx / h; h = maxPx; }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        if (!isPng) {
          // Fill white background only for JPEG (no transparency support)
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
        }
        ctx.drawImage(img, 0, 0, w, h);
        // PNG preserves transparency, JPEG for photos
        resolve(isPng ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ── Print helper: tunggu font & gambar selesai load sebelum print ── */
async function waitFontsAndImagesThenPrint(iframeEl, timeoutMs = 4000) {
  const done = (async () => {
    try {
      const doc = iframeEl.contentDocument;
      if (!doc) return;
      if (doc.fonts && doc.fonts.ready) { try { await doc.fonts.ready; } catch(e){} }
      const imgs = Array.from(doc.images || []);
      await Promise.all(imgs.map(img => (img.complete)
        ? Promise.resolve()
        : new Promise(res => { img.onload = res; img.onerror = res; })));
    } catch(e) {}
  })();
  // Safety timeout: jangan sampai print tertunda selamanya kalau ada resource yang gagal load
  await Promise.race([done, new Promise(res => setTimeout(res, timeoutMs))]);
  try { iframeEl.contentWindow.focus(); iframeEl.contentWindow.print(); } catch(e) {}
  setTimeout(() => iframeEl.remove(), 3000);
}

/* ── Print helper ── */
function printHTML(html) {
  const blob = new Blob([html], {type:'text/html;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (w) {
    w.onload = () => { w.print(); setTimeout(() => { w.close(); URL.revokeObjectURL(url); }, 1000); };
  } else {
    // Fallback: iframe
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    f.onload = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch(e){} setTimeout(() => { f.remove(); URL.revokeObjectURL(url); }, 3000); };
    document.body.appendChild(f);
    f.src = url;
  }
}

/* ── CSV download ── */
function downloadCSV(rows, filename) {
  const csv = rows.map(r => r.map(v => {
    v = (v == null ? '' : '' + v);
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }));
  a.download = filename;
  a.click();
}

/* ── Nav helpers ── */
function openNav() { document.body.classList.add('nav-open'); document.getElementById('overlay')?.classList.add('show'); }
function closeNav() { document.body.classList.remove('nav-open'); document.getElementById('overlay')?.classList.remove('show'); }
function toggleGroup(e, id) { e.preventDefault(); document.getElementById(id)?.classList.toggle('open'); }

/* ── Cache ── */
const cache = {
  get: k => { try { return JSON.parse(localStorage.getItem('mbs_' + k) || '[]'); } catch(e) { return []; } },
  set: (k, v) => { try { localStorage.setItem('mbs_' + k, JSON.stringify(v)); } catch(e) {} },
};


/* ── Document helpers (shared by Invoice, Quotation, PO, SJ) ── */
function fmtFullDate(d) {
  if (!d) return '-';
  const dt = new Date(d+'T00:00:00');
  const h = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][dt.getDay()];
  return h+', '+dt.toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
}
function fmtDateID(d) {
  if (!d) return '-';
  const dt = new Date(d+'T00:00:00');
  const days=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const months=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  return `${days[dt.getDay()]}, ${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
}
function fmtDateShort(d) {
  if (!d) return '-';
  const dt = new Date(d+'T00:00:00');
  return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
}
function fmtRpInv(n) { return 'Rp. '+Math.round(n||0).toLocaleString('id-ID'); }
const fmtRp = n => 'Rp '+Math.round(n||0).toLocaleString('id-ID'); // alias = rp()
function terbilang(n) {
  n=Math.floor(Math.abs(n));if(n===0)return'Nol';
  const sat=['','Satu','Dua','Tiga','Empat','Lima','Enam','Tujuh','Delapan','Sembilan'];
  const bel=['Sepuluh','Sebelas','Dua Belas','Tiga Belas','Empat Belas','Lima Belas','Enam Belas','Tujuh Belas','Delapan Belas','Sembilan Belas'];
  const pul=['','','Dua Puluh','Tiga Puluh','Empat Puluh','Lima Puluh','Enam Puluh','Tujuh Puluh','Delapan Puluh','Sembilan Puluh'];
  function h(n){if(n===0)return'';if(n<10)return sat[n];if(n<20)return bel[n-10];if(n<100)return pul[Math.floor(n/10)]+(n%10?' '+sat[n%10]:'');if(n<200)return'Seratus'+(n%100?' '+h(n%100):'');if(n<1000)return sat[Math.floor(n/100)]+' Ratus'+(n%100?' '+h(n%100):'');if(n<2000)return'Seribu'+(n%1000?' '+h(n%1000):'');if(n<1e6)return h(Math.floor(n/1000))+' Ribu'+(n%1000?' '+h(n%1000):'');if(n<1e9)return h(Math.floor(n/1e6))+' Juta'+(n%1e6?' '+h(n%1e6):'');if(n<1e12)return h(Math.floor(n/1e9))+' Miliar'+(n%1e9?' '+h(n%1e9):'');return h(Math.floor(n/1e12))+' Triliun'+(n%1e12?' '+h(n%1e12):'');}
  return h(n);
}

/* ── Boot ── */
loadSettings();

window.addEventListener('DOMContentLoaded', async () => {
  restoreSidebarState();
  const authed = await checkAuth();
  if (authed) {
    showApp();
  } else {
    showLogin();
  }
});
