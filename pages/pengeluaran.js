/* ── Pengeluaran ── */
registerPage('pengeluaran', {
  rows: [], editingId: null,
  CATS: ['Gaji','Sewa','Operasional','Marketing','Lain-lain'],
  CATCLR: { Gaji:['#E5EDF6','#2F6DB0'], Sewa:['#EFE7F6','#7A4FB0'], Operasional:['#F6ECD2','#A87E1C'], Marketing:['#E4F1E9','#15824A'], 'Lain-lain':['#EFE8DB','#8C8676'] },

  async init(el) {
    this.rows = cache.get('pengeluaran');
    el.innerHTML = this.html();
    this.buildFilters(); this.render();
    await this.load();
  },

  html() {
    return `
    <div class="sum-row reveal">
      <div class="card sum-card">
        <div class="lbl">Total Pengeluaran <span id="pngScope">(semua)</span></div>
        <div class="big text-red mono" id="pngTotal">Rp 0</div>
        <div class="sub" id="pngCount">0 transaksi</div>
      </div>
      <div class="card" style="padding:16px 18px">
        <div style="font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--ink2);margin-bottom:12px">Rincian per Kategori</div>
        <div class="cat-list" id="pngCatList"></div>
      </div>
    </div>
    <div class="card reveal" style="animation-delay:.1s">
      <div class="toolbar">
        <div class="toolbar-title"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="9"/><path d="M12 7v10" stroke-linecap="round"/></svg></span>Daftar Pengeluaran</div>
        <select class="fsel" id="pngPeriod" onchange="Pengeluaran.render()"></select>
        <select class="fsel" id="pngCat" onchange="Pengeluaran.render()"><option value="">Semua kategori</option></select>
        <div class="search-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4" stroke-linecap="round"/></svg><input id="pngSearch" placeholder="Cari keterangan…" oninput="Pengeluaran.render()"></div>
        <button class="btn btn-ghost" onclick="Pengeluaran.openExport()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 19h14" stroke-linecap="round"/></svg>Export</button>
        <button class="btn btn-gold" onclick="Pengeluaran.openForm()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>Tambah</button>
      </div>
      <div class="tbl-wrap">
        <table><thead><tr><th>No</th><th>Tanggal</th><th>Kategori</th><th>Keterangan</th><th class="r">Nominal</th><th class="r">Aksi</th></tr></thead>
        <tbody id="pngBody"></tbody><tfoot id="pngFoot"></tfoot></table>
      </div>
    </div>
    <!-- modal form -->
    <div class="modal-bg" id="pngModal">
      <div class="modal">
        <div class="modal-head"><h3 id="pngModalTitle">Tambah Pengeluaran</h3><button class="modal-x" onclick="Pengeluaran.closeForm()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/></svg></button></div>
        <div class="modal-body">
          <div class="frow c2">
            <div class="field"><label>Tanggal <span class="req">*</span></label><input id="pngTgl" type="date"></div>
            <div class="field"><label>Kategori</label><select id="pngKat">${this.CATS.map(c=>`<option>${c}</option>`).join('')}</select></div>
          </div>
          <div class="frow"><div class="field"><label>Nominal <span class="req">*</span></label><input id="pngNom" inputmode="numeric" placeholder="0" oninput="fmtInput(this)"></div></div>
          <div class="frow"><div class="field"><label>Keterangan</label><textarea id="pngKet" placeholder="Gaji karyawan Juni / Bayar sewa…"></textarea></div></div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" onclick="Pengeluaran.closeForm()">Batal</button>
          <button class="btn btn-gold" id="pngSaveBtn" onclick="Pengeluaran.save()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3h11l3 3v15H5z" stroke-linejoin="round"/><path d="M8 3v5h7" stroke-linecap="round"/></svg>Simpan</button>
        </div>
      </div>
    </div>
    <!-- modal export -->
    <div class="modal-bg" id="pngExpModal">
      <div class="modal">
        <div class="modal-head"><h3>Export Pengeluaran</h3><button class="modal-x" onclick="Pengeluaran.closeExport()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/></svg></button></div>
        <div class="modal-body"><p style="font-size:13px;color:var(--ink2)">Mengekspor data: <b id="pngExpScope" style="color:var(--ink)"></b></p></div>
        <div class="modal-foot">
          <button class="btn btn-ghost" onclick="Pengeluaran.exportCSV()">CSV / Excel</button>
          <button class="btn btn-gold" onclick="Pengeluaran.exportPDF()">PDF</button>
        </div>
      </div>
    </div>`;
  },

  async load() {
    if (!sb.ready()) return;
    try { const res=await sb.select('mbs_pengeluaran'); this.rows=res.map(r=>r.data).filter(Boolean); cache.set('pengeluaran',this.rows); this.buildFilters(); this.render(); }
    catch(e) { toast('Supabase: '+e.message,'err'); }
  },

  buildFilters() {
    const months=[...new Set(this.rows.map(r=>(r.tanggal||'').slice(0,7)).filter(Boolean))].sort().reverse();
    const cur=new Date().toISOString().slice(0,7);
    const sel=document.getElementById('pngPeriod'); if(!sel) return;
    const prev=sel.value;
    sel.innerHTML='<option value="">Semua periode</option>'+months.map(m=>`<option value="${m}">${monthLabel(m)}</option>`).join('');
    sel.value=(prev&&[...sel.options].some(o=>o.value===prev))?prev:(months.includes(cur)?cur:'');
    const cs=document.getElementById('pngCat'); const pc=cs?.value;
    if(cs) cs.innerHTML='<option value="">Semua kategori</option>'+this.CATS.map(c=>`<option ${pc===c?'selected':''}>${c}</option>`).join('');
  },

  filtered() {
    const per=document.getElementById('pngPeriod')?.value, cat=document.getElementById('pngCat')?.value, q=(document.getElementById('pngSearch')?.value||'').toLowerCase().trim();
    return this.rows.filter(r=>(!per||(r.tanggal||'').slice(0,7)===per)&&(!cat||r.kategori===cat)&&(!q||((r.keterangan||'')+' '+(r.kategori||'')).toLowerCase().includes(q))).sort((a,b)=>(b.tanggal||'').localeCompare(a.tanggal||''));
  },

  render() {
    const list=this.filtered();
    const per=document.getElementById('pngPeriod')?.value;
    const scope=document.getElementById('pngScope'); if(scope) scope.textContent=per?'('+monthLabel(per)+')':'(semua)';
    const total=list.reduce((s,r)=>s+(Number(r.nominal)||0),0);
    const t=document.getElementById('pngTotal'); if(t) t.textContent=rp(total);
    const c2=document.getElementById('pngCount'); if(c2) c2.textContent=list.length+' transaksi';
    const byCat={}; this.CATS.forEach(c=>byCat[c]=0); list.forEach(r=>byCat[r.kategori]=(byCat[r.kategori]||0)+(Number(r.nominal)||0));
    const cl=document.getElementById('pngCatList'); if(cl) cl.innerHTML=this.CATS.map(c=>`<div class="cat-chip"><div class="cn"><span class="cd" style="background:${this.CATCLR[c][1]}"></span>${c}</div><div class="cv">${rp(byCat[c])}</div></div>`).join('');
    const tb=document.getElementById('pngBody'); if(!tb) return;
    if(!list.length){tb.innerHTML=`<tr><td colspan="6"><div class="empty-state"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/></svg></div><div class="t">Belum ada pengeluaran</div><div class="d">Klik "Tambah" untuk mencatat biaya.</div></div></td></tr>`;document.getElementById('pngFoot').innerHTML='';return;}
    tb.innerHTML=list.map((r,i)=>{const[bg,fg]=this.CATCLR[r.kategori]||['#EFE8DB','#8C8676'];return`<tr><td class="td-mono">${i+1}</td><td>${fmtDate(r.tanggal)}</td><td><span class="tag" style="background:${bg};color:${fg}">${esc(r.kategori||'-')}</span></td><td style="color:var(--ink2)">${esc(r.keterangan||'-')}</td><td class="td-r">${rp(r.nominal)}</td><td><div class="row-act"><button class="ibtn ibtn-edit" onclick="Pengeluaran.openForm('${r.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h4L18 10l-4-4L4 16z" stroke-linejoin="round"/><path d="M13 5l4 4" stroke-linecap="round"/></svg></button><button class="ibtn ibtn-del" onclick="Pengeluaran.del('${r.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div></td></tr>`;}).join('');
    document.getElementById('pngFoot').innerHTML=`<tr><td colspan="4">Total</td><td class="td-r" style="color:var(--red)">${rp(total)}</td><td></td></tr>`;
  },

  openForm(id) {
    this.editingId=id||null;
    document.getElementById('pngModalTitle').textContent=id?'Edit Pengeluaran':'Tambah Pengeluaran';
    if(id){const r=this.rows.find(x=>x.id===id);document.getElementById('pngTgl').value=r.tanggal||'';document.getElementById('pngKat').value=r.kategori||'Operasional';document.getElementById('pngNom').value=r.nominal?Number(r.nominal).toLocaleString('id-ID'):'';document.getElementById('pngKet').value=r.keterangan||'';}
    else{document.getElementById('pngTgl').value=today();document.getElementById('pngKat').value='Operasional';document.getElementById('pngNom').value='';document.getElementById('pngKet').value='';}
    document.getElementById('pngModal').classList.add('show');
  },
  closeForm(){document.getElementById('pngModal').classList.remove('show');this.editingId=null;},

  async save(){
    const tanggal=document.getElementById('pngTgl').value, nominal=parseNum(document.getElementById('pngNom').value);
    if(!tanggal){toast('Tanggal wajib diisi','err');return;} if(!nominal){toast('Nominal wajib diisi','err');return;}
    let r;
    if(this.editingId){r=this.rows.find(x=>x.id===this.editingId);Object.assign(r,{tanggal,kategori:document.getElementById('pngKat').value,nominal,keterangan:document.getElementById('pngKet').value.trim()});}
    else{r={id:uid('exp'),tanggal,kategori:document.getElementById('pngKat').value,nominal,keterangan:document.getElementById('pngKet').value.trim()};this.rows.unshift(r);}
    const btn=document.getElementById('pngSaveBtn');btn.disabled=true;
    try{if(sb.ready())await sb.upsert('mbs_pengeluaran',{id:r.id,data:r});cache.set('pengeluaran',this.rows);toast(this.editingId?'Diperbarui':'Pengeluaran dicatat','ok');this.closeForm();this.buildFilters();this.render();}
    catch(e){cache.set('pengeluaran',this.rows);toast('Tersimpan lokal: '+e.message,'err');this.closeForm();this.buildFilters();this.render();}
    finally{btn.disabled=false;}
  },

  async del(id){const r=this.rows.find(x=>x.id===id);if(!r)return;if(!confirm('Hapus pengeluaran '+rp(r.nominal)+'?'))return;this.rows=this.rows.filter(x=>x.id!==id);try{if(sb.ready())await sb.remove('mbs_pengeluaran',id);}catch(e){toast('Supabase gagal hapus: '+e.message,'err');}cache.set('pengeluaran',this.rows);this.buildFilters();this.render();toast('Dihapus','ok');},

  scopeText(){const per=document.getElementById('pngPeriod')?.value,cat=document.getElementById('pngCat')?.value;return(per?monthLabel(per):'Semua periode')+(cat?' · '+cat:'');},
  openExport(){if(!this.filtered().length){toast('Tidak ada data','err');return;}const el=document.getElementById('pngExpScope');if(el)el.textContent=this.scopeText();document.getElementById('pngExpModal').classList.add('show');},
  closeExport(){document.getElementById('pngExpModal').classList.remove('show');},
  exportCSV(){const list=this.filtered();const rows=[['No','Tanggal','Kategori','Keterangan','Nominal']];list.forEach((r,i)=>rows.push([i+1,r.tanggal,r.kategori,r.keterangan||'',Math.round(r.nominal||0)]));rows.push(['','','','TOTAL',list.reduce((s,r)=>s+(Number(r.nominal)||0),0)]);downloadCSV(rows,'Pengeluaran_'+today()+'.csv');this.closeExport();toast('CSV diunduh','ok');},
  exportPDF(){
    const list=this.filtered(),total=list.reduce((s,r)=>s+(Number(r.nominal)||0),0);
    const byCat={};this.CATS.forEach(c=>byCat[c]=0);list.forEach(r=>byCat[r.kategori]=(byCat[r.kategori]||0)+(Number(r.nominal)||0));
    const body=list.map((r,i)=>`<tr><td>${i+1}</td><td>${r.tanggal}</td><td>${esc(r.kategori)}</td><td>${esc(r.keterangan||'-')}</td><td class="r">${rp(r.nominal)}</td></tr>`).join('');
    const catRows=this.CATS.filter(c=>byCat[c]>0).map(c=>`<tr><td>${c}</td><td class="r">${rp(byCat[c])}</td></tr>`).join('');
    printHTML(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Laporan Pengeluaran</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;color:#221F1A;padding:20px;font-size:12px}.head{border-bottom:2px solid #221F1A;padding-bottom:10px;margin-bottom:12px;display:flex;justify-content:space-between}.head h1{font-size:17px}.logo{font-weight:800;font-size:18px;color:#A87E1C}table{width:100%;border-collapse:collapse;margin-top:8px}th{background:#211F1C;color:#C79A2E;font-size:10px;text-transform:uppercase;text-align:left;padding:7px 9px}th.r,td.r{text-align:right}td{padding:7px 9px;border-bottom:1px solid #eee;font-size:11px}tfoot td{font-weight:bold;background:#FBF8F2;border-top:2px solid #ccc}.cat{width:46%;margin-top:16px}.cat h3{font-size:12px;margin-bottom:4px;color:#A87E1C}@page{margin:12mm}</style></head><body>
    <div class="head"><div><h1>Laporan Pengeluaran</h1><div style="font-size:11px;color:#777">${esc(this.scopeText())} · ${list.length} transaksi · ${new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'})}</div></div><div class="logo">${esc(mbsSettings.namaPerusahaan)}</div></div>
    <table><thead><tr><th>No</th><th>Tanggal</th><th>Kategori</th><th>Keterangan</th><th class="r">Nominal</th></tr></thead><tbody>${body}</tbody><tfoot><tr><td colspan="4">TOTAL PENGELUARAN</td><td class="r">${rp(total)}</td></tr></tfoot></table>
    <div class="cat"><h3>Rincian per Kategori</h3><table><tbody>${catRows}</tbody></table></div></body></html>`);
    this.closeExport();
  }
});
const Pengeluaran = pageModules['pengeluaran'];
