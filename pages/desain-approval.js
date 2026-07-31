/* ── Desain Approval ── */
registerPage('desain-approval', {
  rows: [], editingId: null, formProds: [], clients: [],

  async init(el) {
    this.rows = cache.get('desain_approval'); this.clients = cache.get('clients');
    el.innerHTML = this.listHTML(); await this.load();
  },

  listHTML() {
    return `<div id="daListView">
      <div class="card reveal">
        <div class="toolbar">
          <div class="toolbar-title"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9" stroke-linecap="round"/></svg></span>Desain Approval</div>
          <div class="search-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4" stroke-linecap="round"/></svg><input id="daSearch" placeholder="Cari nomor / klien / project…" oninput="DesainApproval.render()"></div>
          <button class="btn btn-gold" onclick="DesainApproval.newDoc()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>Buat Desain Approval</button>
        </div>
        <div class="tbl-wrap">
          <table><thead><tr><th>No. Dokumen</th><th>Tanggal</th><th>Klien</th><th>Nama Project</th><th>Produk</th><th class="r">Aksi</th></tr></thead>
          <tbody id="daBody"></tbody></table>
        </div>
      </div>
    </div>
    <div id="daFormView" class="hidden"></div>`;
  },

  async load() {
    if (!sb.ready()) { this.render(); return; }
    try {
      const [da, cl] = await Promise.allSettled([sb.select('mbs_desain_approval'), sb.select('mbs_clients')]);
      if (da.status === 'fulfilled') { this.rows = da.value.map(r => r.data).filter(Boolean); cache.set('desain_approval', this.rows); }
      if (cl.status === 'fulfilled') { this.clients = cl.value.map(r => ({ __id: r.id, ...(r.data || {}) })); cache.set('clients', this.clients); }
      this.render();
    } catch(e) { toast('Supabase: ' + e.message, 'err'); this.render(); }
  },

  render() {
    const q = (document.getElementById('daSearch')?.value || '').toLowerCase().trim();
    const list = this.rows.filter(r => !q || ((r.nomorDok || '') + ' ' + (r.namaKlien || '') + ' ' + (r.namaProject || '')).toLowerCase().includes(q));
    const tb = document.getElementById('daBody'); if (!tb) return;
    if (!list.length) { tb.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/></svg></div><div class="t">Belum ada desain approval</div></div></td></tr>`; return; }
    tb.innerHTML = list.map(r => `<tr>
      <td class="td-mono text-gold">${esc(r.nomorDok || '-')}</td>
      <td>${fmtDate(r.tanggal)}</td>
      <td class="td-bold">${esc(r.namaKlien || '-')}</td>
      <td>${esc(r.namaProject || '-')}</td>
      <td><span class="tag tag-gold">${(r.produk || []).length} produk</span></td>
      <td><div class="row-act">
        <button class="ibtn ibtn-view" onclick="DesainApproval.printDoc('${r.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z" stroke-linejoin="round"/></svg></button>
        <button class="ibtn ibtn-edit" onclick="DesainApproval.edit('${r.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h4L18 10l-4-4L4 16z" stroke-linejoin="round"/></svg></button>
        <button class="ibtn ibtn-del" onclick="DesainApproval.del('${r.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </div></td></tr>`).join('');
  },

  showList() { document.getElementById('daListView')?.classList.remove('hidden'); document.getElementById('daFormView')?.classList.add('hidden'); document.getElementById('pageH1').textContent = 'Desain Approval'; document.getElementById('pageP').textContent = 'Lembar persetujuan desain'; },
  showForm() { document.getElementById('daListView')?.classList.add('hidden'); document.getElementById('daFormView')?.classList.remove('hidden'); window.scrollTo(0, 0); },

  newProd() { return { id: uid('dp'), nama: '', spesifikasi: '', ukuran: '', bahan: '', harga: 0, catatan: '', images: [] }; },
  newDoc() { this.editingId = null; this.formProds = [this.newProd()]; this.renderForm(); },
  edit(id) { this.editingId = id; const r = this.rows.find(x => x.id === id); if (!r) return; this.formProds = r.produk?.length ? JSON.parse(JSON.stringify(r.produk)) : [this.newProd()]; this.renderForm(r); },

  renderForm(r) {
    const fv = document.getElementById('daFormView'); if (!fv) return;
    const no = r?.nomorDok || nextDocNo('da');
    const clientOpts = '<option value="">— Pilih klien —</option>' + this.clients.map(c => `<option value="${c.__id}">${esc(c.nama || c.namaKlien || c.name || '')}</option>`).join('');
    fv.innerHTML = `
    <div class="card reveal">
      <div class="card-head"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9" stroke-linecap="round"/></svg></div><h2>${r ? 'Edit Desain Approval' : 'Buat Desain Approval'}</h2></div>
      <div class="card-body">
        <div class="frow c3">
          <div class="field"><label>No. Dokumen</label><input id="dafNo" value="${esc(no)}" class="auto" readonly></div>
          <div class="field"><label>Tanggal</label><input id="dafTgl" type="date" value="${r?.tanggal || today()}"></div>
          <div class="field"><label>Nama Project</label><input id="dafProject" placeholder="Nama project" value="${esc(r?.namaProject || '')}"></div>
        </div>
        <div class="frow c2">
          <div class="field"><label>Pilih Klien</label><select id="dafKlienSel" onchange="DesainApproval.onPickClient()">${clientOpts}</select></div>
          <div class="field"><label>Nama Klien <span class="req">*</span></label><input id="dafNamaKlien" placeholder="Nama klien" value="${esc(r?.namaKlien || '')}"></div>
        </div>
      </div>
    </div>

    <div id="dafProdList" style="margin-top:0"></div>
    <button class="add-prod-btn" style="margin-top:4px" onclick="DesainApproval.addProd()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>Tambah Produk</button>

    <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px;padding:4px;flex-wrap:wrap">
      <button class="btn btn-ghost" onclick="DesainApproval.showList()">Batal</button>
      <button class="btn btn-ghost" id="dafPrintBtn" onclick="DesainApproval.printForm()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z" stroke-linejoin="round"/></svg>Cetak Preview</button>
      <button class="btn btn-gold" id="dafSaveBtn" onclick="DesainApproval.save()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3h11l3 3v15H5z" stroke-linejoin="round"/><path d="M8 3v5h7" stroke-linecap="round"/></svg>Simpan</button>
    </div>`;
    this.renderProds(); this.showForm();
    if (r) { const m = this.clients.find(c => (c.nama || c.namaKlien || '') === r.namaKlien); const s = document.getElementById('dafKlienSel'); if (s && m) s.value = m.__id; }
  },

  onPickClient() { const s = document.getElementById('dafKlienSel'); const c = this.clients.find(x => x.__id === s?.value); if (!c) return; document.getElementById('dafNamaKlien').value = c.nama || c.namaKlien || ''; },

  renderProds() {
    const wrap = document.getElementById('dafProdList'); if (!wrap) return;
    wrap.innerHTML = this.formProds.map((p, i) => this.prodCard(p, i)).join('');
  },

  prodCard(p, i) {
    const thumbs = (p.images || []).map((img, j) => `<div class="thumb"><img src="${img}"><button class="thumb-x" onclick="DesainApproval.removeImg(${i},${j})">×</button></div>`).join('');
    return `<div class="card" style="margin-top:16px;border:2px solid ${i === 0 ? 'var(--gold)' : 'var(--line)'}">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 18px;background:${i === 0 ? 'var(--gold-soft)' : 'var(--bg)'};border-radius:16px 16px 0 0">
        <span style="font-weight:700;font-size:14px;color:var(--ink)">Produk #${i + 1}</span>
        ${this.formProds.length > 1 ? `<button class="btn btn-sm btn-red" onclick="DesainApproval.delProd(${i})"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13" stroke-linecap="round" stroke-linejoin="round"/></svg>Hapus</button>` : ''}
      </div>
      <div class="card-body">
        <div class="frow c3">
          <div class="field"><label>Nama Produk <span class="req">*</span></label><input value="${esc(p.nama || '')}" placeholder="Nama produk" oninput="DesainApproval.setProd(${i},'nama',this.value)"></div>
          <div class="field"><label>Spesifikasi</label><input value="${esc(p.spesifikasi || '')}" placeholder="Contoh: Polo Shirt Premium" oninput="DesainApproval.setProd(${i},'spesifikasi',this.value)"></div>
          <div class="field"><label>Ukuran</label><input value="${esc(p.ukuran || '')}" placeholder="S/M/L/XL / A3 / dll" oninput="DesainApproval.setProd(${i},'ukuran',this.value)"></div>
        </div>
        <div class="frow c3">
          <div class="field"><label>Bahan / Material</label><input value="${esc(p.bahan || '')}" placeholder="Cotton combed 30s" oninput="DesainApproval.setProd(${i},'bahan',this.value)"></div>
          <div class="field"><label>Harga</label><input value="${p.harga ? Number(p.harga).toLocaleString('id-ID') : ''}" inputmode="numeric" placeholder="0" oninput="DesainApproval.setProdMoney(${i},'harga',this)"></div>
          <div class="field"><label>Catatan Produk</label><input value="${esc(p.catatan || '')}" placeholder="Catatan khusus…" oninput="DesainApproval.setProd(${i},'catatan',this.value)"></div>
        </div>
        <div class="sub-head"><span>Gambar Desain</span><span class="ln"></span></div>
        <div class="dropzone" onclick="document.getElementById('daImg${i}').click()">
          <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M21 16l-5-5L5 20" stroke-linecap="round"/></svg></div>
          <div class="t">Klik atau seret gambar desain</div>
          <div class="d">PNG/JPG — Bisa lebih dari satu gambar</div>
        </div>
        <input type="file" id="daImg${i}" accept="image/*" multiple style="display:none" onchange="DesainApproval.onImgs(${i},this)">
        ${(p.images || []).length ? `<div class="thumbs" style="margin-top:12px">${thumbs}</div>` : ''}
        <div class="field" style="margin-top:16px"><label>Catatan &amp; Revisi</label><textarea rows="3" placeholder="Catatan revisi, permintaan perubahan, dll…" oninput="DesainApproval.setProd(${i},'catatanRevisi',this.value)">${esc(p.catatanRevisi || '')}</textarea></div>
      </div>
    </div>`;
  },

  setProd(i, k, v) { this.formProds[i][k] = v; },
  setProdMoney(i, k, el) { const v = onlyNum(el.value); el.value = v ? Number(v).toLocaleString('id-ID') : ''; this.formProds[i][k] = +v; },
  addProd() { this.formProds.push(this.newProd()); this.renderProds(); document.querySelector('#dafProdList > .card:last-child')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); },
  delProd(i) { this.formProds.splice(i, 1); this.renderProds(); },

  async onImgs(i, input) {
    const files = [...input.files];
    for (const f of files) {
      let url;
      if (sb.ready()) {
        try {
          url = await sb.uploadImage(f, 'mbs-images', 'desain');
        } catch(e) {
          toast('Upload gagal, simpan lokal: ' + e.message, 'err');
          url = await compressImage(f, 900, 0.9);
        }
      } else {
        url = await compressImage(f, 900, 0.9);
      }
      this.formProds[i].images = [...(this.formProds[i].images || []), url];
    }
    this.renderProds(); input.value = '';
  },
  removeImg(i, j) { this.formProds[i].images.splice(j, 1); this.renderProds(); },

  async save() {
    const namaKlien = document.getElementById('dafNamaKlien')?.value.trim(); if (!namaKlien) { toast('Nama klien wajib', 'err'); return; }
    if (this.formProds.some(p => !p.nama?.trim())) { toast('Nama produk wajib diisi di semua produk', 'err'); return; }
    const doc = { id: this.editingId || uid('da'), nomorDok: document.getElementById('dafNo')?.value, tanggal: document.getElementById('dafTgl')?.value, namaProject: document.getElementById('dafProject')?.value.trim(), namaKlien, produk: this.formProds };
    if (this.editingId) { const idx = this.rows.findIndex(x => x.id === this.editingId); this.rows[idx] = doc; } else this.rows.unshift(doc);
    const btn = document.getElementById('dafSaveBtn'); btn.disabled = true;
    try { if (sb.ready()) await sb.upsert('mbs_desain_approval', { id: doc.id, data: doc }); cache.set('desain_approval', this.rows); toast(this.editingId ? 'Diperbarui' : 'Desain Approval disimpan', 'ok'); this.showList(); this.render(); }
    catch(e) { cache.set('desain_approval', this.rows); toast('Tersimpan lokal: ' + e.message, 'err'); this.showList(); this.render(); }
    finally { btn.disabled = false; }
  },

  async del(id) { if (!confirm('Hapus desain approval ini?')) return; this.rows = this.rows.filter(x => x.id !== id); try { if (sb.ready()) await sb.remove('mbs_desain_approval', id); } catch(e) {} cache.set('desain_approval', this.rows); this.render(); toast('Dihapus', 'ok'); },

  printForm() {
    const no = document.getElementById('dafNo')?.value, tgl = document.getElementById('dafTgl')?.value;
    const namaKlien = document.getElementById('dafNamaKlien')?.value, namaProject = document.getElementById('dafProject')?.value;
    this._printPages(no, tgl, namaKlien, namaProject, this.formProds);
  },

  printDoc(id) {
    const r = this.rows.find(x => x.id === id); if (!r) return;
    this._printPages(r.nomorDok, r.tanggal, r.namaKlien, r.namaProject, r.produk || []);
  },

  _printPages(no, tgl, namaKlien, namaProject, prods) {
    const logoHtml = mbsSettings.logo ? `<img src="${mbsSettings.logo}" class="logo-img">` : `<div class="logo-text">${esc(mbsSettings.namaPerusahaan)}</div>`;
    const pages = prods.map((p, i) => {
      const imgBlock = (p.images || []).length
        ? (p.images || []).map(src => `<img src="${src}" class="design-img">`).join('')
        : `<div class="design-placeholder"><div>[ Area Gambar Desain ]</div><div style="font-size:11px;margin-top:6px;color:#bbb">Upload gambar desain dari form</div></div>`;
      return `
      <div class="page" ${i > 0 ? 'style="page-break-before:always"' : ''}>
        <div class="kop">
          <div class="kop-left">${logoHtml}<div class="kop-info"><b>${esc(mbsSettings.namaPerusahaan)}</b><br>${esc(mbsSettings.tagline || '')}<br>${esc(mbsSettings.alamat || '')}<br>${esc(mbsSettings.telepon || '')}${mbsSettings.email ? ' · ' + esc(mbsSettings.email) : ''}</div></div>
          <div class="kop-right">
            <div class="doc-label">DESAIN APPROVAL</div>
            <table class="doc-info"><tbody>
              <tr><td>No. Dokumen</td><td><b>${esc(no)}</b></td></tr>
              <tr><td>Tanggal</td><td>${fmtDate(tgl)}</td></tr>
              <tr><td>Klien</td><td><b>${esc(namaKlien)}</b></td></tr>
              <tr><td>Project</td><td>${esc(namaProject || '-')}</td></tr>
              <tr><td>Produk ke-</td><td>${i + 1} dari ${prods.length}</td></tr>
            </tbody></table>
          </div>
        </div>
        <table class="prod-table">
          <thead><tr><th>Nama Produk</th><th>Spesifikasi</th><th>Ukuran</th><th>Bahan</th><th>Harga</th><th>Catatan</th></tr></thead>
          <tbody><tr>
            <td><b>${esc(p.nama || '-')}</b></td>
            <td>${esc(p.spesifikasi || '-')}</td>
            <td>${esc(p.ukuran || '-')}</td>
            <td>${esc(p.bahan || '-')}</td>
            <td>${p.harga ? rp(p.harga) : '-'}</td>
            <td>${esc(p.catatan || '-')}</td>
          </tr></tbody>
        </table>
        <div class="design-area">${imgBlock}</div>
        <div class="revisi-box">
          <div class="revisi-label">Catatan &amp; Revisi</div>
          <div class="revisi-content">${esc(p.catatanRevisi || '')}</div>
        </div>
        <div class="approval-row">
          <div class="appr-box"><div class="appr-label">Disetujui oleh (Klien)</div><div class="appr-space"></div><div class="appr-name">(${esc(namaKlien)})</div></div>
          <div class="appr-box"><div class="appr-label">Disiapkan oleh</div><div class="appr-space"></div><div class="appr-name">${esc(mbsSettings.namaTtd || '')}</div></div>
        </div>
      </div>`;
    }).join('');
    printHTML(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Desain Approval ${esc(no)}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;color:#221F1A;font-size:12px}.page{padding:20px 24px;min-height:100vh}.kop{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:4px solid #221F1A;padding-bottom:12px;margin-bottom:14px}.kop-left{display:flex;gap:12px;align-items:flex-start}.logo-img{height:50px;object-fit:contain}.logo-text{font-weight:900;font-size:20px;color:#A87E1C}.kop-info{font-size:10px;color:#555;line-height:1.6;margin-top:2px}.kop-right{text-align:right}.doc-label{font-size:19px;font-weight:900;letter-spacing:-1px;color:#221F1A;margin-bottom:6px}.doc-info{border-collapse:collapse;font-size:11px;margin-left:auto}.doc-info td{padding:2px 6px;color:#555}.doc-info td:first-child{color:#999;text-align:right}.doc-info td:last-child{text-align:left}.prod-table{width:100%;border-collapse:collapse;margin-bottom:14px}.prod-table thead th{background:#211F1C;color:#C79A2E;font-size:10px;text-transform:uppercase;padding:7px 10px;text-align:left}.prod-table tbody td{padding:8px 10px;border-bottom:1px solid #eee;font-size:11.5px;vertical-align:top}.design-area{min-height:240px;border:2px dashed #D4C9B5;border-radius:8px;padding:12px;display:flex;flex-wrap:wrap;gap:10px;justify-content:center;align-items:flex-start;margin-bottom:14px;background:#FAFAF7}.design-img{max-width:46%;max-height:280px;object-fit:contain;border-radius:6px;border:1px solid #eee}.design-placeholder{width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:200px;color:#ccc;font-size:14px}.revisi-box{border:1px solid #ddd;border-radius:6px;padding:10px;margin-bottom:14px;min-height:72px}.revisi-label{font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#999;margin-bottom:6px}.revisi-content{font-size:12px;color:#555;min-height:48px;white-space:pre-wrap}.approval-row{display:flex;gap:24px;margin-top:8px}.appr-box{flex:1;text-align:center}.appr-label{font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#999;margin-bottom:4px}.appr-space{height:48px;border-bottom:1px solid #221F1A;margin-bottom:6px}.appr-name{font-size:11px;font-weight:700}@page{size:A4;margin:8mm 10mm}</style></head><body>${pages}</body></html>`);
  }
});
const DesainApproval = pageModules['desain-approval'];
