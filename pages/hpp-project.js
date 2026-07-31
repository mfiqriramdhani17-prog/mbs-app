/* ── HPP & Margin Project ── */
registerPage('hpp-project', {
  rows: [], editingId: null, formItems: [], masterProds: [], clients: [],
  CATS: ['Gaji','Sewa','Operasional','Marketing','Lain-lain'],
  STATUSES: ['Pending','Berjalan','Selesai','Batal'],

  async init(el) {
    this.rows = cache.get('hpp_projects');
    this.masterProds = cache.get('products');
    this.clients = cache.get('clients');
    el.innerHTML = this.listHTML();
    await this.load();
  },

  listHTML() {
    return `
    <div id="hppListView">
      <div class="card reveal">
        <div class="toolbar">
          <div class="toolbar-title"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 19V5M4 19h16M8 16l3.5-4 3 2.5L20 8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>Daftar Project</div>
          <div class="search-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4" stroke-linecap="round"/></svg><input id="hppSearch" placeholder="Cari project / klien…" oninput="HppProject.render()"></div>
          <button class="btn btn-ghost" onclick="HppProject.openExport()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 19h14" stroke-linecap="round"/></svg>Export</button>
          <button class="btn btn-gold" onclick="HppProject.newProject()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>Tambah Project</button>
        </div>
        <div class="tbl-wrap">
          <table><thead><tr><th>No</th><th>Tanggal</th><th>Nama Project</th><th>Klien</th><th>Status</th><th class="r">Total Jual</th><th class="r">Total Margin</th><th class="r">Aksi</th></tr></thead>
          <tbody id="hppBody"></tbody></table>
        </div>
      </div>
    </div>
    <div id="hppFormView" class="hidden"></div>
    <!-- Export Modal -->
    <div class="modal-bg" id="hppExportModal">
      <div class="modal">
        <div class="modal-head"><h3>Export Laporan HPP</h3><button class="modal-x" onclick="HppProject.closeExport()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/></svg></button></div>
        <div class="modal-body">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <label style="font-size:11px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;color:var(--ink2)">Pilih Perusahaan</label>
            <div style="display:flex;gap:6px"><button class="btn btn-ghost btn-sm" onclick="HppProject.expAll(true)">Semua</button><button class="btn btn-ghost btn-sm" onclick="HppProject.expAll(false)">Kosongkan</button></div>
          </div>
          <div id="hppExpList" style="display:flex;flex-direction:column;gap:8px;max-height:280px;overflow-y:auto"></div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" onclick="HppProject.exportCSV()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 3h10a1 1 0 011 1v16a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" stroke-linejoin="round"/></svg>CSV / Excel</button>
          <button class="btn btn-gold" onclick="HppProject.exportPDF()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" stroke-linejoin="round"/></svg>PDF</button>
        </div>
      </div>
    </div>`;
  },

  async load() {
    if (!sb.ready()) { this.render(); return; }
    try {
      const [pr, prod, cl] = await Promise.allSettled([sb.select('mbs_hpp_projects'), sb.select('mbs_products'), sb.select('mbs_clients')]);
      if (pr.status==='fulfilled') { this.rows = pr.value.map(r=>r.data).filter(Boolean); cache.set('hpp_projects', this.rows); }
      if (prod.status==='fulfilled') { this.masterProds = prod.value.map(r=>r.data).filter(Boolean); cache.set('products', this.masterProds); }
      if (cl.status==='fulfilled') { this.clients = cl.value.map(r=>({__id:r.id,...(r.data||{})})); cache.set('clients', this.clients); }
      this.render();
    } catch(e) { toast('Supabase: '+e.message,'err'); this.render(); }
  },

  render() {
    const q = (document.getElementById('hppSearch')?.value||'').toLowerCase().trim();
    const list = this.rows.filter(p => !q || ((p.namaProject||'')+' '+(p.namaKlien||'')).toLowerCase().includes(q));
    const tb = document.getElementById('hppBody'); if (!tb) return;
    if (!list.length) { tb.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 19V5M4 19h16M8 16l3.5-4 3 2.5L20 8" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div class="t">${q?'Project tidak ditemukan':'Belum ada project'}</div><div class="d">${q?'Coba kata kunci lain.':'Klik "Tambah Project" untuk mulai.'}</div></div></td></tr>`; return; }
    const stMap = { Selesai:'tag-green', Berjalan:'tag-gold', Pending:'tag-gray', Batal:'tag-red' };
    tb.innerHTML = list.map((p,i) => `<tr>
      <td class="td-mono">${i+1}</td>
      <td>${fmtDate(p.tglMulai||(p.tanggal||'').slice(0,10))}</td>
      <td class="td-bold">${esc(p.namaProject)}</td>
      <td>${esc(p.namaKlien||'-')}</td>
      <td><span class="tag ${stMap[p.status]||'tag-gray'}">${esc(p.status||'Pending')}</span></td>
      <td class="td-r">${rp(p.totalJual)}</td>
      <td class="td-r text-green">${rp(p.totalMargin)}</td>
      <td><div class="row-act">
        <button class="ibtn ibtn-edit" onclick="HppProject.edit('${p.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h4L18 10l-4-4L4 16z" stroke-linejoin="round"/><path d="M13 5l4 4" stroke-linecap="round"/></svg></button>
        <button class="ibtn ibtn-del" onclick="HppProject.del('${p.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </div></td></tr>`).join('');
  },

  showList() {
    document.getElementById('hppListView')?.classList.remove('hidden');
    document.getElementById('hppFormView')?.classList.add('hidden');
    document.getElementById('pageH1').textContent = 'HPP & Margin Project';
    document.getElementById('pageP').textContent = 'Hitung HPP & margin tiap project';
  },
  showForm() {
    document.getElementById('hppListView')?.classList.add('hidden');
    document.getElementById('hppFormView')?.classList.remove('hidden');
    document.getElementById('pageH1').textContent = this.editingId ? 'Edit Project' : 'Tambah Project';
    document.getElementById('pageP').textContent = 'Isi data project & produk';
    window.scrollTo(0,0);
  },

  newProject() {
    this.editingId = null; this.formItems = [this.newItem()];
    this.renderForm();
  },
  edit(id) {
    this.editingId = id;
    const p = this.rows.find(x=>x.id===id); if (!p) return;
    this.formItems = p.items && p.items.length ? JSON.parse(JSON.stringify(p.items)) : [this.newItem()];
    this.renderForm(p);
  },

  renderForm(p) {
    const fv = document.getElementById('hppFormView'); if (!fv) return;
    const clientOpts = '<option value="">— Pilih dari master —</option>' + this.clients.map(c=>{
      const nm = c.nama||c.namaKlien||c.name||c.perusahaan||'(tanpa nama)';
      return `<option value="${c.__id}">${esc((c.kode?c.kode+' — ':'')+nm)}</option>`;
    }).join('');
    fv.innerHTML = `
    <div class="card reveal">
      <div class="card-head"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg></div><h2>Informasi Project</h2></div>
      <div class="card-body">
        <div class="frow c3">
          <div class="field"><label>Pilih Klien (master)</label><select id="hfKlienSel" onchange="HppProject.onPickClient()">${clientOpts}</select></div>
          <div class="field"><label>Kode Klien</label><input id="hfKodeKlien" placeholder="KL001" value="${esc(p?.kodeKlien||'')}"></div>
          <div class="field"><label>Nama Klien</label><input id="hfNamaKlien" placeholder="Nama klien" value="${esc(p?.namaKlien||'')}"></div>
        </div>
        <div class="frow c3">
          <div class="field"><label>Nama Project <span class="req">*</span></label><input id="hfNamaProject" placeholder="Contoh: Seragam Security Batch 1" value="${esc(p?.namaProject||'')}"></div>
          <div class="field"><label>Tanggal Mulai</label><input id="hfTglMulai" type="date" value="${p?.tglMulai||today()}"></div>
          <div class="field"><label>Tanggal Selesai</label><input id="hfTglSelesai" type="date" value="${p?.tglSelesai||''}"></div>
        </div>
        <div class="frow c2">
          <div class="field"><label>Status Project</label>
            <select id="hfStatus">${this.STATUSES.map(s=>`<option ${(p?.status||'Pending')===s?'selected':''}>${s}</option>`).join('')}</select>
          </div>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <div class="card-head"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z" stroke-linejoin="round"/></svg></div><h2>Produk dalam Project</h2></div>
      <div class="card-body">
        <div id="hfProdList"></div>
        <button class="add-prod-btn" onclick="HppProject.addItem()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>Tambah Produk</button>
      </div>
    </div>
    <div class="proj-footer" style="margin-top:16px">
      <div class="pf-item"><div class="k">Total Biaya</div><div class="v" id="hfFtBiaya">Rp 0</div></div>
      <div class="pf-item jual"><div class="k">Total Harga Jual</div><div class="v" id="hfFtJual">Rp 0</div></div>
      <div class="pf-item margin"><div class="k">Total Margin</div><div class="v" id="hfFtMargin">Rp 0</div></div>
      <div class="pf-item pct"><div class="k">% Margin</div><div class="v" id="hfFtPct">0%</div></div>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px;padding:4px">
      <button class="btn btn-ghost" onclick="HppProject.showList()">Batal</button>
      <button class="btn btn-gold" id="hfSaveBtn" onclick="HppProject.save()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3h11l3 3v15H5z" stroke-linejoin="round"/><path d="M8 3v5h7" stroke-linecap="round"/></svg>Simpan Project</button>
    </div>`;
    this.renderItems(); this.showForm();
  },

  onPickClient() {
    const sel = document.getElementById('hfKlienSel'); if (!sel) return;
    const c = this.clients.find(x=>x.__id===sel.value); if (!c) return;
    document.getElementById('hfKodeKlien').value = c.kode||c.kodeKlien||'';
    document.getElementById('hfNamaKlien').value = c.nama||c.namaKlien||c.name||c.perusahaan||'';
  },

  newItem() {
    return { id:uid('it'), masterId:'', sameAsMaster:false, nama:'', tipe:'Pakaian', qty:'',
      kain:{nama:'',total:'',satuan:'meter',hargaSatuan:''}, prod:{aksesoris:'',cmt:'',bordir:'',sablon:'',packing:'',lainnya:''},
      cst:{produksi:'',operasional:'',lainnya:''}, marginMode:'pct', marginPct:'30', hargaJual:'' };
  },

  calcItem(it) {
    let biaya = 0;
    if (it.tipe==='Pakaian') {
      const kainPcs = (parseFloat(it.kain?.total)||0) * (parseNum(it.kain?.hargaSatuan)||0);
      biaya = kainPcs + ['aksesoris','cmt','bordir','sablon','packing','lainnya'].reduce((s,k)=>s+parseNum(it.prod?.[k]),0);
      it._kainPcs = kainPcs;
    } else {
      biaya = parseNum(it.cst?.produksi) + parseNum(it.cst?.operasional) + parseNum(it.cst?.lainnya);
    }
    const qty = parseInt(it.qty)||0;
    const pct = parseFloat(it.marginPct)||0;
    const jual = it.marginMode==='jual' ? parseNum(it.hargaJual) : biaya*(1+pct/100);
    const realPct = biaya>0 ? (jual/biaya-1)*100 : 0;
    return { biaya, jual, pct:realPct, marginPcs:jual-biaya, qty, totalJual:jual*qty, totalMargin:(jual-biaya)*qty, totalBiaya:biaya*qty };
  },

  renderItems() {
    const wrap = document.getElementById('hfProdList'); if (!wrap) return;
    wrap.innerHTML = this.formItems.map((it,i) => this.itemCard(it,i)).join('');
    this.recalc();
  },

  itemCard(it, i) {
    const masterOpts = '<option value="">— Manual / pilih master —</option>' +
      this.masterProds.map(p=>`<option value="${p.id}" ${it.masterId===p.id?'selected':''}>${esc(p.kode)} — ${esc(p.nama)}</option>`).join('');
    const isPakaian = it.tipe==='Pakaian';
    const costBlock = isPakaian ? `
      <div class="sub-head"><span>Komponen Kain</span><span class="ln"></span></div>
      <div class="frow c5">
        <div class="field"><label>Nama Kain</label><input value="${esc(it.kain?.nama)}" placeholder="Polyester" oninput="HppProject.setIt(${i},'kain.nama',this.value)"></div>
        <div class="field"><label>Total Kain/Pakaian</label><input value="${esc(it.kain?.total)}" inputmode="decimal" placeholder="0.8" oninput="HppProject.setIt(${i},'kain.total',this.value)"></div>
        <div class="field"><label>Satuan</label><select onchange="HppProject.setIt(${i},'kain.satuan',this.value)">${['meter','yard','kg','roll','pcs'].map(s=>`<option ${it.kain?.satuan===s?'selected':''}>${s}</option>`).join('')}</select></div>
        <div class="field"><label>Harga / Satuan</label><input value="${it.kain?.hargaSatuan?Number(it.kain.hargaSatuan).toLocaleString('id-ID'):''}" inputmode="numeric" placeholder="0" oninput="HppProject.setMoney(${i},'kain.hargaSatuan',this)"></div>
        <div class="field"><label>Harga Kain/Pcs</label><input class="auto" id="hf-kainpcs-${i}" value="Rp 0" readonly></div>
      </div>
      <div class="sub-head"><span>Komponen Produksi</span><span class="ln"></span></div>
      <div class="frow c3">
        ${['aksesoris','cmt','bordir','sablon','packing','lainnya'].map(k=>`<div class="field"><label>${k.charAt(0).toUpperCase()+k.slice(1)}</label><input value="${it.prod?.[k]?Number(it.prod[k]).toLocaleString('id-ID'):''}" inputmode="numeric" placeholder="0" oninput="HppProject.setMoney(${i},'prod.${k}',this)"></div>`).join('')}
      </div>` : `
      <div class="sub-head"><span>Komponen Biaya</span><span class="ln"></span></div>
      <div class="frow c3">
        ${[['produksi','Total Biaya Produksi'],['operasional','Biaya Operasional'],['lainnya','Biaya Lainnya']].map(([k,l])=>`<div class="field"><label>${l}</label><input value="${it.cst?.[k]?Number(it.cst[k]).toLocaleString('id-ID'):''}" inputmode="numeric" placeholder="0" oninput="HppProject.setMoney(${i},'cst.${k}',this)"></div>`).join('')}
      </div>`;
    const sameChk = it.masterId ? `<label class="chk-row"><input type="checkbox" ${it.sameAsMaster?'checked':''} onchange="HppProject.setSame(${i},this.checked)">Harga jual sama dengan Master Produk</label>` : '';
    return `<div class="prod-card open" id="hf-card-${i}">
      <div class="pc-head" onclick="HppProject.toggleCard(event,${i})">
        <span class="pc-num">Produk #${i+1}</span>
        <span class="pc-name" id="hf-pname-${i}">${esc(it.nama||'Produk Baru')}</span>
        <span class="pc-sum" id="hf-psum-${i}"></span>
        <button class="pc-del" onclick="HppProject.delItem(event,${i})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13" stroke-linecap="round" stroke-linejoin="round"/></svg>Hapus</button>
        <svg class="pc-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 9l6 6 6-6" stroke-linecap="round"/></svg>
      </div>
      <div class="pc-body"><div class="pc-inner">
        <div class="frow c4">
          <div class="field"><label>Ambil dari Master</label><select onchange="HppProject.pickMaster(${i},this.value)">${masterOpts}</select></div>
          <div class="field"><label>Nama Produk <span class="req">*</span></label><input value="${esc(it.nama)}" placeholder="Nama produk" oninput="HppProject.setIt(${i},'nama',this.value);document.getElementById('hf-pname-${i}').textContent=this.value||'Produk Baru'"></div>
          <div class="field"><label>Tipe Produk</label><select onchange="HppProject.setTipe(${i},this.value)">${['Pakaian','Percetakan','Produk Lainnya','Custom'].map(t=>`<option ${it.tipe===t?'selected':''}>${t}</option>`).join('')}</select></div>
          <div class="field"><label>Qty (Pcs)</label><input value="${esc(it.qty)}" inputmode="numeric" placeholder="0" oninput="HppProject.setIt(${i},'qty',this.value.replace(/[^0-9]/g,''));HppProject.recalc()"></div>
        </div>
        ${sameChk}${costBlock}
        <div class="sub-head"><span>Pengaturan Margin</span><span class="ln"></span></div>
        <div class="mtoggle">
          <button class="${it.marginMode!=='jual'?'on':''}" onclick="HppProject.setMode(${i},'pct')">Mode: Input Margin %</button>
          <button class="${it.marginMode==='jual'?'on':''}" onclick="HppProject.setMode(${i},'jual')">Mode: Input Harga Jual</button>
        </div>
        <div class="frow c2">
          <div class="field"><label>Margin (%)</label><input id="hf-mpct-${i}" value="${it.marginPct}" inputmode="decimal" placeholder="30" ${it.marginMode==='jual'?'class="auto" readonly':''} oninput="HppProject.setIt(${i},'marginPct',this.value);HppProject.recalc()"></div>
          <div class="field"><label>Harga Jual / Pcs</label><input id="hf-mjual-${i}" value="${it.marginMode==='jual'&&it.hargaJual?Number(it.hargaJual).toLocaleString('id-ID'):''}" inputmode="numeric" placeholder="0" ${it.marginMode!=='jual'?'class="auto" readonly':''} oninput="HppProject.setMoney(${i},'hargaJual',this)"></div>
        </div>
        <div class="hasil-wrap">
          <div class="hasil-grid">
            <div class="hcell"><div class="k">Biaya Produksi/Pcs</div><div class="v" id="hf-r-bp-${i}">Rp 0</div></div>
            <div class="hcell"><div class="k">Harga Jual/Pcs</div><div class="v" id="hf-r-hj-${i}">Rp 0</div></div>
            <div class="hcell"><div class="k">Margin/Pcs</div><div class="v" id="hf-r-mp-${i}">Rp 0</div></div>
            <div class="hcell gold"><div class="k">Total Harga Jual</div><div class="v" id="hf-r-tj-${i}">Rp 0</div></div>
            <div class="hcell gold"><div class="k">Total Margin</div><div class="v" id="hf-r-tm-${i}">Rp 0</div></div>
            <div class="hcell"><div class="k">% Margin</div><div class="v" id="hf-r-pct-${i}">0%</div></div>
          </div>
        </div>
      </div></div>
    </div>`;
  },

  setIt(i, path, val) { const it=this.formItems[i]; if(path.includes('.')){const[a,b]=path.split('.');it[a][b]=val;}else it[path]=val; this.recalc(); },
  setMoney(i, path, el) { const v=onlyNum(el.value); el.value=v?'Rp '+Number(v).toLocaleString('id-ID'):''; this.setIt(i,path,v); },
  setTipe(i,t) { this.formItems[i].tipe=t; this.renderItems(); },
  setMode(i,m) { this.formItems[i].marginMode=m; this.renderItems(); },
  setSame(i,on) { const it=this.formItems[i]; it.sameAsMaster=on; if(on&&it.masterId){const m=this.masterProds.find(p=>p.id===it.masterId); if(m){it.marginMode='jual';it.hargaJual=m.jual||0;}} this.renderItems(); },
  pickMaster(i,id) { const it=this.formItems[i]; it.masterId=id; if(id){const m=this.masterProds.find(p=>p.id===id); if(m){it.nama=m.nama; if(it.sameAsMaster){it.marginMode='jual';it.hargaJual=m.jual||0;}}} this.renderItems(); },
  toggleCard(e,i) { if(e.target.closest('.pc-del'))return; document.getElementById('hf-card-'+i)?.classList.toggle('open'); },
  addItem() { this.formItems.push(this.newItem()); this.renderItems(); document.querySelector('#hfProdList .prod-card:last-child')?.scrollIntoView({behavior:'smooth',block:'center'}); },
  delItem(e,i) { e.stopPropagation(); if(this.formItems.length<=1){toast('Minimal satu produk','err');return;} this.formItems.splice(i,1); this.renderItems(); },

  recalc() {
    let tB=0,tJ=0,tM=0;
    this.formItems.forEach((it,i) => {
      const c = this.calcItem(it);
      tB+=c.totalBiaya; tJ+=c.totalJual; tM+=c.totalMargin;
      const s = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
      s('hf-r-bp-'+i,rp(c.biaya)); s('hf-r-hj-'+i,rp(c.jual)); s('hf-r-mp-'+i,rp(c.marginPcs));
      s('hf-r-tj-'+i,rp(c.totalJual)); s('hf-r-tm-'+i,rp(c.totalMargin));
      s('hf-r-pct-'+i, Math.round(c.pct)+'%');
      if(it.tipe==='Pakaian'){const el=document.getElementById('hf-kainpcs-'+i);if(el)el.value=rp(it._kainPcs||0);}
      if(it.marginMode==='jual'){const e=document.getElementById('hf-mpct-'+i);if(e)e.value=Math.round(c.pct*10)/10;}
      else{const e=document.getElementById('hf-mjual-'+i);if(e)e.value=rp(c.jual);}
      const ps=document.getElementById('hf-psum-'+i);if(ps)ps.innerHTML=c.qty?`×${c.qty} · <b>${rp(c.totalMargin)}</b>`:'';
    });
    const s2=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
    s2('hfFtBiaya',rp(tB));s2('hfFtJual',rp(tJ));s2('hfFtMargin',rp(tM));
    const pct=document.getElementById('hfFtPct');if(pct)pct.textContent=(tJ>0?Math.round(tM/tJ*100):0)+'%';
  },

  async save() {
    const namaProject = document.getElementById('hfNamaProject')?.value.trim();
    if (!namaProject) { toast('Nama project wajib diisi','err'); return; }
    let tB=0,tJ=0,tM=0;
    this.formItems.forEach(it=>{const c=this.calcItem(it);tB+=c.totalBiaya;tJ+=c.totalJual;tM+=c.totalMargin;});
    const proj = { id:this.editingId||uid('hpp'), kodeKlien:document.getElementById('hfKodeKlien')?.value.trim(), namaKlien:document.getElementById('hfNamaKlien')?.value.trim(), namaProject, tglMulai:document.getElementById('hfTglMulai')?.value, tglSelesai:document.getElementById('hfTglSelesai')?.value, status:document.getElementById('hfStatus')?.value||'Pending', items:this.formItems, totalBiaya:tB, totalJual:tJ, totalMargin:tM, tanggal:this.editingId?(this.rows.find(p=>p.id===this.editingId)?.tanggal||new Date().toISOString()):new Date().toISOString() };
    if (this.editingId) { const idx=this.rows.findIndex(p=>p.id===this.editingId); this.rows[idx]=proj; }
    else this.rows.unshift(proj);
    const btn=document.getElementById('hfSaveBtn'); btn.disabled=true;
    try { if(sb.ready()) await sb.upsert('mbs_hpp_projects',{id:proj.id,data:proj}); cache.set('hpp_projects',this.rows); toast(this.editingId?'Project diperbarui':'Project disimpan','ok'); this.showList(); this.render(); }
    catch(e) { cache.set('hpp_projects',this.rows); toast('Tersimpan lokal — Supabase gagal: '+e.message,'err'); this.showList(); this.render(); }
    finally { btn.disabled=false; }
  },

  async del(id) {
    const p=this.rows.find(x=>x.id===id); if(!p) return;
    if(!confirm(`Hapus project "${p.namaProject}"?`)) return;
    this.rows=this.rows.filter(x=>x.id!==id);
    try { if(sb.ready()) await sb.remove('mbs_hpp_projects',id); } catch(e) { toast('Supabase gagal hapus: '+e.message,'err'); }
    cache.set('hpp_projects',this.rows); this.render(); toast('Project dihapus','ok');
  },

  /* ── EXPORT ── */
  distinctCompanies() { return [...new Set(this.rows.map(p=>p.namaKlien||'(Tanpa Klien)'))].sort(); },
  openExport() {
    if (!this.rows.length) { toast('Belum ada project','err'); return; }
    document.getElementById('hppExpList').innerHTML = this.distinctCompanies().map(c=>`<label style="display:flex;align-items:center;gap:9px;font-size:13px;font-weight:600;background:#FAF7F1;border:1px solid var(--line);border-radius:10px;padding:10px 12px;cursor:pointer"><input type="checkbox" value="${esc(c)}" checked style="width:16px;height:16px;accent-color:var(--gold)"> ${esc(c)}</label>`).join('');
    document.getElementById('hppExportModal').classList.add('show');
  },
  closeExport() { document.getElementById('hppExportModal').classList.remove('show'); },
  expAll(on) { document.querySelectorAll('#hppExpList input').forEach(i=>i.checked=on); },
  selectedCompanies() { return [...document.querySelectorAll('#hppExpList input:checked')].map(i=>i.value); },
  gatherExport() {
    const comps=this.selectedCompanies();
    if (!comps.length) { toast('Pilih minimal satu perusahaan','err'); return null; }
    const out=[];
    comps.forEach(co=>this.rows.filter(p=>(p.namaKlien||'(Tanpa Klien)')===co).forEach(p=>{
      out.push({ company:co, project:p.namaProject, status:p.status||'Pending', items:(p.items||[]).map(it=>{
        const c=this.calcItem(it);
        const vendorPcs=it.tipe==='Pakaian'?c.biaya:parseNum(it.cst?.produksi);
        const selain=it.tipe==='Pakaian'?0:(parseNum(it.cst?.operasional)+parseNum(it.cst?.lainnya));
        return {nama:it.nama||'-',qty:c.qty,vendorPcs,klienPcs:c.jual,totalSelain:selain*c.qty,totalMargin:c.totalMargin};
      })});
    }));
    if (!out.length) { toast('Tidak ada project di perusahaan terpilih','err'); return null; }
    return out;
  },
  exportCSV() {
    const data=this.gatherExport(); if(!data) return;
    const rows=[['No','Nama Perusahaan','Project','Status','Produk','Total Order','Harga Satuan Vendor','Harga Satuan Klien','Total Biaya (selain produksi)','Total Margin']];
    let no=0;
    data.forEach(r=>{no++;(r.items.length?r.items:[{nama:'(tanpa produk)',qty:0,vendorPcs:0,klienPcs:0,totalSelain:0,totalMargin:0}]).forEach((it,idx)=>{
      rows.push([idx===0?no:'',idx===0?r.company:'',idx===0?r.project:'',idx===0?r.status:'',it.nama,it.qty,Math.round(it.vendorPcs),Math.round(it.klienPcs),Math.round(it.totalSelain),Math.round(it.totalMargin)]);
    });});
    downloadCSV(rows,'Laporan_HPP_'+today()+'.csv');
    this.closeExport(); toast('CSV diunduh','ok');
  },
  exportPDF() {
    const data=this.gatherExport(); if(!data) return;
    const byCo={};data.forEach(r=>{(byCo[r.company]=byCo[r.company]||[]).push(r);});
    let body='',no=0,gJual=0,gMargin=0;
    Object.keys(byCo).forEach(co=>{
      body+=`<h2 class="co">${esc(co)}</h2>`;
      byCo[co].forEach(r=>{
        no++;let pj=0;
        const rh=r.items.map(it=>{gJual+=it.klienPcs*it.qty;gMargin+=it.totalMargin;pj+=it.totalMargin;return `<tr><td>${esc(it.nama)}</td><td class="r">${it.qty}</td><td class="r">${rp(it.vendorPcs)}</td><td class="r">${rp(it.klienPcs)}</td><td class="r">${rp(it.totalSelain)}</td><td class="r">${rp(it.totalMargin)}</td></tr>`;}).join('');
        body+=`<div class="pjh"><span class="pno">No. ${no}</span><span>${esc(co)}</span><span>· <b>${esc(r.project)}</b></span><span class="ps">${esc(r.status)}</span></div>
        <table class="sub"><thead><tr><th>Produk</th><th class="r">Total Order</th><th class="r">H. Satuan Vendor</th><th class="r">H. Satuan Klien</th><th class="r">Total Biaya (selain prod.)</th><th class="r">Total Margin</th></tr></thead>
        <tbody>${rh}<tr class="tot"><td colspan="5">Total Margin Project</td><td class="r">${rp(pj)}</td></tr></tbody></table>`;
      });
    });
    printHTML(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Laporan HPP</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;color:#221F1A;padding:20px;font-size:12px}.head{border-bottom:2px solid #221F1A;padding-bottom:10px;margin-bottom:12px;display:flex;justify-content:space-between}.head h1{font-size:17px}.logo{font-weight:800;font-size:18px;color:#A87E1C}h2.co{font-size:13px;margin:16px 0 4px;color:#A87E1C;border-left:4px solid #C79A2E;padding-left:8px}.pjh{display:flex;gap:12px;flex-wrap:wrap;align-items:center;background:#FAF4E6;border:1px solid #EAD9A6;border-radius:6px;padding:7px 11px;margin-top:10px;font-size:11px}.pno{font-weight:bold;background:#211F1C;color:#fff;padding:2px 9px;border-radius:10px}.ps{margin-left:auto;font-weight:bold;color:#A87E1C}table.sub{width:100%;border-collapse:collapse;margin:5px 0}table.sub th{background:#211F1C;color:#C79A2E;font-size:9.5px;text-transform:uppercase;text-align:left;padding:6px 8px}table.sub th.r,table.sub td.r{text-align:right}table.sub td{padding:6px 8px;border-bottom:1px solid #eee;font-size:11px}table.sub tr.tot td{font-weight:bold;background:#FBF8F2;border-top:1px solid #ccc}.grand{margin-top:14px;text-align:right;font-weight:bold;font-size:13px;border-top:2px solid #221F1A;padding-top:10px}.mg{color:#15824A}@page{margin:12mm}</style></head><body>
    <div class="head"><div><h1>Laporan HPP &amp; Margin Project</h1><div style="font-size:11px;color:#777;margin-top:2px">${data.length} project · ${Object.keys(byCo).length} perusahaan · ${new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'})}</div></div><div class="logo">${esc(mbsSettings.namaPerusahaan)}</div></div>
    ${body}<div class="grand">Total Harga Jual: ${rp(gJual)} &nbsp;·&nbsp; <span class="mg">Total Margin: ${rp(gMargin)}</span></div>
    </body></html>`);
    this.closeExport();
  }
});
const HppProject = pageModules['hpp-project'];
