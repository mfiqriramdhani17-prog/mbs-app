/* ── Laporan Keuangan ── */
registerPage('laporan', {
  async init(el) {
    el.innerHTML = `
    <div class="card reveal" style="padding:16px 20px;margin-bottom:4px">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <select class="fsel" id="lprPeriod" onchange="Laporan.load()"></select>
          <select class="fsel" id="lprMode" onchange="Laporan.load()">
            <option value="month">Per Bulan</option>
            <option value="year">Per Tahun</option>
            <option value="all">Semua Waktu</option>
          </select>
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-ghost" onclick="Laporan.exportCSV()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M7 3h10a1 1 0 011 1v16a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" stroke-linejoin="round"/></svg>CSV</button>
          <button class="btn btn-gold" onclick="Laporan.exportPDF()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" stroke-linejoin="round"/></svg>PDF</button>
        </div>
      </div>
    </div>
    <div id="lprContent"></div>`;
    await this.load();
  },

  async load() {
    const mode = document.getElementById('lprMode')?.value || 'month';
    let projects = cache.get('hpp_projects'), invoices = cache.get('invoices'), expenses = cache.get('pengeluaran');
    if (sb.ready()) {
      try {
        const [pr,inv,exp] = await Promise.allSettled([sb.select('mbs_hpp_projects'),sb.select('mbs_invoices'),sb.select('mbs_pengeluaran')]);
        if(pr.status==='fulfilled'){projects=pr.value.map(r=>r.data).filter(Boolean);cache.set('hpp_projects',projects);}
        if(inv.status==='fulfilled'){invoices=inv.value.map(r=>r.data).filter(Boolean);cache.set('invoices',invoices);}
        if(exp.status==='fulfilled'){expenses=exp.value.map(r=>r.data).filter(Boolean);cache.set('pengeluaran',expenses);}
        setDbStatus('ok','Supabase ✓');
      } catch(e) { setDbStatus('off','Cache lokal'); }
    }
    this.buildPeriodFilter(projects, expenses, invoices, mode);
    const period = document.getElementById('lprPeriod')?.value || '';
    const pFilter = d => {
      if (!d) return false;
      const ym = (d+'').slice(0,7);
      if (mode==='all') return true;
      if (mode==='year') return ym.slice(0,4) === period;
      return ym === period;
    };
    const fProj = projects.filter(p => pFilter(p.tglMulai||(p.tanggal||'').slice(0,10)));
    const fExp  = expenses.filter(e => pFilter(e.tanggal));
    const fInv  = invoices.filter(i => pFilter((i.tanggal||i.createdAt||'').slice(0,10)));
    const omzet       = fProj.reduce((s,p)=>s+(p.totalJual||0),0);
    const hpp         = fProj.reduce((s,p)=>s+(p.totalBiaya||0),0);
    const labaKotor   = omzet - hpp;
    const totalExp    = fExp.reduce((s,e)=>s+(Number(e.nominal)||0),0);
    const labaBersih  = labaKotor - totalExp;
    const kasmasuk    = fInv.reduce((s,i)=>s+(Number(i.jumlahDibayar)||0),0);
    const totalTagihan= fInv.reduce((s,i)=>s+(Number(i.nilaiTagihan ?? i.grandTotal ?? i.total)||0),0);
    const piutang     = totalTagihan - kasmasuk;
    const ppnKeluar   = fInv.filter(i=>i.usePpn && i.termin==='PELUNASAN').reduce((s,i)=>s+(Number(i.totalPpn)||0),0);
    const expByCat    = {}; ['Gaji','Sewa','Operasional','Marketing','Lain-lain'].forEach(c=>expByCat[c]=0); fExp.forEach(e=>expByCat[e.kategori]=(expByCat[e.kategori]||0)+(Number(e.nominal)||0));

    const content = document.getElementById('lprContent'); if(!content) return;
    content.innerHTML = `
    <div class="kpi-grid" style="margin-bottom:16px">
      ${this.kpiCard('gold','Omzet',rp(omzet),'dari project')}
      ${this.kpiCard('green','Laba Kotor',rp(labaKotor),omzet?Math.round(labaKotor/omzet*100)+'% margin':'−')}
      ${this.kpiCard('blue','Laba Bersih',rp(labaBersih),omzet?Math.round(labaBersih/omzet*100)+'% net':'−')}
      ${this.kpiCard('red','Piutang',rp(piutang),fInv.filter(i=>i.statusBayar!=='Lunas').length+' invoice')}
    </div>

    <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:16px;margin-bottom:16px" id="lprMidRow">
      <div class="card">
        <div class="card-head"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" width="16" height="16"><path d="M4 19V5M4 19h16M8 16l3.5-4 3 2.5L20 8" stroke-linecap="round"/></svg></div><h2>Laba Rugi</h2></div>
        <div style="padding:16px 20px">
          ${this.plRow('Omzet (Total Jual Project)',omzet,'gold')}
          ${this.plRow('HPP / Modal',-hpp,'minus')}
          ${this.plBold('Laba Kotor',labaKotor)}
          <div style="padding:8px 0;border-bottom:1px dashed var(--line);font-size:12px;color:var(--ink2);font-style:italic">Rincian Pengeluaran Operasional:</div>
          ${['Gaji','Sewa','Operasional','Marketing','Lain-lain'].map(c=>expByCat[c]>0?this.plRow('\u00a0\u00a0'+c,-expByCat[c],'minus2'):'').join('')}
          ${this.plBold('Total Pengeluaran',-totalExp)}
          ${this.plNet('Laba Bersih',labaBersih)}
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card">
          <div class="card-head"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" width="16" height="16"><circle cx="12" cy="12" r="9"/><path d="M12 7v10" stroke-linecap="round"/></svg></div><h2>Arus Kas &amp; Piutang</h2></div>
          <div style="padding:16px 20px">
            ${this.plRow('Total Tagihan Invoice',totalTagihan,'gold')}
            ${this.plRow('Kas Masuk (Terbayar)',kasmasuk,'green')}
            ${this.plBold('Piutang Belum Terbayar',piutang)}
            <div class="sep"></div>
            ${['Lunas','DP','Belum Bayar'].map(s=>{const c=fInv.filter(i=>(i.statusBayar||'Belum Bayar')===s).length;const t=fInv.filter(i=>(i.statusBayar||'Belum Bayar')===s).reduce((a,i)=>a+(Number(i.nilaiTagihan ?? i.grandTotal ?? i.total)||0),0);return c?`<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--line);font-size:12.5px">${statusBadge3(s)}<span class="mono">${rp(t)}</span></div>`:''}).join('')}
          </div>
        </div>
        <div class="card">
          <div class="card-head"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" width="16" height="16"><path d="M9 7H7a2 2 0 00-2 2v9a2 2 0 002 2h10a2 2 0 002-2V9a2 2 0 00-2-2h-2M9 7V5a2 2 0 014 0v2M9 7h6" stroke-linejoin="round"/></svg></div><h2>PPN Keluaran</h2></div>
          <div style="padding:16px 20px">
            <div style="font-size:12px;color:var(--ink2);margin-bottom:10px">Invoice Pelunasan ber-PPN: <b style="color:var(--ink)">${fInv.filter(i=>i.usePpn&&i.termin==='PELUNASAN').length}</b> <span style="font-size:11px;color:var(--ink3)">(DP tidak dihitung)</span></div>
            ${this.plBold('PPN Keluaran (Disetor)',ppnKeluar)}
            <div style="font-size:11px;color:var(--ink2);margin-top:8px">Tarif efektif 11% (DPP nilai lain). Ini yang harus disetor.</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-head"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" width="16" height="16"><path d="M4 19V5M4 19h16M8 16l3.5-4 3 2.5L20 8" stroke-linecap="round"/></svg></div><h2>Grafik Omzet &amp; Laba Bersih · 6 Bulan</h2></div>
      <div style="padding:14px 18px 18px">
        <div style="display:flex;gap:16px;margin-bottom:10px">
          <span style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--ink2);font-weight:600"><i style="width:9px;height:9px;border-radius:3px;display:inline-block;background:var(--gold)"></i>Omzet</span>
          <span style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--ink2);font-weight:600"><i style="width:9px;height:9px;border-radius:3px;display:inline-block;background:var(--green)"></i>Laba Bersih</span>
        </div>
        <svg id="lprChart" viewBox="0 0 580 190" style="width:100%;height:auto" preserveAspectRatio="none"></svg>
      </div>
    </div>`;

    this._data = { omzet,hpp,labaKotor,totalExp,labaBersih,kasmasuk,totalTagihan,piutang,ppnKeluar,expByCat,period,mode };
    this.drawChart(projects, expenses);
    this.fixGrid();
    window.addEventListener('resize', ()=>this.fixGrid());
  },

  fixGrid(){const w=window.innerWidth;const el=document.getElementById('lprMidRow');if(el)el.style.gridTemplateColumns=w<980?'1fr':'1.4fr 1fr';},

  buildPeriodFilter(projects,expenses,invoices,mode){
    const sel=document.getElementById('lprPeriod');if(!sel)return;
    const prev=sel.value;
    if(mode==='all'){sel.innerHTML='<option value="all">Semua Waktu</option>';return;}
    const s=new Set();[...projects,...expenses,...invoices].forEach(r=>{const d=r.tglMulai||r.tanggal||(r.createdAt||'');if(d)s.add(mode==='year'?d.slice(0,4):d.slice(0,7));});
    const opts=[...s].sort().reverse().map(v=>`<option value="${v}">${mode==='year'?v:monthLabel(v)}</option>`);
    sel.innerHTML=opts.join('')||'<option value="">Belum ada data</option>';
    if(prev&&[...sel.options].some(o=>o.value===prev))sel.value=prev;
  },

  kpiCard(color,label,value,sub){return`<div class="card kpi-card reveal"><div class="kpi-ic ${color}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/></svg></div><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div>${sub?`<div class="kpi-delta">${sub}</div>`:''}</div>`;},
  plRow(k,v,cls){const col=cls==='gold'?'var(--gold-deep)':cls==='green'?'var(--green)':(cls==='minus'||cls==='minus2'||v<0)?'var(--red)':'var(--ink)';return`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed var(--line);font-size:13px"><span style="color:var(--ink2)">${k}</span><span style="font-family:'DM Mono',monospace;color:${col}">${v<0?'−':''}${rp(Math.abs(v))}</span></div>`;},
  plBold(k,v){return`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed var(--line);font-size:13px;font-weight:700"><span>${k}</span><span style="font-family:'DM Mono',monospace;color:${v<0?'var(--red)':'var(--ink)'}">${v<0?'−':''}${rp(Math.abs(v))}</span></div>`;},
  plNet(k,v){return`<div style="display:flex;justify-content:space-between;align-items:center;padding:13px 16px;background:var(--charcoal);border-radius:12px;margin-top:12px"><span style="font-size:12px;color:#cfc7b6;font-weight:600">${k}</span><span style="font-family:'DM Mono',monospace;font-size:20px;font-weight:600;color:${v>=0?'var(--gold)':'var(--red)'}">Rp ${rpNoLabel(v)}</span></div>`;},

  drawChart(projects,expenses){
    const months=[]; const now=new Date();
    for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);months.push(d.toISOString().slice(0,7));}
    const W=580,H=190,PL=38,PR=10,PT=20,PB=30,cW=W-PL-PR,cH=H-PT-PB;
    const om=months.map(m=>projects.filter(p=>(p.tglMulai||p.tanggal||'').slice(0,7)===m).reduce((s,p)=>s+(p.totalJual||0),0));
    const ex=months.map(m=>expenses.filter(e=>(e.tanggal||'').slice(0,7)===m).reduce((s,e)=>s+(Number(e.nominal)||0),0));
    const hp=months.map(m=>projects.filter(p=>(p.tglMulai||p.tanggal||'').slice(0,7)===m).reduce((s,p)=>s+(p.totalBiaya||0),0));
    const lb=om.map((o,i)=>Math.max(0,o-hp[i]-ex[i]));
    const mx=Math.max(...om,1);const xs=cW/(months.length-1);
    const yS=v=>PT+cH-(v/mx)*cH;const bW=Math.min(36,xs*0.5);
    const lines=[1,.66,.33,0].map(r=>{const y=PT+cH*(1-r);return`<line x1="${PL}" y1="${y}" x2="${W-PR}" y2="${y}" stroke="var(--line)" stroke-width="1"/><text x="2" y="${y+4}" fill="var(--ink2)" font-size="9" font-family="'DM Mono',monospace">${r===0?'0':Math.round(mx*r/1e6)+'jt'}</text>`;}).join('');
    const bars=months.map((m,i)=>{const bh=(om[i]/mx)*cH;const y=PT+cH-bh;const x=PL+i*xs;return`<rect x="${x-bW/2}" y="${y}" width="${bW}" height="${bh}" rx="4" fill="var(--gold-soft)"/><rect x="${x-bW/2}" y="${y}" width="${bW}" height="7" rx="4" fill="var(--gold)"/>`;}).join('');
    const lpts=months.map((m,i)=>[PL+i*xs,yS(lb[i])]);
    const aP=`M${lpts[0][0]},${lpts[0][1]} ${lpts.slice(1).map(p=>`L${p[0]},${p[1]}`).join(' ')} L${lpts[lpts.length-1][0]},${PT+cH} L${lpts[0][0]},${PT+cH} Z`;
    const lP=`M${lpts[0][0]},${lpts[0][1]} ${lpts.slice(1).map(p=>`L${p[0]},${p[1]}`).join(' ')}`;
    const dots=lpts.map(([x,y])=>`<circle cx="${x}" cy="${y}" r="3.5" fill="white" stroke="var(--green)" stroke-width="2.5"/>`).join('');
    const xl=months.map((m,i)=>`<text x="${PL+i*xs}" y="${H-4}" fill="var(--ink2)" font-size="9" text-anchor="middle" font-family="'DM Mono',monospace">${monthLabel(m).split(' ')[0]}</text>`).join('');
    const svg=document.getElementById('lprChart');if(!svg)return;
    svg.innerHTML=`<defs><linearGradient id="gGl" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#15824A" stop-opacity=".28"/><stop offset="100%" stop-color="#15824A" stop-opacity="0"/></linearGradient></defs>${lines}${bars}<path d="${aP}" fill="url(#gGl)"/><path d="${lP}" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${dots}${xl}`;
  },

  exportCSV(){
    if(!this._data){toast('Muat laporan dulu','err');return;}
    const {omzet,hpp,labaKotor,totalExp,labaBersih,kasmasuk,totalTagihan,piutang,ppnKeluar,expByCat}=this._data;
    const rows=[['Laporan Keuangan',mbsSettings.namaPerusahaan],[],['LABA RUGI',''],['Omzet',Math.round(omzet)],['HPP / Modal',Math.round(hpp)],['Laba Kotor',Math.round(labaKotor)],['Total Pengeluaran',Math.round(totalExp)],['Laba Bersih',Math.round(labaBersih)],[],['ARUS KAS',''],['Total Tagihan',Math.round(totalTagihan)],['Kas Masuk',Math.round(kasmasuk)],['Piutang',Math.round(piutang)],[],['PPN KELUARAN',''],['PPN yang harus disetor',Math.round(ppnKeluar)],[],['PENGELUARAN PER KATEGORI',''],...['Gaji','Sewa','Operasional','Marketing','Lain-lain'].map(c=>[c,Math.round(expByCat[c]||0)])];
    downloadCSV(rows,'Laporan_Keuangan_'+today()+'.csv');toast('CSV diunduh','ok');
  },

  exportPDF(){
    if(!this._data){toast('Muat laporan dulu','err');return;}
    const {omzet,hpp,labaKotor,totalExp,labaBersih,kasmasuk,totalTagihan,piutang,ppnKeluar,expByCat}=this._data;
    const cats=['Gaji','Sewa','Operasional','Marketing','Lain-lain'];
    const catRows=cats.filter(c=>expByCat[c]>0).map(c=>`<tr><td style="padding-left:20px;color:#666">${c}</td><td class="r">${rp(expByCat[c])}</td></tr>`).join('');
    printHTML(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Laporan Keuangan</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;color:#221F1A;padding:24px;font-size:12px}.head{border-bottom:3px solid #221F1A;padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between}.logo{font-weight:800;font-size:18px;color:#A87E1C}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}.section{border:1px solid #eee;border-radius:8px;padding:14px}h3{font-size:13px;font-weight:bold;margin-bottom:10px;color:#A87E1C;border-bottom:1px solid #eee;padding-bottom:6px}table{width:100%;border-collapse:collapse}td{padding:7px 8px;border-bottom:1px solid #f5f5f5;font-size:11px}td.r{text-align:right;font-family:'Courier New',monospace}tr.bold td{font-weight:bold}tr.net{background:#211F1C;color:#fff}tr.net td{font-weight:bold;font-size:13px;padding:10px 8px}tr.net td.r{color:#C79A2E;font-size:15px}@page{margin:12mm}</style></head><body>
    <div class="head"><div><h1 style="font-size:18px">Laporan Keuangan</h1><div style="font-size:11px;color:#777;margin-top:3px">${esc(mbsSettings.namaPerusahaan)} · ${new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'})}</div></div><div class="logo">${esc(mbsSettings.namaPerusahaan).slice(0,3).toUpperCase()}</div></div>
    <div class="grid">
      <div class="section"><h3>Laba Rugi</h3><table>
        <tr><td>Omzet (Total Jual Project)</td><td class="r">${rp(omzet)}</td></tr>
        <tr><td>HPP / Modal</td><td class="r" style="color:#C4362F">− ${rp(hpp)}</td></tr>
        <tr class="bold"><td>Laba Kotor</td><td class="r">${rp(labaKotor)}</td></tr>
        <tr><td>Total Pengeluaran</td><td class="r" style="color:#C4362F">− ${rp(totalExp)}</td></tr>
        ${catRows}
        <tr class="net"><td>Laba Bersih</td><td class="r">${rp(labaBersih)}</td></tr>
      </table></div>
      <div>
        <div class="section" style="margin-bottom:14px"><h3>Arus Kas & Piutang</h3><table>
          <tr><td>Total Tagihan Invoice</td><td class="r">${rp(totalTagihan)}</td></tr>
          <tr><td>Kas Masuk</td><td class="r" style="color:#15824A">${rp(kasmasuk)}</td></tr>
          <tr class="bold"><td>Piutang</td><td class="r" style="color:#C4362F">${rp(piutang)}</td></tr>
        </table></div>
        <div class="section"><h3>PPN Keluaran</h3><table>
          <tr><td>PPN yang harus disetor</td><td class="r" style="color:#C4362F">${rp(ppnKeluar)}</td></tr>
          <tr><td style="font-size:10px;color:#888" colspan="2">Hanya dari invoice PELUNASAN ber-PPN · DP tidak dihitung</td></tr>
        </table></div>
      </div>
    </div></body></html>`);
  }
});
const Laporan = pageModules['laporan'];
function statusBadge3(s){const map={'Lunas':'tag-green','DP':'tag-gold','Belum Bayar':'tag-red'};return`<span class="tag ${map[s]||'tag-gray'}">${s}</span>`;}
