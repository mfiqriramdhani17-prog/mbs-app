/* ══════════════════════════════════════════════
   INVOICE MODULE — list + form + Supabase sync
   ══════════════════════════════════════════════ */

registerPage('invoice', {
  rows: [], clients: [],

  async init(el) {
    this.rows = cache.get('invoices');
    this.clients = cache.get('clients');
    el.innerHTML = this._listHTML();
    this._render();
    await this._load(el);
  },

  _listHTML() {
    return `
    <div id="invListView">
      <div class="card reveal">
        <div class="toolbar">
          <div class="toolbar-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M7 3h10a1 1 0 011 1v17l-6-3-6 3V4a1 1 0 011-1z" stroke-linejoin="round"/></svg>
            Daftar Invoice
          </div>
          <div class="search-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4" stroke-linecap="round"/></svg>
            <input id="invSearch" placeholder="Cari nomor / klien…" oninput="Invoice._render()">
          </div>
          <select class="fsel" id="invStatusFil" onchange="Invoice._render()">
            <option value="">Semua status</option>
            <option>Lunas</option><option>DP</option><option>Belum Bayar</option>
          </select>
          <button class="btn btn-gold" onclick="Invoice.newDoc()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>
            Buat Invoice
          </button>
        </div>
        <div class="tbl-wrap">
          <table><thead><tr>
            <th>No. Invoice</th><th>Tanggal</th><th>Klien</th>
            <th class="r">Total</th><th>PPN</th><th>Status</th><th class="r">Aksi</th>
          </tr></thead><tbody id="invBody"></tbody></table>
        </div>
      </div>
    </div>
    <div id="invFormView" style="display:none"></div>`;
  },

  async _load(el) {
    if (!sb.ready()) { this._render(); return; }
    try {
      const [inv, cl] = await Promise.allSettled([
        sb.select('mbs_invoices'), sb.select('mbs_clients')
      ]);
      if (inv.status === 'fulfilled') {
        this.rows = inv.value.map(r => ({ __id: r.id, ...(r.data || {}) })).filter(r => r.nomorDok);
        cache.set('invoices', this.rows);
      }
      if (cl.status === 'fulfilled') {
        this.clients = cl.value.map(r => ({ __id: r.id, ...(r.data || {}) }));
        cache.set('clients', this.clients);
      }
      this._render();
    } catch(e) { toast('Load error: ' + e.message, 'err'); this._render(); }
  },

  _render() {
    const tb = document.getElementById('invBody'); if (!tb) return;
    const q = (document.getElementById('invSearch')?.value || '').toLowerCase();
    const sf = document.getElementById('invStatusFil')?.value || '';
    const stMap = { 'Lunas':'tag-green', 'DP':'tag-gold', 'Belum Bayar':'tag-red' };
    const list = this.rows.filter(r =>
      (!q || (r.nomorDok + ' ' + r.namaKlien).toLowerCase().includes(q)) &&
      (!sf || (r.statusBayar || 'Belum Bayar') === sf)
    );
    if (!list.length) {
      tb.innerHTML = `<tr><td colspan="7"><div class="empty-state">
        <div class="t">Belum ada invoice</div>
        <div class="s">Klik "Buat Invoice" untuk mulai</div>
      </div></td></tr>`;
      return;
    }
    tb.innerHTML = list.map(r => `<tr>
      <td class="td-mono text-gold">${esc(r.nomorDok||'-')}</td>
      <td>${fmtDate(r.tanggal)}</td>
      <td class="td-bold">${esc(r.namaKlien||'-')}</td>
      <td class="td-r">${rp(r.nilaiTagihan ?? r.grandTotal ?? 0)}</td>
      <td>${r.usePpn ? '<span class="tag tag-gold">PPN</span>' : '<span class="tag tag-gray">−</span>'}</td>
      <td><span class="tag ${stMap[r.statusBayar||'Belum Bayar']||'tag-gray'}">${r.statusBayar||'Belum Bayar'}</span></td>
      <td><div class="row-act">
        <button class="ibtn ibtn-view" onclick="Invoice.previewRow('${r.__id}')" title="Preview PDF">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-linejoin="round"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button class="ibtn ibtn-edit" onclick="Invoice.edit('${r.__id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h4L18 10l-4-4L4 16z" stroke-linejoin="round"/></svg>
        </button>
        <button class="ibtn ibtn-del" onclick="Invoice.del('${r.__id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13" stroke-linecap="round"/></svg>
        </button>
      </div></td>
    </tr>`).join('');
  },

  showList() {
    document.getElementById('invListView').style.display = '';
    document.getElementById('invFormView').style.display = 'none';
    document.getElementById('pageH1').textContent = 'Invoice';
  },

  showForm() {
    document.getElementById('invListView').style.display = 'none';
    document.getElementById('invFormView').style.display = '';
    window.scrollTo(0, 0);
  },

  newDoc() {
    _inv_itemIndex = 0; _inv_itemRowImages = {}; _inv_editingId = null; _inv_previewData = null;
    const fv = document.getElementById('invFormView');
    fv.innerHTML = _formHTML_invoice();
    document.getElementById('invDate').value = today();
    inv_regenNo(); inv_buildBankSelect(); inv_buildClientDatalist();
    inv_addItemRow(); inv_calcTotals(); inv_onTerminChange();
    // Pre-fill clients datalist
    const dl = document.getElementById('invClientDL');
    if (dl) dl.innerHTML = this.clients.map(c =>
      `<option value="${esc(c.kode||'')}"> ${esc(c.nama||c.name||'')}</option>`).join('');
    this.showForm();
  },

  edit(id) {
    const r = this.rows.find(x => x.__id === id);
    if (!r) return;
    _reset_invoice();
    _inv_editingId = id;
    const fv = document.getElementById('invFormView');
    fv.innerHTML = _formHTML_invoice();
    this._fillForm(r);
    this.showForm();
  },

  _fillForm(r) {
    const setVal = (id, v) => { const el = document.getElementById(id); if(el) el.value = v || ''; };
    setVal('invNo', r.nomorDok);
    setVal('invDate', r.tanggal);
    setVal('invPo', r.noPo);
    setVal('invTermin', r.termin || 'DP');
    setVal('invClientName', r.namaKlien);
    setVal('invClientCp', r.clientCp);
    setVal('invClientTel', r.clientTel);
    setVal('invClientAddr', r.alamatKlien);
    setVal('invNotes', r.catatan);
    setVal('invStatusBayar', r.statusBayar || 'Belum Bayar');
    // DP fields
    setVal('dpMethod', r.dpMethod || 'pct');
    setVal('dpPctVal', r.dpPctVal ?? 30);
    setVal('dpCustomVal', r.dpAmt ?? 0);
    // Pelunasan fields
    const useSudahEl = document.getElementById('useSudah');
    if (useSudahEl) useSudahEl.checked = r.useSudah === true;
    setVal('sudahMethod', r.sudahMethod || 'pct');
    setVal('sudahPctVal', r.sudahPctVal ?? 0);
    setVal('sudahCustomVal', r.sudahAmt ?? 0);
    inv_onDpMethodChange();
    if (useSudahEl) document.getElementById('sudahDetail').style.display = useSudahEl.checked ? '' : 'none';
    inv_onSudahMethodChange();
    // Photo toggle
    const photoEl = document.getElementById('usePhoto');
    if (photoEl) {
      photoEl.checked = r.usePhoto === true;
      inv_togglePhotoCol();
    }
    // PPN
    const ppnEl = document.getElementById('usePpn');
    if (ppnEl) { ppnEl.checked = r.usePpn !== false; }
    if (r.ppnPct) setVal('ppnPct', r.ppnPct);
    if (r.pphPct) setVal('pphPct', r.pphPct);
    // Items
    _inv_itemIndex = 0;
    const tbody = document.getElementById('itemsBody');
    if (tbody) {
      tbody.innerHTML = '';
      (r.items || []).forEach(it => inv_addItemRow(it));
    }
    inv_calcTotals();
    inv_buildBankSelect();
    inv_buildClientDatalist();
    // Pre-fill clients
    const dl = document.getElementById('invClientDL');
    if (dl) dl.innerHTML = this.clients.map(c =>
      `<option value="${esc(c.kode||'')}"> ${esc(c.nama||c.name||'')}</option>`).join('');
  },

  previewRow(id) {
    const r = this.rows.find(x => x.__id === id);
    if (!r) return;
    _inv_ensureModal();
    if (!document.getElementById('invoiceRender')) {
      const old = document.getElementById('previewModal');
      if (old) old.remove();
      _inv_ensureModal();
    }
    _inv_previewData = r;
    document.getElementById('previewTitle').textContent = 'Preview Invoice ' + (r.nomorDok || '');
    document.getElementById('invoiceRender').innerHTML = inv_renderInvoiceHTML(r);
    document.getElementById('previewModal').classList.remove('hidden');
    document.getElementById('previewModal').classList.add('show');
  },

  async del(id) {
    const r = this.rows.find(x => x.__id === id);
    if (!r || !confirm(`Hapus invoice ${r.nomorDok}?`)) return;
    this.rows = this.rows.filter(x => x.__id !== id);
    cache.set('invoices', this.rows);
    this._render();
    try { if (sb.ready()) await sb.remove('mbs_invoices', id); }
    catch(e) {}
    toast('Invoice dihapus', 'ok');
  },

  // Called by form save button
  async afterSave(inv) {
    const isNew = !_inv_editingId;
    if (_inv_editingId) {
      const idx = this.rows.findIndex(x => x.__id === _inv_editingId);
      if (idx >= 0) this.rows[idx] = { __id: _inv_editingId, ...inv };
    } else {
      this.rows.unshift({ __id: inv.id, ...inv });
    }
    cache.set('invoices', this.rows);

    try {
      if (sb.ready()) await sb.upsert('mbs_invoices', { id: inv.id, data: inv });
      toast('Invoice disimpan', 'ok');
    } catch(e) {
      toast('Tersimpan lokal (Supabase error: ' + e.message + ')', 'err');
    }
    this.showList();
    this._render();
  }
});

