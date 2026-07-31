/* ══════════════════════════════════════════════
   SURAT JALAN MODULE — list + form + Supabase sync
   ══════════════════════════════════════════════ */

registerPage('suratjalan', {
  rows: [], clients: [], vendors: [],

  async init(el) {
    this.rows = cache.get('suratjalans') || cache.get('sj');
    this.clients = cache.get('clients');
    this.vendors = cache.get('vendors');
    el.innerHTML = this._listHTML();
    this._render();
    await this._load();
  },

  _listHTML() {
    return `
    <div id="sjListView">
      <div class="card reveal">
        <div class="toolbar">
          <div class="toolbar-title">Surat Jalan</div>
          <div class="search-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4" stroke-linecap="round"/></svg>
            <input id="sjSearch" placeholder="Cari nomor / penerima…" oninput="pageModules.suratjalan._render()">
          </div>
          <button class="btn btn-gold" onclick="pageModules.suratjalan.newDoc()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>
            Buat Surat Jalan
          </button>
        </div>
        <div class="tbl-wrap">
          <table><thead><tr><th>No. SJ</th><th>Tanggal</th><th>Penerima</th><th>No. Polisi</th><th class="r">Total</th><th class="r">Aksi</th></tr></thead>
          <tbody id="sjBody"></tbody></table>
        </div>
      </div>
    </div>
    <div id="sjFormView" style="display:none"></div>`;
  },

  async _load() {
    if (!sb.ready()) { this._render(); return; }
    try {
      const [docs, cl, vn] = await Promise.allSettled([
        sb.select('mbs_suratjalan'),
        sb.select('mbs_clients'),
        sb.select('mbs_vendors')
      ]);
      if (docs.status === 'fulfilled') {
        this.rows = docs.value.map(r => ({ __id: r.id, ...(r.data || {}) })).filter(r => r.nomorDok);
        cache.set('suratjalan', this.rows);

      }
      if (cl.status === 'fulfilled') {
        this.clients = cl.value.map(r => ({ __id: r.id, ...(r.data || {}) }));
        cache.set('clients', this.clients);
      }
      if (vn.status === 'fulfilled') {
        this.vendors = vn.value.map(r => ({ __id: r.id, ...(r.data || {}) }));
        cache.set('vendors', this.vendors);
      }
      this._render();
    } catch(e) { toast('Load error: ' + e.message, 'err'); this._render(); }
  },

  showList() {
    document.getElementById('sjListView').style.display = '';
    document.getElementById('sjFormView').style.display = 'none';
  },

  showForm() {
    document.getElementById('sjListView').style.display = 'none';
    document.getElementById('sjFormView').style.display = '';
    window.scrollTo(0, 0);
  },

  newDoc() {
    _sj_editingId = null;
    this._renderForm(null);
  },
  _renderForm(r) {
    _sj_editingId = r ? r.__id : null;
    const fv = document.getElementById('sjFormView');
    fv.innerHTML = _formHTML_suratjalan();
    if (r) {
      const setVal = (id, v) => { const el = document.getElementById(id); if(el && v != null) el.value = v; };
      setVal('sjNo', r.nomorDok); setVal('sjDate', r.tanggal);
      setVal('sjPo', r.po); setVal('sjPolisi', r.polisi);
      setVal('sjDriver', r.driver); setVal('sjClientName', r.clientName);
      setVal('sjClientAddr', r.clientAddr); setVal('sjClientCp', r.clientCp);
      setVal('sjClientTel', r.clientTel);
      _sj_itemIdx = 0;
      const tb = document.getElementById('itemsBody');
      if (tb) { tb.innerHTML=''; (r.items||[]).forEach(it => sj_addItemRow(it)); }
    }
    if(!r) sj_regenNo(); sj_buildClientDL(); if(!r) sj_addItemRow();
    sj_updateTotal(); sj_updateTtdInfo();
    this.showForm();
  },

  edit(id) {
    const r = this.rows.find(x => x.__id === id);
    if (!r) return;
    _sj_editingId = id;
    this._renderForm(r);
  },

  previewRow(id) {
    const r = this.rows.find(x => x.__id === id);
    if (!r) return;
    _sj_ensureModal();
    if (!document.getElementById('sjRender')) {
      const old = document.getElementById('previewModal');
      if (old) old.remove();
      _sj_ensureModal();
    }
    _sj_previewData = r;
    document.getElementById('previewTitle').textContent = 'Preview Surat Jalan ' + (r.nomorDok || '');
    document.getElementById('sjRender').innerHTML = sj_renderHTML(r);
    document.getElementById('previewModal').classList.remove('hidden');
    document.getElementById('previewModal').classList.add('show');
  },

  async del(id) {
    const r = this.rows.find(x => x.__id === id);
    if (!r || !confirm('Hapus ' + (r.nomorDok || 'dokumen') + '?')) return;
    this.rows = this.rows.filter(x => x.__id !== id);
    cache.set('suratjalan', this.rows);

    this._render();
    try { if (sb.ready()) await sb.remove('mbs_suratjalan', id); }
    catch(e) {}
    toast('Dihapus', 'ok');
  },

  _render() {
    const tb = document.getElementById('sjBody'); if (!tb) return;
    const q = (document.getElementById('sjSearch')?.value || '').toLowerCase();
      const list = this.rows.filter(r => !q || (r.nomorDok+' '+r.clientName).toLowerCase().includes(q));
      if (!list.length) { tb.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="t">Belum ada Surat Jalan</div></div></td></tr>`; return; }
      tb.innerHTML = list.map(r => `<tr>
        <td class="td-mono text-gold">${esc(r.nomorDok||'-')}</td>
        <td>${fmtDate(r.tanggal)}</td>
        <td class="td-bold">${esc(r.clientName||'-')}</td>
        <td class="td-mono">${esc(r.polisi||'-')}</td>
        <td class="td-r">${r.total||0} pcs</td>
        <td><div class="row-act">
          <button class="ibtn ibtn-view" onclick="pageModules.suratjalan.previewRow('${r.__id}')" title="Preview PDF"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-linejoin="round"/><circle cx="12" cy="12" r="3"/></svg></button>
          <button class="ibtn ibtn-edit" onclick="pageModules.suratjalan.edit('${r.__id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h4L18 10l-4-4L4 16z" stroke-linejoin="round"/></svg></button>
          <button class="ibtn ibtn-del" onclick="pageModules.suratjalan.del('${r.__id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13" stroke-linecap="round"/></svg></button>
        </div></td>
      </tr>`).join('');
  },

  async afterSave(doc) {
    const newId = doc.id || doc.nomorDok;
    if (_sj_editingId) {
      const idx = this.rows.findIndex(x => x.__id === _sj_editingId);
      if (idx >= 0) this.rows[idx] = { __id: _sj_editingId, ...doc };
    } else {
      this.rows.unshift({ __id: newId, ...doc });
    }
    cache.set('suratjalan', this.rows);

    try {
      if (sb.ready()) await sb.upsert('mbs_suratjalan', { id: _sj_editingId || newId, data: doc });
      toast('Tersimpan', 'ok');
    } catch(e) {
      toast('Tersimpan lokal (Supabase: ' + e.message + ')', 'err');
    }
    this.showList();
    this._render();
  },
});

/* ── Surat Jalan state ── */

let _sj_itemIdx = 0;
let _sj_editingId = null;
let _sj_previewData = null;

function _formHTML_suratjalan() {
  return `  <!-- INFORMASI SURAT JALAN -->
  <div class="card">
    <div class="sec-title">Informasi Surat Jalan</div>
    <div class="fg c3">
      <div class="field"><label>No. Surat Jalan</label><input type="text" id="sjNo" readonly placeholder="Auto-generate..."></div>
      <div class="field"><label>Hari / Tanggal</label><input type="date" id="sjDate" oninput="sj_regenNo()"></div>
      <div class="field"><label>No. PO <span class="opt">(opsional)</span></label><input type="text" id="sjPo" placeholder="Contoh: NKL-112/2025"></div>
      <div class="field"><label>No. Polisi <span class="opt">(opsional)</span></label><input type="text" id="sjPolisi" placeholder="B 1234 XYZ"></div>
      <div class="field"><label>Nama Pengemudi <span class="opt">(opsional)</span></label><input type="text" id="sjDriver" placeholder="Nama pengemudi..."></div>
    </div>
    <!-- TTD info — baku dari slot Custom (slot 3) -->
    <div class="fg" style="padding-top:0">
      <div>
        <div style="font-size:11px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;color:var(--ink2);margin-bottom:8px">Tanda Tangan PIC</div>
        <div class="ttd-info" id="ttdInfoDisplay">
          <div class="ttd-chip"><span class="dot"></span><span id="ttdPicLabel">Custom (slot 4)</span></div>
          <span style="margin-left:auto;font-size:11.5px;color:var(--ink2)">Otomatis dari <a href="#" style="color:var(--gold-deep);font-weight:700;text-decoration:none">Pengaturan → Tanda Tangan</a></span>
        </div>
      </div>
    </div>
  </div>

  <!-- DATA PENERIMA -->
  <div class="card">
    <div class="sec-title">Data Penerima</div>
    <div style="padding:0 20px;margin-bottom:14px">
      <div class="field" style="max-width:320px">
        <label>Kode Klien (Autofill)</label>
        <div class="lookup-wrap">
          <input type="text" id="sjClientCode" list="clientDL" placeholder="Ketik atau pilih kode klien..."
            oninput="this.value=this.value.toUpperCase();sj_tryAutofill()">
          <button class="lookup-btn" onclick="sj_doAutofill()">Isi Data</button>
        </div>
        <datalist id="clientDL"></datalist>
      </div>
      <div class="autofill-badge" id="autofillBadge">
        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
        <span id="autofillName"></span>
      </div>
    </div>
    <div class="fg c2">
      <div class="field"><label>Nama Perusahaan Penerima <span class="req">*</span></label><input type="text" id="sjClientName" placeholder="PT Karya Pejuang Senyum"></div>
      <div class="field"><label>Narahubung (u.p)</label><input type="text" id="sjClientCp" placeholder="Ibu Gracia (0813-8417-8286)"></div>
      <div class="field"><label>No. Telepon</label><input type="text" id="sjClientTel" placeholder="+62..."></div>
    </div>
    <div class="fg" style="padding-top:0">
      <div class="field"><label>Alamat Tujuan</label><textarea id="sjClientAddr" placeholder="Alamat lengkap tujuan pengiriman..."></textarea></div>
    </div>
  </div>

  <!-- DAFTAR BARANG -->
  <div class="card">
    <div style="padding:16px 20px 14px;font-size:10.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--gold-deep)">Daftar Barang</div>
    <div class="items-wrap">
      <table class="items" id="itemsTable">
        <thead>
          <tr>
            <th style="width:36px">No</th>
            <th>Nama Barang</th>
            <th style="width:80px">Unit</th>
            <th style="width:80px">Size</th>
            <th style="width:90px">Jumlah</th>
            <th>Keterangan</th>
            <th style="width:36px"></th>
          </tr>
        </thead>
        <tbody id="itemsBody"></tbody>
      </table>
    </div>
    <button class="add-item-btn" onclick="sj_addItemRow()">+ Tambah Barang</button>
    <div class="total-counter">Total Barang: <strong id="totalDisplay">0</strong></div>
  </div>

  <!-- BUTTONS -->
  <div class="card" style="padding:0">
    <div class="btn-row" style="padding:16px 20px">
      <button class="btn btn-gold" onclick="sj_saveSJ()">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
        Simpan Surat Jalan
      </button>
      <button class="btn btn-outline" onclick="sj_doPreview()">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
        Preview
      </button>
      <button class="btn btn-outline" onclick="pageModules.suratjalan.showList()">Batal</button>
    </div>
  </div>
</div>

`;
}


function _sj_ensureModal() {
  if (document.getElementById('previewModal')) return;
  const d = document.createElement('div');
  d.className = 'modal-bg hidden';
  d.id = 'previewModal';
  d.innerHTML = `
    <div class="modal modal-lg">
      <div class="modal-head">
        <h3 id="previewTitle">Preview Surat Jalan</h3>
        <button class="modal-x" onclick="sj_closePreview()">×</button>
      </div>
      <div class="modal-body" style="max-height:70vh;overflow-y:auto">
        <div id="sjRender"></div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-gold" onclick="sj_doPrint()">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
          Cetak / PDF
        </button>
        <button class="btn btn-outline" onclick="sj_closePreview()">Tutup</button>
      </div>
    </div>`;
  document.body.appendChild(d);
}

function sj_doPreview() {
  _sj_ensureModal();
  if (!document.getElementById('sjRender')) {
    const old = document.getElementById('previewModal');
    if (old) old.remove();
    _sj_ensureModal();
  }
  const data = sj_buildData();
  _sj_previewData = data;
  document.getElementById('previewTitle').textContent = 'Preview Surat Jalan ' + data.nomorDok;
  document.getElementById('sjRender').innerHTML = sj_renderHTML(data);
  document.getElementById('previewModal').classList.remove('hidden');
  document.getElementById('previewModal').classList.add('show');
}
function sj_closePreview() { const m=document.getElementById('previewModal'); if(m){m.classList.remove('show');} }
function sj_doPrint() {
  if (!_sj_previewData) return;
  const html = sj_buildPrintPage(_sj_previewData);
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(f);
  f.onload = () => waitFontsAndImagesThenPrint(f);
  f.srcdoc = html;
}

// ── No generator ──
function sj_regenNo() {
  const d = document.getElementById('sjDate').value;
  const dt = d ? new Date(d+'T00:00:00') : new Date();
  const bulan = dt.getMonth() + 1;
  const mo = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][dt.getMonth()];
  const yr = dt.getFullYear();
  const existing = pageModules['suratjalan']?.rows || [];
  const thisMonth = existing.filter(r => {
    if (!r.tanggal) return false;
    const rd = new Date(r.tanggal+'T00:00:00');
    return rd.getMonth()+1===bulan && rd.getFullYear()===yr;
  }).length;
  const n = String(thisMonth + 1).padStart(2, '0');
  document.getElementById('sjNo').value = `${bulan}${n}-SJ/MBS/${mo}/${yr}`;
}

// ── TTD: Custom = slot[3] ──
function sj_updateTtdInfo() {
  const slots = mbsSettings.ttdList || [];
  const pic = slots[3] || {}; // Custom (slot 4)
  const el = document.getElementById('ttdPicLabel');
  if (el) {
    const label = pic.nama && pic.jabatan
      ? `${pic.nama} (${pic.jabatan})`
      : pic.jabatan || pic.nama || 'Custom (belum diisi di Pengaturan)';
    el.textContent = label;
  }
}

function sj_buildClientDL() {
  const dl = document.getElementById('clientDL');
  const clients = JSON.parse(localStorage.getItem('mbs_clients') || '[]');
  dl.innerHTML = clients.map(c => `<option value="${c.kode||c.code||''}">${c.kode||c.code||''} — ${c.nama||c.name||''}</option>`).join('');
}

function sj_tryAutofill() {
  const code = document.getElementById('sjClientCode').value.trim().toUpperCase();
  const clients = JSON.parse(localStorage.getItem('mbs_clients') || '[]');
  const c = clients.find(x => (x.kode||x.code||'').toUpperCase() === code);
  if (c) sj_applyClient(c);
}
function sj_applyClient(c) {
  document.getElementById('sjClientName').value = c.nama || c.name || '';
  document.getElementById('sjClientAddr').value = c.alamat || c.address || '';
  document.getElementById('sjClientCp').value = c.contact || c.naraHubung || '';
  document.getElementById('sjClientTel').value = c.telepon || c.phone || '';
  const badge = document.getElementById('autofillBadge');
  badge.style.display = 'flex';
  document.getElementById('autofillName').textContent = c.nama || c.name || '';
}
function sj_doAutofill() {
  const code = document.getElementById('sjClientCode').value.trim().toUpperCase();
  const clients = JSON.parse(localStorage.getItem('mbs_clients') || '[]');
  const c = clients.find(x => (x.kode||x.code||'').toUpperCase() === code);
  if (!c) { alert('Kode klien tidak ditemukan'); return; }
  sj_applyClient(c);
}

// ── Items ──
function sj_addItemRow(data=null) {
  const tbody = document.getElementById('itemsBody');
  const i = _sj_itemIdx++;
  const no = tbody.rows.length + 1;
  const tr = document.createElement('tr');
  tr.id = `item-row-${i}`;
  tr.innerHTML = `
    <td class="no">${no}</td>
    <td><input type="text" placeholder="Nama barang" value="${esc(data?.name||'')}"></td>
    <td><input type="text" placeholder="Pcs" value="${esc(data?.unit||'')}" style="width:100%"></td>
    <td><input type="text" placeholder="M, L, XL..." value="${esc(data?.size||'')}" style="width:100%"></td>
    <td><input type="number" placeholder="0" value="${data?.qty||''}" min="0" oninput="sj_updateTotal()" style="width:100%"></td>
    <td><input type="text" placeholder="Keterangan..." value="${esc(data?.keterangan||'')}"></td>
    <td><button class="remove-row" onclick="sj_removeRow(this,${i})">×</button></td>
  `;
  tbody.appendChild(tr);
  sj_updateTotal(); sj_renumber();
}
function sj_removeRow(btn, i) { btn.closest('tr').remove(); sj_renumber(); sj_updateTotal(); }
function sj_renumber() { document.querySelectorAll('#itemsBody tr').forEach((r,i) => { if(r.cells[0]) r.cells[0].textContent=i+1; }); }
function sj_updateTotal() {
  let t = 0;
  document.querySelectorAll('#itemsBody tr').forEach(r => {
    const q = r.querySelector('input[type=number]');
    if (q) t += parseFloat(q.value) || 0;
  });
  const el = document.getElementById('totalDisplay');
  if (el) el.textContent = t;
}
function sj_getItems() {
  return Array.from(document.querySelectorAll('#itemsBody tr')).map(r => {
    const ins = r.querySelectorAll('input');
    return { name:ins[0]?.value||'', unit:ins[1]?.value||'', size:ins[2]?.value||'', qty:parseFloat(ins[3]?.value)||0, keterangan:ins[4]?.value||'' };
  });
}

// ── Save ──
function sj_saveSJ() {
  const clientName = document.getElementById('sjClientName').value.trim();
  if (!clientName) { toast('Nama penerima wajib diisi!', 'err'); return; }
  const sj = sj_buildData();
  pageModules['suratjalan'].afterSave(sj);
}

// ── Build data ──
function sj_buildData() {
  const g = id => document.getElementById(id);
  return {
    id: _sj_editingId || ('sj_' + Date.now()),
    nomorDok: g('sjNo')?.value || '',
    tanggal: g('sjDate')?.value || '',
    po: g('sjPo')?.value || '',
    polisi: g('sjPolisi')?.value || '',
    driver: g('sjDriver')?.value || '',
    clientName: g('sjClientName')?.value || '',
    clientCp: g('sjClientCp')?.value || '',
    clientTel: g('sjClientTel')?.value || '',
    clientAddr: g('sjClientAddr')?.value || '',
    items: sj_getItems(),
    ttdSlot: 0,
    ttdMakerSnapshot: (mbsSettings.ttdList||[])[0] || null,
    ttdDirekturSnapshot: (mbsSettings.ttdList||[])[2] || null,
  };
}

// ── Render HTML (preview) ──
function sj_renderHTML(sj) {
  const s = mbsSettings;
  const logoHTML = s.logo
    ? `<img style="width:40px;height:40px;object-fit:contain" src="${s.logo}">`
    : `<div style="width:40px;height:40px;background:#C79A2E;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:11px">${(s.namaPerusahaan||'MBS').slice(0,3)}</div>`;

  const itemsHTML = (sj.items||[]).map((it,i) => `
    <tr>
      <td style="text-align:center;padding:6px 8px;border-bottom:1px solid #f0f0f0;font-size:11px">${i+1}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;font-size:11px">${esc(it.name||'')}</td>
      <td style="text-align:center;padding:6px 8px;border-bottom:1px solid #f0f0f0;font-size:11px">${esc(it.unit||'')}</td>
      <td style="text-align:center;padding:6px 8px;border-bottom:1px solid #f0f0f0;font-size:11px">${esc(it.size||'')}</td>
      <td style="text-align:center;padding:6px 8px;border-bottom:1px solid #f0f0f0;font-size:11px;font-weight:700">${it.qty||0}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;font-size:11px;color:#666">${esc(it.keterangan||'')}</td>
    </tr>`).join('');

  const totalQty = (sj.items||[]).reduce((a,it) => a + (parseFloat(it.qty)||0), 0);
  const ttdList = s.ttdList || [];
  const ttdMaker = sj.ttdMakerSnapshot || ttdList[sj.ttdSlot||0] || {};
  const ttdDirektur = sj.ttdDirekturSnapshot || ttdList[2] || {};

  return `
<div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;color:#111;padding:4px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">
    <div style="display:flex;align-items:center;gap:10px">
      ${logoHTML}
      <div>
        <div style="font-size:14px;font-weight:800">${esc(s.namaPerusahaan||'CV MBS')}</div>
        <div style="font-size:10px;color:#666;margin-top:2px;line-height:1.5">${esc(s.alamat||'').replace(/\n/g,'<br>')}</div>
      </div>
    </div>
    <div style="text-align:right">
      <div style="background:#211F1C;color:#C79A2E;font-size:16px;font-weight:800;padding:5px 14px;border-radius:7px;letter-spacing:.05em">SURAT JALAN</div>
      <div style="margin-top:8px;font-size:11px;color:#444">
        <div><b>No:</b> ${esc(sj.nomorDok||'-')}</div>
        <div><b>Tanggal:</b> ${fmtFullDate(sj.tanggal)}</div>
        ${sj.po ? `<div><b>No. PO:</b> ${esc(sj.po)}</div>` : ''}
        ${sj.polisi ? `<div><b>No. Polisi:</b> ${esc(sj.polisi)}</div>` : ''}
        ${sj.driver ? `<div><b>Pengemudi:</b> ${esc(sj.driver)}</div>` : ''}
      </div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
    <div style="background:#f9f6f0;border:1px solid #e8dfc8;border-radius:8px;padding:10px 14px">
      <div style="font-size:9.5px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#a07c20;margin-bottom:6px">Pengirim</div>
      <div style="font-weight:700">${esc(s.namaPerusahaan||'')}</div>
      <div style="font-size:11px;color:#555;margin-top:2px">${esc(s.alamat||'').replace(/\n/g,'<br>')}</div>
    </div>
    <div style="background:#f9f6f0;border:1px solid #e8dfc8;border-radius:8px;padding:10px 14px">
      <div style="font-size:9.5px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#a07c20;margin-bottom:6px">Penerima</div>
      <div style="font-weight:700">${esc(sj.clientName||'-')}</div>
      ${sj.clientCp ? `<div style="font-size:11px;color:#555">u.p: ${esc(sj.clientCp)}</div>` : ''}
      ${sj.clientTel ? `<div style="font-size:11px;color:#555">${esc(sj.clientTel)}</div>` : ''}
      ${sj.clientAddr ? `<div style="font-size:11px;color:#555;margin-top:2px">${esc(sj.clientAddr).replace(/\n/g,'<br>')}</div>` : ''}
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;border:1px solid #e0d8c8;border-radius:8px;overflow:hidden">
    <thead>
      <tr style="background:#211F1C;color:#C79A2E">
        <th style="padding:8px;font-size:10.5px;text-align:center;width:36px">No</th>
        <th style="padding:8px;font-size:10.5px;text-align:left">Nama Barang</th>
        <th style="padding:8px;font-size:10.5px;text-align:center;width:70px">Satuan</th>
        <th style="padding:8px;font-size:10.5px;text-align:center;width:80px">Ukuran</th>
        <th style="padding:8px;font-size:10.5px;text-align:center;width:60px">Qty</th>
        <th style="padding:8px;font-size:10.5px;text-align:left">Keterangan</th>
      </tr>
    </thead>
    <tbody>${itemsHTML}</tbody>
    <tfoot>
      <tr style="background:#faf7f2">
        <td colspan="4" style="padding:8px;font-size:11px;font-weight:700;text-align:right;border-top:2px solid #e0d8c8">Total Qty:</td>
        <td style="padding:8px;font-size:13px;font-weight:800;text-align:center;border-top:2px solid #e0d8c8;color:#211F1C">${totalQty}</td>
        <td style="border-top:2px solid #e0d8c8"></td>
      </tr>
    </tfoot>
  </table>

  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:24px">
    ${[{label:'Pengirim', data:ttdMaker},{label:'Penerima', data:{}},{label:'Mengetahui', data:ttdDirektur}].map(col=>`
    <div style="text-align:center;border:1px solid #e0d8c8;border-radius:8px;padding:14px 10px;display:flex;flex-direction:column;justify-content:space-between;min-height:140px">
      <div style="font-size:10px;font-weight:700;color:#666">${col.label}</div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:6px 0">
        ${col.data.img ? `<img src="${col.data.img}" style="max-height:65px;max-width:90%;object-fit:contain">` : ''}
      </div>
      <div style="border-top:1px solid #333;padding-top:6px">
        <div style="font-weight:700;font-size:11px">${esc(col.data.nama||'...............')}</div>
        <div style="font-size:10px;color:#666">${esc(col.data.jabatan||'')}</div>
      </div>
    </div>`).join('')}
  </div>
</div>`;
}

// ── Print page ──
function sj_buildPrintPage(sj) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Surat Jalan ${esc(sj.nomorDok||'')}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  * { box-sizing:border-box; margin:0; padding:0; -webkit-print-color-adjust:exact; print-color-adjust:exact; color-adjust:exact; }
  body { font-family:'Plus Jakarta Sans',sans-serif; font-size:12px; color:#111; padding:20px; }
  @media print { body { padding:0; } @page { size:A4; margin:15mm 15mm 15mm 15mm; } }
</style>
</head><body>${sj_renderHTML(sj)}</body></html>`;
}
