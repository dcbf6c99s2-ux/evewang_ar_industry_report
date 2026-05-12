/**
 * charts.js — 智能眼镜行业报告渲染逻辑
 * 依赖：D3 v7, TopoJSON v3, Chart.js 4.x
 * 数据：ar_data.json（通过全局 window.AR_DATA 注入）
 */

/* ── 全局状态 ── */
var GR; // 从 AR_DATA 读取
var s3Done = false;
var s4Done = false;
var rmDone = false;
var rmCur  = 'cn';
var rmH    = {};
var selYear = null;
var WF = null, WM = 'brand', WA = null;
var rgCI = null;

/* ── Tab 切换 ── */
function showTab(n) {
  document.getElementById('s1').classList.toggle('on', n === 1);
  document.getElementById('s2').classList.toggle('on', n === 2);
  document.getElementById('s3').classList.toggle('on', n === 3);
  var s4el = document.getElementById('s4');
  if (s4el) s4el.classList.toggle('on', n === 4);
  document.querySelectorAll('.tbtn').forEach(function(b, i) {
    b.classList.toggle('on', i === n - 1);
  });
  if (n === 2 && !rmDone) { setTimeout(renderRM, 80); setTimeout(renderReg, 120); }
  if (n === 3 && !s3Done) { setTimeout(initS3, 80); }
}
window.showTab = showTab;

/* ── 主初始化（数据加载后调用）── */
function initAll(DATA) {
  GR = DATA.GR;
  initS1Donuts(DATA.s1_donuts);
  initWorldMap(DATA);
  initS2Pies(DATA.s2_pies);
  initBOM(DATA.bom);
  initFunding(DATA.funding_chart, DATA.funding_cards);
  initStratTable(DATA.strategy_table);
}

/* ════════════════════════════════════════
   S1 — 甜甜圈图（市场份额）
════════════════════════════════════════ */
function initS1Donuts(datasets) {
  datasets.forEach(function(ds) {
    var el = document.getElementById(ds.legendId);
    if (el) {
      el.innerHTML = ds.items.map(function(it) {
        var e = it.e ? '<span style="font-size:9px;color:var(--i3)">约</span>' : '';
        var oth = it.l === '其他' ? ' style="cursor:pointer"' : '';
        return '<div class="plr"' + oth + ' data-op="' + ds.otherId + '" data-cu="' + ds.cueId + '">' +
          '<div class="pll"><span class="psq" style="background:' + it.c + '"></span><span>' + it.l + '</span></div>' +
          '<div style="display:flex;align-items:center;gap:2px"><span class="ppt">' + it.v + '%</span>' + e + '</div></div>';
      }).join('');
      el.querySelectorAll('[data-op]').forEach(function(r) {
        r.addEventListener('click', function() {
          var p = document.getElementById(r.dataset.op);
          var c = document.getElementById(r.dataset.cu);
          if (p) p.style.display = p.style.display === 'block' ? 'none' : 'block';
          if (c) c.style.display = c.style.display === 'flex'  ? 'none' : 'flex';
        });
      });
    }
    var ctx = document.getElementById(ds.id);
    if (!ctx) return;
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ds.items.map(function(i) { return i.l; }),
        datasets: [{
          data: ds.items.map(function(i) { return i.v; }),
          backgroundColor: ds.items.map(function(i) { return i.c; }),
          borderColor: '#fff', borderWidth: 2, hoverOffset: 4
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '60%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function(c) {
            return ' ' + c.label + '：' + c.parsed + '%' + (ds.items[c.dataIndex].e ? ' (est.)' : '');
          }}}
        },
        animation: { duration: 500 },
        onClick: function(e, els) {
          if (!els.length) return;
          var it = ds.items[els[0].index];
          if (it.l === '其他') {
            var p = document.getElementById(ds.otherId);
            var cu = document.getElementById(ds.cueId);
            if (p)  p.style.display  = p.style.display  === 'block' ? 'none' : 'block';
            if (cu) cu.style.display = cu.style.display === 'flex'  ? 'none' : 'flex';
          }
        }
      }
    });
  });
}