const Invoice = pageModules['invoice'];

let _inv_itemIndex = 0;
let _inv_itemRowImages = {};
let _inv_editingId = null;
let _inv_previewData = null;

function _reset_invoice() {
  _inv_itemIndex = 0;
  _inv_itemRowImages = {};
  _inv_editingId = null;
  _inv_previewData = null;
}

function _formHTML_invoice() {
  return `  <!-- INFORMASI INVOICE -->
  <div class="card">
    <div class="sec-title">Informasi Invoice</div>
    <div class="fg c4">
      <div class="field">
        <label>No. Invoice</label>
        <input type="text" id="invNo" readonly placeholder="Auto-generate...">
      </div>
      <div class="field">
        <label>Tanggal</label>
        <input type="date" id="invDate" oninput="inv_regenNo()">
      </div>
      <div class="field">
        <label>No. PO</label>
        <input type="text" id="invPo" placeholder="Contoh: NKL-112/2025">
      </div>
      <div class="field">
        <label>Termin Pembayaran</label>
        <select id="invTermin" onchange="inv_onTerminChange()">
          <option value="DP">Down Payment (DP)</option>
          <option value="DP1">DP 1</option>
          <option value="DP2">DP 2</option>
          <option value="DP3">DP 3</option>
          <option value="DP4">DP 4</option>
          <option value="PELUNASAN">Pelunasan</option>
        </select>
      </div>
    </div>
  </div>

  <!-- DATA PENERIMA / KLIEN -->
  <div class="card">
    <div class="sec-title">Data Penerima / Klien</div>
    <div style="padding:0 20px;margin-bottom:14px">
      <div class="field" style="max-width:320px;position:relative">
        <label>Kode Klien (Autofill)</label>
        <div class="lookup-wrap">
          <input type="text" id="invClientCode" list="clientDL" placeholder="Ketik atau pilih kode klien..."
            oninput="this.value=this.value.toUpperCase();inv_tryAutofill()">
          <button class="lookup-btn" onclick="inv_doAutofill()">Isi Data</button>
        </div>
        <datalist id="clientDL"></datalist>
      </div>
      <div class="autofill-badge" id="autofillBadge">
        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
        <span id="autofillName"></span>
      </div>
    </div>
    <div class="fg c2">
      <div class="field"><label>Nama Perusahaan / Klien <span class="req">*</span></label><input type="text" id="invClientName" placeholder="PT Karya Pejuang Senyum"></div>
      <div class="field"><label>u.p (Narahubung)</label><input type="text" id="invClientCp" placeholder="Ibu Gracia (0813-8417-8286)"></div>
      <div class="field"><label>No. Telepon</label><input type="text" id="invClientTel" placeholder="+62..."></div>
    </div>
    <div class="fg" style="padding-top:0">
      <div class="field"><label>Alamat Klien</label><textarea id="invClientAddr" placeholder="Alamat lengkap penerima invoice..."></textarea></div>
    </div>
  </div>

  <!-- REKENING BANK -->
  <div class="card">
    <div class="sec-title">Rekening Bank Tujuan Transfer</div>
    <div class="fg">
      <div class="field">
        <label>Pilih Rekening yang Ditampilkan di Invoice</label>
        <select id="invBankSel"></select>
        <div class="hint">Rekening dikelola di menu <strong style="color:var(--gold-deep)">Pengaturan → Rekening Bank</strong></div>
      </div>
    </div>
  </div>

  <!-- ITEM PENJUALAN -->
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px 14px">
      <div style="font-size:10.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--gold-deep)">Item Penjualan</div>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;cursor:pointer;color:var(--ink2)">
        <input type="checkbox" id="usePhoto" onchange="inv_togglePhotoCol()" style="width:16px;height:16px;accent-color:var(--gold);cursor:pointer">
        Tampilkan foto pada item
      </label>
    </div>
    <div class="items-wrap">
      <table class="items" id="itemsTable">
        <thead>
          <tr id="itemsThead">
            <th style="width:36px">No</th>
            <th class="col-photo" style="display:none;width:110px">Foto</th>
            <th>Nama Item</th>
            <th>Deskripsi</th>
            <th style="width:80px">Unit</th>
            <th style="width:70px">Qty</th>
            <th style="width:130px">Harga Satuan</th>
            <th style="width:130px;text-align:right">Jumlah</th>
            <th style="width:36px"></th>
          </tr>
        </thead>
        <tbody id="itemsBody"></tbody>
      </table>
    </div>
    <button class="add-item-btn" onclick="inv_addItemRow()">+ Tambah Item</button>
  </div>

  <!-- PAJAK & TOTAL -->
  <div class="card">
    <div class="sec-title">Pajak &amp; Total</div>
    <div class="toggle-row">
      <input type="checkbox" id="usePpn" checked onchange="inv_calcTotals()">
      <label for="usePpn">Gunakan PPN &amp; PPH (DPP Nilai Lain)</label>
    </div>

    <!-- Panel Pelunasan (DP sebelumnya) -->
    <div class="panel panel-pelunasan" id="pelunasanPanel" style="display:none">
      <div class="panel-title-pel">Pembayaran Sebelumnya (DP)</div>
      <div class="toggle-row" style="padding:0;margin-bottom:12px">
        <input type="checkbox" id="useSudah" onchange="inv_onSudahChange()">
        <label for="useSudah">Tampilkan "Sudah Dibayar" (DP yang telah diterima)</label>
      </div>
      <div id="sudahDetail" style="display:none">
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
          <div class="field" style="flex:1;min-width:160px">
            <label>Metode</label>
            <select id="sudahMethod" onchange="inv_onSudahMethodChange()">
              <option value="pct">Persentase (%) dari Grand Total</option>
              <option value="custom">Nominal Custom</option>
            </select>
          </div>
          <div class="field" style="flex:0 0 140px" id="sudahPctGroup">
            <label>% DP Dibayar</label>
            <div style="display:flex;align-items:center;gap:6px">
              <input type="number" id="sudahPctVal" value="30" min="0" max="100" oninput="inv_calcTotals()" style="width:100%">
              <span style="color:var(--ink2)">%</span>
            </div>
          </div>
          <div class="field" style="flex:1;min-width:160px;display:none" id="sudahCustomGroup">
            <label>Nominal Sudah Dibayar (Rp)</label>
            <input type="number" id="sudahCustomVal" value="0" min="0" oninput="inv_calcTotals()">
          </div>
        </div>
      </div>
    </div>

    <!-- Panel DP -->
    <div class="panel panel-dp" id="dpPanel">
      <div class="panel-title-dp">Pengaturan DP</div>
      <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
        <div class="field" style="flex:1;min-width:160px">
          <label>Metode DP</label>
          <select id="dpMethod" onchange="inv_onDpMethodChange()">
            <option value="pct">Persentase (%) dari Total</option>
            <option value="custom">Nominal Custom</option>
          </select>
        </div>
        <div class="field" style="flex:0 0 140px" id="dpPctGroup">
          <label>% DP</label>
          <div style="display:flex;align-items:center;gap:6px">
            <input type="number" id="dpPctVal" value="30" min="0" max="100" oninput="inv_calcTotals()" style="width:100%">
            <span style="color:var(--ink2)">%</span>
          </div>
        </div>
        <div class="field" style="flex:1;min-width:160px;display:none" id="dpCustomGroup">
          <label>Nominal DP (Rp)</label>
          <input type="number" id="dpCustomVal" value="0" min="0" oninput="inv_calcTotals()">
        </div>
      </div>
      <div class="dp-display">
        <div class="dp-box"><div class="lbl">Nilai DP</div><div class="val" id="dpAmtDisplay">Rp 0</div></div>
        <div class="dp-box green"><div class="lbl">Sisa Pelunasan</div><div class="val" id="dpSisaDisplay">Rp 0</div></div>
      </div>
    </div>

    <!-- Totals grid -->
    <div class="totals-grid">
      <div class="field"><label>Catatan / Notes</label><textarea id="invNotes" placeholder="Catatan tambahan..."></textarea></div>
      <div class="totals-box">
        <div class="total-row"><span class="lbl">Sub Total</span><span class="val mono" id="calcSubtotal">Rp 0</span></div>
        <div id="taxRows">
          <div class="total-row"><span class="lbl">DPP Nilai Lain</span><span class="val mono" id="calcDpp">Rp 0</span></div>
          <div class="total-row"><span class="lbl">PPN <input type="number" class="pct-input" id="ppnPct" value="12" min="0" max="100" oninput="inv_calcTotals()"> %</span><span class="val mono" id="calcPpn">Rp 0</span></div>
          <div class="total-row"><span class="lbl">PPH <input type="number" class="pct-input" id="pphPct" value="2" min="0" max="100" oninput="inv_calcTotals()"> %</span><span class="val mono" id="calcPph">Rp 0</span></div>
        </div>
        <div class="total-row grand"><span class="lbl">Grand Total</span><span class="val mono" id="calcGrand">Rp 0</span></div>
        <div id="dpTotalRows" style="display:none">
          <div class="total-row dp-row"><span class="lbl" id="dpLabelRow">DP</span><span class="val mono" id="calcDpVal">Rp 0</span></div>
          <div class="total-row sisa-row"><span class="lbl">Sisa Pelunasan</span><span class="val mono" id="calcSisaVal">Rp 0</span></div>
        </div>
        <div id="pelunasanTotalRows" style="display:none">
          <div class="total-row sudah-row"><span class="lbl">Sudah Dibayar</span><span class="val mono" id="calcSudahVal">Rp 0</span></div>
          <div class="total-row pelunasan-final"><span class="lbl">Sisa yang Harus Dibayar</span><span class="val mono" id="calcPelSisaVal">Rp 0</span></div>
        </div>
      </div>
    </div>

    <!-- STATUS PEMBAYARAN -->
  </div>

  <div class="card">
    <div class="sec-title">Status Pembayaran</div>
    <div style="padding:0 24px 20px;max-width:320px">
      <div class="field">
        <label>Status Pembayaran</label>
        <select id="invStatusBayar">
          <option value="Belum Bayar">Belum Bayar</option>
          <option value="DP">DP (Sebagian)</option>
          <option value="Lunas">Lunas</option>
        </select>
      </div>
    </div>
  </div>

  <div class="card">
    <!-- Buttons -->
    <div class="btn-row">
      <button class="btn btn-gold" onclick="inv_saveInvoice()">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
        Simpan Invoice
      </button>
      <button class="btn btn-outline" onclick="inv_previewInvoice()">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
        Preview
      </button>
      <button class="btn btn-outline" onclick="Invoice.showList()">Batal</button>
    </div>
  </div>
</div>

`;
}


