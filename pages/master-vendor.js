/* ── Master Vendor ── */
registerPage('master-vendor', {
  rows: [], editingId: null,

  async init(el) {
    this.rows = cache.get('vendors');
    el.innerHTML = this.html();
    await this.load();
  },

  html() {
    return `
    <div class="card reveal">
      <div class="toolbar">
        <div class="toolbar-title">
          <span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke-linejoin="round"/><path d="M9 22V12h6v10" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
          Daftar Vendor / Supplier
        </div>
        <div class="search-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4" stroke-linecap="round"/></svg>
          <input id="vnSearch" placeholder="Cari nama / telepon…" oninput="MasterVendor.render()">
        </div>
        <button class="btn btn-gold" onclick="MasterVendor.openForm()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>Tambah Vendor
        </button>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Nama Vendor / Supplier</th><th>Contact Person</th><th>Telepon</th><th>Kategori</th><th>Alamat</th><th class="r">Aksi</th></tr></thead>
          <tbody id="vnBody"></tbody>
        </table>
      </div>
    </div>

    <!-- Modal -->
    <div class="modal-bg" id="vnModal">
      <div class="modal">
        <div class="modal-head">
          <h3 id="vnModalTitle">Tambah Vendor</h3>
          <button class="modal-x" onclick="MasterVendor.closeForm()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/></svg></button>
        </div>
        <div class="modal-body">
          <div class="frow c2">
            <div class="field">
              <label>Nama Vendor / Supplier <span class="req">*</span></label>
              <input id="vnNama" placeholder="CV Kain Jaya / PT Bahan Prima…">
            </div>
            <div class="field">
              <label>Kategori Vendor</label>
              <select id="vnKategori">
                <option value="">— Pilih —</option>
                <option>Kain & Bahan</option>
                <option>Aksesoris</option>
                <option>Percetakan</option>
                <option>Jasa (CMT/Bordir/Sablon)</option>
                <option>Packing</option>
                <option>Lainnya</option>
              </select>
            </div>
          </div>
          <div class="frow c2">
            <div class="field">
              <label>Contact Person</label>
              <input id="vnCp" placeholder="Nama narahubung">
            </div>
            <div class="field">
              <label>No. Telepon / WA</label>
              <input id="vnTelp" placeholder="0813-xxxx-xxxx">
            </div>
          </div>
          <div class="frow">
            <div class="field">
              <label>Alamat</label>
              <textarea id="vnAlamat" rows="2" placeholder="Alamat lengkap vendor…"></textarea>
            </div>
          </div>
          <div class="frow c2">
            <div class="field">
              <label>Email</label>
              <input id="vnEmail" type="email" placeholder="email@vendor.com">
            </div>
            <div class="field">
              <label>Catatan</label>
              <input id="vnCatatan" placeholder="Min. order, lead time, dll">
            </div>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" onclick="MasterVendor.closeForm()">Batal</button>
          <button class="btn btn-gold" id="vnSaveBtn" onclick="MasterVendor.save()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3h11l3 3v15H5z" stroke-linejoin="round"/><path d="M8 3v5h7" stroke-linecap="round"/></svg>Simpan
          </button>
        </div>
      </div>
    </div>`;
  },

  async load() {
    if (!sb.ready()) { this.render(); return; }
    try {
      const res = await sb.select('mbs_vendors');
      this.rows = res.map(r => ({ __id: r.id, ...(r.data || {}) }));
      cache.set('vendors', this.rows);
      this.render();
    } catch(e) { toast('Supabase: ' + e.message, 'err'); this.render(); }
  },

  render() {
    const q = (document.getElementById('vnSearch')?.value || '').toLowerCase().trim();
    const list = this.rows.filter(r => !q ||
      ((r.nama||r.name||'') + ' ' + (r.telepon||r.tel||'')).toLowerCase().includes(q)
    );
    const tb = document.getElementById('vnBody'); if (!tb) return;
    if (!list.length) {
      tb.innerHTML = `<tr><td colspan="6"><div class="empty-state">
        <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke-linejoin="round"/></svg></div>
        <div class="t">${q ? 'Vendor tidak ditemukan' : 'Belum ada data vendor'}</div>
        <div class="d">${q ? 'Coba kata kunci lain.' : 'Klik "Tambah Vendor" untuk mulai.'}</div>
      </div></td></tr>`;
      return;
    }
    tb.innerHTML = list.map(r => `<tr>
      <td class="td-bold">${esc(r.nama || r.name || '-')}</td>
      <td style="color:var(--ink2)">${esc(r.cp || r.contact || '-')}</td>
      <td class="td-mono" style="font-size:12px">${esc(r.telepon || r.tel || '-')}</td>
      <td>${r.kategori ? `<span class="tag tag-gold">${esc(r.kategori)}</span>` : '<span class="tag tag-gray">—</span>'}</td>
      <td style="color:var(--ink2);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px">${esc((r.alamat || r.addr || '-').replace(/\n/g,', '))}</td>
      <td><div class="row-act">
        <button class="ibtn ibtn-edit" onclick="MasterVendor.openForm('${r.__id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h4L18 10l-4-4L4 16z" stroke-linejoin="round"/><path d="M13 5l4 4" stroke-linecap="round"/></svg></button>
        <button class="ibtn ibtn-del" onclick="MasterVendor.del('${r.__id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </div></td></tr>`).join('');
  },

  openForm(id) {
    this.editingId = id || null;
    document.getElementById('vnModalTitle').textContent = id ? 'Edit Vendor' : 'Tambah Vendor';
    if (id) {
      const r = this.rows.find(x => x.__id === id);
      document.getElementById('vnNama').value     = r.nama || r.name || '';
      document.getElementById('vnKategori').value = r.kategori || '';
      document.getElementById('vnCp').value       = r.cp || r.contact || '';
      document.getElementById('vnTelp').value     = r.telepon || r.tel || '';
      document.getElementById('vnAlamat').value   = r.alamat || r.addr || '';
      document.getElementById('vnEmail').value    = r.email || '';
      document.getElementById('vnCatatan').value  = r.catatan || '';
    } else {
      ['vnNama','vnCp','vnTelp','vnAlamat','vnEmail','vnCatatan'].forEach(id => { document.getElementById(id).value = ''; });
      document.getElementById('vnKategori').value = '';
    }
    document.getElementById('vnModal').classList.add('show');
  },

  closeForm() { document.getElementById('vnModal').classList.remove('show'); this.editingId = null; },

  async save() {
    const nama = document.getElementById('vnNama').value.trim();
    if (!nama) { toast('Nama vendor wajib diisi', 'err'); return; }

    const newId = this.editingId || uid('vn');
    const data = {
      nama,
      kategori: document.getElementById('vnKategori').value,
      cp:       document.getElementById('vnCp').value.trim(),
      telepon:  document.getElementById('vnTelp').value.trim(),
      alamat:   document.getElementById('vnAlamat').value.trim(),
      email:    document.getElementById('vnEmail').value.trim(),
      catatan:  document.getElementById('vnCatatan').value.trim(),
      // legacy aliases
      name:     nama,
      tel:      document.getElementById('vnTelp').value.trim(),
      addr:     document.getElementById('vnAlamat').value.trim(),
      contact:  document.getElementById('vnCp').value.trim(),
    };

    if (this.editingId) {
      const idx = this.rows.findIndex(x => x.__id === this.editingId);
      this.rows[idx] = { __id: newId, ...data };
    } else {
      this.rows.unshift({ __id: newId, ...data });
    }

    const btn = document.getElementById('vnSaveBtn'); btn.disabled = true;
    try {
      if (sb.ready()) await sb.upsert('mbs_vendors', { id: newId, data });
      cache.set('vendors', this.rows);
      toast(this.editingId ? 'Vendor diperbarui' : `Vendor "${nama}" ditambahkan`, 'ok');
      this.closeForm(); this.render();
    } catch(e) {
      cache.set('vendors', this.rows);
      toast('Tersimpan lokal — Supabase gagal: ' + e.message, 'err');
      this.closeForm(); this.render();
    } finally { btn.disabled = false; }
  },

  async del(id) {
    const r = this.rows.find(x => x.__id === id); if (!r) return;
    if (!confirm(`Hapus vendor "${r.nama || r.name}"?`)) return;
    this.rows = this.rows.filter(x => x.__id !== id);
    try { if (sb.ready()) await sb.remove('mbs_vendors', id); } catch(e) { toast('Supabase gagal hapus: ' + e.message, 'err'); }
    cache.set('vendors', this.rows); this.render(); toast('Vendor dihapus', 'ok');
  }
});
const MasterVendor = pageModules['master-vendor'];
