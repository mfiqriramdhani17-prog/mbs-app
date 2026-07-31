/* ── Pengaturan ── */
registerPage('pengaturan', {
  async init(el) {
    // Always load latest settings from Supabase first
    await loadSettingsFromSupabase();
    // ensure ttdList has all 4 slots
    if (!mbsSettings.ttdList || !Array.isArray(mbsSettings.ttdList) || mbsSettings.ttdList.length < 4) {
      const existing = Array.isArray(mbsSettings.ttdList) ? mbsSettings.ttdList : [];
      const defaults = [
        { label:'Admin',            nama: mbsSettings.namaTtd||'', jabatan: mbsSettings.jabatanTtd||'Admin', img: mbsSettings.ttd||'' },
        { label:'Manajer Marketing', nama:'', jabatan:'Manajer Marketing', img:'' },
        { label:'Direktur',          nama:'', jabatan:'Direktur', img:'' },
        { label:'Custom',            nama:'', jabatan:'', img:'' },
      ];
      mbsSettings.ttdList = defaults.map((d, i) => existing[i] ? { ...d, ...existing[i] } : d);
    }
    el.innerHTML = `
    <div class="settings-grid reveal">

      <!-- Koneksi Supabase -->
      <div class="card" style="grid-column:1/-1">
        <div class="card-head"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" stroke-linejoin="round"/><circle cx="12" cy="12" r="1.5"/></svg></div><h2>Koneksi Supabase</h2></div>
        <div class="card-body">
          <div class="frow c2">
            <div class="field"><label>API URL</label><input id="sUrl" placeholder="https://xxxx.supabase.co" value="${esc(SUPABASE_URL)}"></div>
            <div class="field"><label>API Key</label><input id="sKey" type="password" placeholder="eyJ… atau sb_publishable_…" value="${esc(SUPABASE_KEY)}"></div>
          </div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-gold" onclick="saveSupabase()">Simpan &amp; Tes Koneksi</button>
            <span id="sbTestResult" style="font-size:12.5px;font-weight:600"></span>
          </div>
        </div>
      </div>

      <!-- Identitas Perusahaan -->
      <div class="card">
        <div class="card-head"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke-linejoin="round"/></svg></div><h2>Identitas Perusahaan</h2></div>
        <div class="card-body">
          <div class="frow"><div class="field"><label>Nama Perusahaan</label><input id="sNama" value="${esc(mbsSettings.namaPerusahaan)}"></div></div>
          <div class="frow"><div class="field"><label>Tagline</label><input id="sTagline" value="${esc(mbsSettings.tagline)}"></div></div>
          <div class="frow"><div class="field"><label>Alamat</label><textarea id="sAlamat" rows="2">${esc(mbsSettings.alamat)}</textarea></div></div>
          <div class="frow c2">
            <div class="field"><label>Telepon</label><input id="sTelp" value="${esc(mbsSettings.telepon)}"></div>
            <div class="field"><label>Email</label><input id="sEmail" value="${esc(mbsSettings.email)}"></div>
          </div>
          <div class="frow c2">
            <div class="field"><label>NPWP</label><input id="sNpwp" value="${esc(mbsSettings.npwp)}" placeholder="00.000.000.0-000.000"></div>
            <div class="field"><label>Status PKP</label>
              <select id="sPkp"><option value="true" ${mbsSettings.isPkp?'selected':''}>PKP</option><option value="false" ${!mbsSettings.isPkp?'selected':''}>Non-PKP</option></select>
            </div>
          </div>
          <button class="btn btn-gold" onclick="saveIdentitas()">Simpan Identitas</button>
        </div>
      </div>

      <!-- Logo -->
      <div class="card">
        <div class="card-head"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M21 16l-5-5L5 20" stroke-linecap="round"/></svg></div><h2>Logo Perusahaan</h2></div>
        <div class="card-body">
          <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px">
            <div class="logo-box" id="logoBox" onclick="document.getElementById('logoFile').click()">
              ${mbsSettings.logo ? `<img src="${mbsSettings.logo}">` : `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M21 16l-5-5L5 20" stroke-linecap="round"/></svg>`}
            </div>
            <div style="font-size:12.5px;color:var(--ink2)">Klik untuk upload logo<br><button style="font-size:12px;color:var(--red);background:none;border:none;cursor:pointer;margin-top:4px" onclick="clearLogo()">Hapus logo</button></div>
          </div>
          <input type="file" id="logoFile" accept="image/*" style="display:none" onchange="onLogoFile(this)">
          <button class="btn btn-gold" onclick="saveLogo()">Simpan Logo</button>
        </div>
      </div>

      <!-- Tanda Tangan (4 slot) -->
      <div class="card" style="grid-column:1/-1">
        <div class="card-head"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M3 17c3.5-2 6-5 9-8 1.5-1.5 3 0 2 2-1.5 3-4 5-3 7 .5 1 2 .5 3-1 2-3 4-8 6-10" stroke-linecap="round"/></svg></div><h2>Tanda Tangan</h2><span style="font-size:12px;color:var(--ink2);margin-left:4px">— hingga 4 penandatangan, bisa dipilih per dokumen</span></div>
        <div class="card-body">
          <div id="ttdGrid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px"></div>
          <button class="btn btn-gold" style="margin-top:16px" onclick="saveTtd()">Simpan Tanda Tangan</button>
        </div>
      </div>

      <!-- Rekening Bank -->
      <div class="card">
        <div class="card-head"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M3 9l9-7 9 7v2H3V9z" stroke-linejoin="round"/><path d="M5 11v7M9 11v7M15 11v7M19 11v7M3 18h18" stroke-linecap="round"/></svg></div><h2>Rekening Bank</h2></div>
        <div class="card-body">
          <div id="bankList"></div>
          <button class="add-bank-btn" onclick="addBank()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>Tambah Rekening
          </button>
          <button class="btn btn-gold" style="margin-top:14px" onclick="saveBanks()">Simpan Rekening</button>
        </div>
      </div>

    </div>`;

    renderBanks();
    renderTtdGrid();
  }
});

function renderTtdGrid() {
  const grid = document.getElementById('ttdGrid'); if (!grid) return;
  const list = mbsSettings.ttdList || [];
  const LABELS = ['Admin','Manajer Marketing','Direktur','Custom'];
  grid.innerHTML = list.map((t, i) => `
    <div style="border:1.5px solid var(--line);border-radius:14px;padding:14px">
      <div style="font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--gold-deep);margin-bottom:10px">${LABELS[i]||'Slot '+(i+1)}</div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:10px">
        <div class="ttd-box" onclick="document.getElementById('ttdFile'+${i}+'').click()" style="cursor:pointer">
          ${t.img ? `<img src="${t.img}" style="width:100%;height:100%;object-fit:contain">` : `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 17c3.5-2 6-5 9-8 1.5-1.5 3 0 2 2-1.5 3-4 5-3 7 .5 1 2 .5 3-1 2-3 4-8 6-10" stroke-linecap="round"/></svg>`}
        </div>
        <button style="font-size:11px;color:var(--red);background:none;border:none;cursor:pointer" onclick="clearTtdSlot(${i})">Hapus TTD</button>
      </div>
      <input type="file" id="ttdFile${i}" accept="image/*" style="display:none" onchange="onTtdSlot(${i},this)">
      <div class="field" style="margin-bottom:8px"><label>Nama</label><input value="${esc(t.nama||'')}" oninput="mbsSettings.ttdList[${i}].nama=this.value"></div>
      <div class="field"><label>Jabatan</label><input value="${esc(t.jabatan||'')}" placeholder="${LABELS[i]||'Jabatan'}" oninput="mbsSettings.ttdList[${i}].jabatan=this.value"></div>
    </div>`).join('');
}

async function onTtdSlot(i, input) {
  const f = input.files[0]; if (!f) return;
  const b64 = await compressImage(f, 500, 0.88);
  mbsSettings.ttdList[i].img = b64;
  renderTtdGrid(); input.value = '';
}
function clearTtdSlot(i) { mbsSettings.ttdList[i].img = ''; renderTtdGrid(); }
function saveTtd() {
  saveSettings({ ttdList: mbsSettings.ttdList,
    // keep legacy fields in sync with slot 0
    namaTtd: mbsSettings.ttdList[0]?.nama||'', jabatanTtd: mbsSettings.ttdList[0]?.jabatan||'', ttd: mbsSettings.ttdList[0]?.img||''
  });
  updateTopbar(); toast('Tanda tangan disimpan','ok');
}

function renderBanks() {
  const list = document.getElementById('bankList'); if (!list) return;
  const banks = mbsSettings.banks || [];
  if (!banks.length) { list.innerHTML = '<p style="font-size:12.5px;color:var(--ink2);margin-bottom:12px">Belum ada rekening.</p>'; return; }
  list.innerHTML = banks.map((b,i) => `
    <div class="bank-card" style="margin-bottom:12px">
      <button class="ibtn ibtn-del bank-del" onclick="delBank(${i})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <div class="frow c3">
        <div class="field"><label>Nama Bank</label><input value="${esc(b.bank)}" oninput="mbsSettings.banks[${i}].bank=this.value" placeholder="BCA / Mandiri…"></div>
        <div class="field"><label>No. Rekening</label><input value="${esc(b.norek)}" oninput="mbsSettings.banks[${i}].norek=this.value"></div>
        <div class="field"><label>Atas Nama</label><input value="${esc(b.atas)}" oninput="mbsSettings.banks[${i}].atas=this.value"></div>
      </div>
    </div>`).join('');
}
function addBank() { mbsSettings.banks = mbsSettings.banks || []; mbsSettings.banks.push({bank:'',norek:'',atas:''}); renderBanks(); }
function delBank(i) { mbsSettings.banks.splice(i,1); renderBanks(); }

async function saveSupabase() {
  const url=document.getElementById('sUrl').value.trim(), key=document.getElementById('sKey').value.trim();
  if(!url||!key){toast('URL dan Key wajib diisi','err');return;}
  SUPABASE_URL=url; SUPABASE_KEY=key;
  localStorage.setItem('mbs_sb_url',url); localStorage.setItem('mbs_sb_key',key);
  const res=document.getElementById('sbTestResult'); res.textContent='Menguji…'; res.style.color='var(--ink2)';
  try {
    const r=await fetch(`${url}/rest/v1/mbs_settings?select=id&limit=1`,{headers:sb._h()});
    if(!r.ok) throw new Error('HTTP '+r.status+' — '+(await r.text()).slice(0,100));
    res.textContent='✓ Tersambung!'; res.style.color='var(--green)';
    setDbStatus('ok','Supabase ✓'); toast('Koneksi berhasil','ok');
  } catch(e){ res.textContent='✗ '+e.message; res.style.color='var(--red)'; setDbStatus('err','Supabase ✗'); toast('Gagal: '+e.message,'err'); }
}
function saveIdentitas() {
  saveSettings({ namaPerusahaan:document.getElementById('sNama').value.trim(), tagline:document.getElementById('sTagline').value.trim(), alamat:document.getElementById('sAlamat').value.trim(), telepon:document.getElementById('sTelp').value.trim(), email:document.getElementById('sEmail').value.trim(), npwp:document.getElementById('sNpwp').value.trim(), isPkp:document.getElementById('sPkp').value==='true' });
  updateTopbar(); toast('Identitas disimpan','ok');
}
async function onLogoFile(input) {
  const f=input.files[0]; if(!f) return;
  // Always use PNG for logo to preserve transparency
  const b64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let {width:w, height:h} = img;
        const maxPx = 400;
        if (w > h && w > maxPx) { h = h*maxPx/w; w = maxPx; }
        else if (h > maxPx) { w = w*maxPx/h; h = maxPx; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(f);
  }); saveSettings({logo:b64}); const box=document.getElementById('logoBox'); if(box) box.innerHTML=`<img src="${b64}">`; }
function clearLogo() { saveSettings({logo:''}); const b=document.getElementById('logoBox'); if(b) b.innerHTML=`<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M21 16l-5-5L5 20" stroke-linecap="round"/></svg>`; }
function saveLogo() { toast('Logo disimpan','ok'); }
function saveBanks() { saveSettings({banks:mbsSettings.banks}); toast('Rekening disimpan','ok'); }
/* helper: get TTD slot for documents */
function getTtdSlots() { return mbsSettings.ttdList || [{ label:'Penandatangan', nama:mbsSettings.namaTtd||'', jabatan:mbsSettings.jabatanTtd||'', img:mbsSettings.ttd||'' }]; }