function _inv_ensureModal() {
  if (document.getElementById('previewModal')) return;
  const d = document.createElement('div');
  d.className = 'modal-bg hidden';
  d.id = 'previewModal';
  d.innerHTML = `
    <div class="modal modal-lg">
      <div class="modal-head">
        <h3 id="previewTitle">Preview Invoice</h3>
        <button class="modal-x" onclick="inv_closePreview()">×</button>
      </div>
      <div class="modal-body" style="max-height:70vh;overflow-y:auto">
        <div id="invoiceRender"></div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-gold" onclick="inv_printInvoice()">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
          Cetak / PDF
        </button>
        <button class="btn btn-outline" onclick="inv_closePreview()">Tutup</button>
      </div>
    </div>`;
  document.body.appendChild(d);
}

function inv_buildInvData(totals) {
  const { sub, dpp, ppn, pph, grand, ppnPct, pphPct, usePpn, dpAmt, sisaAmt, sudahAmt, pelSisa } = totals || inv_calcTotals();
  const termin = document.getElementById('invTermin').value;
  // nilaiTagihan = nilai yang BENAR-BENAR ditagih di invoice ini (bukan grand total proyek)
  // DP/DP1-4 -> nilai DP-nya saja. PELUNASAN -> sisa pelunasan (pelSisa) atau grand jika tanpa DP sebelumnya
  let nilaiTagihan = grand;
  if (termin !== 'PELUNASAN') {
    nilaiTagihan = dpAmt;
  } else {
    const useSudah = document.getElementById('useSudah')?.checked;
    nilaiTagihan = useSudah ? pelSisa : grand;
  }
  return {
    id: _inv_editingId || ('inv_' + Date.now()),
    nomorDok: document.getElementById('invNo').value,
    tanggal: document.getElementById('invDate').value,
    noPo: document.getElementById('invPo').value,
    termin,
    namaKlien: document.getElementById('invClientName').value,
    clientCp: document.getElementById('invClientCp').value,
    clientTel: document.getElementById('invClientTel').value,
    alamatKlien: document.getElementById('invClientAddr').value,
    catatan: document.getElementById('invNotes').value,
    items: inv_getItems(),
    usePhoto: document.getElementById('usePhoto').checked,
    usePpn, ppnPct, pphPct,
    sub, dpp, ppn, pph, grandTotal: grand, nilaiTagihan,
    dpMethod: document.getElementById('dpMethod').value,
    dpPctVal: parseFloat(document.getElementById('dpPctVal').value)||0,
    dpAmt, sisaAmt,
    useSudah: document.getElementById('useSudah')?.checked||false,
    sudahMethod: document.getElementById('sudahMethod')?.value||'pct',
    sudahPctVal: parseFloat(document.getElementById('sudahPctVal')?.value)||0,
    sudahAmt, pelSisa,
    selectedBankIdx: parseInt(document.getElementById('invBankSel')?.value)||0,
    bankSnapshot: (mbsSettings.banks||[])[parseInt(document.getElementById('invBankSel')?.value)||0] || null,
    ttdSlot: 0, ttdApproverSlot: 2,
    ttdMakerSnapshot: (mbsSettings.ttdList||[])[0] || null,
    ttdApproverSnapshot: (mbsSettings.ttdList||[])[2] || (mbsSettings.ttdList||[])[1] || (mbsSettings.ttdList||[])[0] || null,
    statusBayar: document.getElementById('invStatusBayar')?.value || 'Belum Bayar',
    jumlahDibayar: 0,
    totalPpn: ppn,
  };
}

