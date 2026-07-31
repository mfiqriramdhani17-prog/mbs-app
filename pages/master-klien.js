/* ── Master Klien ── */
registerPage('master-klien', {
  rows: [], editingId: null,

  async init(el) {
    this.rows = cache.get('clients');
    el.innerHTML = this.html();
    await this.load();
  },

  html() {
    return `
    <div class="card reveal">
      <div class="toolbar">
        <div class="toolbar-title">
          <span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke-linecap="round"/></svg></span>
          Daftar Klien
        </div>
        <div class="search-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4" stroke-linecap="round"/></svg>
          <input id="klSearch" placeholder="Cari kode / nama / telepon…" oninput="MasterKlien.render()">
        </div>
        <button class="btn btn-gold" onclick="MasterKlien.openForm()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>Tambah Klien
        </button>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Kode</th><th>Nama Perusahaan / Klien</th><th>Narahubung</th><th>Telepon</th><th>Alamat</th><th class="r">Aksi</th></tr></thead>
          <tbody id="klBody"></tbody>
        </table>
      </div>
    </div>

    <!-- Modal -->
    <div class="modal-bg" id="klModal">
      <div class="modal">
        <div class="modal-head">
          <h3 id="klModalTitle">Tambah Klien</h3>
          <button class="modal-x" onclick="MasterKlien.closeForm()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/></svg></button>
        </div>
        <div class="modal-body">
          <div class="frow c2">
            <div class="field">
              <label>Kode Klien <span class="req">*</span></label>
              <input id="klKode" placeholder="KPS / PT001 / dll" maxlength="12" oninput="this.value=this.value.toUpperCase()">
              <div class="hint">Unik, dipakai untuk autofill di dokumen.</div>
            </div>
            <div class="field">
              <label>Nama Perusahaan / Klien <span class="req">*</span></label>
              <input id="klNama" placeholder="PT Karya Pejuang Senyum">
            </div>
          </div>
          <div class="frow">
            <div class="field">
              <label>Alamat</label>
              <textarea id="klAlamat" rows="2" placeholder="Alamat lengkap…"></textarea>
            </div>
          </div>
          <div class="frow c2">
            <div class="field">
              <label>Narahubung (Contact Person)</label>
              <input id="klContact" placeholder="Ibu Gracia">
            </div>
            <div class="field">
              <label>No. Telepon</label>
              <input id="klTelp" placeholder="0813-xxxx-xxxx">
            </div>
          </div>
          <div class="frow c2">
            <div class="field">
              <label>Email</label>
              <input id="klEmail" type="email" placeholder="email@perusahaan.com">
            </div>
            <div class="field">
              <label>NPWP</label>
              <input id="klNpwp" placeholder="00.000.000.0-000.000">
            </div>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" onclick="MasterKlien.closeForm()">Batal</button>
          <button class="btn btn-gold" id="klSaveBtn" onclick="MasterKlien.save()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3h11l3 3v15H5z" stroke-linejoin="round"/><path d="M8 3v5h7" stroke-linecap="round"/></svg>Simpan
          </button>
        </div>
      </div>
    </div>`;
  },

  async load() {
    if (!sb.ready()) { this.render(); return; }
    try {
      const res = await sb.select('mbs_clients');
      this.rows = res.map(r => ({ __id: r.id, ...(r.data || {}) }));
      cache.set('clients', this.rows);
      this.render();
    } catch(e) { toast('Supabase: ' + e.message, 'err'); this.render(); }
  },

  render() {
    const q = (document.getElementById('klSearch')?.value || '').toLowerCase().trim();
    const list = this.rows.filter(r => !q ||
      ((r.kode||'') + ' ' + (r.nama||'') + ' ' + (r.telepon||'')).toLowerCase().includes(q)
    );
    const tb = document.getElementById('klBody'); if (!tb) return;
    if (!list.length) {
      tb.innerHTML = `<tr><td colspan="6"><div class="empty-state">
        <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>
        <div class="t">${q ? 'Klien tidak ditemukan' : 'Belum ada data klien'}</div>
        <div class="d">${q ? 'Coba kata kunci lain.' : 'Klik "Tambah Klien" untuk mulai.'}</div>
      </div></td></tr>`;
      return;
    }
    tb.innerHTML = list.map(r => `<tr>
      <td class="td-mono text-gold">${esc(r.kode || '-')}</td>
      <td class="td-bold">${esc(r.nama || '-')}</td>
      <td style="color:var(--ink2)">${esc(r.contact || r.narahubung || '-')}</td>
      <td class="td-mono" style="font-size:12px">${esc(r.telepon || r.phone || '-')}</td>
      <td style="color:var(--ink2);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px">${esc((r.alamat || r.address || '-').replace(/\n/g,', '))}</td>
      <td><div class="row-act">
        <button class="ibtn ibtn-edit" onclick="MasterKlien.openForm('${r.__id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h4L18 10l-4-4L4 16z" stroke-linejoin="round"/><path d="M13 5l4 4" stroke-linecap="round"/></svg></button>
        <button class="ibtn ibtn-del" onclick="MasterKlien.del('${r.__id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </div></td></tr>`).join('');
  },

  openForm(id) {
    this.editingId = id || null;
    document.getElementById('klModalTitle').textContent = id ? 'Edit Klien' : 'Tambah Klien';
    if (id) {
      const r = this.rows.find(x => x.__id === id);
      document.getElementById('klKode').value    = r.kode || '';
      document.getElementById('klNama').value    = r.nama || r.name || '';
      document.getElementById('klAlamat').value  = r.alamat || r.address || '';
      document.getElementById('klContact').value = r.contact || r.narahubung || '';
      document.getElementById('klTelp').value    = r.telepon || r.phone || '';
      document.getElementById('klEmail').value   = r.email || '';
      document.getElementById('klNpwp').value    = r.npwp || '';
    } else {
      ['klKode','klNama','klAlamat','klContact','klTelp','klEmail','klNpwp'].forEach(id => { document.getElementById(id).value = ''; });
    }
    document.getElementById('klModal').classList.add('show');
  },

  closeForm() { document.getElementById('klModal').classList.remove('show'); this.editingId = null; },

  async save() {
    const kode = document.getElementById('klKode').value.trim().toUpperCase();
    const nama = document.getElementById('klNama').value.trim();
    if (!kode) { toast('Kode klien wajib diisi', 'err'); return; }
    if (!nama) { toast('Nama klien wajib diisi', 'err'); return; }
    // check duplicate kode
    const dupCheck = this.rows.find(r => r.kode === kode && r.__id !== this.editingId);
    if (dupCheck) { toast(`Kode "${kode}" sudah dipakai oleh "${dupCheck.nama}"`, 'err'); return; }

    const newId = this.editingId || uid('cl');
    const data = {
      kode, nama,
      alamat:    document.getElementById('klAlamat').value.trim(),
      contact:   document.getElementById('klContact').value.trim(),
      telepon:   document.getElementById('klTelp').value.trim(),
      email:     document.getElementById('klEmail').value.trim(),
      npwp:      document.getElementById('klNpwp').value.trim(),
      // legacy aliases so other modules can read
      name:      nama,
      address:   document.getElementById('klAlamat').value.trim(),
      phone:     document.getElementById('klTelp').value.trim(),
      naraHubung:document.getElementById('klContact').value.trim(),
    };

    if (this.editingId) {
      const idx = this.rows.findIndex(x => x.__id === this.editingId);
      this.rows[idx] = { __id: newId, ...data };
    } else {
      this.rows.unshift({ __id: newId, ...data });
    }

    const btn = document.getElementById('klSaveBtn'); btn.disabled = true;
    try {
      if (sb.ready()) await sb.upsert('mbs_clients', { id: newId, data });
      cache.set('clients', this.rows);
      toast(this.editingId ? 'Klien diperbarui' : `Klien "${nama}" ditambahkan`, 'ok');
      this.closeForm(); this.render();
    } catch(e) {
      cache.set('clients', this.rows);
      toast('Tersimpan lokal — Supabase gagal: ' + e.message, 'err');
      this.closeForm(); this.render();
    } finally { btn.disabled = false; }
  },

  async del(id) {
    const r = this.rows.find(x => x.__id === id); if (!r) return;
    if (!confirm(`Hapus klien "${r.nama}" (${r.kode})?`)) return;
    this.rows = this.rows.filter(x => x.__id !== id);
    try { if (sb.ready()) await sb.remove('mbs_clients', id); } catch(e) { toast('Supabase gagal hapus: ' + e.message, 'err'); }
    cache.set('clients', this.rows); this.render(); toast('Klien dihapus', 'ok');
  }
});
const MasterKlien = pageModules['master-klien'];
