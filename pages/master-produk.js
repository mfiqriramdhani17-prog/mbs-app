/* ── Master Produk ── */
registerPage('master-produk', {
  rows: [],
  editingId: null,
  curFoto: '',

  async init(el) {
    this.rows = cache.get('products');
    el.innerHTML = this.listHTML();
    await this.load();
  },

  listHTML() {
    return `
    <div class="card reveal">
      <div class="toolbar">
        <div class="toolbar-title"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z" stroke-linejoin="round"/></svg></span>Daftar Produk</div>
        <div class="search-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4" stroke-linecap="round"/></svg>
          <input id="mpSearch" placeholder="Cari nama / kode / jenis…" oninput="MasterProduk.render()">
        </div>
        <button class="btn btn-gold" onclick="MasterProduk.openForm()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>Tambah Produk</button>
      </div>
      <div class="tbl-wrap">
        <table><thead><tr><th>Kode</th><th>Foto</th><th>Nama Produk</th><th>Jenis</th><th class="r">Harga Vendor</th><th class="r">Harga Jual</th><th class="r">Margin</th><th class="r">Aksi</th></tr></thead>
        <tbody id="mpBody"></tbody></table>
      </div>
    </div>
    <!-- Modal -->
    <div class="modal-bg" id="mpModal">
      <div class="modal">
        <div class="modal-head"><h3 id="mpModalTitle">Tambah Produk</h3><button class="modal-x" onclick="MasterProduk.closeForm()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/></svg></button></div>
        <div class="modal-body">
          <div class="frow c2">
            <div class="field"><label>Nama Produk <span class="req">*</span></label><input id="mpNama" placeholder="Contoh: Polo Shirt Security"></div>
            <div class="field"><label>Jenis Produk <span class="req">*</span></label>
              <select id="mpJenis" onchange="MasterProduk.updateKode()"><option value="Pakaian">Pakaian</option><option value="Percetakan">Percetakan</option><option value="Produk Lainnya">Produk Lainnya</option></select>
            </div>
          </div>
          <div class="frow c2">
            <div class="field"><label>Harga Vendor / Produksi</label><input id="mpVendor" inputmode="numeric" placeholder="0" oninput="fmtInput(this)"></div>
            <div class="field"><label>Harga Jual</label><input id="mpJual" inputmode="numeric" placeholder="0" oninput="fmtInput(this)"></div>
          </div>
          <div class="frow c2">
            <div class="field"><label>Kode Produk (otomatis)</label><div class="kode-preview" id="mpKodePrev">PK0001</div><div class="hint">Dibuat otomatis dari jenis produk.</div></div>
            <div class="field">
              <label>Foto Produk</label>
              <div style="display:flex;align-items:center;gap:12px">
                <div class="logo-box" id="mpFotoBox" onclick="document.getElementById('mpFotoFile').click()">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M21 16l-5-5L5 20" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </div>
                <div style="font-size:12px;color:var(--ink2)">Klik untuk upload<br><button style="font-size:12px;color:var(--red);background:none;border:none;cursor:pointer;margin-top:4px" onclick="MasterProduk.clearFoto()">Hapus foto</button></div>
              </div>
              <input type="file" id="mpFotoFile" accept="image/*" style="display:none" onchange="MasterProduk.onFoto(this)">
            </div>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" onclick="MasterProduk.closeForm()">Batal</button>
          <button class="btn btn-gold" id="mpSaveBtn" onclick="MasterProduk.save()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3h11l3 3v15H5z" stroke-linejoin="round"/><path d="M8 3v5h7" stroke-linecap="round" stroke-linejoin="round"/></svg>Simpan</button>
        </div>
      </div>
    </div>`;
  },

  async load() {
    if (!sb.ready()) { this.render(); return; }
    try {
      const res = await sb.select('mbs_products');
      this.rows = res.map(r => r.data).filter(Boolean);
      cache.set('products', this.rows);
      this.render();
    } catch(e) { toast('Supabase: ' + e.message, 'err'); this.render(); }
  },

  PREFIX: { Pakaian: 'PK', Percetakan: 'PC', 'Produk Lainnya': 'PL' },

  nextKode(jenis) {
    const pf = this.PREFIX[jenis];
    let max = 0;
    this.rows.forEach(p => {
      if (p.jenis === jenis && p.id !== this.editingId) {
        const n = parseInt((p.kode||'').replace(pf,''))||0;
        if (n > max) max = n;
      }
    });
    return pf + String(max+1).padStart(4,'0');
  },

  updateKode() {
    const j = document.getElementById('mpJenis')?.value;
    const el = document.getElementById('mpKodePrev');
    if (!el || !j) return;
    if (this.editingId) { el.textContent = this.rows.find(r=>r.id===this.editingId)?.kode || this.nextKode(j); }
    else { el.textContent = this.nextKode(j); }
  },

  render() {
    const q = (document.getElementById('mpSearch')?.value||'').toLowerCase().trim();
    const list = this.rows.filter(p => !q || (p.nama+' '+p.kode+' '+p.jenis).toLowerCase().includes(q));
    const tb = document.getElementById('mpBody');
    if (!tb) return;
    if (!list.length) { tb.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z" stroke-linejoin="round"/></svg></div><div class="t">${q?'Produk tidak ditemukan':'Belum ada produk'}</div><div class="d">${q?'Coba kata kunci lain.':'Klik "Tambah Produk" untuk mulai.'}</div></div></td></tr>`; return; }
    tb.innerHTML = list.map(p => {
      const mg = (p.jual||0)-(p.vendor||0), mgp = p.jual ? Math.round(mg/p.jual*100) : 0;
      const foto = p.foto ? `<img src="${p.foto}" style="width:42px;height:42px;border-radius:9px;object-fit:cover;border:1px solid var(--line)">` : `<div style="width:42px;height:42px;border-radius:9px;border:1px dashed var(--line);background:#FAF7F1;display:flex;align-items:center;justify-content:center;color:#C2BBAD"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M21 16l-5-5L5 20" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
      return `<tr><td class="td-mono text-gold">${esc(p.kode)}</td><td>${foto}</td><td class="td-bold">${esc(p.nama)}</td><td><span class="tag tag-gold">${esc(p.jenis)}</span></td><td class="td-r">${rp(p.vendor)}</td><td class="td-r">${rp(p.jual)}</td><td class="td-r"><span class="text-green">${rp(mg)}</span> <span style="font-size:11px;color:var(--ink2)">(${mgp}%)</span></td><td><div class="row-act"><button class="ibtn ibtn-edit" onclick="MasterProduk.openForm('${p.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h4L18 10l-4-4L4 16z" stroke-linejoin="round"/><path d="M13 5l4 4" stroke-linecap="round"/></svg></button><button class="ibtn ibtn-del" onclick="MasterProduk.del('${p.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div></td></tr>`;
    }).join('');
  },

  openForm(id) {
    this.editingId = id || null;
    document.getElementById('mpModalTitle').textContent = id ? 'Edit Produk' : 'Tambah Produk';
    if (id) {
      const p = this.rows.find(x => x.id===id);
      document.getElementById('mpNama').value = p.nama||'';
      document.getElementById('mpJenis').value = p.jenis||'Pakaian';
      document.getElementById('mpVendor').value = p.vendor ? Number(p.vendor).toLocaleString('id-ID') : '';
      document.getElementById('mpJual').value = p.jual ? Number(p.jual).toLocaleString('id-ID') : '';
      this.curFoto = p.foto||'';
    } else {
      ['mpNama','mpVendor','mpJual'].forEach(id => { document.getElementById(id).value = ''; });
      document.getElementById('mpJenis').value = 'Pakaian';
      this.curFoto = '';
    }
    this.paintFoto(); this.updateKode();
    document.getElementById('mpModal').classList.add('show');
  },
  closeForm() { document.getElementById('mpModal').classList.remove('show'); this.editingId = null; },

  async onFoto(input) {
    const f = input.files[0]; if (!f) return;
    const box = document.getElementById('mpFotoBox');
    // Preview lokal dulu
    const localUrl = URL.createObjectURL(f);
    if (box) box.innerHTML = `<img src="${localUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:12px">`;
    if (sb.ready()) {
      try {
        const url = await sb.uploadImage(f, 'mbs-images', 'produk');
        this.curFoto = url;
      } catch(e) {
        toast('Upload gagal, simpan lokal: ' + e.message, 'err');
        this.curFoto = await compressImage(f, 600);
      }
    } else {
      this.curFoto = await compressImage(f, 600);
    }
    this.paintFoto(); input.value = '';
  },
  paintFoto() {
    const box = document.getElementById('mpFotoBox'); if (!box) return;
    box.innerHTML = this.curFoto ? `<img src="${this.curFoto}" style="width:100%;height:100%;object-fit:cover;border-radius:12px">` : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M21 16l-5-5L5 20" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  },
  clearFoto() { this.curFoto = ''; this.paintFoto(); },

  async save() {
    const nama = document.getElementById('mpNama').value.trim();
    const jenis = document.getElementById('mpJenis').value;
    if (!nama) { toast('Nama produk wajib diisi','err'); return; }
    const vendor = parseNum(document.getElementById('mpVendor').value);
    const jual   = parseNum(document.getElementById('mpJual').value);
    let p;
    if (this.editingId) {
      p = this.rows.find(x => x.id===this.editingId);
      if (p.jenis !== jenis) p.kode = this.nextKode(jenis);
      Object.assign(p, { nama, jenis, vendor, jual, foto: this.curFoto });
    } else {
      p = { id: uid('prod'), kode: this.nextKode(jenis), nama, jenis, vendor, jual, foto: this.curFoto };
      this.rows.unshift(p);
    }
    const btn = document.getElementById('mpSaveBtn'); btn.disabled = true;
    try {
      if (sb.ready()) await sb.upsert('mbs_products', { id: p.id, data: p });
      cache.set('products', this.rows);
      toast(this.editingId ? 'Produk diperbarui' : `Produk ditambahkan (${p.kode})`, 'ok');
      this.closeForm(); this.render();
    } catch(e) { cache.set('products', this.rows); toast('Tersimpan lokal — Supabase gagal: '+e.message,'err'); this.closeForm(); this.render(); }
    finally { btn.disabled = false; }
  },

  async del(id) {
    const p = this.rows.find(x => x.id===id); if (!p) return;
    if (!confirm(`Hapus produk "${p.nama}" (${p.kode})?`)) return;
    this.rows = this.rows.filter(x => x.id!==id);
    try { if (sb.ready()) await sb.remove('mbs_products', id); } catch(e) { toast('Supabase gagal hapus: '+e.message,'err'); }
    cache.set('products', this.rows); this.render(); toast('Produk dihapus','ok');
  }
});
const MasterProduk = pageModules['master-produk'];