// ── Preview & Print ──
function inv_previewInvoice() {
  _inv_ensureModal();
  // Safety: jika modal lama korup/tidak lengkap, hapus dan buat ulang
  if (!document.getElementById('invoiceRender')) {
    const old = document.getElementById('previewModal');
    if (old) old.remove();
    _inv_ensureModal();
  }
  const totals = inv_calcTotals();
  _inv_previewData = inv_buildInvData(totals);
  document.getElementById('previewTitle').textContent = 'Preview Invoice ' + _inv_previewData.nomorDok;
  document.getElementById('invoiceRender').innerHTML = inv_renderInvoiceHTML(_inv_previewData);
  document.getElementById('previewModal').classList.remove('hidden');
  document.getElementById('previewModal').classList.add('show');
}

function inv_closePreview() { document.getElementById('previewModal').classList.remove('show'); }

function inv_printInvoice() {
  if (!_inv_previewData) return;
  const html = inv_buildPrintPage(_inv_previewData);
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(f);
  f.onload = () => waitFontsAndImagesThenPrint(f);
  f.srcdoc = html;
}

// ── Render HTML ──
function inv_renderInvoiceHTML(inv) {
  const s=mbsSettings;
  const logoHTML = s.logo ? `<img style="width:42px;height:42px;object-fit:contain" src="${s.logo}">` : `<div style="width:42px;height:42px;background:#FFC000;border-radius:7px;display:flex;align-items:center;justify-content:center;color:#111;font-weight:800;font-size:12px">${(s.namaPerusahaan||'MBS').slice(0,3)}</div>`;
  const npwpParts = [];
  if (s.npwp) npwpParts.push(`NPWP. ${s.npwp}`);
  if (s.isPkp && s.npwp) npwpParts.push(`PKP. ${s.npwp}`);
  if (s.email) npwpParts.push(s.email);
  if (s.telepon) npwpParts.push(s.telepon);

  const usePhoto = inv.usePhoto;
  const imgCol = usePhoto ? `<th style="width:90px;padding:8px 10px;font-size:10.5px;font-weight:700;text-align:left;text-transform:uppercase;letter-spacing:.04em">Foto</th>` : '';

  const itemsHTML = (inv.items||[]).map((item, i) => {
    const imgSrc = item.image || (inv.itemImages && inv.itemImages[i]) || '';
    const imgTd = usePhoto ? `<td style="padding:9px 10px;border-bottom:1px solid #f0f0f0">${imgSrc ? `<img src="${imgSrc}" style="width:70px;height:60px;object-fit:contain;border-radius:4px">` : ''}</td>` : '';
    return `<tr>
      <td style="text-align:center;padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:10px">${i+1}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:10px">${esc(item.name||'')}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:10px;color:#555">${esc(item.desc||'')}</td>
      ${imgTd}
      <td style="text-align:center;padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:10px">${esc(item.unit||'')}</td>
      <td style="text-align:right;padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:10px">${item.qty||0}</td>
      <td style="text-align:right;padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:10px;white-space:nowrap;min-width:90px">${fmtRpInv(item.price||0)}</td>
      <td style="text-align:right;font-weight:600;padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:10px;white-space:nowrap;min-width:100px">${fmtRpInv((item.qty||0)*(item.price||0))}</td>
    </tr>`;
  }).join('');

  const bankIdx = inv.selectedBankIdx||0;
  const bank = inv.bankSnapshot || (s.banks||[])[bankIdx]; // snapshot dulu, fallback utk data lama
  const banksHTML = bank ? `<div style="font-weight:700;margin-bottom:3px">${esc(bank.bank)}</div><div style="margin-bottom:2px">${esc(bank.norek)}</div><div>${esc(bank.atas)}</div>` : '<div style="color:#aaa;font-style:italic">Belum ada rekening</div>';

  const terbilangAmt = inv.termin!=='PELUNASAN'&&inv.dpAmt ? inv.dpAmt : (inv.termin==='PELUNASAN'&&inv.useSudah&&inv.sudahAmt) ? inv.pelSisa : inv.grandTotal;
  const terbilangText = inv_terbilang(Math.round(terbilangAmt||0)) + ' Rupiah';
  const fullDate = fmtFullDate(inv.tanggal);

  const ttdList = s.ttdList||[];
  const ttdMaker = inv.ttdMakerSnapshot || ttdList[0]||{}; // snapshot dulu, fallback utk data lama
  const ttdApprover = inv.ttdApproverSnapshot || ttdList[2]||ttdList[1]||ttdList[0]||{};

  const colSpan = usePhoto ? 7 : 6;

  return `
<div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;color:#111;padding:4px">
  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px">
    <div>
      <div style="display:flex;align-items:center;gap:12px">
        ${logoHTML}
        <div>
          <div style="font-size:14px;font-weight:800;color:#111;letter-spacing:-.01em">${esc(s.namaPerusahaan)}</div>
          <div style="font-size:10px;color:#555;margin-top:2px;line-height:1.6">${esc(s.alamat||'').replace(/\n/g,'<br>')}</div>
        </div>
      </div>
      ${npwpParts.length ? `<div style="background:#f3f4f6;padding:5px 10px;font-size:9.5px;color:#555;margin-top:6px;border-radius:4px">${npwpParts.join(' | ')}</div>` : ''}
    </div>
    <div style="text-align:right">
      <div style="background:#FFC000;color:#111;font-size:18px;font-weight:800;padding:5px 14px;border-radius:7px;letter-spacing:.04em;display:inline-block">INVOICE</div>
      <div style="text-align:right;margin-top:10px;font-size:11px">
        <table style="margin-left:auto;border-collapse:collapse;white-space:nowrap">
          <tr><td style="padding:2px 6px;color:#777">NO.Invoice</td><td style="padding:2px 6px;color:#777">:</td><td style="padding:2px 6px;font-weight:600;color:#111">${esc(inv.nomorDok||'')}</td></tr>
          <tr><td style="padding:2px 6px;color:#777">Hari/Tanggal</td><td style="padding:2px 6px;color:#777">:</td><td style="padding:2px 6px;font-weight:600;color:#111">${fullDate}</td></tr>
          <tr><td style="padding:2px 6px;color:#777">No.PO</td><td style="padding:2px 6px;color:#777">:</td><td style="padding:2px 6px;font-weight:600;color:#111">${esc(inv.noPo||'-')}</td></tr>
        </table>
      </div>
    </div>
  </div>
  <hr style="border:none;border-top:2px solid #FFC000;margin:0 0 14px">

  <!-- Recipient -->
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:8px 12px;margin-bottom:10px;font-size:10.5px">
    <div style="font-size:9px;color:#888;margin-bottom:3px">Dikirim Kepada :</div>
    <div style="font-size:12px;font-weight:700;color:#111">${esc(inv.namaKlien||'')}</div>
    <div style="margin-top:4px;font-size:10.5px;color:#444">${esc(inv.alamatKlien||'').replace(/\n/g,'<br>')}</div>
    ${inv.clientCp ? `<div style="margin-top:4px;font-size:10.5px;color:#666">u.p ${esc(inv.clientCp)}</div>` : ''}
  </div>

  <!-- Items table -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:0">
    <thead>
      <tr style="background:#FFC000;color:#111">
        <th style="width:28px;padding:5px 8px;font-size:9.5px;font-weight:700;text-align:left;text-transform:uppercase;letter-spacing:.04em">NO</th>
        <th style="padding:5px 8px;font-size:9.5px;font-weight:700;text-align:left;text-transform:uppercase;letter-spacing:.04em">ITEM</th>
        <th style="width:30px;padding:5px 8px;font-size:9.5px;font-weight:700;text-align:left;text-transform:uppercase;letter-spacing:.04em">DESC</th>
        ${imgCol}
        <th style="width:48px;padding:5px 8px;font-size:9.5px;font-weight:700;text-align:center;text-transform:uppercase;letter-spacing:.04em">UNIT</th>
        <th style="width:40px;padding:5px 8px;font-size:9.5px;font-weight:700;text-align:right;text-transform:uppercase;letter-spacing:.04em">QTY</th>
        <th style="width:100px;padding:5px 8px;font-size:9.5px;font-weight:700;text-align:right;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap">UNIT PRICE</th>
        <th style="width:105px;padding:5px 8px;font-size:9.5px;font-weight:700;text-align:right;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap">AMOUNT</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHTML}
      <tr>
        <td colspan="${colSpan}" style="text-align:right;font-weight:700;font-size:10.5px;background:#f9fafb;padding:5px 8px">TOTAL</td>
        <td style="text-align:right;font-weight:700;font-size:10.5px;background:#f9fafb;padding:5px 8px;white-space:nowrap">${fmtRpInv(inv.sub||0)}</td>
      </tr>
    </tbody>
  </table>

  <!-- Totals -->
  <div style="display:flex;justify-content:flex-end;margin-top:0">
    <div style="min-width:220px;max-width:260px">
      ${inv.usePpn ? `
      <div style="display:flex;justify-content:space-between;padding:4px 8px;font-size:10px;background:#f9fafb;border-bottom:1px solid #eee"><span>DPP Nilai Lain</span><span style="white-space:nowrap;font-family:monospace">${fmtRpInv(inv.dpp||0)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:4px 8px;font-size:10px;background:#f9fafb;border-bottom:1px solid #eee"><span>PPN</span><span style="white-space:nowrap;font-family:monospace">${fmtRpInv(inv.ppn||0)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:4px 8px;font-size:10px;background:#f9fafb;border-bottom:1px solid #eee"><span>PPH</span><span style="white-space:nowrap;font-family:monospace">${fmtRpInv(inv.pph||0)}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;padding:6px 8px;font-size:11px;font-weight:800;background:#FFC000;color:#111"><span>GRAND TOTAL</span><span style="white-space:nowrap;font-family:monospace">${fmtRpInv(inv.grandTotal||0)}</span></div>
      ${inv.termin!=='PELUNASAN'&&inv.dpAmt ? `<div style="display:flex;justify-content:space-between;padding:4px 8px;font-size:10px;background:#fffbf0;color:#7a5a00;font-weight:600;border-bottom:1px solid #eee"><span>${esc(inv.termin||'DP')}</span><span style="white-space:nowrap;font-family:monospace">${fmtRpInv(inv.dpAmt||0)}</span></div>` : ''}
      ${inv.termin==='PELUNASAN'&&inv.useSudah&&inv.sudahAmt ? `
      <div style="display:flex;justify-content:space-between;padding:5px 10px;font-size:11px;background:#f0faf5;color:#2d7a5a;font-weight:600;border-bottom:1px solid #eee"><span>Sudah Dibayar (DP)</span><span style="text-decoration:line-through;opacity:.7">${fmtRpInv(inv.sudahAmt||0)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:8px 10px;font-size:13px;font-weight:800;background:#1a6a3a;color:#fff"><span>PELUNASAN</span><span>${fmtRpInv(inv.pelSisa||0)}</span></div>` : ''}
    </div>
  </div>

  <!-- Terbilang -->
  <div style="margin-top:6px;background:#fffbf0;border:1px solid #f0e0b0;border-radius:5px;padding:5px 10px;font-size:9.5px;color:#7a5a00">
    Terbilang : <span style="font-style:italic;font-weight:600">${terbilangText}</span>
  </div>

  <!-- Bank + Notes -->
  <div style="display:flex;gap:10px;margin-top:6px">
    <div style="background:#f0f4f8;border:1px solid #dce3ec;border-radius:6px;padding:7px 10px;font-size:9.5px;flex:1">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#FFC000;margin-bottom:4px">Bank Account</div>
      ${banksHTML}
    </div>
    ${inv.catatan ? `<div style="border:1px dashed #ccc;border-radius:5px;padding:6px 8px;font-size:9.5px;color:#555;flex:1"><strong>Notes :</strong><br><em>${esc(inv.catatan)}</em></div>` : ''}
  </div>

  <!-- Signatures + footer — forced to stay on same page -->
  <div style="page-break-inside:avoid;break-inside:avoid">
  <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:12px">
    <div style="text-align:center;font-size:9.5px">
      <div style="font-size:9px;color:#888;margin-bottom:3px">Dibuat Oleh,</div>
      ${ttdMaker.img ? `<img src="${ttdMaker.img}" style="height:55px;max-width:120px;object-fit:contain;display:block;margin:0 auto">` : '<div style="height:55px"></div>'}
      <div style="font-weight:700;font-size:10px;border-top:1px solid #aaa;padding-top:3px;display:inline-block;min-width:100px">${esc(ttdMaker.nama||s.namaPerusahaan)}</div>
      <div style="color:#777;font-size:9px">${esc(ttdMaker.jabatan||'Admin')}</div>
    </div>
    <div style="text-align:center;font-size:9.5px;opacity:0"></div>
    <div style="text-align:center;font-size:9.5px">
      <div style="font-size:9px;color:#888;margin-bottom:3px">${esc(s.namaPerusahaan)}</div>
      ${ttdApprover.img ? `<img src="${ttdApprover.img}" style="height:55px;max-width:120px;object-fit:contain;display:block;margin:0 auto">` : '<div style="height:55px"></div>'}
      <div style="font-weight:700;font-size:10px;border-top:1px solid #aaa;padding-top:3px;display:inline-block;min-width:100px">${esc(ttdApprover.nama||'')}</div>
      <div style="color:#777;font-size:9px">${esc(ttdApprover.jabatan||'')}</div>
    </div>
  </div>

  <div style="text-align:center;margin-top:10px;padding-top:8px;border-top:2px solid #FFC000;font-style:italic;font-size:9.5px;color:#888">
    Terima kasih atas kepercayaan dan kerja sama Anda
  </div>
  </div>
</div>`;
}

function inv_buildPrintPage(inv) {
  const innerHTML = inv_renderInvoiceHTML(inv);
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Invoice ${esc(inv.nomorDok||'')}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#111;font-size:12px;line-height:1.5;background:#fff}
@page{size:A4;margin:7mm 9mm}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body><div style="padding:24px 28px">${innerHTML}</div></body></html>`;
}

// ── Helpers ──


function inv_terbilang(n) {
  n = Math.floor(Math.abs(n)); if (n===0) return 'Nol';
  const sat=['','Satu','Dua','Tiga','Empat','Lima','Enam','Tujuh','Delapan','Sembilan'];
  const bel=['Sepuluh','Sebelas','Dua Belas','Tiga Belas','Empat Belas','Lima Belas','Enam Belas','Tujuh Belas','Delapan Belas','Sembilan Belas'];
  const pul=['','','Dua Puluh','Tiga Puluh','Empat Puluh','Lima Puluh','Enam Puluh','Tujuh Puluh','Delapan Puluh','Sembilan Puluh'];
  function h(n){if(n===0)return'';if(n<10)return sat[n];if(n<20)return bel[n-10];if(n<100)return pul[Math.floor(n/10)]+(n%10?' '+sat[n%10]:'');if(n<200)return'Seratus'+(n%100?' '+h(n%100):'');if(n<1000)return sat[Math.floor(n/100)]+' Ratus'+(n%100?' '+h(n%100):'');if(n<2000)return'Seribu'+(n%1000?' '+h(n%1000):'');if(n<1e6)return h(Math.floor(n/1000))+' Ribu'+(n%1000?' '+h(n%1000):'');if(n<1e9)return h(Math.floor(n/1e6))+' Juta'+(n%1e6?' '+h(n%1e6):'');if(n<1e12)return h(Math.floor(n/1e9))+' Miliar'+(n%1e9?' '+h(n%1e9):'');return h(Math.floor(n/1e12))+' Triliun'+(n%1e12?' '+h(n%1e12):'');}
  return h(n);
}


// ── Preview & Print ──



// ── Render HTML ──


// ── Helpers ──

function inv_regenNo() {
  const date = document.getElementById('invDate').value;
  const d = date ? new Date(date + 'T00:00:00') : new Date();
  const bulan = d.getMonth() + 1;
  const mo = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][d.getMonth()];
  const yr = d.getFullYear();
  const termin = document.getElementById('invTermin')?.value || 'DP';
  const terminMap = { DP:'INV/DP', DP1:'INV/DP1', DP2:'INV/DP2', DP3:'INV/DP3', DP4:'INV/DP4', PELUNASAN:'INV/PLN', FULL:'INV' };
  const type = terminMap[termin] || 'INV';
  const existing = Invoice?.rows || [];
  const thisMonth = existing.filter(r => {
    if (r.tanggal) {
      const rd = new Date(r.tanggal + 'T00:00:00');
      return rd.getMonth() + 1 === bulan && rd.getFullYear() === yr;
    }
    // fallback: cek prefix nomor dokumen
    const no = r.nomorDok || '';
    return no.startsWith(String(bulan)) && no.includes('/'+mo+'/'+yr);
  }).length;
  const n = String(thisMonth + 1).padStart(2, '0');
  document.getElementById('invNo').value = `${bulan}${n}-${type}/MBS/${mo}/${yr}`;
}

