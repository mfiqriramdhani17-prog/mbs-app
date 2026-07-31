/* ══════════════════════════════════════════════
   PURCHASE ORDER MODULE — list + form + Supabase sync
   ══════════════════════════════════════════════ */

registerPage('po', {
  rows: [], clients: [], vendors: [],

  async init(el) {
    this.rows = cache.get('purchaseorderss') || cache.get('pos');
    this.clients = cache.get('clients');
    this.vendors = cache.get('vendors');
    el.innerHTML = this._listHTML();
    this._render();
    await this._load();
  },

  _listHTML() {
    return `
    <div id="poListView">
      <div class="card reveal">
        <div class="toolbar">
          <div class="toolbar-title">Purchase Order</div>
          <div class="search-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4" stroke-linecap="round"/></svg>
            <input id="poSearch" placeholder="Cari nomor / vendor…" oninput="pageModules.po._render()">
          </div>
          <button class="btn btn-gold" onclick="pageModules.po.newDoc()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>
            Buat Purchase Order
          </button>
        </div>
        <div class="tbl-wrap">
          <table><thead><tr><th>No. PO</th><th>Tanggal</th><th>Vendor</th><th>No. Quo</th><th class="r">Total</th><th class="r">Aksi</th></tr></thead>
          <tbody id="poBody"></tbody></table>
        </div>
      </div>
    </div>
    <div id="poFormView" style="display:none"></div>`;
  },

  async _load() {
    if (!sb.ready()) { this._render(); return; }
    try {
      const [docs, cl, vn] = await Promise.allSettled([
        sb.select('mbs_purchaseorders'),
        sb.select('mbs_clients'),
        sb.select('mbs_vendors')
      ]);
      if (docs.status === 'fulfilled') {
        this.rows = docs.value.map(r => ({ __id: r.id, ...(r.data || {}) })).filter(r => r.nomorDok);
        cache.set('purchaseorders', this.rows);

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
    document.getElementById('poListView').style.display = '';
    document.getElementById('poFormView').style.display = 'none';
  },

  showForm() {
    document.getElementById('poListView').style.display = 'none';
    document.getElementById('poFormView').style.display = '';
    window.scrollTo(0, 0);
  },

  newDoc() {
    _po_editingId = null;
    this._renderForm(null);
  },
  _renderForm(r) {
    _po_editingId = r ? r.__id : null;
    const fv = document.getElementById('poFormView');
    fv.innerHTML = _formHTML_po();
    if (r) {
      const setVal = (id, v) => { const el = document.getElementById(id); if(el && v != null) el.value = v; };
      setVal('poNo', r.nomorDok); setVal('poDate', r.tanggal);
      setVal('poQuoNo', r.quoNo); setVal('poVendorName', r.namaVendor);
      setVal('poVendorCp', r.vendorCp); setVal('poVendorTel', r.vendorTel);
      setVal('poVendorAddr', r.alamatVendor); setVal('poNotes', r.catatan);
      const useDpEl = document.getElementById('useDP');
      if (useDpEl) useDpEl.checked = r.useDP === true;
      setVal('dpMethod', r.dpMethod || 'pct');
      setVal('dpPctVal', r.dpPctVal ?? 30);
      setVal('dpCustomVal', r.dpCustomVal ?? 0);
      if (useDpEl) {
        document.getElementById('dpDetail').style.display = useDpEl.checked ? '' : 'none';
        document.getElementById('dpTotalRows').style.display = useDpEl.checked ? '' : 'none';
      }
      po_onDpMethodChange();
      _po_itemIdx = 0;
      const tb = document.getElementById('itemsBody');
      if (tb) { tb.innerHTML=''; (r.items||[]).forEach(it => po_addItemRow(it)); }
    }
    if(!r) po_regenNo(); po_buildVendorDL(); if(!r) po_addItemRow();
    po_calcTotals(); po_updateTtdInfo();
    this.showForm();
  },

  edit(id) {
    const r = this.rows.find(x => x.__id === id);
    if (!r) return;
    _po_editingId = id;
    this._renderForm(r);
  },

  previewRow(id) {
    const r = this.rows.find(x => x.__id === id);
    if (!r) return;
    _po_ensureModal();
    if (!document.getElementById('poRender')) {
      const old = document.getElementById('previewModal');
      if (old) old.remove();
      _po_ensureModal();
    }
    _po_previewData = r;
    document.getElementById('previewTitle').textContent = 'Preview PO ' + (r.nomorDok || '');
    document.getElementById('poRender').innerHTML = po_renderHTML(r);
    document.getElementById('previewModal').classList.remove('hidden');
    document.getElementById('previewModal').classList.add('show');
  },

  async del(id) {
    const r = this.rows.find(x => x.__id === id);
    if (!r || !confirm('Hapus ' + (r.nomorDok || 'dokumen') + '?')) return;
    this.rows = this.rows.filter(x => x.__id !== id);
    cache.set('purchaseorders', this.rows);

    this._render();
    try { if (sb.ready()) await sb.remove('mbs_purchaseorders', id); }
    catch(e) {}
    toast('Dihapus', 'ok');
  },

  _render() {
    const tb = document.getElementById('poBody'); if (!tb) return;
    const q = (document.getElementById('poSearch')?.value || '').toLowerCase();
      const list = this.rows.filter(r => !q || (r.nomorDok+' '+r.namaVendor).toLowerCase().includes(q));
      if (!list.length) { tb.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="t">Belum ada PO</div></div></td></tr>`; return; }
      tb.innerHTML = list.map(r => `<tr>
        <td class="td-mono text-gold">${esc(r.nomorDok||'-')}</td>
        <td>${fmtDate(r.tanggal)}</td>
        <td class="td-bold">${esc(r.namaVendor||'-')}</td>
        <td class="td-mono" style="font-size:12px">${esc(r.quoNo||'-')}</td>
        <td class="td-r">${rp(r.grandTotal||r.total||0)}</td>
        <td><div class="row-act">
          <button class="ibtn ibtn-view" onclick="pageModules.po.previewRow('${r.__id}')" title="Preview PDF"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-linejoin="round"/><circle cx="12" cy="12" r="3"/></svg></button>
          <button class="ibtn ibtn-edit" onclick="pageModules.po.edit('${r.__id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h4L18 10l-4-4L4 16z" stroke-linejoin="round"/></svg></button>
          <button class="ibtn ibtn-del" onclick="pageModules.po.del('${r.__id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13" stroke-linecap="round"/></svg></button>
        </div></td>
      </tr>`).join('');
  },

  async afterSave(doc) {
    const newId = doc.id || doc.nomorDok;
    if (_po_editingId) {
      const idx = this.rows.findIndex(x => x.__id === _po_editingId);
      if (idx >= 0) this.rows[idx] = { __id: _po_editingId, ...doc };
    } else {
      this.rows.unshift({ __id: newId, ...doc });
    }
    cache.set('purchaseorders', this.rows);

    try {
      if (sb.ready()) await sb.upsert('mbs_purchaseorders', { id: _po_editingId || newId, data: doc });
      toast('Tersimpan', 'ok');
    } catch(e) {
      toast('Tersimpan lokal (Supabase: ' + e.message + ')', 'err');
    }
    this.showList();
    this._render();
  },
});

/* ── Purchase Order state ── */

let _po_itemIdx = 0;
let _po_editingId = null;
let _po_previewData = null;

function _formHTML_po() {
  return `  <!-- INFORMASI PO -->
  <div class="card">
    <div class="sec-title">Informasi Purchase Order</div>
    <div class="fg c3">
      <div class="field"><label>No. PO</label><input type="text" id="poNo" readonly placeholder="Auto-generate..."></div>
      <div class="field"><label>Tanggal</label><input type="date" id="poDate" oninput="po_regenNo()"></div>
      <div class="field"><label>No. Quotation <span class="opt">(opsional)</span></label><input type="text" id="poQuoNo" placeholder="Nomor quotation referensi..."></div>
    </div>
    <!-- TTD info — baku, tidak bisa dipilih -->
    <div class="fg" style="padding-top:0">
      <div>
        <div style="font-size:11px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;color:var(--ink2);margin-bottom:8px">Tanda Tangan</div>
        <div class="ttd-info" id="ttdInfoDisplay">
          <div class="ttd-chip"><span class="dot"></span><span id="ttdMakerLabel">Manajer Marketing</span></div>
          <span class="ttd-sep">·</span>
          <div class="ttd-chip"><span class="dot" style="background:var(--green)"></span><span id="ttdApproverLabel">Direktur</span></div>
          <span style="margin-left:auto;font-size:11.5px;color:var(--ink2)">Otomatis dari <a href="#" style="color:var(--gold-deep);font-weight:700;text-decoration:none">Pengaturan</a></span>
        </div>
      </div>
    </div>
  </div>

  <!-- DATA VENDOR -->
  <div class="card">
    <div class="sec-title">Data Vendor / Supplier</div>
    <div class="fg c2">
      <div class="field"><label>Nama Vendor <span class="req">*</span></label><input type="text" id="poVendorName" list="vendorDL" placeholder="Ketik atau pilih vendor..." oninput="po_onVendorNameInput(this.value)"></div>
      <div class="field"><label>u.p / Narahubung <span class="opt">(opsional)</span></label><input type="text" id="poVendorCp" placeholder="Pak Agus..."></div>
      <div class="field"><label>No. Telepon <span class="opt">(opsional)</span></label><input type="text" id="poVendorTel" placeholder="+62..."></div>
    </div>
    <div class="fg" style="padding-top:0">
      <div class="field"><label>Alamat Vendor <span class="opt">(opsional)</span></label><textarea id="poVendorAddr" placeholder="Alamat vendor..."></textarea></div>
    </div>
    <datalist id="vendorDL"></datalist>
  </div>

  <!-- ITEM PO -->
  <div class="card">
    <div style="padding:16px 20px 14px;font-size:10.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--gold-deep)">Item Purchase Order</div>
    <div class="items-wrap">
      <table class="items" id="itemsTable">
        <thead>
          <tr>
            <th style="width:36px">No</th>
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
    <button class="add-item-btn" onclick="po_addItemRow()">+ Tambah Item</button>
  </div>

  <!-- TERM PEMBAYARAN & TOTAL -->
  <div class="card">
    <div class="sec-title">Term Pembayaran &amp; Total</div>

    <!-- Panel DP -->
    <div class="panel-dp">
      <div class="panel-title">Pengaturan DP</div>
      <label class="toggle-row">
        <input type="checkbox" id="useDP" onchange="po_onUseDpChange()">
        <span>Gunakan Down Payment (DP)</span>
      </label>
      <div id="dpDetail" style="display:none">
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
          <div class="field" style="flex:1;min-width:160px">
            <label>Metode DP</label>
            <select id="dpMethod" onchange="po_onDpMethodChange()">
              <option value="pct">Persentase (%) dari Total</option>
              <option value="custom">Nominal Custom</option>
            </select>
          </div>
          <div class="field" style="flex:0 0 140px" id="dpPctGroup">
            <label>% DP</label>
            <div style="display:flex;align-items:center;gap:6px">
              <input type="number" id="dpPctVal" value="30" min="0" max="100" oninput="po_calcTotals()" style="width:100%">
              <span style="color:var(--ink2)">%</span>
            </div>
          </div>
          <div class="field" style="flex:1;min-width:160px;display:none" id="dpCustomGroup">
            <label>Nominal DP (Rp)</label>
            <input type="number" id="dpCustomVal" value="0" min="0" oninput="po_calcTotals()">
          </div>
        </div>
        <div class="dp-display">
          <div class="dp-box"><div class="lbl">Nilai DP</div><div class="val" id="dpDisplay">Rp 0</div></div>
          <div class="dp-box green"><div class="lbl">Sisa Pelunasan</div><div class="val" id="sisaDisplay">Rp 0</div></div>
        </div>
      </div>
    </div>

    <!-- Totals -->
    <div class="totals-grid">
      <div class="field"><label>Catatan / Notes</label><textarea id="poNotes" placeholder="Catatan tambahan PO..."></textarea></div>
      <div class="totals-box">
        <div class="total-row grand"><span class="lbl">Total Amount</span><span class="val" id="calcTotal">Rp 0</span></div>
        <div id="dpTotalRows" style="display:none">
          <div class="total-row dp-row"><span class="lbl">DP</span><span class="val" id="calcDp">Rp 0</span></div>
          <div class="total-row sisa-row"><span class="lbl">Pelunasan</span><span class="val" id="calcPelunasan">Rp 0</span></div>
        </div>
      </div>
    </div>

    <!-- Buttons -->
    <div class="btn-row">
      <button class="btn btn-gold" onclick="po_savePO()">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
        Simpan Purchase Order
      </button>
      <button class="btn btn-outline" onclick="po_doPreview()">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
        Preview
      </button>
      <button class="btn btn-outline" onclick="pageModules.po.showList()">Batal</button>
    </div>
  </div>
</div>

`;
}


function _po_ensureModal() {
  if (document.getElementById('previewModal')) return;
  const d = document.createElement('div');
  d.className = 'modal-bg hidden';
  d.id = 'previewModal';
  d.innerHTML = `
    <div class="modal modal-lg">
      <div class="modal-head">
        <h3 id="previewTitle">Preview Purchase Order</h3>
        <button class="modal-x" onclick="po_closePreview()">×</button>
      </div>
      <div class="modal-body" style="max-height:70vh;overflow-y:auto">
        <div id="poRender"></div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-gold" onclick="po_doPrint()">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
          Cetak / PDF
        </button>
        <button class="btn btn-outline" onclick="po_closePreview()">Tutup</button>
      </div>
    </div>`;
  document.body.appendChild(d);
}

// ── Settings ──
try{const r=localStorage.getItem(MBS_SETTINGS_KEY);if(r)settings={...settings,...JSON.parse(r)};}catch(e){}


// ── No generator ──
function po_regenNo(){
  const d=document.getElementById('poDate').value;
  const dt=d?new Date(d+'T00:00:00'):new Date();
  const bulan=dt.getMonth()+1;
  const mo=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][dt.getMonth()];
  const yr=dt.getFullYear();
  const existing = pageModules['po']?.rows || [];
  const thisMonth = existing.filter(r => {
    if (!r.tanggal) return false;
    const rd = new Date(r.tanggal+'T00:00:00');
    return rd.getMonth()+1===bulan && rd.getFullYear()===yr;
  }).length;
  const n=String(thisMonth+1).padStart(2,'0');
  document.getElementById('poNo').value=`${bulan}${n}-PO/MBS/${mo}/${yr}`;
}

// ── TTD info display (baku: slot1=Manajer Marketing, slot2=Direktur) ──
function po_updateTtdInfo(){
  const slots=mbsSettings.ttdList||[];
  const maker=slots[1]||{};    // Manajer Marketing
  const approver=slots[2]||{}; // Direktur
  const ml=document.getElementById('ttdMakerLabel');
  const al=document.getElementById('ttdApproverLabel');
  if(ml) ml.textContent=(maker.nama&&maker.jabatan)?`${maker.nama} (${maker.jabatan})`:(maker.jabatan||'Manajer Marketing');
  if(al) al.textContent=(approver.nama&&approver.jabatan)?`${approver.nama} (${approver.jabatan})`:(approver.jabatan||'Direktur');
}

function po_buildVendorDL(){
  const dl=document.getElementById('vendorDL');
  const vendors=JSON.parse(localStorage.getItem('mbs_vendors')||'[]');
  dl.innerHTML=vendors.map(v=>`<option value="${v.nama||v.name||''}">${v.nama||v.name||''}</option>`).join('');
}

// Autofill data vendor lain saat nama vendor cocok dengan master vendor
function po_onVendorNameInput(val){
  const vendors=JSON.parse(localStorage.getItem('mbs_vendors')||'[]');
  const match=vendors.find(v=>(v.nama||v.name||'').trim().toLowerCase()===val.trim().toLowerCase());
  if(match){
    const setVal=(id,v)=>{const el=document.getElementById(id); if(el) el.value=v||'';};
    setVal('poVendorCp', match.cp||match.contact||'');
    setVal('poVendorTel', match.telepon||match.tel||'');
    setVal('poVendorAddr', match.alamat||match.addr||'');
  }
}

// ── Items ──
function po_addItemRow(data=null){
  const tbody=document.getElementById('itemsBody');
  const i=_po_itemIdx++;
  const no=tbody.rows.length+1;
  const tr=document.createElement('tr');
  tr.id=`item-row-${i}`;
  tr.innerHTML=`
    <td class="no">${no}</td>
    <td><input type="text" placeholder="Nama item" value="${esc(data?.name||'')}" oninput="po_calcTotals()"></td>
    <td><input type="text" placeholder="Deskripsi item..." value="${esc(data?.desc||'')}"></td>
    <td><input type="text" placeholder="Pcs" value="${esc(data?.unit||'')}" style="width:100%"></td>
    <td><input type="number" placeholder="0" value="${data?.qty||''}" min="0" oninput="po_calcTotals()" style="width:100%"></td>
    <td><input type="number" placeholder="0" value="${data?.price||''}" min="0" oninput="po_calcTotals()" style="width:100%"></td>
    <td class="amt" id="item-amt-${i}">${data?.qty&&data?.price?fmtRp(data.qty*data.price):'Rp 0'}</td>
    <td><button class="remove-row" onclick="po_removeRow(this,${i})">×</button></td>
  `;
  tbody.appendChild(tr); po_calcTotals(); po_renumber();
}
function po_removeRow(btn,i){btn.closest('tr').remove();po_renumber();po_calcTotals();}
function po_renumber(){document.querySelectorAll('#itemsBody tr').forEach((r,i)=>{if(r.cells[0])r.cells[0].textContent=i+1;});}
function po_getItems(){
  return Array.from(document.querySelectorAll('#itemsBody tr')).map(r=>{
    const ins=r.querySelectorAll('input');
    return{name:ins[0]?.value||'',desc:ins[1]?.value||'',unit:ins[2]?.value||'',
           qty:parseFloat(ins[3]?.value)||0,price:parseFloat(ins[4]?.value)||0};
  });
}

// ── DP ──
function po_onUseDpChange(){
  const on=document.getElementById('useDP').checked;
  document.getElementById('dpDetail').style.display=on?'':'none';
  document.getElementById('dpTotalRows').style.display=on?'':'none';
  po_calcTotals();
}
function po_onDpMethodChange(){
  const m=document.getElementById('dpMethod').value;
  document.getElementById('dpPctGroup').style.display=m==='pct'?'':'none';
  document.getElementById('dpCustomGroup').style.display=m==='custom'?'':'none';
  po_calcTotals();
}


function po_calcTotals(){
  let total=0;
  document.querySelectorAll('#itemsBody tr').forEach(r=>{
    const ins=r.querySelectorAll('input[type=number]');
    if(ins.length>=2){
      const qty=parseFloat(ins[ins.length-2].value)||0;
      const price=parseFloat(ins[ins.length-1].value)||0;
      const amt=qty*price; total+=amt;
      const i=r.id.replace('item-row-','');
      const el=document.getElementById('item-amt-'+i);
      if(el)el.textContent=fmtRp(amt);
    }
  });
  po_set('calcTotal',fmtRp(total));
  const useDP=document.getElementById('useDP').checked;
  let dpAmt=0,sisaAmt=total;
  if(useDP){
    const m=document.getElementById('dpMethod').value;
    dpAmt=m==='pct'?total*(parseFloat(document.getElementById('dpPctVal').value)||0)/100:parseFloat(document.getElementById('dpCustomVal').value)||0;
    sisaAmt=total-dpAmt;
    po_set('dpDisplay',fmtRp(dpAmt));po_set('sisaDisplay',fmtRp(sisaAmt));
    po_set('calcDp',fmtRp(dpAmt));po_set('calcPelunasan',fmtRp(sisaAmt));
  }
  return{total,dpAmt,sisaAmt,useDP};
}
function po_set(id,val){const el=document.getElementById(id);if(el)el.textContent=val;}

// ── Save ──
function po_savePO(){
  const required = document.getElementById('poVendorName').value.trim();
  if(!required){ toast('Nama vendor wajib diisi!','err'); return; }
  const totals = po_calcTotals();
  const po = po_buildData(totals);
  pageModules['po'].afterSave(po);
}
function po_buildData(t){
  return{
    id:_po_editingId||('po_'+Date.now()),
    nomorDok:document.getElementById('poNo').value,
    tanggal:document.getElementById('poDate').value,
    quoNo:document.getElementById('poQuoNo').value,
    namaVendor:document.getElementById('poVendorName').value,
    vendorCp:document.getElementById('poVendorCp').value,
    vendorTel:document.getElementById('poVendorTel').value,
    alamatVendor:document.getElementById('poVendorAddr').value,
    catatan:document.getElementById('poNotes').value,
    items:po_getItems(), ...t, grandTotal:t.total,
    dpMethod: document.getElementById('dpMethod').value,
    dpPctVal: parseFloat(document.getElementById('dpPctVal').value)||0,
    dpCustomVal: parseFloat(document.getElementById('dpCustomVal').value)||0,
    // TTD baku: slot1=Manajer Marketing (maker), slot2=Direktur (approver)
    ttdMakerSlot:1, ttdApproverSlot:2,
    ttdMakerSnapshot: (mbsSettings.ttdList||[])[1] || (mbsSettings.ttdList||[])[0] || null,
    ttdApproverSnapshot: (mbsSettings.ttdList||[])[2] || (mbsSettings.ttdList||[])[0] || null,
  };
}

// ── Preview & Print ──
function po_doPreview(){
  _po_ensureModal();
  if (!document.getElementById('poRender')) {
    const old = document.getElementById('previewModal');
    if (old) old.remove();
    _po_ensureModal();
  }
  const t=po_calcTotals();
  _po_previewData=po_buildData(t);
  document.getElementById('previewTitle').textContent='Preview PO '+_po_previewData.nomorDok;
  document.getElementById('poRender').innerHTML=po_renderHTML(_po_previewData);
  document.getElementById('previewModal').classList.remove('hidden'); document.getElementById('previewModal').classList.add('show');
}
function po_closePreview(){document.getElementById('previewModal').classList.remove('show');}
function po_doPrint(){
  if(!_po_previewData)return;
  const html=po_buildPrintPage(_po_previewData);
  const f=document.createElement('iframe');
  f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(f);
  f.onload=()=>waitFontsAndImagesThenPrint(f);
  f.srcdoc=html;
}

// ── Render ──
function po_renderHTML(po){
  const s=mbsSettings;
  const slots=s.ttdList||[];
  const maker=po.ttdMakerSnapshot||slots[1]||slots[0]||{};       // Manajer Marketing (slot 1)
  const approver=po.ttdApproverSnapshot||slots[2]||slots[0]||{}; // Direktur (slot 2)

  const logoHTML=s.logo
    ?`<img src="${s.logo}" style="width:48px;height:48px;object-fit:contain;flex-shrink:0">`
    :`<div style="width:48px;height:48px;background:#FFC000;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#111;font-weight:800;font-size:13px;flex-shrink:0">${(s.namaPerusahaan||'MBS').slice(0,3)}</div>`;

  const npwpParts=[];
  if(s.npwp) npwpParts.push(`NPWP. ${s.npwp}`);
  if(s.email) npwpParts.push(s.email);
  if(s.telepon) npwpParts.push(`| ${s.telepon}`);

  const dateStr=(()=>{
    if(!po.tanggal)return'-';
    const d=new Date(po.tanggal+'T00:00:00');
    return`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  })();

  const itemsHTML=(po.items||[]).map((it,i)=>`<tr>
    <td style="text-align:center;padding:7px 9px;border:1px solid #ddd;font-size:10.5px">${i+1}</td>
    <td style="padding:7px 9px;border:1px solid #ddd;font-size:10.5px;font-weight:600">${esc(it.name||'')}</td>
    <td style="padding:7px 9px;border:1px solid #ddd;font-size:10.5px;color:#555">${esc(it.desc||'').replace(/\n/g,'<br>')}</td>
    <td style="text-align:center;padding:7px 9px;border:1px solid #ddd;font-size:10.5px">${esc(it.unit||'')}</td>
    <td style="text-align:right;padding:7px 9px;border:1px solid #ddd;font-size:10.5px">${it.qty||0}</td>
    <td style="text-align:right;padding:7px 9px;border:1px solid #ddd;font-size:10.5px">${fmtRpInv(it.price||0)}</td>
    <td style="text-align:right;padding:7px 9px;border:1px solid #ddd;font-size:10.5px;font-weight:600">${fmtRpInv((it.qty||0)*(it.price||0))}</td>
  </tr>`).join('');

  const terbilangText=po_terbilang(Math.round(po.useDP&&po.dpAmt?po.dpAmt:po.total||0))+' Rupiah';

  return `<div style="padding:28px 32px;background:#fff;font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;color:#111">
  <!-- HEADER -->
  <div style="display:flex;gap:0;border:1px solid #ddd">
    <div style="flex:1;padding:12px 16px;display:flex;gap:12px;align-items:flex-start">
      ${logoHTML}
      <div>
        <div style="font-size:14px;font-weight:800;color:#111">${esc(s.namaPerusahaan)}</div>
        <div style="font-size:9px;color:#555;margin-top:3px;line-height:1.6">${esc(s.alamat||'').replace(/\n/g,'<br>')}</div>
        ${npwpParts.length?`<div style="font-size:8.5px;color:#777;margin-top:3px">${npwpParts.join(' | ')}</div>`:''}
      </div>
    </div>
    <div style="background:#FFC000;min-width:220px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px 20px">
      <div style="font-size:18px;font-weight:800;color:#111;letter-spacing:.06em;margin-bottom:10px">PURCHASE ORDER</div>
      <table style="font-size:10px;color:#111;border-collapse:collapse;width:100%">
        <tr><td style="padding:2px 4px;opacity:.85">NO.PO</td><td style="padding:2px 4px">:</td><td style="padding:2px 4px;font-weight:700">${esc(po.nomorDok||'')}</td></tr>
        <tr><td style="padding:2px 4px;opacity:.85">Tanggal</td><td style="padding:2px 4px">:</td><td style="padding:2px 4px;font-weight:700">${dateStr}</td></tr>
        <tr><td style="padding:2px 4px;opacity:.85">Quo.No</td><td style="padding:2px 4px">:</td><td style="padding:2px 4px;font-weight:700">${esc(po.quoNo||'-')}</td></tr>
      </table>
    </div>
  </div>
  <!-- VENDOR + DELIVERY -->
  <div style="display:grid;grid-template-columns:1fr 1fr;border:1px solid #ddd;border-top:none">
    <div style="padding:12px 16px;border-right:1px solid #ddd">
      <div style="font-size:9.5px;color:#888;margin-bottom:6px">To :</div>
      <div style="font-size:11px;font-weight:700;color:#111">${esc(po.vendorCp||po.namaVendor||'')}</div>
      <div style="font-size:10px;color:#555;margin-top:3px">${esc(po.namaVendor||'')}</div>
      ${po.alamatVendor?`<div style="font-size:9.5px;color:#777;margin-top:3px">${esc(po.alamatVendor).replace(/\n/g,'<br>')}</div>`:''}
    </div>
    <div style="padding:12px 16px">
      <div style="font-size:9.5px;color:#888;margin-bottom:6px;font-weight:700">Delivery To:</div>
      <div style="font-size:11px;font-weight:700;color:#111">${esc(s.namaPerusahaan)}</div>
      <div style="font-size:9.5px;color:#555;margin-top:3px;line-height:1.6">${esc(s.alamat||'').replace(/\n/g,'<br>')}</div>
      ${maker.nama?`<div style="font-size:9.5px;color:#555;margin-top:3px">${esc(maker.nama)}${maker.jabatan?' ('+esc(maker.jabatan)+')':''}</div>`:''}
    </div>
  </div>
  <!-- ITEMS -->
  <table style="width:100%;border-collapse:collapse;margin-top:14px">
    <thead><tr style="background:#FFC000">
      <th style="padding:8px 9px;font-size:9.5px;font-weight:700;text-align:center;color:#111;border:1px solid #e6a800;width:32px">NO</th>
      <th style="padding:8px 9px;font-size:9.5px;font-weight:700;text-align:left;color:#111;border:1px solid #e6a800">ITEM</th>
      <th style="padding:8px 9px;font-size:9.5px;font-weight:700;text-align:left;color:#111;border:1px solid #e6a800">DESC</th>
      <th style="padding:8px 9px;font-size:9.5px;font-weight:700;text-align:center;color:#111;border:1px solid #e6a800;width:55px">UNIT</th>
      <th style="padding:8px 9px;font-size:9.5px;font-weight:700;text-align:right;color:#111;border:1px solid #e6a800;width:50px">QTY</th>
      <th style="padding:8px 9px;font-size:9.5px;font-weight:700;text-align:right;color:#111;border:1px solid #e6a800;width:110px">UNIT PRICE</th>
      <th style="padding:8px 9px;font-size:9.5px;font-weight:700;text-align:right;color:#111;border:1px solid #e6a800;width:120px">AMOUNT</th>
    </tr></thead>
    <tbody>${itemsHTML}</tbody>
  </table>
  <!-- TOTALS -->
  <div style="display:flex;justify-content:flex-end;margin-top:0">
    <table style="border-collapse:collapse;min-width:260px">
      <tr style="background:#FFC000"><td style="padding:7px 12px;font-size:10.5px;font-weight:700;color:#111;border:1px solid #e6a800;text-align:center">TOTAL AMOUNT</td><td style="padding:7px 12px;font-size:10.5px;font-weight:700;color:#111;border:1px solid #e6a800;text-align:right">${fmtRpInv(po.total||0)}</td></tr>
      ${po.useDP?`
      <tr style="background:#FFC000"><td style="padding:7px 12px;font-size:10.5px;font-weight:700;color:#111;border:1px solid #e6a800;text-align:center">DP</td><td style="padding:7px 12px;font-size:10.5px;font-weight:700;color:#111;border:1px solid #e6a800;text-align:right">${fmtRpInv(po.dpAmt||0)}</td></tr>
      <tr style="background:#FFC000"><td style="padding:7px 12px;font-size:10.5px;font-weight:700;color:#111;border:1px solid #e6a800;text-align:center">PELUNASAN</td><td style="padding:7px 12px;font-size:10.5px;font-weight:700;color:#111;border:1px solid #e6a800;text-align:right">${fmtRpInv(po.sisaAmt||0)}</td></tr>`
      :`<tr style="background:#FFC000"><td style="padding:7px 12px;font-size:10.5px;font-weight:700;color:#111;border:1px solid #e6a800;text-align:center">PELUNASAN</td><td style="padding:7px 12px;font-size:10.5px;font-weight:700;color:#111;border:1px solid #e6a800;text-align:right">${fmtRpInv(po.total||0)}</td></tr>`}
    </table>
  </div>
  <!-- TERBILANG -->
  <div style="background:#fffbf0;border:1px solid #f0e0b0;border-left:3px solid #FFC000;border-radius:5px;padding:7px 12px;font-size:10px;color:#7a5a00;margin-top:12px">Terbilang : <em style="font-weight:600">${terbilangText}</em></div>
  <!-- NOTES -->
  ${po.catatan
    ?`<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:5px;padding:8px 12px;font-size:10px;color:#444;margin-top:10px"><strong style="display:block;font-size:9px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;color:#888">Notes :</strong>${esc(po.catatan).replace(/\n/g,'<br>')}</div>`
    :`<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:5px;padding:8px 12px;font-size:10px;color:#aaa;margin-top:10px;font-style:italic"><strong style="display:block;font-size:9px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Notes :</strong>&nbsp;</div>`}
  <!-- SIGNATURES -->
  <div style="display:flex;justify-content:space-between;margin-top:28px">
    <div style="text-align:center;font-size:10px">
      <div style="color:#555;margin-bottom:4px">Dibuat Oleh,</div>
      ${maker.img?`<img src="${maker.img}" style="height:70px;max-width:140px;object-fit:contain;display:block;margin:0 auto">`:'<div style="height:70px"></div>'}
      <div style="font-weight:700;border-top:1px solid #aaa;padding-top:3px;display:inline-block;min-width:110px">${esc(maker.nama||'')}</div>
      <div style="color:#777;font-size:9.5px">${esc(maker.jabatan||'Manajer Marketing')}</div>
    </div>
    <div style="text-align:center;font-size:10px">
      <div style="color:#555;margin-bottom:4px">Disetujui Oleh,</div>
      ${approver.img?`<img src="${approver.img}" style="height:70px;max-width:140px;object-fit:contain;display:block;margin:0 auto">`:'<div style="height:70px"></div>'}
      <div style="font-weight:700;border-top:1px solid #aaa;padding-top:3px;display:inline-block;min-width:110px">${esc(approver.nama||'')}</div>
      <div style="color:#777;font-size:9.5px">${esc(approver.jabatan||'Direktur')}</div>
    </div>
  </div>
  <!-- FOOTER -->
  <div style="background:#FFC000;text-align:center;padding:6px 0;margin-top:18px;font-size:9.5px;font-style:italic;color:#111">Terima Kasih atas kepercayaan dan kerjasama dengan Perusahaan Kami</div>
</div>`;
}

function po_buildPrintPage(po){
  const inner=po_renderHTML(po);
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>PO ${esc(po.nomorDok||'')}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#111;background:#fff}
@page{size:A4;margin:10mm}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>
</head><body>${inner}</body></html>`;
}


function po_terbilang(n){
  n=Math.floor(Math.abs(n));if(n===0)return'Nol';
  const sat=['','Satu','Dua','Tiga','Empat','Lima','Enam','Tujuh','Delapan','Sembilan'];
  const bel=['Sepuluh','Sebelas','Dua Belas','Tiga Belas','Empat Belas','Lima Belas','Enam Belas','Tujuh Belas','Delapan Belas','Sembilan Belas'];
  const pul=['','','Dua Puluh','Tiga Puluh','Empat Puluh','Lima Puluh','Enam Puluh','Tujuh Puluh','Delapan Puluh','Sembilan Puluh'];
  function h(n){if(n===0)return'';if(n<10)return sat[n];if(n<20)return bel[n-10];if(n<100)return pul[Math.floor(n/10)]+(n%10?' '+sat[n%10]:'');if(n<200)return'Seratus'+(n%100?' '+h(n%100):'');if(n<1000)return sat[Math.floor(n/100)]+' Ratus'+(n%100?' '+h(n%100):'');if(n<2000)return'Seribu'+(n%1000?' '+h(n%1000):'');if(n<1e6)return h(Math.floor(n/1000))+' Ribu'+(n%1000?' '+h(n%1000):'');if(n<1e9)return h(Math.floor(n/1e6))+' Juta'+(n%1e6?' '+h(n%1e6):'');if(n<1e12)return h(Math.floor(n/1e9))+' Miliar'+(n%1e9?' '+h(n%1e9):'');return h(Math.floor(n/1e12))+' Triliun'+(n%1e12?' '+h(n%1e12):'');}
  return h(n);
}