/* ════════════════════════════════════════
   S1 — 世界地图（D3）
════════════════════════════════════════ */
function initWorldMap(DATA) {
  var BD = DATA.brand_data;
  var SC = DATA.supply_chain;
  var BCL = { ai: 'AI眼镜', ost: 'AR眼镜（OST）', vst: 'MR/VST', vr: 'VR眼镜' };
  var BT  = { ai: 'dai', ost: 'dost', vst: 'dvst', vr: 'dvr2' };

  var WSVG = d3.select('#wms').attr('viewBox', '0 0 880 400').style('background', '#C4D6E2');
  var WTIP = document.getElementById('wmtip');
  var WWRP = document.getElementById('wmw');
  var WMPH = document.getElementById('wmph');
  var WMDET = document.getElementById('wmdet');
  var WP = d3.geoNaturalEarth1().scale(145).translate([430, 218]);
  var WG = d3.geoPath().projection(WP);

  WSVG.append('path').datum(d3.geoGraticule()()).attr('d', WG).attr('fill', 'none').attr('stroke', 'rgba(0,0,0,.04)').attr('stroke-width', .5);
  WSVG.append('path').datum({ type: 'Sphere' }).attr('d', WG).attr('fill', 'none').attr('stroke', 'rgba(0,0,0,.07)').attr('stroke-width', .5);

  function isWA(id) { return !!(WM === 'brand' ? BD : SC)[id]; }
  function getWC(id) { return ((WM === 'brand' ? BD : SC)[id] || {}).c || '#D4D0C8'; }

  function wmCls() {
    WA = null;
    WMPH.style.display = '';
    WMDET.style.display = 'none';
    WMDET.innerHTML = '';
    WSVG.selectAll('path.wc').attr('opacity', 1).attr('stroke-width', function(f) { return isWA(f.id) ? 0.7 : 0.3; });
  }
  window.wmClose = wmCls;

  function mkT(c, n) { return '<span class="dtag ' + BT[c] + '">' + n + '</span>'; }

  function showWD(id) {
    WMPH.style.display = 'none';
    WMDET.style.display = 'block';
    WMDET.innerHTML = '';
    WM === 'brand' ? showWB(id) : showWS(id);
  }

  function showWB(id) {
    var info = BD[id];
    var hd = document.createElement('div');
    hd.className = 'dhd';
    hd.innerHTML = '<span class="ddot" style="background:' + info.c + '"></span>' +
      '<span class="dnm">' + info.name + '</span>' +
      '<span class="dcnt"> · ' + info.t + ' 家品牌</span>' +
      '<button class="dcls" onclick="wmClose()">收起×</button>';
    WMDET.appendChild(hd);
    if (id === '156') {
      renderCN(info);
    } else {
      var b = document.createElement('div');
      b.className = 'dbdy';
      Object.entries(info.cats).forEach(function(kv) {
        b.innerHTML += '<div><div class="dcl">' + BCL[kv[0]] + '</div>' +
          '<div class="dtags">' + kv[1].map(function(n) { return mkT(kv[0], n); }).join('') + '</div></div>';
      });
      WMDET.appendChild(b);
    }
  }

  function renderCN(info) {
    var cw = document.createElement('div'); cw.className = 'dcn2';
    var md = document.createElement('div'); md.className = 'dcm';
    var lst = document.createElement('div'); lst.className = 'dcl2';
    var sv = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); sv.id = 'cn-sv';
    md.appendChild(sv);
    Object.entries(info.cities).forEach(function(kv) {
      var c = kv[0], d = kv[1];
      var all = ['ai', 'ost', 'vst', 'vr'].reduce(function(a, k) {
        return a.concat((d[k] || []).map(function(n) { return { n: n, k: k }; }));
      }, []);
      lst.innerHTML += '<div><div class="dcy"><span class="dcd" style="background:' + d.cl + '"></span>' + c +
        '<span class="dcn3">' + all.length + ' 家</span></div>' +
        '<div class="dtags">' + all.map(function(x) { return mkT(x.k, x.n); }).join('') + '</div></div>';
    });
    cw.appendChild(md); cw.appendChild(lst); WMDET.appendChild(cw);
    setTimeout(function() { drawCN(info, sv); }, 80);
  }

  function drawCN(info, svEl) {
    if (!WF) return;
    var cf = WF.find(function(d) { return String(d.id) === '156'; });
    if (!cf) return;
    var CW = 300, CH = 270;
    svEl.setAttribute('viewBox', '0 0 ' + CW + ' ' + CH);
    var cs = d3.select(svEl).style('background', '#C4D8E6');
    var cp = d3.geoMercator().fitExtent([[8, 8], [CW - 8, CH - 8]], cf);
    var cph = d3.geoPath().projection(cp);
    function marks() {
      Object.entries(info.cities).forEach(function(kv) {
        var c = kv[0], d = kv[1];
        var pt = cp(d.co);
        if (!pt || isNaN(pt[0])) return;
        var cnt = ['ai', 'ost', 'vst', 'vr'].reduce(function(s, k) { return s + (d[k] || []).length; }, 0);
        var r = Math.max(10, 7 + cnt * 1.7);
        var g = cs.append('g');
        g.append('circle').attr('cx', pt[0]).attr('cy', pt[1]).attr('r', r)
          .attr('fill', d.cl).attr('stroke', '#fff').attr('stroke-width', 1.8).attr('opacity', .9);
        g.append('text').attr('x', pt[0]).attr('y', pt[1]).attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central').attr('fill', '#fff').attr('font-size', '8px')
          .attr('font-weight', '500').attr('font-family', 'sans-serif').text(cnt);
        g.append('text').attr('x', pt[0]).attr('y', pt[1] + r + 10).attr('text-anchor', 'middle')
          .attr('fill', '#2C2A28').attr('font-size', '9px').attr('font-family', 'sans-serif').text(c);
      });
    }
    d3.json('https://cdn.jsdelivr.net/npm/datamaps@0.5.10/src/js/data/chn.topo.json').then(function(topo) {
      var key = Object.keys(topo.objects)[0];
      var pv = topojson.feature(topo, topo.objects[key]).features;
      var pp = d3.geoMercator().fitExtent([[8, 8], [CW - 8, CH - 8]], cf);
      var pph = d3.geoPath().projection(pp);
      cs.selectAll('path.cp').data(pv).join('path').attr('class', 'cp').attr('d', pph)
        .attr('fill', '#EBE6DC').attr('stroke', 'rgba(0,0,0,.1)').attr('stroke-width', .5);
      marks();
    }).catch(function() {
      cs.append('path').datum(cf).attr('d', cph).attr('fill', '#EBE6DC').attr('stroke', 'rgba(0,0,0,.15)').attr('stroke-width', 1);
      marks();
    });
  }

  function showWS(id) {
    var info = SC[id];
    var hd = document.createElement('div'); hd.className = 'dhd';
    hd.innerHTML = '<span class="ddot" style="background:' + info.c + '"></span>' +
      '<span class="dnm">' + info.name + '</span>' +
      '<span class="dcnt"> · ' + (info.tl || '供应商') + '</span>' +
      '<button class="dcls" onclick="wmClose()">收起×</button>';
    WMDET.appendChild(hd);
    var b = document.createElement('div'); b.className = 'scb';
    info.nodes.forEach(function(nd) {
      b.innerHTML += '<div class="scr"><div class="sci" style="background:' + nd.bg + '">' + nd.ic + '</div>' +
        '<div><div class="scn">' + nd.nm + '</div><div class="scs">' + nd.sb + '</div><div class="scnt">' + nd.nt + '</div></div></div>';
    });
    WMDET.appendChild(b);
  }

  window.sw1 = function(m) {
    if (m === WM) return;
    WM = m; wmCls();
    document.getElementById('btn-b').classList.toggle('on', m === 'brand');
    document.getElementById('btn-s').classList.toggle('on', m === 'sc');
    document.getElementById('mleg-b').style.display = m === 'brand' ? '' : 'none';
    document.getElementById('mleg-s').style.display = m === 'sc'    ? '' : 'none';
    var sb = document.getElementById('map-sum-b'), ss = document.getElementById('map-sum-s');
    if (sb) sb.style.display = m === 'brand' ? '' : 'none';
    if (ss) ss.style.display = m === 'sc'    ? '' : 'none';
    repW();
  };

  function repW() {
    if (!WF) return;
    WSVG.selectAll('path.wc')
      .attr('fill', function(d) { return getWC(d.id); })
      .attr('stroke-width', function(d) { return isWA(d.id) ? 0.7 : 0.3; })
      .style('cursor', function(d) { return isWA(d.id) ? 'pointer' : 'default'; });
    WSVG.selectAll('g.wb').remove();
    var DATA_SRC = WM === 'brand' ? BD : SC;
    Object.keys(DATA_SRC).forEach(function(id) {
      var f = WF.find(function(d) { return String(d.id) === id; });
      if (!f) return;
      var c = WG.centroid(f); var cx = c[0], cy = c[1];
      if (id === '840') { cx -= 24; cy += 8; }
      if (id === '158') { cx += 5;  cy -= 3; }
      if (isNaN(cx) || isNaN(cy)) return;
      var info = DATA_SRC[id];
      var tot = typeof info.t === 'number' ? info.t : (info.nodes ? info.nodes.length : 0);
      var r = Math.max(11, 8 + tot * .5);
      var g = WSVG.append('g').attr('class', 'wb').style('pointer-events', 'none');
      g.append('circle').attr('cx', cx).attr('cy', cy).attr('r', r)
        .attr('fill', 'rgba(255,255,255,.2)').attr('stroke', 'rgba(255,255,255,.8)').attr('stroke-width', 1.2);
      g.append('text').attr('x', cx).attr('y', cy).attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central').attr('fill', '#fff')
        .attr('font-size', r > 14 ? '12px' : '10px').attr('font-weight', '500')
        .attr('font-family', 'monospace').text(tot);
    });
  }

  // 加载世界地图 TopoJSON
  d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(function(world) {
    WF = topojson.feature(world, world.objects.countries).features;
    WSVG.selectAll('path.wc').data(WF).join('path').attr('class', 'wc').attr('d', WG)
      .attr('fill', function(d) { return getWC(d.id); })
      .attr('stroke', 'rgba(255,255,255,.7)')
      .attr('stroke-width', function(d) { return isWA(d.id) ? 0.7 : 0.3; })
      .style('cursor', function(d) { return isWA(d.id) ? 'pointer' : 'default'; })
      .on('mousemove', function(ev, d) {
        if (!isWA(d.id)) return;
        var info = (WM === 'brand' ? BD : SC)[d.id];
        var rc = WWRP.getBoundingClientRect();
        var tx = ev.clientX - rc.left + 12, ty = ev.clientY - rc.top - 52;
        if (tx + 200 > rc.width) tx -= 210;
        if (ty < 6) ty = ev.clientY - rc.top + 12;
        WTIP.style.display = 'block'; WTIP.style.left = tx + 'px'; WTIP.style.top = ty + 'px';
        document.getElementById('t-n').textContent = info.name;
        document.getElementById('t-s').textContent = '点击展开详情';
      })
      .on('mouseleave', function(ev, d) { if (isWA(d.id)) WTIP.style.display = 'none'; })
      .on('click', function(ev, d) {
        if (!isWA(d.id)) return;
        WTIP.style.display = 'none';
        if (WA === d.id) { wmCls(); return; }
        WA = d.id;
        WSVG.selectAll('path.wc')
          .attr('opacity', function(f) { return !isWA(f.id) ? 1 : (f.id === d.id ? 1 : .4); })
          .attr('stroke-width', function(f) { return f.id === d.id ? 2.4 : (isWA(f.id) ? 0.7 : 0.3); });
        showWD(d.id);
        WMDET.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    repW();
    // 如果 S2 已激活，同时渲染区域地图
    renderReg();
  }).catch(function() {
    WSVG.append('text').attr('x', 440).attr('y', 200).attr('text-anchor', 'middle')
      .attr('fill', '#888').attr('font-size', '13px').attr('font-family', 'sans-serif').text('地图加载失败');
  });

  setTimeout(function() {
    if (document.getElementById('s2').classList.contains('on')) { renderRM(); renderReg(); }
  }, 200);
  window.addEventListener('resize', function() { if (rmDone) renderRM(); });

  /* ── S2 区域地图 ── */
  function renderReg() {
    if (!WF) return;
    var RC = window._AR_DATA.regional_codes;
    var RCOLORS = window._AR_DATA.regional_colors;
    var RD = window._AR_DATA.regional_data;
    var svg = document.getElementById('rgs');
    if (!svg) return;
    var W = 660, H = 320;
    var proj = d3.geoNaturalEarth1().scale(108).translate([W / 2 - 5, H / 2 + 18]);
    var gp = d3.geoPath().projection(proj);
    var s = d3.select(svg); s.selectAll('*').remove();
    s.append('path').datum(d3.geoGraticule()()).attr('d', gp).attr('fill', 'none').attr('stroke', 'rgba(0,0,0,.04)').attr('stroke-width', .4);
    s.selectAll('path.rc').data(WF).join('path').attr('class', 'rc').attr('d', gp)
      .attr('fill', function(d) {
        var rk = RC[d.id] || 'row';
        var a = { cn: 1, apac: .82, nam: .8, eur: .75, row: .22 };
        var c = RCOLORS[rk]; var av = a[rk];
        return av < 1 ? c + Math.round(av * 255).toString(16).padStart(2, '0') : c;
      })
      .attr('stroke', 'rgba(255,255,255,.45)').attr('stroke-width', .3)
      .style('cursor', function(d) { var rk = RC[d.id]; return rk && rk !== 'row' ? 'pointer' : 'default'; })
      .on('mousemove', function(ev, d) {
        var rk = RC[d.id]; if (!rk) return;
        var rd = RD[rk]; if (!rd) return;
        var rc = svg.getBoundingClientRect();
        var tx = ev.clientX - rc.left + 10, ty = ev.clientY - rc.top - 46;
        if (tx + 170 > rc.width) tx -= 180;
        if (ty < 4) ty = ev.clientY - rc.top + 10;
        var tip = document.getElementById('rgtip');
        tip.style.display = 'block'; tip.style.left = tx + 'px'; tip.style.top = ty + 'px';
        document.getElementById('rt-n').textContent = rd.name;
        document.getElementById('rt-s').textContent = '综合竞争强度 ' + '⭐'.repeat(rd.stars) + ' · 点击查看价格/渠道/生态分析';
      })
      .on('mouseleave', function(ev, d) { if (RC[d.id]) document.getElementById('rgtip').style.display = 'none'; })
      .on('click', function(ev, d) {
        var rk = RC[d.id]; if (!rk) return;
        document.getElementById('rgtip').style.display = 'none';
        showRgDet(rk);
      });
    var lbl = { cn: [116, 35], apac: [142, 22], nam: [-100, 44], eur: [15, 51] };
    Object.entries(lbl).forEach(function(e) {
      var pt = proj(e[1]); if (!pt || isNaN(pt[0])) return;
      s.append('text').attr('x', pt[0]).attr('y', pt[1]).attr('text-anchor', 'middle')
        .attr('fill', 'rgba(255,255,255,.85)').attr('font-size', '9px').attr('font-weight', '500')
        .attr('font-family', 'sans-serif').attr('pointer-events', 'none').text((RD[e[0]] || {}).name || e[0]);
    });
  }
  window.renderReg = renderReg;

  function showRgDet(rk) {
    var RD = window._AR_DATA.regional_data;
    var RCOLORS = window._AR_DATA.regional_colors;
    var rd = RD[rk]; if (!rd) return;
    document.getElementById('rd-ph').style.display = 'none';
    document.getElementById('rd-ch').style.display = 'block';
    document.getElementById('rd-nm').textContent = rd.name;
    var bg = document.getElementById('rd-bg');
    bg.textContent = '⭐'.repeat(rd.stars) + ' 竞争强度';
    bg.style.background = RCOLORS[rk] + '22'; bg.style.color = RCOLORS[rk];
    document.getElementById('rd-top').textContent = rd.top;
    document.getElementById('rd-lbl').textContent = rd.topl;
    document.getElementById('rd-leg').innerHTML = rd.share.map(function(it) {
      return '<div class="rglegr"><div class="rglegl"><span class="rglegs" style="background:' + it.c + '"></span><span>' + it.l + '</span></div><span class="rglegp">' + it.v + '%</span></div>';
    }).join('');
    var dimEl = document.getElementById('rd-dims');
    dimEl.innerHTML = rd.dims.map(function(d) {
      var pct = d.score / 5 * 100;
      var pills = d.pills.map(function(p) { return '<span class="dim-pill">' + p + '</span>'; }).join('');
      return '<div class="dim-row"><div class="dim-lbl">' + d.lbl + '</div><div class="dim-right">' +
        '<div class="dim-bar-wrap"><div class="dim-bar"><div class="dim-fill" style="width:' + pct + '%;background:' + d.color + '"></div></div>' +
        '<span class="dim-score" style="color:' + d.color + '">' + d.score + '/5</span></div>' +
        (d.desc ? '<div style="font-size:10px;font-weight:500;color:' + d.color + ';margin-bottom:2px;">' + d.desc + '</div>' : '') +
        '<div class="dim-detail">' + d.detail + '</div><div class="dim-pills">' + pills + '</div>' +
        '</div></div>';
    }).join('');
    if (rgCI) rgCI.destroy();
    var ctx = document.getElementById('rdc'); if (!ctx) return;
    rgCI = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: rd.share.map(function(i) { return i.l; }),
        datasets: [{ data: rd.share.map(function(i) { return i.v; }), backgroundColor: rd.share.map(function(i) { return i.c; }), borderColor: '#fff', borderWidth: 2, hoverOffset: 4 }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '58%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(c) { return ' ' + c.label + '：' + c.parsed + '%'; } } } }, animation: { duration: 400 } }
    });
  }
}