function inv_buildBankSelect() {
  const sel = document.getElementById('invBankSel');
  const banks = mbsSettings.banks || [];
  if (!banks.length) { sel.innerHTML = '<option>— Belum ada rekening, tambahkan di Pengaturan —</option>'; return; }
  sel.innerHTML = banks.map((b, i) => `<option value="${i}">${b.bank} — ${b.norek}</option>`).join('');
}

function inv_buildTtdSelect() {
  const slots = mbsSettings.ttdList || [];
  if (!slots.length) { sel.innerHTML = '<option value="0">— Belum ada TTD —</option>'; return; }
}

function inv_buildClientDatalist() {
  const dl = document.getElementById('clientDL');
  const clients = JSON.parse(localStorage.getItem('mbs_clients') || '[]');
  dl.innerHTML = clients.map(c => `<option value="${c.kode || c.code || ''}">${c.kode||c.code||''} — ${c.nama||c.name||''}</option>`).join('');
}

function inv_tryAutofill() {
  const code = document.getElementById('invClientCode').value.trim().toUpperCase();
  const clients = JSON.parse(localStorage.getItem('mbs_clients') || '[]');
  const c = clients.find(x => (x.kode||x.code||'').toUpperCase() === code);
  if (c) inv_applyClient(c);
}
function inv_applyClient(c) {
  document.getElementById('invClientName').value = c.nama || c.name || '';
  document.getElementById('invClientAddr').value = c.alamat || c.address || '';
  document.getElementById('invClientCp').value = c.contact || c.naraHubung || '';
  document.getElementById('invClientTel').value = c.telepon || c.phone || '';
  const badge = document.getElementById('autofillBadge');
  badge.style.display = 'flex';
  document.getElementById('autofillName').textContent = c.nama || c.name || '';
}
function inv_doAutofill() {
  const code = document.getElementById('invClientCode').value.trim().toUpperCase();
  const clients = JSON.parse(localStorage.getItem('mbs_clients') || '[]');
  const c = clients.find(x => (x.kode||x.code||'').toUpperCase() === code);
  if (!c) { alert('Kode klien tidak ditemukan'); return; }
  inv_applyClient(c);
}

