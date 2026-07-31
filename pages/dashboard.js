/* ── Dashboard ── */
registerPage('dashboard', {
  async init(el) {
    el.innerHTML = `
    <div class="kpi-grid">
      ${kpiCard('gold','M6 3h11l3 3v15H5z M8 3v5h7','Total Omzet','kpi-omzet','bulan ini')}
      ${kpiCard('green','M4 19V5M4 19h16M8 16l3.5-4 3 2.5L20 8','Laba Kotor','kpi-labakotor','')}
      ${kpiCard('blue','M12 3v18M7 7h7a3 3 0 010 6H7m0 0h8','Laba Bersih','kpi-lababersih','')}
      ${kpiCard('red','M12 8v5M12 16h.01M3 7h18v10a1 1 0 01-1 1H4a1 1 0 01-1-1z','Piutang','kpi-piutang','5 invoice')}
    </div>

    <div style="display:grid;grid-template-columns:1.55fr 1fr;gap:16px" id="dashMidRow">
      <div class="card reveal" style="animation-delay:.1s">
        <div class="card-head"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 19V5M4 19h16M8 16l3.5-4 3 2.5L20 8" stroke-linecap="round" stroke-linejoin="round"/></svg></div><h2>Omzet &amp; Laba · 6 Bulan</h2></div>
        <div style="padding:14px 18px 18px">
          <div style="display:flex;gap:16px;margin-bottom:12px">
            <span style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--ink2);font-weight:600"><i style="width:9px;height:9px;border-radius:3px;display:inline-block;background:var(--gold)"></i>Omzet</span>
            <span style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--ink2);font-weight:600"><i style="width:9px;height:9px;border-radius:3px;display:inline-block;background:var(--green)"></i>Laba Bersih</span>
          </div>
          <svg id="dashChart" viewBox="0 0 580 190" style="width:100%;height:auto" preserveAspectRatio="none"></svg>
        </div>
      </div>

      <div class="card reveal" style="animation-delay:.16s;padding:20px">
        <h2 style="font-size:15px;font-weight:700;margin-bottom:4px">Laba Rugi</h2>
        <p style="font-size:11.5px;color:var(--ink2);margin-bottom:16px" id="dashLRPeriod">—</p>
        <div id="dashPL"></div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1.55fr 1fr;gap:16px" id="dashBotRow">
      <div class="card reveal" style="animation-delay:.22s">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px 0">
          <h2 style="font-size:15px;font-weight:700">Invoice Terbaru</h2>
          <span style="font-size:12px;color:var(--gold-deep);font-weight:700;cursor:pointer" onclick="showPage('invoice')">Lihat semua →</span>
        </div>
        <div class="tbl-wrap" style="margin-top:8px">
          <table>
            <thead><tr><th>No. Dokumen</th><th>Klien</th><th class="r">Nilai</th><th>Status</th></tr></thead>
            <tbody id="dashInvList"></tbody>
          </table>
        </div>
      </div>
      <div class="card reveal" style="animation-delay:.28s">
        <div style="padding:16px 20px 0"><h2 style="font-size:15px;font-weight:700">Produk Margin Tertinggi</h2></div>
        <div id="dashTopProd" style="padding:6px 8px 14px"></div>
      </div>
    </div>`;

    await this.loadData();
    // responsive mid/bot grid
    this.fixGrid();
    window.addEventListener('resize', () => this.fixGrid());
  },

  fixGrid() {
    const w = window.innerWidth;
    ['dashMidRow','dashBotRow'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.gridTemplateColumns = w < 980 ? '1fr' : (id === 'dashMidRow' ? '1.55fr 1fr' : '1.55fr 1fr');
    });
  },

  async loadData() {
    let invoices = cache.get('invoices');
    let projects = cache.get('hpp_projects');
    let expenses = cache.get('pengeluaran');

    if (sb.ready()) {
      try {
        const [inv, proj, exp] = await Promise.allSettled([
          sb.select('mbs_invoices'), sb.select('mbs_hpp_projects'), sb.select('mbs_pengeluaran')
        ]);
        if (inv.status==='fulfilled') { invoices = inv.value.map(r=>r.data).filter(Boolean); cache.set('invoices', invoices); }
        if (proj.status==='fulfilled') { projects = proj.value.map(r=>r.data).filter(Boolean); cache.set('hpp_projects', projects); }
        if (exp.status==='fulfilled') { expenses = exp.value.map(r=>r.data).filter(Boolean); cache.set('pengeluaran', expenses); }
        setDbStatus('ok','Supabase ✓');
      } catch(e) { setDbStatus('off','Cache lokal'); }
    }

    const now = new Date();
    const curMo = now.toISOString().slice(0,7);

    // KPIs from projects (current month)
    const moProj = projects.filter(p => (p.tglMulai||p.tanggal||'').slice(0,7) === curMo);
    const omzet = moProj.reduce((s,p)=>s+(p.totalJual||0),0);
    const hpp   = moProj.reduce((s,p)=>s+(p.totalBiaya||0),0);
    const labaKotor = omzet - hpp;
    const moExp = expenses.filter(e=>(e.tanggal||'').slice(0,7)===curMo).reduce((s,e)=>s+(Number(e.nominal)||0),0);
    const labaBersih = labaKotor - moExp;

    // Piutang from invoices
    const piutang = invoices.filter(inv=>inv.statusBayar!=='Lunas').reduce((s,inv)=>{
      const total = inv.grandTotal||inv.total||0;
      const dibayar = inv.jumlahDibayar||0;
      return s + (total - dibayar);
    },0);

    document.getElementById('kpi-omzet').textContent = rp(omzet);
    document.getElementById('kpi-labakotor').textContent = rp(labaKotor);
    document.getElementById('kpi-lababersih').textContent = rp(labaBersih);
    document.getElementById('kpi-piutang').textContent = rp(piutang);

    // Laba Rugi panel
    document.getElementById('dashLRPeriod').textContent = monthLabel(curMo);
    document.getElementById('dashPL').innerHTML = plRow('Omzet', omzet, 'gold') +
      plRow('HPP (Modal)', -hpp, 'minus') + plRowBold('Laba Kotor', labaKotor) +
      plRow('Pengeluaran', -moExp, 'minus') + plNet('Laba Bersih', labaBersih);

    // Chart: 6 months
    this.drawChart(projects, expenses);

    // Invoice list (last 5)
    const last5 = invoices.slice(0,5);
    document.getElementById('dashInvList').innerHTML = last5.length
      ? last5.map(inv => `<tr>
          <td class="td-mono">${esc(inv.nomorDok||inv.nomor||'-')}</td>
          <td style="font-weight:600">${esc(inv.namaKlien||'-')}</td>
          <td class="td-r">${rp(inv.grandTotal||inv.total||0)}</td>
          <td>${statusBadge(inv.statusBayar||'Belum Bayar')}</td>
        </tr>`).join('')
      : '<tr><td colspan="4" class="empty-state" style="padding:24px;color:var(--ink2)">Belum ada invoice</td></tr>';

    // Top products by margin
    const prodMap = {};
    projects.forEach(p => (p.items||[]).forEach(it => {
      const k = it.nama||'—';
      if (!prodMap[k]) prodMap[k] = { totalJual: 0, totalModal: 0 };
      const c = calcItemSimple(it);
      prodMap[k].totalJual  += c.totalJual;
      prodMap[k].totalModal += c.totalModal;
    }));
    const topProds = Object.entries(prodMap)
      .map(([n,v]) => ({ n, pct: v.totalJual > 0 ? Math.round((v.totalJual-v.totalModal)/v.totalJual*100) : 0 }))
      .sort((a,b) => b.pct - a.pct).slice(0,5);
    document.getElementById('dashTopProd').innerHTML = topProds.length
      ? topProds.map((p,i) => `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 12px">
          <div style="width:24px;height:24px;border-radius:8px;background:var(--bg);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;color:var(--ink2);flex:0 0 24px;font-family:'DM Mono',monospace">${i+1}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.n)}</div>
            <div style="height:5px;border-radius:4px;background:var(--bg2);margin-top:6px"><div style="width:${p.pct}%;height:100%;border-radius:4px;background:linear-gradient(90deg,var(--gold),var(--gold-deep))"></div></div>
          </div>
          <div style="text-align:right"><div style="font-weight:700;font-size:12.5px;color:var(--green);font-family:'DM Mono',monospace">${p.pct}%</div><div style="font-size:10px;color:var(--ink2)">margin</div></div>
        </div>`).join('')
      : '<p style="padding:16px;color:var(--ink2);font-size:12.5px">Belum ada data project.</p>';
  },

  drawChart(projects, expenses) {
    const months = []; const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toISOString().slice(0,7));
    }
    const W = 580, H = 190, PL = 38, PR = 10, PT = 20, PB = 30;
    const cW = W - PL - PR, cH = H - PT - PB;
    const omzetArr = months.map(m => projects.filter(p=>(p.tglMulai||p.tanggal||'').slice(0,7)===m).reduce((s,p)=>s+(p.totalJual||0),0));
    const expArr   = months.map(m => expenses.filter(e=>(e.tanggal||'').slice(0,7)===m).reduce((s,e)=>s+(Number(e.nominal)||0),0));
    const hppArr   = months.map(m => projects.filter(p=>(p.tglMulai||p.tanggal||'').slice(0,7)===m).reduce((s,p)=>s+(p.totalBiaya||0),0));
    const lbArr    = omzetArr.map((o,i) => Math.max(0, o - hppArr[i] - expArr[i]));
    const maxV     = Math.max(...omzetArr, 1);
    const xStep    = cW / (months.length - 1);
    const yScale   = v => PT + cH - (v / maxV) * cH;
    const pts      = months.map((m,i) => [PL + i*xStep, yScale(omzetArr[i])]);
    const lpts     = months.map((m,i) => [PL + i*xStep, yScale(lbArr[i])]);
    const barW     = Math.min(36, xStep * 0.55);
    const lines    = [1,.66,.33,0].map(r => {
      const y = PT + cH * (1 - r);
      const label = r === 0 ? '0' : Math.round(maxV * r / 1e6) + 'jt';
      return `<line x1="${PL}" y1="${y}" x2="${W-PR}" y2="${y}" stroke="var(--line)" stroke-width="1"/>
              <text x="2" y="${y+4}" fill="var(--ink2)" font-size="9" font-family="'DM Mono',monospace">${label}</text>`;
    }).join('');
    const bars = pts.map(([x],i) => {
      const bh = (omzetArr[i] / maxV) * cH;
      const y  = PT + cH - bh;
      return `<rect x="${x - barW/2}" y="${y}" width="${barW}" height="${bh}" rx="4" fill="var(--gold-soft)"/>
              <rect x="${x - barW/2}" y="${y}" width="${barW}" height="8" rx="4" fill="var(--gold)"/>`;
    }).join('');
    const areaPath = `M${lpts[0][0]},${lpts[0][1]} ` + lpts.slice(1).map(p=>`L${p[0]},${p[1]}`).join(' ') +
      ` L${lpts[lpts.length-1][0]},${PT+cH} L${lpts[0][0]},${PT+cH} Z`;
    const linePath = `M${lpts[0][0]},${lpts[0][1]} ` + lpts.slice(1).map(p=>`L${p[0]},${p[1]}`).join(' ');
    const dots  = lpts.map(([x,y]) => `<circle cx="${x}" cy="${y}" r="3.5" fill="white" stroke="var(--green)" stroke-width="2.5"/>`).join('');
    const xlbls = months.map((m,i) => `<text x="${PL+i*xStep}" y="${H-4}" fill="var(--ink2)" font-size="9" text-anchor="middle" font-family="'DM Mono',monospace">${monthLabel(m).split(' ')[0]}</text>`).join('');

    const svg = document.getElementById('dashChart');
    if (!svg) return;
    svg.innerHTML = `<defs><linearGradient id="gG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#15824A" stop-opacity=".28"/><stop offset="100%" stop-color="#15824A" stop-opacity="0"/></linearGradient></defs>
      ${lines}${bars}<path d="${areaPath}" fill="url(#gG)"/><path d="${linePath}" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}${xlbls}`;
  }
});