/* ════════════════════════════════════════
   S2 — 市场份额饼图
════════════════════════════════════════ */
function initS2Pies(datasets) {
  datasets.forEach(function(ds) {
    var el = document.getElementById(ds.legendId);
    if (el) {
      el.innerHTML = ds.items.map(function(it) {
        var e = it.e ? '<span class="piest">约</span>' : '';
        return '<div class="pielr"><div class="piell"><span class="piesq" style="background:' + it.c + '"></span><span>' + it.l + '</span></div>' +
          '<div style="display:flex;align-items:center;gap:2px"><span class="piept">' + it.v + '%</span>' + e + '</div></div>';
      }).join('');
    }
    var ctx = document.getElementById(ds.canvasId); if (!ctx) return;
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ds.items.map(function(i) { return i.l; }),
        datasets: [{ data: ds.items.map(function(i) { return i.v; }), backgroundColor: ds.items.map(function(i) { return i.c; }), borderColor: '#fff', borderWidth: 2, hoverOffset: 4 }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(c) { return ' ' + c.label + '：' + c.parsed + '%' + (ds.items[c.dataIndex].e ? ' (est.)' : ''); } } } }, animation: { duration: 500 } }
    });
  });
}

/* ════════════════════════════════════════
   S2 — Roadmap SVG
════════════════════════════════════════ */
function isOnSale(p, yr) {
  var ISTRY = window._AR_DATA.roadmap.discontinued;
  var ey = ISTRY[p.b + '|' + p.name];
  return Math.floor(p.y) <= yr && (!ey || ey >= yr);
}