// ── Photo toggle ──
function inv_togglePhotoCol() {
  const show = document.getElementById('usePhoto').checked;
  document.querySelectorAll('.col-photo').forEach(el => el.style.display = show ? 'table-cell' : 'none');
}

// ── Item rows ──
function inv_addItemRow(data = null) {
  const tbody = document.getElementById('itemsBody');
  const idx = _inv_itemIndex++;
  const usePhoto = document.getElementById('usePhoto').checked;
  const imgData = data?.image || '';
  if (imgData) _inv_itemRowImages[idx] = imgData;
  const no = tbody.rows.length + 1;

  const tr = document.createElement('tr');
  tr.id = `item-row-${idx}`;
  tr.innerHTML = `
    <td class="no">${no}</td>
    <td class="col-photo" style="display:${usePhoto?'table-cell':'none'}">
      <div class="item-img-cell">
        <img id="img-prev-${idx}" class="item-img-thumb" src="${imgData}" style="display:${imgData?'block':'none'}">
        <input type="file" id="img-file-${idx}" accept="image/*" style="display:none" onchange="inv_handleImg(${idx},this)">
        <button class="item-img-btn" onclick="document.getElementById('img-file-${idx}').click()">📷 Pilih</button>
        <button class="item-img-btn" id="img-clr-${idx}" onclick="inv_clearImg(${idx})" style="${imgData?'':'display:none'}">✕</button>
      </div>
    </td>
    <td><input type="text" placeholder="Nama item" value="${esc(data?.name||'')}" oninput="inv_calcTotals()"></td>
    <td><input type="text" placeholder="Deskripsi item..." value="${esc(data?.desc||'')}"></td>
    <td><input type="text" placeholder="Pcs" value="${esc(data?.unit||'')}" style="width:100%"></td>
    <td><input type="number" placeholder="0" value="${data?.qty||''}" min="0" oninput="inv_calcTotals()" style="width:100%"></td>
    <td><input type="number" placeholder="0" value="${data?.price||''}" min="0" oninput="inv_calcTotals()" style="width:100%"></td>
    <td class="amt" id="item-amt-${idx}">${data?.qty&&data?.price?fmtRp(data.qty*data.price):'Rp 0'}</td>
    <td><button class="remove-row" onclick="inv_removeRow(this,${idx})">×</button></td>
  `;
  tbody.appendChild(tr);
  inv_calcTotals();
  inv_renumber();
}

