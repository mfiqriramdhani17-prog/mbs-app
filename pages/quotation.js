/* ══════════════════════════════════════════════
   QUOTATION MODULE — list + form + Supabase sync
   ══════════════════════════════════════════════ */

registerPage('quotation', {
  rows: [], clients: [], vendors: [],

  async init(el) {
    this.rows = cache.get('quotationss') || cache.get('quotations');
    this.clients = cache.get('clients');
    this.vendors = cache.get('vendors');
    el.innerHTML = this._listHTML();
    this._render();
    await this._load();
  },

  _listHTML() {
    return `
    <div id="quoListView">
      <div class="card reveal">
        <div class="toolbar">
          <div class="toolbar-title">Quotation</div>
          <div class="search-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4" stroke-linecap="round"/></svg>
            <input id="quoSearch" placeholder="Cari nomor / klien…" oninput="pageModules.quotation._render()">
          </div>
          <button class="btn btn-gold" onclick="pageModules.quotation.newDoc()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>
            Buat Quotation
          </button>
        </div>
        <div class="tbl-wrap">
          <table><thead><tr><th>No. Dokumen</th><th>Tanggal</th><th>Klien</th><th>Perihal</th><th class="r">Total</th><th class="r">Aksi</th></tr></thead>
          <tbody id="quoBody"></tbody></table>
        </div>
      </div>
    </div>
    <div id="quoFormView" style="display:none"></div>`;
  },

  async _load() {
    if (!sb.ready()) { this._render(); return; }
    try {
      const [docs, cl, vn] = await Promise.allSettled([
        sb.select('mbs_quotations'),
        sb.select('mbs_clients'),
        sb.select('mbs_vendors')
      ]);
      if (docs.status === 'fulfilled') {
        this.rows = docs.value.map(r => ({ __id: r.id, ...(r.data || {}) })).filter(r => r.nomorDok);
        cache.set('quotations', this.rows);

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
    document.getElementById('quoListView').style.display = '';
    document.getElementById('quoFormView').style.display = 'none';
  },

  showForm() {
    document.getElementById('quoListView').style.display = 'none';
    document.getElementById('quoFormView').style.display = '';
    window.scrollTo(0, 0);
  },

  newDoc() {
    _quo_editingId = null;
    this._renderForm(null);
  },
  _renderForm(r) {
    _quo_editingId = r ? r.__id : null;
    const fv = document.getElementById('quoFormView');
    fv.innerHTML = _formHTML_quotation();
    if (r) {
      // Fill form with existing data
      const setVal = (id, v) => { const el = document.getElementById(id); if(el && v != null) el.value = v; };
      setVal('quoNo', r.nomorDok); setVal('quoDate', r.tanggal);
      setVal('quoLampiran', r.lampiran); setVal('quoPerihal', r.perihal);
      setVal('quoClientName', r.namaKlien); setVal('quoCp', r.clientCp);
      setVal('quoNotes', r.catatan);
      if (r.usePpn) document.getElementById('quoPpn') && (document.getElementById('quoPpn').checked = true);
      if (r.usePph) document.getElementById('quoPph') && (document.getElementById('quoPph').checked = true);
      _quo_itemIdx = 0;
      const tb = document.getElementById('itemsBody');
      if (tb) { tb.innerHTML=''; (r.items||[]).forEach(it => quo_addItemRow(it)); }
    }
    if(!r) quo_regenNo(); quo_buildClientDL(); if(!r) quo_addItemRow();
    quo_calcTotals();
    this.showForm();
  },

  edit(id) {
    const r = this.rows.find(x => x.__id === id);
    if (!r) return;
    _quo_editingId = id;
    this._renderForm(r);
  },

  previewRow(id) {
    const r = this.rows.find(x => x.__id === id);
    if (!r) return;
    _quo_ensureModal();
    if (!document.getElementById('quoRender')) {
      const old = document.getElementById('previewModal');
      if (old) old.remove();
      _quo_ensureModal();
    }
    _quo_previewData = r;
    document.getElementById('previewTitle').textContent = 'Preview Quotation ' + (r.nomorDok || '');
    document.getElementById('quoRender').innerHTML = quo_renderHTML(r);
    document.getElementById('previewModal').classList.remove('hidden');
    document.getElementById('previewModal').classList.add('show');
  },

  async del(id) {
    const r = this.rows.find(x => x.__id === id);
    if (!r || !confirm('Hapus ' + (r.nomorDok || 'dokumen') + '?')) return;
    this.rows = this.rows.filter(x => x.__id !== id);
    cache.set('quotations', this.rows);

    this._render();
    try { if (sb.ready()) await sb.remove('mbs_quotations', id); }
    catch(e) {}
    toast('Dihapus', 'ok');
  },

  _render() {
    const tb = document.getElementById('quoBody'); if (!tb) return;
    const q = (document.getElementById('quoSearch')?.value || '').toLowerCase();
      const list = this.rows.filter(r => !q || (r.nomorDok+' '+r.namaKlien).toLowerCase().includes(q));
      if (!list.length) { tb.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="t">Belum ada quotation</div></div></td></tr>`; return; }
      tb.innerHTML = list.map(r => `<tr>
        <td class="td-mono text-gold">${esc(r.nomorDok||'-')}</td>
        <td>${fmtDate(r.tanggal)}</td>
        <td class="td-bold">${esc(r.namaKlien||'-')}</td>
        <td style="color:var(--ink2)">${esc(r.perihal||'-')}</td>
        <td class="td-r">${rp(r.grandTotal||0)}</td>
        <td><div class="row-act">
          <button class="ibtn ibtn-view" onclick="pageModules.quotation.previewRow('${r.__id}')" title="Preview PDF"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-linejoin="round"/><circle cx="12" cy="12" r="3"/></svg></button>
          <button class="ibtn ibtn-edit" onclick="pageModules.quotation.edit('${r.__id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h4L18 10l-4-4L4 16z" stroke-linejoin="round"/></svg></button>
          <button class="ibtn ibtn-del" onclick="pageModules.quotation.del('${r.__id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13" stroke-linecap="round"/></svg></button>
        </div></td>
      </tr>`).join('');
  },

  async afterSave(doc) {
    const newId = doc.id || doc.nomorDok;
    if (_quo_editingId) {
      const idx = this.rows.findIndex(x => x.__id === _quo_editingId);
      if (idx >= 0) this.rows[idx] = { __id: _quo_editingId, ...doc };
    } else {
      this.rows.unshift({ __id: newId, ...doc });
    }
    cache.set('quotations', this.rows);

    try {
      if (sb.ready()) await sb.upsert('mbs_quotations', { id: _quo_editingId || newId, data: doc });
      toast('Tersimpan', 'ok');
    } catch(e) {
      toast('Tersimpan lokal (Supabase: ' + e.message + ')', 'err');
    }
    this.showList();
    this._render();
  },
});

/* ── Quotation state ── */

let _quo_itemIdx = 0;
let _quo_imgMap = {};
let _quo_editingId = null;
let _quo_previewData = null;

function _formHTML_quotation() {
  return `  <!-- INFORMASI QUOTATION -->
  <div class="card">
    <div class="sec-title">Informasi Quotation</div>
    <div class="fg c4">
      <div class="field"><label>No. Quotation</label><input type="text" id="quoNo" readonly placeholder="Auto-generate..."></div>
      <div class="field"><label>Hari / Tanggal</label><input type="date" id="quoDate" oninput="quo_regenNo()"></div>
      <div class="field"><label>Lampiran</label><input type="text" id="quoLampiran" placeholder="2" value="2"></div>
      <div class="field"><label>Perihal</label><input type="text" id="quoPerihal" placeholder="Penawaran Harga" value="Penawaran Harga"></div>
    </div>
  </div>

  <!-- DATA KLIEN -->
  <div class="card">
    <div class="sec-title">Data Klien / Penerima</div>
    <div style="padding:0 20px;margin-bottom:14px">
      <div class="field" style="max-width:320px">
        <label>Kode Klien (Autofill)</label>
        <div class="lookup-wrap">
          <input type="text" id="quoClientCode" list="clientDL" placeholder="Ketik atau pilih kode klien..."
            oninput="this.value=this.value.toUpperCase();quo_tryAutofill()">
          <button class="lookup-btn" onclick="quo_doAutofill()">Isi Data</button>
        </div>
        <datalist id="clientDL"></datalist>
      </div>
      <div class="autofill-badge" id="autofillBadge">
        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
        <span id="autofillName"></span>
      </div>
    </div>
    <div class="fg c2">
      <div class="field"><label>Nama Perusahaan / Klien <span class="req">*</span></label><input type="text" id="quoClientName" placeholder="PT Karya Pejuang Senyum"></div>
      <div class="field"><label>u.p / Narahubung Klien</label><input type="text" id="quoClientCp" placeholder="Ibu Gracia"></div>
    </div>
  </div>

  <!-- ITEM PENAWARAN -->
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px 14px">
      <div style="font-size:10.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--gold-deep)">Item Penawaran</div>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;cursor:pointer;color:var(--ink2)">
        <input type="checkbox" id="usePhoto" onchange="quo_togglePhotoCol()" style="width:16px;height:16px;accent-color:var(--gold);cursor:pointer">
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
    <button class="add-item-btn" onclick="quo_addItemRow()">+ Tambah Item</button>
  </div>

  <!-- PAJAK & TOTAL -->
  <div class="card">
    <div class="sec-title">Pajak &amp; Total Penawaran</div>
    <div style="display:flex;gap:20px;flex-wrap:wrap;padding:0 20px;margin-bottom:16px">
      <label class="toggle-row">
        <input type="checkbox" id="usePpn" onchange="quo_onPpnChange()">
        <span>Tambahkan PPN</span>
      </label>
      <label class="toggle-row">
        <input type="checkbox" id="usePph" onchange="quo_onPphChange()">
        <span>Tambahkan PPH</span>
      </label>
    </div>
    <!-- PPN % row -->
    <div class="ppn-pct-row" id="ppnPctRow">
      <div class="field" style="max-width:220px">
        <label>% PPN</label>
        <div style="display:flex;align-items:center;gap:8px">
          <input type="number" class="pct-input" id="ppnPct" value="11" min="0" max="100" oninput="quo_calcTotals()">
          <span style="color:var(--ink2);font-size:14px;font-weight:600">%</span>
        </div>
      </div>
    </div>
    <!-- PPH % row -->
    <div class="pph-pct-row" id="pphPctRow">
      <div class="field" style="max-width:220px">
        <label>% PPH</label>
        <div style="display:flex;align-items:center;gap:8px">
          <input type="number" class="pct-input" id="pphPct" value="2" min="0" max="100" oninput="quo_calcTotals()">
          <span style="color:var(--ink2);font-size:14px;font-weight:600">%</span>
        </div>
      </div>
    </div>
    <!-- Totals -->
    <div class="totals-grid">
      <div class="field"><label>Catatan / Notes</label><textarea id="quoNotes" placeholder="Catatan tambahan untuk quotation ini..."></textarea></div>
      <div class="totals-box">
        <div class="total-row"><span class="lbl">Total</span><span class="val" id="calcSubtotal">Rp 0</span></div>
        <div id="taxRows" style="display:none">
          <div class="total-row" id="ppnDisplayRow" style="display:none"><span class="lbl" id="ppnLabel">PPN (12%)</span><span class="val" id="calcPpn">Rp 0</span></div>
          <div class="total-row" id="pphDisplayRow" style="display:none"><span class="lbl" id="pphLabel">PPH (2%)</span><span class="val" id="calcPph">Rp 0</span></div>
        </div>
        <div class="total-row grand"><span class="lbl">Grand Total</span><span class="val" id="calcGrand">Rp 0</span></div>
      </div>
    </div>

    <!-- Buttons -->
    <div class="btn-row">
      <button class="btn btn-gold" onclick="quo_saveQuotation()">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
        Simpan Quotation
      </button>
      <button class="btn btn-outline" onclick="quo_doPreview()">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
        Preview
      </button>
      <button class="btn btn-outline" onclick="pageModules.quotation.showList()">Batal</button>
    </div>
  </div>
</div>

`;
}


function _quo_ensureModal() {
  if (document.getElementById('previewModal')) return;
  const d = document.createElement('div');
  d.className = 'modal-bg hidden';
  d.id = 'previewModal';
  d.innerHTML = `
    <div class="modal modal-lg">
      <div class="modal-head">
        <h3 id="previewTitle">Preview Quotation</h3>
        <button class="modal-x" onclick="quo_closePreview()">×</button>
      </div>
      <div class="modal-body" style="max-height:70vh;overflow-y:auto">
        <div id="quoRender"></div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-gold" onclick="quo_doPrint()">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
          Cetak / PDF
        </button>
        <button class="btn btn-outline" onclick="quo_closePreview()">Tutup</button>
      </div>
    </div>`;
  document.body.appendChild(d);
}

// ── No generator ──
function quo_regenNo(){
  const d=document.getElementById('quoDate').value;
  const dt=d?new Date(d+'T00:00:00'):new Date();
  const bulan=dt.getMonth()+1;
  const mo=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][dt.getMonth()];
  const yr=dt.getFullYear();
  const existing = pageModules['quotation']?.rows || [];
  const thisMonth = existing.filter(r => {
    if (r.tanggal) {
      const rd = new Date(r.tanggal+'T00:00:00');
      return rd.getMonth()+1===bulan && rd.getFullYear()===yr;
    }
    const no = r.nomorDok || '';
    return no.startsWith(String(bulan)) && no.includes('/'+mo+'/'+yr);
  }).length;
  const n=String(thisMonth+1).padStart(2,'0');
  document.getElementById('quoNo').value=`${bulan}${n}-QUO/MBS/${mo}/${yr}`;
}



function quo_buildClientDL(){
  const dl=document.getElementById('clientDL');
  const clients=JSON.parse(localStorage.getItem('mbs_clients')||'[]');
  dl.innerHTML=clients.map(c=>`<option value="${c.kode||c.code||''}">${c.kode||c.code||''} — ${c.nama||c.name||''}</option>`).join('');
}

function quo_tryAutofill(){
  const code=document.getElementById('quoClientCode').value.trim().toUpperCase();
  const clients=JSON.parse(localStorage.getItem('mbs_clients')||'[]');
  const c=clients.find(x=>(x.kode||x.code||'').toUpperCase()===code);
  if(c) quo_applyClient(c);
}
function quo_applyClient(c){
  document.getElementById('quoClientName').value=c.nama||c.name||'';
  document.getElementById('quoClientCp').value=c.contact||c.naraHubung||'';
  const badge=document.getElementById('autofillBadge');
  badge.style.display='flex';
  document.getElementById('autofillName').textContent=c.nama||c.name||'';
}
function quo_doAutofill(){
  const code=document.getElementById('quoClientCode').value.trim().toUpperCase();
  const clients=JSON.parse(localStorage.getItem('mbs_clients')||'[]');
  const c=clients.find(x=>(x.kode||x.code||'').toUpperCase()===code);
  if(!c){alert('Kode klien tidak ditemukan');return;}
  quo_applyClient(c);
}

// ── Photo toggle ──
function quo_togglePhotoCol(){
  const show=document.getElementById('usePhoto').checked;
  document.querySelectorAll('.col-photo').forEach(el=>el.style.display=show?'table-cell':'none');
}

// ── Items ──
function quo_addItemRow(data=null){
  const tbody=document.getElementById('itemsBody');
  const i=_quo_itemIdx++;
  const show=document.getElementById('usePhoto').checked;
  const imgD=data?.image||'';
  if(imgD) _quo_imgMap[i]=imgD;
  const no=tbody.rows.length+1;
  const tr=document.createElement('tr');
  tr.id=`item-row-${i}`;
  tr.innerHTML=`
    <td class="no">${no}</td>
    <td class="col-photo" style="display:${show?'table-cell':'none'}">
      <div class="item-img-cell">
        <img id="img-p-${i}" class="item-img-thumb" src="${imgD}" style="display:${imgD?'block':'none'}">
        <input type="file" id="img-f-${i}" accept="image/*" style="display:none" onchange="quo_handleImg(${i},this)">
        <button class="item-img-btn" onclick="document.getElementById('img-f-${i}').click()">📷 Pilih</button>
        <button class="item-img-btn" id="img-c-${i}" onclick="quo_clearImg(${i})" style="${imgD?'':'display:none'}">✕</button>
      </div>
    </td>
    <td><input type="text" placeholder="Nama item" value="${esc(data?.name||'')}" oninput="quo_calcTotals()"></td>
    <td><input type="text" placeholder="Deskripsi item..." value="${esc(data?.desc||'')}"></td>
    <td><input type="text" placeholder="Pcs" value="${esc(data?.unit||'')}" style="width:100%"></td>
    <td><input type="number" placeholder="0" value="${data?.qty||''}" min="0" oninput="quo_calcTotals()" style="width:100%"></td>
    <td><input type="number" placeholder="0" value="${data?.price||''}" min="0" oninput="quo_calcTotals()" style="width:100%"></td>
    <td class="amt" id="item-amt-${i}">${data?.qty&&data?.price?fmtRp(data.qty*data.price):'Rp 0'}</td>
    <td><button class="remove-row" onclick="quo_removeRow(this,${i})">×</button></td>
  `;
  tbody.appendChild(tr); quo_calcTotals(); quo_renumber();
}
async function quo_handleImg(i, input) {
  const f = input.files[0]; if (!f) return;
  const btn = document.querySelector(`#item-row-${i} .item-img-btn`);
  const im = document.getElementById('img-p-'+i);
  const cl = document.getElementById('img-c-'+i);
  const localUrl = URL.createObjectURL(f);
  if (im) { im.src = localUrl; im.style.display = 'block'; }
  if (btn) btn.textContent = '⏳ Upload...';
  if (sb.ready()) {
    try {
      const url = await sb.uploadImage(f, 'mbs-images', 'quotation-items');
      _quo_imgMap[i] = url;
      if (im) im.src = url;
      if (btn) btn.textContent = '📷 Pilih';
      if (cl) cl.style.display = '';
    } catch(e) {
      toast('Upload gagal, simpan lokal: ' + e.message, 'err');
      const b64 = await compressImage(f, 900, 0.82);
      _quo_imgMap[i] = b64;
      if (btn) btn.textContent = '📷 Pilih';
      if (cl) cl.style.display = '';
    }
  } else {
    const b64 = await compressImage(f, 900, 0.82);
    _quo_imgMap[i] = b64;
    if (im) im.src = b64;
    if (btn) btn.textContent = '📷 Pilih';
    if (cl) cl.style.display = '';
  }
}
async function quo_clearImg(i) {
  const oldUrl = _quo_imgMap[i];
  if (oldUrl && oldUrl.startsWith('http') && sb.ready()) {
    sb.deleteImage(oldUrl).catch(() => {});
  }
  delete _quo_imgMap[i];
  const im = document.getElementById('img-p-'+i);
  const cl = document.getElementById('img-c-'+i);
  if (im) { im.src = ''; im.style.display = 'none'; }
  if (cl) cl.style.display = 'none';
}
function quo_removeRow(btn,i){btn.closest('tr').remove();delete _quo_imgMap[i];quo_renumber();quo_calcTotals();}
function quo_renumber(){document.querySelectorAll('#itemsBody tr').forEach((r,i)=>{if(r.cells[0])r.cells[0].textContent=i+1;});}
function quo_getItems(){
  return Array.from(document.querySelectorAll('#itemsBody tr')).map(r=>{
    const ins=r.querySelectorAll('input[type=text],input[type=number]');
    const i=r.id.replace('item-row-','');
    return{name:ins[0]?.value||'',desc:ins[1]?.value||'',unit:ins[2]?.value||'',qty:parseFloat(ins[3]?.value)||0,price:parseFloat(ins[4]?.value)||0,image:_quo_imgMap[i]||''};
  });
}

// ── PPN / PPH toggles ──
function quo_onPpnChange(){
  const on=document.getElementById('usePpn').checked;
  document.getElementById('ppnPctRow').style.display=on?'block':'none';
  document.getElementById('ppnDisplayRow').style.display=on?'flex':'none';
  quo_updateTaxDisplay(); quo_calcTotals();
}
function quo_onPphChange(){
  const on=document.getElementById('usePph').checked;
  document.getElementById('pphPctRow').style.display=on?'block':'none';
  document.getElementById('pphDisplayRow').style.display=on?'flex':'none';
  quo_updateTaxDisplay(); quo_calcTotals();
}
function quo_updateTaxDisplay(){
  const usePpn=document.getElementById('usePpn').checked;
  const usePph=document.getElementById('usePph').checked;
  document.getElementById('taxRows').style.display=(usePpn||usePph)?'':'none';
}


function quo_calcTotals(){
  let sub=0;
  document.querySelectorAll('#itemsBody tr').forEach(r=>{
    const ins=r.querySelectorAll('input[type=number]');
    if(ins.length>=2){
      const qty=parseFloat(ins[ins.length-2].value)||0;
      const price=parseFloat(ins[ins.length-1].value)||0;
      const amt=qty*price; sub+=amt;
      const i=r.id.replace('item-row-','');
      const el=document.getElementById('item-amt-'+i);
      if(el)el.textContent=fmtRp(amt);
    }
  });
  const usePpn=document.getElementById('usePpn').checked;
  const usePph=document.getElementById('usePph').checked;
  const ppnPct=parseFloat(document.getElementById('ppnPct').value)||0;
  const pphPct=parseFloat(document.getElementById('pphPct').value)||0;
  const ppn=usePpn?sub*ppnPct/100:0;
  const pph=usePph?sub*pphPct/100:0;
  const grand=sub+ppn-pph;
  quo_set('calcSubtotal',fmtRp(sub));
  quo_set('calcPpn',fmtRp(ppn));
  quo_set('calcPph',fmtRp(pph));
  quo_set('calcGrand',fmtRp(grand));
  if(document.getElementById('ppnLabel')) document.getElementById('ppnLabel').textContent=`PPN (${ppnPct}%)`;
  if(document.getElementById('pphLabel')) document.getElementById('pphLabel').textContent=`PPH (${pphPct}%)`;
  return{sub,ppn,pph,grand,ppnPct,pphPct,usePpn,usePph};
}
function quo_set(id,val){const el=document.getElementById(id);if(el)el.textContent=val;}

// ── Save ──
function quo_saveQuotation(){
  const required = document.getElementById('quoClientName').value.trim();
  if(!required){ toast('Nama klien wajib diisi!','err'); return; }
  const totals = quo_calcTotals();
  const quo = quo_buildData(totals);
  pageModules['quotation'].afterSave(quo);
}
function quo_buildData(t){
  return{
    id:_quo_editingId||('quo_'+Date.now()),
    nomorDok:document.getElementById('quoNo').value,
    tanggal:document.getElementById('quoDate').value,
    lampiran:document.getElementById('quoLampiran').value,
    perihal:document.getElementById('quoPerihal').value,
    namaKlien:document.getElementById('quoClientName').value,
    clientCp:document.getElementById('quoClientCp').value,
    catatan:document.getElementById('quoNotes').value,
    usePhoto:document.getElementById('usePhoto').checked,
    ...t, grandTotal:t.grand,
    items:quo_getItems(),
    ttdSlot:1,
    ttdSnapshot: (mbsSettings.ttdList||[])[1] || (mbsSettings.ttdList||[])[0] || null,
  };
}

// ── Preview & Print ──
function quo_doPreview(){
  _quo_ensureModal();
  if (!document.getElementById('quoRender')) {
    const old = document.getElementById('previewModal');
    if (old) old.remove();
    _quo_ensureModal();
  }
  const t=quo_calcTotals();
  _quo_previewData=quo_buildData(t);
  document.getElementById('previewTitle').textContent='Preview Quotation '+_quo_previewData.nomorDok;
  document.getElementById('quoRender').innerHTML=quo_renderHTML(_quo_previewData);
  document.getElementById('previewModal').classList.remove('hidden');
  document.getElementById('previewModal').classList.add('show');
}
function quo_closePreview(){document.getElementById('previewModal').classList.remove('show');}
function quo_doPrint(){
  if(!_quo_previewData)return;
  const html=quo_buildPrintPage(_quo_previewData);
  const f=document.createElement('iframe');
  f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(f);
  f.onload=()=>waitFontsAndImagesThenPrint(f);
  f.srcdoc=html;
}

// ── Render ──
function quo_renderHTML(quo){
  const s=mbsSettings;
  const logoHTML=s.logo?`<img style="width:70px;height:70px;object-fit:contain;flex-shrink:0" src="${s.logo}">`:`<div style="width:42px;height:42px;background:#FFC000;border-radius:7px;display:flex;align-items:center;justify-content:center;color:#111;font-weight:800;font-size:13px;flex-shrink:0">${(s.namaPerusahaan||'MBS').slice(0,3)}</div>`;
  const logoHTML2=s.logo?`<img src="${s.logo}" style="width:70px;height:70px;object-fit:contain;display:block;margin:0 auto 4px">`:`<div style="width:46px;height:46px;background:#FFC000;border-radius:7px;display:flex;align-items:center;justify-content:center;color:#111;font-weight:800;font-size:13px;margin:0 auto 4px">${(s.namaPerusahaan||'MBS').slice(0,3)}</div>`;
  const contactLine=[s.telepon,s.email].filter(Boolean).join(' | ');
  const cityDate='Bandung, '+new Date((quo.tanggal||new Date().toISOString().slice(0,10))+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
  const ttdList=s.ttdList||[];
  const ttd=quo.ttdSnapshot||ttdList[1]||ttdList[0]||{}; // Manajer Marketing
  const usePhoto=quo.usePhoto;
  const imgCol=usePhoto?`<th style="width:80px;border:1px solid #e6a800;background:#FFC000;color:#111;padding:5px 8px;font-size:9.5px;font-weight:700;text-transform:uppercase">Foto</th>`:'';
  const colSpan=usePhoto?7:6;

  const itemsHTML=(quo.items||[]).map((it,i)=>{
    const imgSrc=it.image||'';
    const imgTd=usePhoto?`<td style="border:1px solid #ddd;padding:5px 8px">${imgSrc?`<img src="${imgSrc}" style="width:70px;height:60px;object-fit:contain;border-radius:4px">`:''}</td>`:'';
    return `<tr>
      <td style="border:1px solid #ddd;text-align:center;padding:5px 8px;font-size:10px">${i+1}</td>
      <td style="border:1px solid #ddd;padding:5px 8px;font-size:10px">${esc(it.name||'')}</td>
      <td style="border:1px solid #ddd;padding:5px 8px;font-size:10px;color:#555">${esc(it.desc||'')}</td>
      ${imgTd}
      <td style="border:1px solid #ddd;text-align:center;padding:5px 8px;font-size:10px">${esc(it.unit||'')}</td>
      <td style="border:1px solid #ddd;text-align:right;padding:5px 8px;font-size:10px">${it.qty||0}</td>
      <td style="border:1px solid #ddd;text-align:right;padding:5px 8px;font-size:10px;white-space:nowrap;min-width:88px">${fmtRpInv(it.price||0)}</td>
      <td style="border:1px solid #ddd;text-align:right;font-weight:600;padding:5px 8px;font-size:10px;white-space:nowrap;min-width:95px">${fmtRpInv((it.qty||0)*(it.price||0))}</td>
    </tr>`;
  }).join('');

  const page1=`<div style="padding:22px 28px;font-family:'Plus Jakarta Sans',sans-serif;font-size:10.5px;color:#111">
  <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:8px">
    ${logoHTML}
    <div>
      <div style="font-size:20px;font-weight:800;color:#111">${esc(s.namaPerusahaan)}</div>
      <div style="font-size:12px;color:#555;line-height:1.65;margin-top:3px">${esc(s.alamat||'').split('\n').join('<br>')}${contactLine?'<br>'+contactLine:''}</div>
    </div>
  </div>
  <div style="border:none;border-top:2px solid #111;margin:7px 0 12px"></div>
  <div style="text-align:right;font-size:12px;margin-bottom:10px">${cityDate}</div>
  <table style="font-size:14px;border-collapse:collapse;margin-bottom:14px">
    <tr><td style="padding:2px 6px 2px 0;color:#555;white-space:nowrap">Nomor</td><td style="padding:2px 8px;color:#555">:</td><td style="padding:2px 0;font-weight:600;color:#111"><strong>${esc(quo.nomorDok||'')}</strong></td></tr>
    <tr><td style="padding:2px 6px 2px 0;color:#555">Lampiran</td><td style="padding:2px 8px;color:#555">:</td><td style="padding:2px 0;font-weight:600;color:#111">${esc(quo.lampiran||'-')}</td></tr>
    <tr><td style="padding:2px 6px 2px 0;color:#555">Perihal</td><td style="padding:2px 8px;color:#555">:</td><td style="padding:2px 0;font-weight:600;color:#111">${esc(quo.perihal||'Penawaran Harga')}</td></tr>
  </table>
  <div style="text-align:justify;font-size:14px;color:#333;line-height:1.7">
    <p>Kepada Yth,</p>
    <p><strong>${quo.clientCp?esc(quo.clientCp):'Bapak/Ibu'}</strong></p>
    <p><strong>${esc(quo.namaKlien||'')}</strong></p>
    <p>Di Tempat,</p><br>
    <p>Dengan Hormat,</p><br>
    <p>Bersama surat ini, kami atas nama <strong>${esc(s.namaPerusahaan)}</strong> bermaksud memberikan penawaran item terlampir. Adapun penawaran ini berlaku selama 7 hari.</p><br>
    <p>Demikian surat penawaran harga ini kami sampaikan. Atas kerja sama dan kepercayaannya kami ucapkan terima kasih.</p>
  </div>
  <div style="page-break-inside:avoid;break-inside:avoid;margin-top:20px;font-size:14px">
    <p>Hormat Kami,</p>
    <p>${esc(s.namaPerusahaan)},</p>
    ${ttd.img?`<img src="${ttd.img}" style="height:60px;max-width:130px;object-fit:contain;display:block;margin:3px 0">`:'<div style="height:60px"></div>'}
    <p><strong><u>${esc(ttd.nama||'')}</u></strong></p>
    <p style="font-size:10.5px;color:#555">${esc(ttd.jabatan||'')}</p>
  </div>
</div>`;

  const page2=`<div style="padding:18px 24px;font-family:'Plus Jakarta Sans',sans-serif;font-size:10.5px;color:#111;page-break-before:always;break-before:page">
  <div style="text-align:center;margin-bottom:16px">
    ${logoHTML2}
    <div style="font-size:20px;font-weight:800;text-align:center;text-transform:uppercase">${esc(s.namaPerusahaan)}</div>
    <div style="border:none;border-top:2px solid #111;margin:5px 0"></div>
  </div>
  <div style="font-size:14px;font-weight:500;color:#333;margin-bottom:8px">Daftar Penawaran Harga :</div>
  <table style="width:100%;border-collapse:collapse">
    <thead><tr style="background:#FFC000">
      <th style="width:28px;border:1px solid #e6a800;padding:5px 8px;font-size:9.5px;font-weight:700;text-align:left;text-transform:uppercase;color:#111">NO</th>
      <th style="border:1px solid #e6a800;padding:5px 8px;font-size:9.5px;font-weight:700;text-align:left;text-transform:uppercase;color:#111">ITEM</th>
      <th style="width:140px;border:1px solid #e6a800;padding:5px 8px;font-size:9.5px;font-weight:700;text-align:left;text-transform:uppercase;color:#111">DESC</th>
      ${imgCol}
      <th style="width:48px;border:1px solid #e6a800;padding:5px 8px;font-size:9.5px;font-weight:700;text-align:center;text-transform:uppercase;color:#111">UNIT</th>
      <th style="width:40px;border:1px solid #e6a800;padding:5px 8px;font-size:9.5px;font-weight:700;text-align:right;text-transform:uppercase;color:#111">QTY</th>
      <th style="width:95px;border:1px solid #e6a800;padding:5px 8px;font-size:9.5px;font-weight:700;text-align:right;text-transform:uppercase;color:#111;white-space:nowrap">ITEM PRICE</th>
      <th style="width:100px;border:1px solid #e6a800;padding:5px 8px;font-size:9.5px;font-weight:700;text-align:right;text-transform:uppercase;color:#111;white-space:nowrap">AMOUNT</th>
    </tr></thead>
    <tbody>
      ${itemsHTML}
      <tr style="background:#FFC000"><td colspan="${colSpan}" style="text-align:center;font-weight:700;border:1px solid #e6a800;padding:5px 8px;font-size:10px;color:#111">TOTAL</td><td style="text-align:right;font-weight:700;border:1px solid #e6a800;padding:5px 8px;font-size:10px;color:#111;white-space:nowrap;font-family:monospace">${fmtRpInv(quo.sub||0)}</td></tr>
      ${quo.usePpn?`<tr style="background:#FFC000"><td colspan="${colSpan}" style="text-align:center;font-weight:700;border:1px solid #e6a800;padding:5px 8px;font-size:10px;color:#111">PPN</td><td style="text-align:right;font-weight:700;border:1px solid #e6a800;padding:5px 8px;font-size:10px;color:#000;white-space:nowrap;font-family:monospace">${fmtRpInv(quo.ppn||0)}</td></tr>`:''}
      ${quo.usePph?`<tr style="background:#FFC000"><td colspan="${colSpan}" style="text-align:center;font-weight:700;border:1px solid #e6a800;padding:5px 8px;font-size:10px;color:#111">PPH (${quo.pphPct||0}%)</td><td style="text-align:right;font-weight:700;border:1px solid #e6a800;padding:5px 8px;font-size:10px;color:#000;white-space:nowrap;font-family:monospace">${fmtRpInv(quo.pph||0)}</td></tr>`:''}
      <tr style="background:#FFC000"><td colspan="${colSpan}" style="text-align:center;font-weight:800;font-size:11px;border:1px solid #e6a800;padding:5px 8px;color:#111">GRAND TOTAL</td><td style="text-align:right;font-weight:800;font-size:11px;border:1px solid #e6a800;padding:5px 8px;color:#111;white-space:nowrap;font-family:monospace">${fmtRpInv(quo.grand||quo.grandTotal||0)}</td></tr>
    </tbody>
  </table>
  <div style="border:1px solid #ddd;border-radius:4px;padding:7px 10px;min-height:50px;margin-top:10px">
    <div style="font-size:9.5px;color:#555;margin-bottom:4px">Catatan :</div>
    <div style="font-size:10px;color:#333">${(quo.catatan||'').split('\n').join('<br>')}</div>
  </div>
  <div style="page-break-inside:avoid;break-inside:avoid;margin-top:12px;display:flex;justify-content:flex-end;font-size:10px">
    <div style="text-align:center">
      <p style="margin-bottom:3px">Hormat Kami,</p>
      <p style="margin-bottom:3px">${esc(s.namaPerusahaan)},</p>
      ${ttd.img?`<img src="${ttd.img}" style="height:60px;max-width:130px;object-fit:contain;display:block;margin:3px auto">`:'<div style="height:60px"></div>'}
      <p><strong><u>${esc(ttd.nama||'')}</u></strong></p>
      <p style="font-size:9px;color:#555">${esc(ttd.jabatan||'')}</p>
    </div>
  </div>
</div>`;

  return page1+page2;
}

function quo_buildPrintPage(quo){
  const inner=quo_renderHTML(quo);
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Quotation ${esc(quo.nomorDok||'')}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#111;background:#fff;font-size:10.5px;line-height:1.4}
@page{size:A4;margin:7mm 9mm}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>
</head><body>${inner}</body></html>`;
}