function switchRM(m) {
  if (m === rmCur) return;
  rmCur = m; rmH = {}; selYear = null;
  var yb = document.getElementById('rm-yr-bar');
  if (yb) yb.style.display = 'none';
  document.getElementById('tab-cn').classList.toggle('on', m === 'cn');
  document.getElementById('tab-os').classList.toggle('on', m === 'os');
  renderRM();
}
window.switchRM = switchRM;

function clickYear(yr) {
  selYear = (selYear === yr) ? null : yr;
  var yb = document.getElementById('rm-yr-bar'), yt = document.getElementById('rm-yr-txt');
  if (yb && yt) {
    yb.style.display = selYear ? 'block' : 'none';
    if (yt) yt.textContent = selYear || '';
  }
  renderRM();
}

function renderRM() {
  rmDone = true;
  var DATA = window._AR_DATA.roadmap;
  var svg = document.getElementById('rmsv'); if (!svg) return;
  svg.innerHTML = '';
  var pr = rmCur === 'cn' ? DATA.products_cn : DATA.products_os;
  var br = rmCur === 'cn' ? DATA.brands_cn   : DATA.brands_os;
  var cy = rmCur === 'cn' ? '¥' : '$';
  var W = svg.parentElement.clientWidth || 860, H = 440;
  var PAD = { t: 16, r: 18, b: 46, l: 60 };
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  var vp = (selYear ? pr.filter(function(p) { return !rmH[p.b] && isOnSale(p, selYear); }) : pr.filter(function(p) { return !rmH[p.b]; })).map(function(p) { return p.p; });
  var pMax = (vp.length ? Math.max.apply(null, vp) : 7000) * 1.18, xMin = 2020.8;
  /* X 轴右边界：动态取产品最大年份 + 0.6，至少到 2026.85 */
  var xMaxRaw = pr.length ? Math.max.apply(null, pr.map(function(p) { return p.y; })) : 2026;
  var xMax = Math.max(2026.85, Math.ceil(xMaxRaw) + 0.6);
  /* 年份刻度：从 2021 到 xMax 上取整 */
  var yrEnd = Math.ceil(xMaxRaw);
  var yrLabels = [];
  for (var _y = 2021; _y <= yrEnd; _y++) yrLabels.push(_y);
  function xS(x) { return PAD.l + (x - xMin) / (xMax - xMin) * (W - PAD.l - PAD.r); }
  function yS(y) { return H - PAD.b - y / pMax * (H - PAD.t - PAD.b); }
  var ns = 'http://www.w3.org/2000/svg';
  function el(t, a) { var e = document.createElementNS(ns, t); Object.entries(a).forEach(function(kv) { e.setAttribute(kv[0], kv[1]); }); return e; }
  var tks = rmCur === 'cn' ? [2000, 3000, 4000, 5000, 6000, 7000] : [500, 1000, 2000, 3000, 5000];
  var g = el('g', {}); svg.appendChild(g);
  tks.forEach(function(p) {
    if (p > pMax) return;
    var y = yS(p);
    g.appendChild(el('line', { x1: PAD.l, y1: y, x2: W - PAD.r, y2: y, stroke: '#E2DFDA', 'stroke-width': '.7', 'stroke-dasharray': '4 3' }));
    var t = el('text', { x: PAD.l - 4, y: y + 4, 'text-anchor': 'end', 'font-size': '10', 'font-family': 'monospace', fill: '#8C8A86' });
    t.textContent = cy + (p >= 1000 ? (p / 1000 + 'k') : p); g.appendChild(t);
  });
  yrLabels.forEach(function(yr) {
    var x = xS(yr); var f = yr >= 2026; var isSel = selYear === yr;
    g.appendChild(el('line', { x1: x, y1: PAD.t, x2: x, y2: H - PAD.b, stroke: isSel ? '#4A90D9' : (f ? '#D8D4CA' : '#E8E5E0'), 'stroke-width': isSel ? '1.8' : (f ? '1.2' : '.7'), 'stroke-dasharray': f ? '5 3' : 'none' }));
    var lb = el('text', { x: x, y: H - PAD.b + 14, 'text-anchor': 'middle', 'font-size': '11', 'font-family': 'sans-serif', fill: isSel ? '#4A90D9' : (f ? '#B0ADA8' : '#6A6865'), cursor: 'pointer', 'font-weight': isSel ? '700' : '400' });
    lb.textContent = yr;
    if (f && !isSel) {
      lb.setAttribute('font-style', 'italic');
      var lb2 = el('text', { x: x, y: H - PAD.b + 26, 'text-anchor': 'middle', 'font-size': '9', 'font-family': 'sans-serif', fill: '#B0ADA8', cursor: 'pointer' });
      lb2.textContent = '(预计)';
      lb2.addEventListener('click', function() { clickYear(yr); });
      g.appendChild(lb2);
    }
    lb.addEventListener('click', function() { clickYear(yr); });
    g.appendChild(lb);
    var hint = el('rect', { x: x - 24, y: H - PAD.b + 2, width: 48, height: 32, fill: 'rgba(0,0,0,0.001)', 'pointer-events': 'all', cursor: 'pointer' });
    hint.addEventListener('click', function() { clickYear(yr); });
    g.appendChild(hint);
  });
  g.appendChild(el('line', { x1: PAD.l, y1: PAD.t, x2: PAD.l, y2: H - PAD.b, stroke: '#CBC8C2', 'stroke-width': '1' }));
  g.appendChild(el('line', { x1: PAD.l, y1: H - PAD.b, x2: W - PAD.r, y2: H - PAD.b, stroke: '#CBC8C2', 'stroke-width': '1' }));
  if (!selYear) {
    var hint2 = el('text', { x: W - PAD.r, y: H - PAD.b + 28, 'text-anchor': 'end', 'font-size': '9', 'font-family': 'sans-serif', fill: '#B0ADA8' });
    hint2.textContent = '点击年份筛选当年在售产品'; g.appendChild(hint2);
  }
  Object.keys(br).forEach(function(bk) {
    if (rmH[bk]) return;
    var bp = pr.filter(function(p) { return p.b === bk && (!selYear || isOnSale(p, selYear)); }).sort(function(a, b) { return a.y - b.y; });
    if (bp.length < 2) return;
    var pts = bp.map(function(p) { return xS(p.y) + ',' + yS(p.p); }).join(' ');
    g.appendChild(el('polyline', { points: pts, fill: 'none', stroke: br[bk].c, 'stroke-width': '1.4', 'stroke-opacity': '.28', 'stroke-dasharray': '4 3' }));
  });
  var tip = document.getElementById('rmtip');
  pr.forEach(function(prod) {
    if (rmH[prod.b]) return;
    if (selYear && !isOnSale(prod, selYear)) return;
    var bc = br[prod.b]; var cx2 = xS(prod.y), cy2 = yS(prod.p);
    var r = 7 + Math.min(prod.p / 1400, 4.5);
    var isFut = prod.y >= 2025.5 && (function() {
      var st = '';
      prod.s.forEach(function(r) { if (r[0] === '2026在售') st = r[1]; });
      return st.indexOf('规划中') !== -1 || st.indexOf('传言') !== -1 || st.indexOf('发布中') !== -1;
    })();
    var gg = el('g', { class: 'rmdt' }); gg.style.cursor = 'pointer';
    if (isFut) gg.appendChild(el('circle', { cx: cx2, cy: cy2, r: r + 3, fill: 'none', stroke: bc.c, 'stroke-width': '1', 'stroke-dasharray': '3 2', opacity: '0.5' }));
    gg.appendChild(el('circle', { cx: cx2, cy: cy2, r: r, fill: bc.c, opacity: isFut ? '.55' : '1', stroke: '#fff', 'stroke-width': '1.4' }));
    if (r > 8) {
      var tb = el('text', { x: cx2, y: cy2 + 1, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': '7', 'font-weight': '500', 'font-family': 'monospace', fill: '#fff', 'pointer-events': 'none' });
      tb.textContent = bc.ab; gg.appendChild(tb);
    }
    var sn = prod.name.replace('XREAL ', '').replace('Nreal ', '').replace('雷鸟 ', '').replace('Rokid ', '').replace('INMO ', '').replace('VITURE ', '');
    if (sn.length > 12) sn = sn.substring(0, 11) + '…';
    var lb = el('text', { x: cx2, y: cy2 - r - 5, 'text-anchor': 'middle', 'font-size': '8.5', 'font-family': 'sans-serif', fill: bc.c, 'font-weight': '500', 'pointer-events': 'none' });
    lb.textContent = sn; gg.appendChild(lb);
    gg.addEventListener('mouseenter', function(e) {
      var rows = [['上市', Math.floor(prod.y) + '年'], ['MSRP', cy + prod.p.toLocaleString()]].concat(prod.s.filter(function(r) { return r[0] !== '2026在售'; }));
      document.getElementById('tt-dt').style.background = bc.c;
      document.getElementById('tt-nm').textContent = prod.name;
      document.getElementById('tt-br').textContent = bc.name;
      document.getElementById('tt-bd').innerHTML = rows.map(function(r) {
        var d = r[0] === '降价';
        return '<div class="ttr"><span class="ttl"' + (d ? ' style="color:#E67E22"' : '') + '>' + r[0] + '</span><span class="ttv"' + (d ? ' style="color:#E67E22;font-weight:500"' : '') + '>' + r[1] + '</span></div>';
      }).join('');
      tip.style.display = 'block'; mvTip(e);
    });
    gg.addEventListener('mousemove', mvTip);
    gg.addEventListener('mouseleave', function() { tip.style.display = 'none'; });
    svg.appendChild(gg);
  });
  var lel = document.getElementById('rmleg'); lel.innerHTML = '';
  Object.entries(br).forEach(function(kv) {
    var bk = kv[0], bc = kv[1];
    var item = document.createElement('div');
    item.className = 'rmli' + (rmH[bk] ? ' dim' : '');
    item.innerHTML = '<span class="rmld" style="background:' + bc.c + '"></span>' + bc.name;
    item.addEventListener('click', function() { rmH[bk] = !rmH[bk]; renderRM(); });
    lel.appendChild(item);
  });
}
window.renderRM = renderRM;

function mvTip(e) {
  var tip = document.getElementById('rmtip');
  var tw = tip.offsetWidth || 240, th = tip.offsetHeight || 180;
  var x = e.clientX + 12, y = e.clientY - 16;
  if (x + tw > window.innerWidth - 4)  x = e.clientX - tw - 12;
  if (y + th > window.innerHeight - 4) y = e.clientY - th - 4;
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
}

/* ════════════════════════════════════════
   S2 — BOM 图表
════════════════════════════════════════ */
function initBOM(bom) {
  function mkBom(id, data, total) {
    var ctx = document.getElementById(id); if (!ctx) return;
    new Chart(ctx, {
      type: 'bar',
      data: { labels: bom.labels, datasets: [{ data: data, backgroundColor: bom.colors, borderRadius: 4, borderSkipped: false }] },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(c) { var v = c.parsed.x; return ' ¥' + v + ' · 占BOM ' + (v / total * 100).toFixed(0) + '%'; } } } },
        scales: {
          x: { max: total, grid: { color: '#E2DFDA' }, ticks: { font: { size: 9 }, callback: function(v) { return '¥' + v; } } },
          y: { grid: { display: false }, ticks: { font: { size: 9 } } }
        }
      }
    });
  }
  mkBom('bom1', bom.entry.data,    bom.entry.total);
  mkBom('bom2', bom.midrange.data, bom.midrange.total);
}