async function inv_handleImg(idx, input) {
  const file = input.files[0]; if (!file) return;
  const btn = document.querySelector(`#item-row-${idx} .item-img-btn`);
  const img = document.getElementById(`img-prev-${idx}`);
  const clr = document.getElementById(`img-clr-${idx}`);
  // Tampilkan preview lokal dulu (UX cepat)
  const localUrl = URL.createObjectURL(file);
  if (img) { img.src = localUrl; img.style.display = 'block'; }
  if (btn) btn.textContent = '⏳ Upload...';
  // Upload ke Supabase Storage jika tersedia, fallback ke base64
  if (sb.ready()) {
    try {
      const url = await sb.uploadImage(file, 'mbs-images', 'invoice-items');
      _inv_itemRowImages[idx] = url;
      if (img) img.src = url;
      if (btn) btn.textContent = '📷 Pilih';
      if (clr) clr.style.display = '';
    } catch(e) {
      toast('Upload gagal, simpan lokal: ' + e.message, 'err');
      // Fallback ke base64
      const b64 = await compressImage(file, 900, 0.82);
      _inv_itemRowImages[idx] = b64;
      if (btn) btn.textContent = '📷 Pilih';
      if (clr) clr.style.display = '';
    }
  } else {
    // Offline / belum konfigurasi Supabase → base64
    const b64 = await compressImage(file, 900, 0.82);
    _inv_itemRowImages[idx] = b64;
    if (img) img.src = b64;
    if (btn) btn.textContent = '📷 Pilih';
    if (clr) clr.style.display = '';
  }
}
async function inv_clearImg(idx) {
  const oldUrl = _inv_itemRowImages[idx];
  // Hapus dari Storage jika URL (bukan base64)
  if (oldUrl && oldUrl.startsWith('http') && sb.ready()) {
    sb.deleteImage(oldUrl).catch(() => {});
  }
  delete _inv_itemRowImages[idx];
  const img = document.getElementById(`img-prev-${idx}`);
  const clr = document.getElementById(`img-clr-${idx}`);
  if (img) { img.src = ''; img.style.display = 'none'; }
  if (clr) clr.style.display = 'none';
}
function inv_removeRow(btn, idx) { btn.closest('tr').remove(); delete _inv_itemRowImages[idx]; inv_renumber(); inv_calcTotals(); }
function inv_renumber() { document.querySelectorAll('#itemsBody tr').forEach((r,i) => { if (r.cells[0]) r.cells[0].textContent = i+1; }); }

