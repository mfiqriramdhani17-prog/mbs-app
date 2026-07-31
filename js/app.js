/* ============================================================
   MBS ADMIN PANEL — app.js
   Page router, sidebar nav, init
   ============================================================ */

const PAGES = {
  dashboard:         { title: 'Dashboard',            sub: 'Ringkasan bisnis & keuangan' },
  'master-produk':   { title: 'Master Produk',         sub: 'Kelola daftar produk & harga' },
  'master-klien':    { title: 'Master Klien',          sub: 'Kelola data klien & perusahaan' },
  'master-vendor':   { title: 'Master Vendor',         sub: 'Kelola data vendor & supplier' },
  'hpp-project':     { title: 'HPP & Margin Project',  sub: 'Hitung HPP & margin tiap project' },
  pengeluaran:       { title: 'Pengeluaran',            sub: 'Biaya operasional & overhead' },
  laporan:           { title: 'Laporan Keuangan',       sub: 'Laba rugi, kas & PPN' },
  invoice:           { title: 'Invoice',                sub: 'Buat & kelola invoice' },
  quotation:         { title: 'Quotation',              sub: 'Daftar penawaran harga' },
  po:                { title: 'Purchase Order',         sub: 'Order pembelian ke vendor' },
  suratjalan:        { title: 'Surat Jalan',            sub: 'Dokumen pengiriman' },
  'desain-approval': { title: 'Desain Approval',        sub: 'Lembar persetujuan desain' },
  pengaturan:        { title: 'Pengaturan',             sub: 'Konfigurasi sistem & perusahaan' },
};

let currentPage = '';
const pageModules = {};

function registerPage(name, mod) { pageModules[name] = mod; }

async function showPage(name) {
  if (!PAGES[name]) return;
  currentPage = name;
  document.getElementById('pageH1').textContent = PAGES[name].title;
  document.getElementById('pageP').textContent  = PAGES[name].sub;
  const content = document.getElementById('pageContent');
  content.innerHTML = '';
  document.querySelectorAll('.nav-item, .nav-sub .nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === name);
  });
  const subItem = document.querySelector(`.nav-sub .nav-item[data-page="${name}"]`);
  if (subItem) subItem.closest('.nav-group')?.classList.add('open');
  closeNav();
  localStorage.setItem('mbs_last_page', name);

  if (pageModules[name]) {
    try { await pageModules[name].init(content); }
    catch(e) {
      content.innerHTML = `<div class="card card-body"><p style="color:var(--red);font-size:13px">
        <strong>Error memuat modul:</strong> ${esc(e.message)}</p></div>`;
      console.error(e);
    }
  } else {
    content.innerHTML = `<div class="card" style="padding:48px;text-align:center;color:var(--ink2)">
      <p style="font-size:13px">Modul <b>${PAGES[name].title}</b> belum dimuat.</p></div>`;
  }
}

/* ── Build sidebar nav ── */
function buildNav() {
  const ico = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${d}</svg>`;
  document.getElementById('sidebarNav').innerHTML = `
    <a class="nav-item" data-page="dashboard" onclick="showPage('dashboard')">
      ${ico('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>')}
      Dashboard
    </a>

    <div class="nav-section">Master Data</div>
    <a class="nav-item" data-page="master-produk" onclick="showPage('master-produk')">
      ${ico('<path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z" stroke-linejoin="round"/><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9" stroke-linejoin="round"/>')}
      Master Produk
    </a>
    <a class="nav-item" data-page="master-klien" onclick="showPage('master-klien')">
      ${ico('<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke-linecap="round" stroke-linejoin="round"/>')}
      Master Klien
    </a>
    <a class="nav-item" data-page="master-vendor" onclick="showPage('master-vendor')">
      ${ico('<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke-linejoin="round"/><path d="M9 22V12h6v10" stroke-linecap="round" stroke-linejoin="round"/>')}
      Master Vendor
    </a>

    <div class="nav-section">Dokumen</div>
    <div class="nav-group" id="grpDok">
      <a class="nav-item" onclick="toggleGroup(event,'grpDok')">
        ${ico('<path d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" stroke-linejoin="round"/><path d="M14 3v5h5" stroke-linecap="round"/>')}
        Buat Dokumen
        <svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 9l6 6 6-6" stroke-linecap="round"/></svg>
      </a>
      <div class="nav-sub">
        <a class="nav-item" data-page="invoice"          onclick="showPage('invoice')">Invoice</a>
        <a class="nav-item" data-page="quotation"        onclick="showPage('quotation')">Quotation</a>
        <a class="nav-item" data-page="po"               onclick="showPage('po')">Purchase Order</a>
        <a class="nav-item" data-page="suratjalan"       onclick="showPage('suratjalan')">Surat Jalan</a>
        <a class="nav-item" data-page="desain-approval"  onclick="showPage('desain-approval')">Desain Approval</a>
      </div>
    </div>

    <div class="nav-section">Keuangan</div>
    <a class="nav-item" data-page="hpp-project" onclick="showPage('hpp-project')">
      ${ico('<path d="M4 19V5M4 19h16M8 16l3.5-4 3 2.5L20 8" stroke-linecap="round" stroke-linejoin="round"/>')}
      HPP &amp; Margin Project
    </a>
    <a class="nav-item" data-page="pengeluaran" onclick="showPage('pengeluaran')">
      ${ico('<circle cx="12" cy="12" r="8.5"/><path d="M12 7v10M14.5 9.3C14 8.4 13 8 12 8c-1.4 0-2.5.8-2.5 2s1.1 1.8 2.5 2 2.5.9 2.5 2-1.1 2-2.5 2c-1 0-2-.4-2.5-1.3" stroke-linecap="round"/>')}
      Pengeluaran
    </a>
    <a class="nav-item" data-page="laporan" onclick="showPage('laporan')">
      ${ico('<path d="M7 3h10a1 1 0 011 1v17l-6-3-6 3V4a1 1 0 011-1z" stroke-linejoin="round"/>')}
      Laporan Keuangan
    </a>

    <div class="nav-section">Sistem</div>
    <a class="nav-item" data-page="pengaturan" onclick="showPage('pengaturan')">
      ${ico('<circle cx="12" cy="12" r="3"/><path d="M19.4 13a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 01-4 0v-.2A1.6 1.6 0 005 19.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 002.6 14H2a2 2 0 010-4h.2A1.6 1.6 0 003.7 7.3 2 2 0 116.4 4.4l.1.1A1.6 1.6 0 009 4.6V4a2 2 0 014 0v.2a1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1A1.6 1.6 0 0019.4 11" stroke-linejoin="round"/>')}
      Pengaturan
    </a>
  `;
}

/* ── Init (called after login via showApp()) ── */
function initApp() {
  buildNav();
  updateTopbar();
  if (!sb.ready()) {
    setDbStatus('off', 'Set Supabase di Pengaturan');
  } else {
    setDbStatus('ok', 'Supabase ✓');
  }
  const saved = localStorage.getItem('mbs_last_page') || 'dashboard';
  showPage(PAGES[saved] ? saved : 'dashboard');
}

function updateTopbar() {
  updateUserUI();
}