function kpiCard(color, iconPath, label, valueId, subText) {
  return `<div class="card kpi-card reveal">
    <div class="kpi-ic ${color}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="${iconPath}" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    <div class="kpi-label">${label}</div>
    <div class="kpi-value" id="${valueId}">Rp 0</div>
    ${subText ? `<div class="kpi-delta delta-up">${subText}</div>` : ''}
  </div>`;
}
function plRow(k, v, cls) {
  const sign = v < 0 ? '−' : '+';
  const color = cls === 'minus' ? 'var(--red)' : (v >= 0 ? 'var(--green)' : 'var(--red)');
  return `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px dashed var(--line);font-size:13px"><span style="color:var(--ink2);font-weight:600">${k}</span><span style="font-family:'DM Mono',monospace;color:${color}">${v<0?'−':''} ${rp(Math.abs(v))}</span></div>`;
}
function plRowBold(k, v) {
  return `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px dashed var(--line);font-size:13px;font-weight:700"><span>${k}</span><span style="font-family:'DM Mono',monospace">${rp(v)}</span></div>`;
}
function plNet(k, v) {
  return `<div style="display:flex;justify-content:space-between;padding:14px 16px;background:var(--charcoal);border-radius:12px;margin-top:14px"><span style="font-size:12px;color:#cfc7b6;font-weight:600">${k}</span><span style="font-family:'DM Mono',monospace;font-size:20px;font-weight:600;color:${v>=0?'var(--gold)':'var(--red)'}">Rp ${rpNoLabel(v)}</span></div>`;
}
function statusBadge(s) {
  const map = { 'Lunas':'tag-green','DP':'tag-gold','Belum Bayar':'tag-red' };
  return `<span class="tag ${map[s]||'tag-gray'}">${s}</span>`;
}
function calcItemSimple(it) {
  let modal = 0;
  if (it.tipe === 'Pakaian') {
    const kain = (parseFloat(it.kain?.total)||0) * (parseNum(it.kain?.hargaSatuan)||0);
    const prod = ['aksesoris','cmt','bordir','sablon','packing','lainnya'].reduce((s,k)=>s+parseNum(it.prod?.[k]),0);
    modal = kain + prod;
  } else {
    modal = parseNum(it.cst?.produksi) + parseNum(it.cst?.operasional) + parseNum(it.cst?.lainnya);
  }
  const qty = parseInt(it.qty)||0;
  const pct = parseFloat(it.marginPct)||0;
  const jual = it.marginMode==='jual' ? parseNum(it.hargaJual) : modal*(1+pct/100);
  return { totalJual: jual*qty, totalModal: modal*qty };
}