/* ════════════════════════════════════════
   S2 — 融资图表 + 卡片
════════════════════════════════════════ */
function initFunding(fundingChart, fundingCards) {
  var fc = document.getElementById('funding-chart');
  if (fc) {
    new Chart(fc, {
      type: 'line',
      data: {
        labels: fundingChart.labels,
        datasets: fundingChart.datasets.map(function(ds) {
          var hex = ds.color.replace('#',''), r=parseInt(hex.slice(0,2),16), g=parseInt(hex.slice(2,4),16), b=parseInt(hex.slice(4,6),16), bg='rgba('+r+','+g+','+b+',.1)';
          return { label: ds.label, data: ds.data, borderColor: ds.color, backgroundColor: bg, tension: .3, spanGaps: true, pointRadius: 4, borderWidth: 2 };
        })
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } }, tooltip: { callbacks: { label: function(c) { return ' ' + c.dataset.label + '：$' + c.parsed.y + 'M'; } } } },
        scales: {
          x: { grid: { color: '#E2DFDA' }, ticks: { font: { size: 11 } } },
          y: { grid: { color: '#E2DFDA' }, ticks: { font: { size: 10 }, callback: function(v) { return '$' + v + 'M'; } }, title: { display: true, text: '融资额（百万美元）', font: { size: 10 } } }
        }
      }
    });
  }
  var fc2 = document.getElementById('funding-cards');
  if (fc2) {
    fc2.innerHTML = fundingCards.map(function(d) {
      return '<div style="background:var(--sf);border:1px solid var(--ru);border-radius:10px;padding:13px 14px;">' +
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:7px;"><span style="width:8px;height:8px;border-radius:50%;background:' + d.c + ';flex-shrink:0;"></span><span style="font-size:12px;font-weight:600;color:var(--ink);">' + d.brand + '</span></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:7px;">' +
        '<div style="background:#F7F5F1;border-radius:6px;padding:6px 8px;"><div style="font-size:9px;color:var(--i3);margin-bottom:1px;">累计融资</div><div style="font-size:12px;font-weight:700;font-family:var(--mono);color:' + d.c + '">' + d.total + '</div></div>' +
        '<div style="background:#F7F5F1;border-radius:6px;padding:6px 8px;"><div style="font-size:9px;color:var(--i3);margin-bottom:1px;">估值 / 状态</div><div style="font-size:11px;font-weight:500;color:var(--ink);">' + d.val + '</div></div>' +
        '</div>' +
        '<div style="font-size:10px;color:var(--i3);margin-bottom:4px;"><strong style="color:var(--i2);">主要投资方：</strong>' + d.key + '</div>' +
        '<div style="font-size:10px;color:var(--i3);line-height:1.5;border-top:1px solid var(--ru);padding-top:5px;margin-top:5px;">' + d.note + '</div>' +
        '</div>';
    }).join('');
  }
}