function inv_getItems() {
  return Array.from(document.querySelectorAll('#itemsBody tr')).map(r => {
    const inputs = r.querySelectorAll('input[type=text],input[type=number]');
    const idx = r.id.replace('item-row-','');
    return { name: inputs[0]?.value||'', desc: inputs[1]?.value||'', unit: inputs[2]?.value||'', qty: parseFloat(inputs[3]?.value)||0, price: parseFloat(inputs[4]?.value)||0, image: _inv_itemRowImages[idx]||'' };
  });
}

// ── Calculations ──

function inv_calcTotals() {
  let sub = 0;
  document.querySelectorAll('#itemsBody tr').forEach(r => {
    const inputs = r.querySelectorAll('input[type=number]');
    if (inputs.length >= 2) {
      const qty = parseFloat(inputs[inputs.length-2].value)||0;
      const price = parseFloat(inputs[inputs.length-1].value)||0;
      const amt = qty * price; sub += amt;
      const idx = r.id.replace('item-row-','');
      const amtEl = document.getElementById(`item-amt-${idx}`);
      if (amtEl) amtEl.textContent = fmtRp(amt);
    }
  });

  const usePpn = document.getElementById('usePpn')?.checked;
  const ppnPct = parseFloat(document.getElementById('ppnPct').value)||0;
  const pphPct = parseFloat(document.getElementById('pphPct').value)||0;
  let dpp=0, ppn=0, pph=0, grand=sub;
  if (usePpn) { dpp=sub*(11/12); ppn=dpp*(ppnPct/100); pph=sub*(pphPct/100); grand=sub+ppn-pph; }

  inv_set('calcSubtotal', fmtRp(sub));
  inv_set('calcDpp', fmtRp(dpp));
  inv_set('calcPpn', fmtRp(ppn));
  inv_set('calcPph', fmtRp(pph));
  inv_set('calcGrand', fmtRp(grand));
  document.getElementById('taxRows').style.display = usePpn ? '' : 'none';

  const termin = document.getElementById('invTermin')?.value||'DP';
  const isDp = termin !== 'PELUNASAN';
  const isPel = termin === 'PELUNASAN';
  document.getElementById('dpPanel').style.display = isDp ? '' : 'none';
  document.getElementById('dpTotalRows').style.display = isDp ? '' : 'none';
  document.getElementById('pelunasanPanel').style.display = isPel ? '' : 'none';

  let dpAmt=0, sisaAmt=0;
  if (isDp) {
    const meth = document.getElementById('dpMethod').value;
    dpAmt = meth==='pct' ? grand*(parseFloat(document.getElementById('dpPctVal').value)||0)/100 : parseFloat(document.getElementById('dpCustomVal').value)||0;
    sisaAmt = grand - dpAmt;
    const label = document.getElementById('dpLabelRow');
    if (label) label.textContent = termin;
    inv_set('dpAmtDisplay', fmtRp(dpAmt));
    inv_set('dpSisaDisplay', fmtRp(sisaAmt));
    inv_set('calcDpVal', fmtRp(dpAmt));
    inv_set('calcSisaVal', fmtRp(sisaAmt));
  }

  let sudahAmt=0, pelSisa=grand;
  if (isPel) {
    const useSudah = document.getElementById('useSudah')?.checked;
    document.getElementById('pelunasanTotalRows').style.display = useSudah ? '' : 'none';
    if (useSudah) {
      const meth = document.getElementById('sudahMethod').value;
      sudahAmt = meth==='pct' ? grand*(parseFloat(document.getElementById('sudahPctVal').value)||0)/100 : parseFloat(document.getElementById('sudahCustomVal').value)||0;
      pelSisa = grand - sudahAmt;
      inv_set('calcSudahVal', fmtRp(sudahAmt));
      inv_set('calcPelSisaVal', fmtRp(pelSisa));
    }
  } else { document.getElementById('pelunasanTotalRows').style.display = 'none'; }

  return { sub, dpp, ppn, pph, grand, ppnPct, pphPct, usePpn, dpAmt, sisaAmt, sudahAmt, pelSisa };
}

function inv_onTerminChange() { inv_regenNo(); inv_calcTotals(); }
function inv_onDpMethodChange() {
  const meth = document.getElementById('dpMethod').value;
  document.getElementById('dpPctGroup').style.display = meth==='pct' ? '' : 'none';
  document.getElementById('dpCustomGroup').style.display = meth==='custom' ? '' : 'none';
  inv_calcTotals();
}
function inv_onSudahChange() { document.getElementById('sudahDetail').style.display = document.getElementById('useSudah').checked ? '' : 'none'; inv_calcTotals(); }
function inv_onSudahMethodChange() {
  const meth = document.getElementById('sudahMethod').value;
  document.getElementById('sudahPctGroup').style.display = meth==='pct' ? '' : 'none';
  document.getElementById('sudahCustomGroup').style.display = meth==='custom' ? '' : 'none';
  inv_calcTotals();
}

function inv_set(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

// ── Save ──
function inv_saveInvoice() {
  const clientName = document.getElementById('invClientName').value.trim();
  if (!clientName) { toast('Nama klien wajib diisi!', 'err'); return; }
  const totals = inv_calcTotals();
  const inv = inv_buildInvData(totals);
  pageModules['invoice'].afterSave(inv);
}