/* ════════════════════════════════════════
   S3 — 品牌战略对比表
════════════════════════════════════════ */
function initStratTable(STRATS) {
  var tb = document.getElementById('strat-tbody'); if (!tb) return;
  tb.innerHTML = STRATS.map(function(r) {
    return '<tr style="border-bottom:1px solid var(--ru);">' +
      '<td style="padding:10px 14px;"><div style="display:flex;align-items:center;gap:5px;"><span style="width:8px;height:8px;border-radius:50%;background:' + r.c + ';flex-shrink:0;"></span><span style="font-size:11px;font-weight:600;">' + r.b + '</span></div></td>' +
      '<td style="padding:10px 12px;font-size:10px;color:var(--i2);">' + r.tech  + '</td>' +
      '<td style="padding:10px 12px;font-size:10px;color:var(--i2);">' + r.price + '</td>' +
      '<td style="padding:10px 12px;font-size:10px;color:var(--i2);">' + r.ch    + '</td>' +
      '<td style="padding:10px 12px;font-size:10px;color:var(--i2);">' + r.ai    + '</td>' +
      '<td style="padding:10px 12px;font-size:10px;color:var(--i2);">' + r.intl  + '</td>' +
      '<td style="padding:10px 14px;font-size:10px;color:var(--i3);font-style:italic;line-height:1.5;">' + r.judge + '</td>' +
      '</tr>';
  }).join('');
}

/* ════════════════════════════════════════
   S3 — 里程碑时间轴 + 未来折线图
════════════════════════════════════════ */
function initS3() {
  if (s3Done) return;
  s3Done = true;
  var MS = window._AR_DATA.milestones;
  var CAT_C = { enterprise: '#1A5276', vr: '#6B3E0A', consumer: '#0052CC', milestone: '#C8002A' };
  var CAT_L = { enterprise: '企业级先驱', vr: 'VR 规模化', consumer: '消费级爆发', milestone: '行业里程碑' };
  var msSvg    = document.getElementById('ms-svg');
  var msDetail = document.getElementById('ms-detail');
  var selMs = null;

  /* ── 按年份分组 ── */
  var byYear = {};
  MS.forEach(function(m, idx) {
    if (!byYear[m.y]) byYear[m.y] = [];
    byYear[m.y].push({ m: m, idx: idx });
  });
  var years = Object.keys(byYear).map(Number).sort(function(a, b) { return a - b; });

  function renderMS() {
    if (!msSvg) return;
    var cols = years.map(function(yr) {
      var events = byYear[yr];
      var dotColor = CAT_C[events[0].m.cat];
      var cards = events.map(function(ev) {
        var m = ev.m, idx = ev.idx, cc = CAT_C[m.cat], on = selMs === idx;
        return '<div class="ms-card' + (on ? ' ms-card-on' : '') + '" style="border-left-color:' + cc + '" data-idx="' + idx + '">' +
          '<span class="ms-tag" style="background:' + cc + '22;color:' + cc + '">' + CAT_L[m.cat] + '</span>' +
          '<div class="ms-ttl">' + m.t + '</div></div>';
      }).join('');
      return '<div class="ms-col"><div class="ms-dot" style="background:' + dotColor + '"></div>' +
        '<div class="ms-yr">' + yr + '</div><div class="ms-cards">' + cards + '</div></div>';
    }).join('');

    var legend = Object.entries(CAT_C).map(function(kv) {
      return '<div class="ms-leg-item"><span class="ms-leg-dot" style="background:' + kv[1] + '"></span>' + CAT_L[kv[0]] + '</div>';
    }).join('');

    msSvg.innerHTML = '<div class="ms-scroll"><div class="ms-cols">' + cols + '</div>' +
      '<div class="ms-legend">' + legend + '</div></div>';

    msSvg.querySelectorAll('.ms-card').forEach(function(card) {
      card.addEventListener('click', function() {
        var idx = parseInt(card.getAttribute('data-idx'));
        var m = MS[idx], cc = CAT_C[m.cat];
        selMs = (selMs === idx) ? null : idx;
        if (selMs === null) {
          msDetail.style.display = 'none';
        } else {
          msDetail.style.display = 'block';
          document.getElementById('ms-det-year').textContent  = m.y + '　';
          document.getElementById('ms-det-title').textContent = m.t;
          document.getElementById('ms-det-body').innerHTML =
            '<span style="font-size:10px;padding:1px 7px;border-radius:10px;background:' + cc + '22;color:' + cc + ';font-weight:500;margin-right:6px;">' + CAT_L[m.cat] + '</span>' + m.d;
        }
        renderMS();
      });
    });
  }
  renderMS();

  /* 未来折线图 */
  var fc = window._AR_DATA.future_chart;
  var ctx = document.getElementById('future-chart'); if (!ctx) return;
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: fc.labels,
      datasets: [
        { label: '全球年出货量（万台）', data: fc.shipments, borderColor: '#0052CC', backgroundColor: 'rgba(0,82,204,0.06)', tension: .4, yAxisID: 'y',  borderWidth: 2, pointRadius: 3 },
        { label: '均价（美元）',         data: fc.avg_price,  borderColor: '#C8002A', backgroundColor: 'rgba(200,0,42,0.06)',  tension: .4, yAxisID: 'y2', borderWidth: 2, pointRadius: 3, borderDash: [4, 3] }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
        tooltip: { callbacks: { label: function(c) {
          var v = c.parsed.y;
          return ' ' + c.dataset.label + '：' + (c.datasetIndex === 0 ? (v >= 10000 ? (v / 10000).toFixed(1) + '亿台' : v + '万台') : '$' + v);
        }}}
      },
      scales: {
        x:  { grid: { color: '#E2DFDA' }, ticks: { font: { size: 11 } } },
        y:  { position: 'left',  grid: { color: '#E2DFDA' }, ticks: { font: { size: 10 }, callback: function(v) { return v >= 10000 ? (v / 10000).toFixed(0) + '亿' : v + '万'; } }, title: { display: true, text: '出货量', font: { size: 10 } } },
        y2: { position: 'right', grid: { drawOnChartArea: false }, ticks: { font: { size: 10 }, callback: function(v) { return '$' + v; } }, title: { display: true, text: '均价', font: { size: 10 } } }
      }
    }
  });
}
window.initS3 = initS3;

/* ════════════════════════════════════════
   启动：加载 JSON → 初始化
════════════════════════════════════════ */
fetch('ar_data.json?v=' + Date.now())
  .then(function(r) { return r.json(); })
  .then(function(data) {
    window._AR_DATA = data;
    initAll(data);
  })
  .catch(function(e) { console.error('ar_data.json 加载失败', e); });
