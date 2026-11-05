/* HEARTH Blueprint: draws everything from the manifest. No framework, no network calls, so the file opens anywhere. */
(function () {
  "use strict";
  var M = JSON.parse(document.getElementById("blueprint-data").textContent);
  var S = M.stories;
  var F = M.facts;
  var REPO = "https://github.com/mail6heatler/Project-HEARTH/blob/main/";
  var LIVE = "https://project-hearth-five.vercel.app";
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var INV = { ACME: { c: "#4CC9F0", s: "●" }, CFI: { c: "#A78BFA", s: "■" }, SPICE: { c: "#5EE6A8", s: "◆" } };
  var INV_IDS = ["ACME", "CFI", "SPICE"];
  var CONF = { supported: { c: "#5EE6A8", i: "✓", l: "supported" }, sparse: { c: "#FFC857", i: "~", l: "sparse" }, extrapolated: { c: "#FFC857", i: "~", l: "extrapolated" }, no_data: { c: "#FF5D6C", i: "∅", l: "no data" } };

  // ---------------------------------------------------------------- helpers
  function $(q, el) { return (el || document).querySelector(q); }
  function $$(q, el) { return Array.prototype.slice.call((el || document).querySelectorAll(q)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function md(s) { return esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>"); }
  function T(st) {
    if (typeof st === "string") return md(st);
    if (st.s === st.e) return md(st.s);
    return '<span class="t-s">' + md(st.s) + '</span><span class="t-e">' + md(st.e) + "</span>";
  }
  function n(v) { return typeof v === "number" ? v.toLocaleString("en-US") : esc(v); }
  function fileLink(p, label) { return '<a class="file" href="' + REPO + esc(p) + '" target="_blank" rel="noopener">' + esc(label || p) + "</a>"; }
  function bytes(b) { return b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.round(b / 1024) + " KB"; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, reduced ? 0 : ms); }); }
  function confPill(id) { var c = CONF[id] || CONF.no_data; return '<span class="pill" style="--p:' + c.c + '"><i aria-hidden="true">' + c.i + "</i>" + esc(c.l) + "</span>"; }
  function invDot(id) { return '<span class="dot" style="color:' + INV[id].c + '" aria-hidden="true">' + INV[id].s + "</span>"; }
  function onView(el, fn) {
    if (!("IntersectionObserver" in window)) return fn();
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); fn(); } }); }, { threshold: 0.2 });
    io.observe(el);
  }
  function section(id, inner) {
    var s = S.sections[id];
    var pill = M.needsReview.some(function (r) { return r.section === id; }) ? '<span class="review-pill">' + esc(S.review.pill) + "</span>" : "";
    return '<section id="' + id + '" class="sec"><header class="sec-head"><p class="eyebrow">' + esc(s.eyebrow) + pill + "</p><h2>" + esc(s.title) + '</h2><p class="lead">' + T(s.intro) + "</p></header>" + inner + "</section>";
  }
  function panelHead(title, story) { return '<div class="panel-head"><h3>' + esc(title) + "</h3>" + (story ? "<p>" + T(story) + "</p>" : "") + "</div>"; }

  // ---------------------------------------------------------------- edges between elements
  function curve(a, b, sideways) {
    var ax = a.left + a.width / 2, ay = a.top + a.height / 2, bx = b.left + b.width / 2, by = b.top + b.height / 2;
    var dx = bx - ax, dy = by - ay, x1, y1, x2, y2, k;
    if (sideways || Math.abs(dx) >= Math.abs(dy)) {
      x1 = dx > 0 ? a.left + a.width : a.left; y1 = ay; x2 = dx > 0 ? b.left : b.left + b.width; y2 = by;
      k = (x2 - x1) / 2;
      return "M" + x1 + " " + y1 + " C" + (x1 + k) + " " + y1 + " " + (x2 - k) + " " + y2 + " " + x2 + " " + y2;
    }
    x1 = ax; y1 = dy > 0 ? a.top + a.height : a.top; x2 = bx; y2 = dy > 0 ? b.top : b.top + b.height;
    k = (y2 - y1) / 2;
    return "M" + x1 + " " + y1 + " C" + x1 + " " + (y1 + k) + " " + x2 + " " + (y2 - k) + " " + x2 + " " + y2;
  }
  function drawEdges(box, svg, edges) {
    var r = box.getBoundingClientRect();
    function rect(el) { var q = el.getBoundingClientRect(); return { left: q.left - r.left, top: q.top - r.top, width: q.width, height: q.height }; }
    var html = "";
    edges.forEach(function (e, i) {
      if (!e.from || !e.to || !e.from.offsetParent || !e.to.offsetParent) return;
      var d = curve(rect(e.from), rect(e.to), e.sideways);
      html += '<path d="' + d + '" fill="none" stroke="' + (e.color || "#3A4B70") + '" stroke-width="' + (e.width || 1.6) + '"' + (e.dash ? ' stroke-dasharray="4 5"' : "") + (e.opacity ? ' opacity="' + e.opacity + '"' : "") + "/>";
      if (!reduced && e.particles) {
        for (var p = 0; p < e.particles; p++) {
          var dur = e.dur || 3.4;
          var col = e.colors ? e.colors[p % e.colors.length] : e.color || "#FF7A2F";
          html += '<circle r="3.2" fill="' + col + '"><animateMotion dur="' + dur + 's" begin="' + (-(p * dur) / e.particles - i * 0.31).toFixed(2) + 's" repeatCount="indefinite" path="' + d + '"/></circle>';
        }
      }
    });
    svg.innerHTML = html;
  }
  function liveEdges(box, svg, getEdges) {
    function go() { drawEdges(box, svg, getEdges()); }
    go();
    if ("ResizeObserver" in window) new ResizeObserver(go).observe(box);
    else window.addEventListener("resize", go);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go);
    window.addEventListener("load", go);
    return go;
  }

  // ---------------------------------------------------------------- hero
  function hero() {
    var when = new Date(M.scan.at);
    var stamp = when.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    var banner = M.unexplained.length
      ? '<div class="banner" role="status"><b>New, not explained yet:</b> ' + M.unexplained.map(function (u) { return "<code>" + esc(u.id) + "</code>"; }).join(" ") + "<span> The scanner found these in the code. Add their stories to <code>scripts/blueprint/stories.ts</code>.</span></div>"
      : "";
    var review = M.needsReview.length
      ? '<div class="banner review" role="status"><b>' + esc(S.review.title) + "</b> " + T(S.review.story) + '<ul class="review-list">' + M.needsReview.map(function (r) { return "<li>" + fileLink(r.file) + " <span>" + esc(S.review.reasons[r.reason] || r.reason) + '</span> <a href="#' + esc(r.section) + '">' + esc(S.sections[r.section] ? S.sections[r.section].nav : r.section) + " ↓</a></li>"; }).join("") + "</ul></div>"
      : "";
    return '<section id="top" class="hero">' + banner + review +
      '<p class="eyebrow">' + esc(S.hero.eyebrow) + '</p><h1 class="fire">' + esc(S.hero.title) + '</h1><p class="lead big">' + T(S.hero.lead) + "</p>" +
      '<p class="stamp"><span class="live-badge"><i></i>Watching for changes</span><span>Scanned from the code on ' + esc(stamp) + "</span>" + (M.scan.commit ? "<span>at commit <code>" + esc(M.scan.commit) + "</code></span>" : "") + "</p>" +
      '<ul class="stats">' + S.hero.stats.map(function (t) { return '<li><b class="count" data-to="' + esc(F[t.fact]) + '">' + n(F[t.fact]) + "</b><span>" + esc(t.label) + "</span></li>"; }).join("") + "</ul></section>";
  }

  // ---------------------------------------------------------------- the machine
  var MAP_EDGES = [
    ["nasa", "ingest", 1], ["ingest", "clean", 1], ["clean", "brains", 1], ["brains", "api", 0], ["api", "pages", 1], ["pages", "you", 1],
    ["brains", "tools", 1], ["tools", "vesta", 1], ["engines", "vesta", 1], ["vesta", "api", 1],
    ["clean", "repo", 0], ["repo", "vercel", 1], ["vercel", "pages", 1],
  ];
  function machine() {
    var nodes = Object.keys(S.mapNodes).map(function (id) {
      var d = S.mapNodes[id];
      return '<button type="button" class="node node-' + id + '" data-node="' + id + '" style="grid-area:' + id + '"><b>' + esc(d.label) + "</b><span>" + esc(d.sub) + "</span></button>";
    }).join("");
    return section("map", '<div class="panel map-panel"><div class="map" id="machine"><svg class="edges" aria-hidden="true" id="map-edges"></svg>' + nodes + '</div><div id="map-detail" class="detail" aria-live="polite"></div></div>');
  }
  function initMachine() {
    var box = $("#machine"), svg = $("#map-edges"), colors = ["#4CC9F0", "#A78BFA", "#5EE6A8", "#FF7A2F"];
    liveEdges(box, svg, function () {
      var mobile = window.innerWidth <= 760;
      return MAP_EDGES.filter(function (e) { return !mobile || e[2]; }).map(function (e) {
        var main = e[0] !== "repo" && e[0] !== "vercel" && e[0] !== "clean" || e[1] === "brains";
        return { from: $('[data-node="' + e[0] + '"]', box), to: $('[data-node="' + e[1] + '"]', box), particles: main ? 2 : 1, colors: main ? colors : ["#FFB98A"], dash: !main, color: "#3A4B70" };
      });
    });
    function select(id) {
      var d = S.mapNodes[id];
      $$(".node", box).forEach(function (b) { var on = b.dataset.node === id; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
      $("#map-detail").innerHTML = "<h3>" + esc(d.label) + "</h3><p>" + T(d.story) + '</p><p class="files">' + d.files.map(function (f) { return fileLink(f); }).join("") + '</p><a class="jump" href="#' + d.jump + '">See it up close ↓</a>';
    }
    $$(".node", box).forEach(function (b) { b.addEventListener("click", function () { select(b.dataset.node); }); });
    select("nasa");
  }

  // ---------------------------------------------------------------- data journey
  function journey() {
    var cards = INV_IDS.map(function (id) {
      var i = M.investigations.filter(function (x) { return x.id === id; })[0];
      var d = S.investigations[id];
      var files = M.raw.filter(function (r) { return r.investigation === id; }).map(function (r) {
        return "<li>" + fileLink(r.file, r.name) + "<span>" + (r.pages ? r.pages + (r.pages === 1 ? " page · " : " pages · ") : "") + (r.rows ? r.rows + " rows · " : "") + bytes(r.bytes) + "</span></li>";
      }).join("");
      return '<article class="inv" style="--inv:' + INV[id].c + '"><h4>' + invDot(id) + " " + id + " <small>" + esc(d.title) + "</small></h4><p>" + T(d.story) + '</p><ul class="inv-files">' + files + "</ul></article>";
    }).join("");
    var steps = S.ingestSteps.map(function (st, i) { return '<li><button type="button" class="step" data-step="' + i + '"><i>' + (i + 1) + "</i>" + esc(st.label) + "</button></li>"; }).join("");
    var totals = { rows: F.testsTotal, chunks: F.chunks, tables: F.tables };
    var lanes = S.split.lanes.map(function (l) {
      var bar = INV_IDS.map(function (id) {
        var v = M.investigations.filter(function (x) { return x.id === id; })[0][l.key];
        return v ? '<span class="seg" style="flex:' + v + " 0 0;background:" + INV[id].c + '" title="' + id + ": " + n(v) + '"></span>' : "";
      }).join("");
      var legend = INV_IDS.map(function (id) { var v = M.investigations.filter(function (x) { return x.id === id; })[0][l.key]; return "<span>" + invDot(id) + " " + id + " <b>" + n(v) + "</b></span>"; }).join("");
      return '<article class="lane"><header><code>' + esc(l.file) + '</code><b class="lane-n">' + n(totals[l.key]) + "</b></header><h4>" + esc(l.title) + ' <small>' + esc(l.from) + '</small></h4><div class="bar" role="img" aria-label="' + esc(l.title) + ' by investigation">' + bar + '</div><p class="legend">' + legend + '</p><p class="use">Used by: ' + esc(l.use) + "</p></article>";
    }).join("");
    var tabs = M.samples.map(function (x, i) { return '<button type="button" class="tab" data-sample="' + i + '" style="--inv:' + INV[x.investigation].c + '">' + invDot(x.investigation) + " " + esc(x.investigation) + "</button>"; }).join("");
    var ch = M.chunkSample;
    var chunkHtml = "";
    if (ch) {
      var keep = 240;
      var a = ch.first.slice(0, ch.first.length - ch.overlap), shared = ch.second.slice(0, ch.overlap), b = ch.second.slice(ch.overlap);
      chunkHtml = '<div class="panel">' + panelHead(S.chunkDemo.title, S.chunkDemo.story) + '<div class="chunks"><article><header><code>' + esc(ch.firstId) + '</code></header><p>' + (a.length > keep ? "…" : "") + esc(a.slice(-keep)) + "<mark>" + esc(shared) + "</mark></p></article><article><header><code>" + esc(ch.secondId) + "</code></header><p><mark>" + esc(shared) + "</mark>" + esc(b.slice(0, keep)) + (b.length > keep ? "…" : "") + '</p></article></div><p class="cite">Source: ' + fileLink(ch.file) + ", page " + ch.page + " · " + ch.overlap + " shared characters</p></div>";
    }
    return section("journey",
      '<div class="invs">' + cards + "</div>" +
      '<div class="panel"><div class="panel-head"><h3>Inside the cleaner</h3></div><ol class="steps" id="steps">' + steps + '</ol><div id="step-detail" class="detail tight" aria-live="polite"></div></div>' +
      '<div class="panel">' + panelHead(S.split.title, S.split.story) + '<div class="lanes">' + lanes + '</div><div class="equation" aria-label="' + esc(F.testsTotal) + " rows minus " + esc(F.duplicates) + " duplicates equals " + esc(F.testsCounted) + ' counted tests"><span><b>' + n(F.testsTotal) + "</b> rows</span><i>−</i><span><b>" + n(F.duplicates) + "</b> repeats</span><i>=</i><span class=\"eq-final\"><b>" + n(F.testsCounted) + "</b> counted tests</span></div><p class=\"note\">" + T(S.split.equation) + "</p></div>" +
      (M.samples.length ? '<div class="panel">' + panelHead(S.rawClean.title, S.rawClean.story) + '<div class="tabs" role="group" aria-label="Choose an experiment">' + tabs + '<button type="button" class="btn" id="clean-go">Clean this row ▶</button></div><div id="clean-table"></div></div>' : "") +
      chunkHtml);
  }
  function initJourney() {
    var active = 0, auto = !reduced, box = $("#steps");
    function show(i) {
      active = i;
      $$(".step", box).forEach(function (b, k) { b.classList.toggle("on", k === i); b.classList.toggle("past", k < i); b.setAttribute("aria-pressed", k === i); });
      box.style.setProperty("--done", (i / (S.ingestSteps.length - 1)) * 100 + "%");
      var st = S.ingestSteps[i];
      $("#step-detail").innerHTML = "<b>" + esc(st.label) + "</b> " + T(st.story);
    }
    $$(".step", box).forEach(function (b) { b.addEventListener("click", function () { auto = false; show(Number(b.dataset.step)); }); });
    show(0);
    if (auto) onView(box, function () { var t = setInterval(function () { if (!auto) return clearInterval(t); show((active + 1) % S.ingestSteps.length); }, 3400); });

    if (!M.samples.length) return;
    var run = 0, sample = 0;
    function renderClean(animate) {
      var x = M.samples[sample], my = ++run;
      $$("[data-sample]").forEach(function (b, k) { b.classList.toggle("on", k === sample); b.setAttribute("aria-pressed", k === sample); });
      var rows = x.mapping.map(function (m) {
        var i = x.columns.indexOf(m.raw);
        var rawV = i >= 0 ? x.values[i] : "column not found";
        var v = x.clean[m.clean];
        return '<tr class="' + (animate ? "pending" : "") + '"><td data-l="NASA column"><span class="col">' + esc(m.raw) + "</span><code>" + esc(rawV === "" ? "empty" : rawV) + '</code></td><td class="how" data-l="What happens">→ ' + esc(m.how) + ' →</td><td data-l="Clean field"><span class="col">' + esc(m.clean) + "</span><code>" + esc(v == null ? "null" : v) + "</code></td></tr>";
      }).join("");
      var notes = (x.clean.flags || []).length ? '<p class="note">Flags on this record: ' + x.clean.flags.map(function (f) { return "<code>" + esc(f) + "</code>"; }).join(" ") + "</p>" : "";
      var all = x.columns.map(function (c, i) { return "<li><span>" + esc(c) + "</span><code>" + esc(x.values[i] === "" ? "empty" : x.values[i]) + "</code></li>"; }).join("");
      $("#clean-table").innerHTML = '<table class="clean"><thead><tr><th scope="col">NASA row</th><th scope="col">Cleaner</th><th scope="col">HEARTH record</th></tr></thead><tbody>' + rows + "</tbody></table>" + notes +
        '<p class="cite">Record <code>' + esc(x.clean.test_id) + "</code> keeps its source: " + fileLink(x.file) + ", row " + x.row + '</p><details class="more"><summary>See the whole raw row</summary><ul class="kv">' + all + "</ul></details>";
      if (animate) {
        $$("#clean-table tbody tr").reduce(function (p, tr) {
          return p.then(function () { if (my !== run) return; tr.classList.remove("pending"); tr.classList.add("flash"); return sleep(420); });
        }, sleep(150));
      }
    }
    $$("[data-sample]").forEach(function (b) { b.addEventListener("click", function () { sample = Number(b.dataset.sample); renderClean(!reduced); }); });
    $("#clean-go").addEventListener("click", function () { renderClean(!reduced); });
    renderClean(false);
    onView($("#clean-table"), function () { renderClean(!reduced); });
  }

  // ---------------------------------------------------------------- storage + envelope playground
  var CHART = { w: 640, h: 380, l: 46, r: 14, t: 14, b: 42 };
  function storage() {
    var flow = S.storageSteps.map(function (st, i) { return '<li class="flow-card"><i>' + (i + 1) + "</i><h4>" + esc(st.title) + "</h4><p>" + T(st.story) + "</p></li>"; }).join("");
    var missions = M.missions.map(function (m) { return '<button type="button" class="chip" data-m="' + esc(m.id) + '">' + esc(m.short) + "</button>"; }).join("");
    return section("storage", '<ol class="flow">' + flow + "</ol>" +
      '<div class="panel">' + panelHead(S.envelope.title, S.envelope.story) +
      '<div class="env"><div class="env-side"><p class="chips" role="group" aria-label="Load a mission">' + missions + "</p>" +
      '<label class="slider"><span>Oxygen <output id="o2-out"></output></span><input id="o2" type="range" min="0" max="100" step="1"></label>' +
      '<label class="slider"><span>Pressure <output id="p-out"></output></span><input id="p" type="range" min="1" step="0.1"></label>' +
      '<div class="verdict" aria-live="polite" id="verdict"></div><p class="note">' + T(S.envelope.rule) + "</p></div>" +
      '<div class="env-chart"><p class="legend chart-legend">' + INV_IDS.map(function (id) { return "<span>" + invDot(id) + " " + id + "</span>"; }).join("") + '<span><span class="swatch-box" aria-hidden="true"></span> your evidence window</span></p><div class="chart-wrap" id="env-wrap"><svg id="env-svg" viewBox="0 0 ' + CHART.w + " " + CHART.h + '" role="img" aria-label="NASA tests plotted by pressure and oxygen, with your evidence window"></svg><div class="tip" id="env-tip" hidden></div></div></div></div>' +
      '<details class="more" id="env-more"><summary>List the tests in the window</summary><div id="env-list"></div></details></div>');
  }
  function initStorage() {
    var pts = M.points, rule = { o2: F.envO2, p: F.envP, min: F.envMin };
    var xMax = Math.ceil(Math.max.apply(null, pts.map(function (q) { return q[2]; })) / 10) * 10;
    var c = CHART, W = c.w - c.l - c.r, H = c.h - c.t - c.b;
    function X(v) { return c.l + (v / xMax) * W; }
    function Y(v) { return c.t + H - (v / 100) * H; }
    var o2 = $("#o2"), p = $("#p");
    p.max = xMax;
    var g = "";
    for (var y = 0; y <= 100; y += 20) g += '<line x1="' + c.l + '" x2="' + (c.w - c.r) + '" y1="' + Y(y) + '" y2="' + Y(y) + '" class="grid"/><text x="' + (c.l - 8) + '" y="' + (Y(y) + 4) + '" class="axis" text-anchor="end">' + y + "</text>";
    for (var x = 0; x <= xMax; x += 10) g += '<text x="' + X(x) + '" y="' + (c.h - c.b + 18) + '" class="axis" text-anchor="middle">' + x + "</text>";
    g += '<text x="' + (c.l + W / 2) + '" y="' + (c.h - 6) + '" class="axis-t" text-anchor="middle">Pressure (psi)</text><text transform="translate(12 ' + (c.t + H / 2) + ') rotate(-90)" class="axis-t" text-anchor="middle">Oxygen (%)</text>';
    var dots = pts.map(function (q) {
      var id = INV_IDS[q[0]], cx = X(q[2]), cy = Y(q[1]), col = INV[id].c;
      if (q[0] === 1) return '<rect x="' + (cx - 3) + '" y="' + (cy - 3) + '" width="6" height="6" fill="' + col + '" class="pt"/>';
      if (q[0] === 2) return '<path d="M' + cx + " " + (cy - 4) + "l4 4l-4 4l-4-4z" + '" fill="' + col + '" class="pt"/>';
      return '<circle cx="' + cx + '" cy="' + cy + '" r="3.2" fill="' + col + '" class="pt"/>';
    }).join("");
    $("#env-svg").innerHTML = g + "<g>" + dots + '</g><rect id="env-win" class="win" rx="4"/><circle id="env-pin" class="pin" r="6"/>';

    function update() {
      var a = Number(o2.value), b = Number(p.value), res = BPLogic.envelope(pts, a, b, rule);
      $("#o2-out").textContent = a + "%";
      $("#p-out").textContent = b + " psi";
      var win = $("#env-win");
      var x1 = X(Math.max(0, b - rule.p)), x2 = X(Math.min(xMax, b + rule.p)), y1 = Y(Math.min(100, a + rule.o2)), y2 = Y(Math.max(0, a - rule.o2));
      win.setAttribute("x", x1); win.setAttribute("y", y1); win.setAttribute("width", Math.max(2, x2 - x1)); win.setAttribute("height", Math.max(2, y2 - y1));
      var pin = $("#env-pin"); pin.setAttribute("cx", X(b)); pin.setAttribute("cy", Y(a));
      var by = INV_IDS.map(function (id, i) { var k = res.inside.filter(function (q) { return q[0] === i; }).length; return k ? "<span>" + invDot(id) + " " + id + " <b>" + k + "</b></span>" : ""; }).join("");
      var po2 = BPLogic.pO2(a, b), ratio = BPLogic.ratioToIss(a, b, F.issPo2);
      $("#verdict").innerHTML = '<div class="v-top"><b class="v-n">' + res.count + "</b><span>tests nearby</span>" + confPill(res.status) + '</div><p class="legend">' + (by || "<span>No NASA test is this close. That's a data gap.</span>") + '</p><p class="formula"><span>pO2 = (' + a + " / 100) × " + b + " = <b>" + po2 + ' psi</b></span><span class="t-e-inline">' + ratio + "× the ISS (" + F.issPo2 + " psi)</span></p>";
      $("#env-list").innerHTML = res.count ? '<ul class="kv ids">' + res.inside.slice(0, 60).map(function (q) { return "<li><code>" + esc(q[3]) + "</code><span>" + q[1] + "% · " + q[2] + " psi</span></li>"; }).join("") + "</ul>" + (res.count > 60 ? '<p class="note">Showing 60 of ' + res.count + ".</p>" : "") : '<p class="note">Nothing to list.</p>';
      $$("[data-m]").forEach(function (bt) { var m = M.missions.filter(function (x) { return x.id === bt.dataset.m; })[0]; var on = m.o2 === a && m.p === b; bt.classList.toggle("on", on); bt.setAttribute("aria-pressed", on); });
    }
    o2.addEventListener("input", update);
    p.addEventListener("input", update);
    $$("[data-m]").forEach(function (b) { b.addEventListener("click", function () { var m = M.missions.filter(function (x) { return x.id === b.dataset.m; })[0]; o2.value = m.o2; p.value = m.p; update(); }); });
    var start = M.missions.filter(function (m) { return m.id === "lunar-rover"; })[0] || M.missions[0];
    o2.value = start.o2; p.value = start.p; update();

    var wrap = $("#env-wrap"), tip = $("#env-tip"), svg = $("#env-svg");
    wrap.addEventListener("pointermove", function (ev) {
      var r = svg.getBoundingClientRect(), sx = ((ev.clientX - r.left) / r.width) * c.w, sy = ((ev.clientY - r.top) / r.height) * c.h, best = null, bd = 196;
      pts.forEach(function (q) { var d = Math.pow(X(q[2]) - sx, 2) + Math.pow(Y(q[1]) - sy, 2); if (d < bd) { bd = d; best = q; } });
      if (!best) { tip.hidden = true; return; }
      tip.hidden = false;
      tip.innerHTML = "<b>" + esc(best[3]) + "</b><br>" + best[1] + "% O2 · " + best[2] + " psi";
      var left = ev.clientX - r.left + 12;
      tip.style.left = Math.min(left, r.width - 150) + "px";
      tip.style.top = Math.max(0, ev.clientY - r.top - 44) + "px";
    });
    wrap.addEventListener("pointerleave", function () { tip.hidden = true; });
  }

  // ---------------------------------------------------------------- feature tracer
  function short(p) { return p.replace("lib/", "").replace("data/processed/", "").replace("/api", "") || "/"; }
  var ALL_PAGES = M.pages.concat([M.everyPage]);
  function features() {
    var tabs = ALL_PAGES.map(function (p, i) { return '<button type="button" class="tab" data-page="' + i + '">' + esc(p.label) + "</button>"; }).join("");
    var dataFiles = M.processed.filter(function (f) { return /\.json$/.test(f.name); });
    function col(title, items) { return '<div class="tcol"><h4>' + esc(title) + "</h4>" + items + "</div>"; }
    var grid =
      col("Page", ALL_PAGES.map(function (p, i) { return '<span class="tn" data-t="p:' + esc(p.path) + '" data-idx="' + i + '">' + esc(p.path) + "</span>"; }).join("")) +
      col("API route", M.routes.map(function (r) { return '<span class="tn" data-t="a:' + esc(r.path) + '" title="' + esc(S.routes[r.path] ? S.routes[r.path].s : "") + '">' + esc(short(r.path)) + "</span>"; }).join("")) +
      col("Brain", M.libs.map(function (l) { return '<span class="tn" data-t="l:' + esc(l) + '" title="' + esc(S.libs[l] ? S.libs[l].s : "") + '">' + esc(short(l)) + "</span>"; }).join("")) +
      col("Clean data", dataFiles.map(function (d) { return '<span class="tn" data-t="d:' + esc(d.file) + '">' + esc(d.name) + "</span>"; }).join(""));
    var shell = M.shell.map(function (f) { var d = S.shell[f]; return '<article class="mini"><h4>' + esc(d ? d.title : f) + "</h4><p>" + (d ? T(d.story) : "New, not explained yet.") + "</p>" + fileLink(f) + "</article>"; }).join("");
    var routes = M.routes.map(function (r) { var st = S.routes[r.path]; return "<tr><td><code>" + esc(r.methods.join(" ")) + " " + esc(r.path) + "</code></td><td>" + (st ? T(st) : "New, not explained yet.") + '</td><td class="only-e-cell">' + fileLink(r.file, "code") + "</td></tr>"; }).join("");
    var libs = M.libs.map(function (l) { var st = S.libs[l]; return "<tr><td><code>" + esc(l) + "</code></td><td>" + (st ? T(st) : "New, not explained yet.") + "</td><td>" + fileLink(l === "lib/vesta" ? "lib/vesta" : l, "code") + "</td></tr>"; }).join("");
    return section("features",
      '<div class="panel"><div class="tabs wrap" role="group" aria-label="Choose a page">' + tabs + '</div><div id="page-detail" class="detail tight" aria-live="polite"></div><div class="tracer" id="tracer"><svg class="edges" id="tracer-edges" aria-hidden="true"></svg>' + grid + '</div><p class="legend trace-key"><span><span class="k solid" aria-hidden="true"></span> asks the server</span><span><span class="k dashed" aria-hidden="true"></span> used directly by the page</span></p></div>' +
      '<div class="panel">' + panelHead("On every page") + '<div class="minis">' + shell + "</div></div>" +
      '<details class="more panel"><summary>All ' + M.routes.length + ' API routes</summary><div class="scroll"><table class="plain">' + routes + '</table></div></details><details class="more panel"><summary>All ' + M.libs.length + ' brain modules</summary><div class="scroll"><table class="plain">' + libs + "</table></div></details>");
  }
  function initFeatures() {
    var box = $("#tracer"), svg = $("#tracer-edges"), selected = 0, routes = {};
    M.routes.forEach(function (r) { routes[r.path] = r; });
    function node(k) { return box.querySelector('[data-t="' + k.replace(/"/g, '\\"') + '"]'); }
    function build() {
      var p = ALL_PAGES[selected], edges = [], lit = {};
      lit["p:" + p.path] = 1;
      p.apis.forEach(function (a) {
        lit["a:" + a] = 1;
        edges.push({ from: node("p:" + p.path), to: node("a:" + a), color: "#FF7A2F", particles: 1, colors: ["#FFB98A"], width: 1.8, dur: 2.6 });
        (routes[a] ? routes[a].libs : []).forEach(function (l) {
          lit["l:" + l] = 1;
          edges.push({ from: node("a:" + a), to: node("l:" + l), color: "#FF7A2F", opacity: 0.55 });
        });
      });
      p.libs.forEach(function (l) {
        lit["l:" + l] = 1;
        edges.push({ from: node("p:" + p.path), to: node("l:" + l), color: "#97A3BC", dash: true, opacity: 0.55 });
      });
      Object.keys(lit).forEach(function (k) {
        if (k.indexOf("l:") !== 0) return;
        (M.libEdges[k.slice(2)] || []).forEach(function (d) {
          lit["d:" + d] = 1;
          edges.push({ from: node(k), to: node("d:" + d), color: "#5EE6A8", opacity: 0.6, particles: 1, colors: ["#5EE6A8"], dur: 3 });
        });
      });
      $$(".tn", box).forEach(function (t) { t.classList.toggle("lit", !!lit[t.dataset.t]); });
      return edges;
    }
    var redraw = liveEdges(box, svg, function () { var list = build(); list.forEach(function (e) { e.sideways = true; }); return window.innerWidth <= 820 ? [] : list; });
    function show(i) {
      selected = i;
      var p = ALL_PAGES[i], st = S.pages[p.path];
      $$("[data-page]").forEach(function (b, k) { b.classList.toggle("on", k === i); b.setAttribute("aria-pressed", k === i); });
      $("#page-detail").innerHTML = "<h3>" + esc(p.label) + " <code>" + esc(p.path) + "</code></h3><p>" + (st ? T(st.story) : "New, not explained yet.") + "</p>" + (st ? '<p class="try"><b>Try this:</b> ' + esc(st.try) + "</p>" : "") + '<p class="t-e files-line">' + p.components.length + " components · " + p.apis.length + " API routes · " + fileLink(p.file) + "</p>" + (!p.apis.length && !p.libs.length ? '<p class="note">This page needs no API call and no brain module: it is plain content.</p>' : "");
      redraw();
    }
    $$("[data-page]").forEach(function (b) { b.addEventListener("click", function () { show(Number(b.dataset.page)); }); });
    show(0);
  }

  // ---------------------------------------------------------------- VESTA
  function vesta() {
    var rail = S.stages.map(function (st, i) { return '<li data-stage="' + st.id + '"><i>' + (i + 1) + "</i><span>" + esc(st.label) + "</span></li>"; }).join("");
    var qs = M.replays.map(function (r, i) { return '<button type="button" class="chip" data-q="' + i + '">' + esc(r.label) + "</button>"; }).join("");
    function list(pts) { return "<ol>" + pts.map(function (p) { return "<li>" + T(p) + "</li>"; }).join("") + "</ol>"; }
    var tools = M.tools.map(function (t) {
      var st = S.tools[t.name];
      return '<article class="tool" data-tool="' + esc(t.name) + '"><h4><code>' + esc(t.name) + '</code><small>' + (t.kind === "data" ? "reads data" : "acts") + "</small></h4><p>" + (st ? T(st) : "New, not explained yet.") + '</p><p class="t-e tool-desc">' + esc(t.description) + "</p></article>";
    }).join("");
    var G = M.grounding;
    var bad = esc(G.badText).split(esc(G.invented)).join('<del class="bad-n">' + esc(G.invented) + "</del>");
    var gSteps = [G.toolSummary ? "<code>envelope_check</code> " + esc(G.toolSummary) : "", bad, md(G.fixRequest), esc(G.finalText)];
    var grounding = G.caught
      ? '<ol class="ground" id="ground">' + S.groundingDemo.steps.map(function (t, i) { return '<li class="' + (i === 1 ? "is-bad" : i === 2 ? "is-catch" : i === 3 ? "is-good" : "") + '"><h4>' + esc(t) + "</h4><p>" + gSteps[i] + "</p></li>"; }).join("") + '</ol><p class="note">' + esc(S.groundingDemo.note) + (G.confidence ? " Final tag: " + confPill(G.confidence) : "") + "</p>"
      : '<p class="note">The recording did not catch the number, so this demo is switched off until the scan is fixed.</p>';
    var engines = M.engines.map(function (e, i) {
      var off = e.id === "offline";
      return (i ? '<i class="link" aria-hidden="true"></i>' : "") + (off ? '<div class="eng" data-eng="offline"><b>' + esc(e.label) + '</b><small>Always on</small><span class="t-e">' + esc(e.model) + '</span></div>' : '<button type="button" class="eng" data-eng="' + e.id + '"><b>' + esc(e.label) + '</b><small data-state></small><span class="t-e">' + esc(e.model) + "</span></button>");
    }).join("");
    var C = S.chain;
    return section("vesta",
      '<div class="panel replay">' + panelHead(S.replay.title) +
      '<p class="chips" role="group" aria-label="Choose a question">' + qs + "</p>" +
      '<ol class="rail" id="rail">' + rail + '</ol><div id="caption" class="detail tight" aria-live="polite"></div>' +
      '<div class="chat-wrap"><div class="chat" id="chat" tabindex="0" aria-label="Replay of a VESTA answer"></div><div class="log t-e" id="log" tabindex="0" aria-label="Raw event stream"></div></div>' +
      '<p class="actions"><button type="button" class="btn" id="replay-go">↻ Play again</button></p><p class="note">' + esc(S.replay.note) + "</p></div>" +
      '<div class="panel">' + panelHead(S.brains.title) + '<div class="brains"><article><h4>' + esc(S.brains.ai.title) + '</h4><div class="loop" aria-hidden="true"><span>Model</span><i>⇄</i><span>Tools</span><i>→</i><span>Checker</span></div>' + list(S.brains.ai.points) + "</article><article><h4>" + esc(S.brains.offline.title) + '</h4><div class="loop" aria-hidden="true"><span>Rules</span><i>→</i><span>Tools</span><i>→</i><span>Template</span></div>' + list(S.brains.offline.points) + "</article><article><h4>" + esc(S.brains.alert.title) + '</h4><div class="loop" aria-hidden="true"><span>Mission</span><i>→</i><span>Formulas</span><i>→</i><span>Alert</span></div><p>' + T(S.brains.alert.story) + "</p></article></div></div>" +
      '<div class="panel">' + panelHead(S.toolsBoard.title, S.toolsBoard.story) + '<div class="toolgrid">' + tools + "</div></div>" +
      '<div class="panel">' + panelHead(S.groundingDemo.title, S.groundingDemo.story) + grounding + "</div>" +
      '<div class="panel" id="chain">' + panelHead(C.title, C.story) + '<p class="chips" role="group" aria-label="Scenarios"><button type="button" class="chip" data-preset="ok,ok,ok,ok">All working</button><button type="button" class="chip" data-preset="nokey,ok,limit,ok">A normal bad day</button><button type="button" class="chip" data-preset="limit,limit,limit,limit">Everything at its limit</button><button type="button" class="chip" data-preset="nokey,nokey,nokey,nokey">No keys at all</button></p><div class="engines" id="engines">' + engines + '</div><div class="result" id="chain-result" aria-live="polite"></div><p class="note">' + T(C.detail) + '</p><p class="demo"><b>DEMO</b> ' + esc(C.note.replace(/^DEMO: /, "")) + "</p></div>");
  }
  function initVesta() {
    var run = 0, chat = $("#chat"), log = $("#log"), rail = $("#rail"), current = 0, stages = {};
    S.stages.forEach(function (s) { stages[s.id] = s; });
    function stage(id) {
      var seen = true;
      $$("li", rail).forEach(function (li) {
        if (li.dataset.stage === id) { li.className = "on"; seen = false; rail.scrollLeft = li.offsetLeft - rail.offsetLeft - rail.clientWidth / 2 + li.clientWidth / 2; }
        else if (seen && li.className !== "skip") li.className = "done";
      });
      var st = stages[id];
      $("#caption").innerHTML = "<b>" + esc(st.label) + "</b> " + T(st.story);
    }
    function addLog(type, data) {
      var d = data ? JSON.stringify(data) : "";
      log.insertAdjacentHTML("beforeend", '<div><b>event: ' + esc(type) + "</b>" + (d && d !== "{}" ? "<br>data: " + esc(d.length > 150 ? d.slice(0, 150) + "…" : d) : "") + "</div>");
      log.scrollTop = log.scrollHeight;
    }
    function fmtAnswer(t) { return md(t).replace(/\n/g, "<br>"); }
    function play(i) {
      var my = ++run, r = M.replays[i], alive = function () { return my === run; };
      current = i;
      $$("[data-q]").forEach(function (b, k) { b.classList.toggle("on", k === i); b.setAttribute("aria-pressed", k === i); });
      $$(".tool").forEach(function (t) { t.classList.remove("used"); });
      $$("li", rail).forEach(function (li) { li.className = ""; });
      log.innerHTML = "";
      chat.innerHTML = '<div class="bubble you">' + esc(r.question) + '</div><div class="bubble her"><div class="orb" aria-hidden="true"></div><div class="body"><p class="badge-line" id="r-badge"></p><ul class="tool-steps" id="r-steps"></ul><div class="answer" id="r-text"></div><div id="r-extra"></div></div></div>';
      var seq = sleep(0), textShown = false, uiEvents = [];
      function then(fn, wait) { seq = seq.then(function () { if (!alive()) return; fn(); return sleep(wait); }); }
      then(function () { stage("send"); }, 1100);
      then(function () { stage("gate"); }, 1100);
      then(function () { stage("cache"); }, 1000);
      then(function () { stage("router"); }, 1100);
      r.events.forEach(function (e) {
        if (e.type === "engine") {
          then(function () { $("#r-badge").textContent = e.badge; addLog("engine", { id: e.id, label: e.label, model: e.model, badge: e.badge }); stage("think"); }, 1500);
        } else if (e.type === "step") {
          then(function () {
            stage("tools");
            addLog("step", { tool: e.tool, status: e.status, summary: e.summary });
            var list = $("#r-steps"), found = $$('[data-run="' + e.tool + '"]', list).pop();
            var icon = e.status === "running" ? '<i class="spin"></i>' : e.status === "done" ? '<i class="ok">✓</i>' : '<i class="err">!</i>';
            var row = icon + "<code>" + esc(e.tool) + "</code> <span>" + esc(e.summary) + "</span>";
            if (found && e.status !== "running") { found.innerHTML = row; found.removeAttribute("data-run"); }
            else list.insertAdjacentHTML("beforeend", '<li data-run="' + esc(e.tool) + '">' + row + "</li>");
            var card = $('[data-tool="' + e.tool + '"]');
            if (card) card.classList.add("used");
          }, e.status === "running" ? 500 : 650);
        } else if (e.type === "chart") {
          then(function () { addLog("chart", { title: e.title }); $("#r-extra").insertAdjacentHTML("beforeend", '<p class="chiplet">Chart drawn: ' + esc(e.title) + "</p>"); }, 350);
        } else if (e.type === "ui") {
          uiEvents.push(e.ui);
          then(function () { addLog("ui", e.ui); }, 250);
        } else if (e.type === "text") {
          then(function () { stage("check"); textShown = true; }, 1300);
          then(function () { stage("stream"); addLog("text", { pieces: e.pieces, characters: e.text.length }); }, 0);
          seq = seq.then(function () {
            if (!alive()) return;
            var el = $("#r-text");
            if (reduced) { el.innerHTML = fmtAnswer(e.text); return; }
            return new Promise(function (res) {
              var pos = 0, stepBy = Math.max(2, Math.ceil(e.text.length / 150));
              var t = setInterval(function () {
                if (!alive()) { clearInterval(t); return res(); }
                pos = Math.min(e.text.length, pos + stepBy);
                el.innerHTML = fmtAnswer(e.text.slice(0, pos));
                chat.scrollTop = chat.scrollHeight;
                if (pos >= e.text.length) { clearInterval(t); res(); }
              }, 22);
            });
          });
        } else if (e.type === "sources") {
          then(function () {
            addLog("sources", { count: e.sources.length });
            $("#r-extra").insertAdjacentHTML("beforeend", e.sources.length ? '<p class="srcs"><b>Sources</b> ' + e.sources.slice(0, 5).map(function (s) { var name = String(s.file).split("/").pop(); return "<span>" + esc(name) + (s.row ? " row " + s.row : s.rows ? " rows " + s.rows : s.page ? " p" + s.page : "") + "</span>"; }).join("") + (e.sources.length > 5 ? "<span>+" + (e.sources.length - 5) + " more</span>" : "") + "</p>" : "");
            chat.scrollTop = chat.scrollHeight;
          }, 500);
        } else if (e.type === "confidence") {
          then(function () { addLog("confidence", { confidence: e.confidence }); $("#r-extra").insertAdjacentHTML("beforeend", '<p class="conf-line">Confidence ' + confPill(e.confidence) + "</p>"); chat.scrollTop = chat.scrollHeight; }, 700);
        } else if (e.type === "done") {
          then(function () {
            addLog("done");
            if (uiEvents.length) {
              stage("move");
              $("#r-extra").insertAdjacentHTML("beforeend", uiEvents.map(function (u) { return '<p class="chiplet">Dashboard moves: ' + esc(u.path || u.mission || u.test_id || (u.test_ids ? u.test_ids.length + " tests highlighted" : u.action)) + "</p>"; }).join(""));
              chat.scrollTop = chat.scrollHeight;
            } else {
              $('[data-stage="move"]', rail).className = "skip";
            }
            $$("li", rail).forEach(function (li) { if (li.className === "on") li.className = "done"; });
          }, 0);
        }
      });
      return seq;
    }
    $$("[data-q]").forEach(function (b) { b.addEventListener("click", function () { play(Number(b.dataset.q)); }); });
    $("#replay-go").addEventListener("click", function () { play(current); });
    if (reduced) play(0); else onView($(".replay"), function () { play(0); });
    if (!reduced) { $("#caption").innerHTML = "<b>" + esc(S.stages[0].label) + "</b> " + T(S.stages[0].story); }

    // grounding demo reveals step by step
    var ground = $("#ground");
    if (ground) {
      if (!reduced) {
        $$("li", ground).forEach(function (li) { li.classList.add("wait"); });
        onView(ground, function () { $$("li", ground).reduce(function (p, li) { return p.then(function () { li.classList.remove("wait"); return sleep(1100); }); }, sleep(100)); });
      }
    }

    // backup chain
    var ids = M.engines.filter(function (e) { return e.id !== "offline"; }).map(function (e) { return e.id; });
    var states = {}, chainRun = 0, labels = S.chain.stateLabels, order = M.fallback.states;
    ids.forEach(function (id) { states[id] = "ok"; });
    function renderChain() {
      var my = ++chainRun, key = ids.map(function (id) { return states[id]; }).join("|"), res = M.fallback.results[key];
      $$(".eng").forEach(function (el) {
        var id = el.dataset.eng;
        el.className = "eng";
        if (id !== "offline") { el.classList.add("s-" + states[id]); $("[data-state]", el).textContent = labels[states[id]]; }
      });
      $$("[data-preset]").forEach(function (b) { var on = b.dataset.preset.split(",").join("|") === key; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
      var out = $("#chain-result");
      out.innerHTML = '<p class="muted">Finding an engine…</p>';
      res.path.reduce(function (p, id) {
        return p.then(function () {
          if (my !== chainRun) return;
          var el = $('[data-eng="' + id + '"]');
          if (el) { el.classList.add(id === res.winner ? "hit" : "miss"); }
          return sleep(id === res.winner ? 0 : 480);
        });
      }, sleep(120)).then(function () {
        if (my !== chainRun) return;
        out.innerHTML = '<p class="r-title">What you would see</p><p class="badge-line">' + esc(res.badge) + "</p>" + (res.note ? '<p class="fall-note">' + esc(res.note) + "</p>" : '<p class="muted">No fallback note needed.</p>');
      });
    }
    $$("button.eng").forEach(function (b) { b.addEventListener("click", function () { var id = b.dataset.eng; states[id] = order[(order.indexOf(states[id]) + 1) % order.length]; renderChain(); }); });
    $$("[data-preset]").forEach(function (b) { b.addEventListener("click", function () { var v = b.dataset.preset.split(","); ids.forEach(function (id, i) { states[id] = v[i] || "ok"; }); renderChain(); }); });
    renderChain();
  }

  // ---------------------------------------------------------------- honesty
  function honesty() {
    var conf = S.confidence.items.map(function (c) { return '<li class="conf-card">' + confPill(c.id) + "<p>" + T(c.story) + "</p></li>"; }).join("");
    var rules = S.rules.map(function (r, i) {
      return '<article class="rule"><i>' + (i + 1) + "</i><h4>" + esc(r.title) + "</h4><p>" + T(r.story) + '</p><p class="rule-links"><span>Kept by</span>' + r.code.map(function (f) { return fileLink(f, f.split("/").pop()); }).join("") + '</p><p class="rule-links"><span>Checked by</span>' + r.test.map(function (f) { return fileLink(f, f.split("/").pop()); }).join("") + "</p></article>";
    }).join("");
    return section("honesty", '<div class="panel">' + panelHead(S.confidence.title) + '<ul class="confs">' + conf + '</ul><p class="note">' + T(S.confidence.lowest) + '</p></div><div class="rules">' + rules + "</div>");
  }

  // ---------------------------------------------------------------- ship
  function ship() {
    var steps = S.shipSteps.map(function (st, i) { return '<li><button type="button" class="step" data-ship="' + i + '"><i>' + (i + 1) + "</i>" + esc(st.label) + "<small>" + esc(st.sub) + "</small></button></li>"; }).join("");
    var vault = S.vault.steps.map(function (st) { return "<li><b>" + esc(st.label) + "</b><span>" + md(st.detail) + "</span></li>"; }).join("");
    var max = Math.max.apply(null, M.tests.map(function (t) { return t.count; }));
    var tests = M.tests.slice().sort(function (a, b) { return b.count - a.count; }).map(function (t) {
      return '<li title="' + esc(t.file) + ": " + t.count + ' test blocks">' + fileLink(t.file, t.file.replace("tests/", "").replace(".test.ts", "")) + '<span class="tbar"><i style="width:' + (t.count / max) * 100 + '%"></i></span><b>' + t.count + "</b></li>";
    }).join("");
    var deps = M.deps.map(function (d) { return "<li><b>" + esc(d.name) + "</b><code>" + esc(d.version) + "</code><span>" + esc(S.deps[d.name] || "New, not explained yet.") + "</span></li>"; }).join("");
    return section("ship",
      '<div class="panel"><ol class="steps ship" id="ship-steps">' + steps + '</ol><div id="ship-detail" class="detail tight" aria-live="polite"></div><p class="cite">Live site: <a class="file" href="' + LIVE + '" target="_blank" rel="noopener">' + LIVE.replace("https://", "") + "</a></p></div>" +
      '<div class="two"><div class="panel">' + panelHead(S.vault.title, S.vault.story) + '<ol class="vault">' + vault + '</ol></div><div class="panel">' + panelHead(S.testsPanel.title, S.testsPanel.story) + '<ul class="tests">' + tests + "</ul></div></div>" +
      '<details class="more panel"><summary>' + esc(S.stack.title) + '</summary><ul class="deps">' + deps + '</ul><p class="note"><b>' + esc(S.stack.python) + ":</b> " + M.pythonDeps.map(esc).join(", ") + "</p></details>");
  }
  function initShip() {
    var box = $("#ship-steps"), active = 0, auto = !reduced;
    function show(i) {
      active = i;
      $$(".step", box).forEach(function (b, k) { b.classList.toggle("on", k === i); b.classList.toggle("past", k < i); b.setAttribute("aria-pressed", k === i); });
      box.style.setProperty("--done", (i / (S.shipSteps.length - 1)) * 100 + "%");
      var st = S.shipSteps[i];
      $("#ship-detail").innerHTML = "<b>" + esc(st.label) + "</b> " + T(st.story);
    }
    $$(".step", box).forEach(function (b) { b.addEventListener("click", function () { auto = false; show(Number(b.dataset.ship)); }); });
    show(0);
    if (auto) onView(box, function () { var t = setInterval(function () { if (!auto) return clearInterval(t); show((active + 1) % S.shipSteps.length); }, 2800); });
  }

  // ---------------------------------------------------------------- growth
  function growth() {
    var U = S.selfUpdate;
    var steps = U.steps.map(function (st, i) { return '<li class="flow-card"><i>' + (i + 1) + "</i><h4>" + esc(st.label) + "</h4><p>" + T(st.story) + "</p></li>"; }).join("");
    var cmds = U.commands.map(function (c) { return "<li><code>" + esc(c.cmd) + "</code><span>" + esc(c.what) + "</span></li>"; }).join("");
    var watch = Object.keys(S.sections).filter(function (id) { return M.watched.some(function (w) { return w.section === id; }); }).map(function (id) {
      return '<p class="watch-group"><b>' + esc(S.sections[id].nav) + "</b>" + M.watched.filter(function (w) { return w.section === id; }).map(function (w) { return fileLink(w.file); }).join("") + "</p>";
    }).join("");
    var changes = M.changes.length
      ? '<ul class="changes">' + M.changes.map(function (c) { return "<li><time>" + esc(c.date) + "</time>" + c.added.map(function (a) { return '<span class="add">+ ' + esc(a) + "</span>"; }).join("") + c.removed.map(function (a) { return '<span class="rem">− ' + esc(a) + "</span>"; }).join("") + "</li>"; }).join("") + "</ul>"
      : '<p class="note">' + esc(S.timeline.noChanges) + "</p>";
    function item(h) {
      var phase = /^Phase (\d)/.exec(h.subject);
      return '<li class="' + (phase ? "phase" : "") + '"><time>' + esc(h.date) + '</time><div><span>' + esc(h.subject) + "</span> <code>" + esc(h.hash) + "</code></div></li>";
    }
    var head = M.history.slice(0, 10).map(item).join(""), rest = M.history.slice(10).map(item).join("");
    return section("growth",
      '<div class="panel">' + panelHead(U.title) + '<ol class="flow">' + steps + '</ol><ul class="cmds">' + cmds + '</ul><p class="guard">' + T(U.guard) + '</p><details class="more"><summary>' + esc(U.watchList) + "</summary>" + watch + "</details></div>" +
      '<div class="panel">' + panelHead(S.timeline.changes) + changes + "</div>" +
      '<div class="panel">' + panelHead(S.timeline.title) + '<ol class="timeline">' + head + "</ol>" + (rest ? '<details class="more"><summary>Show ' + (M.history.length - 10) + ' earlier changes</summary><ol class="timeline">' + rest + "</ol></details>" : "") + "</div>");
  }

  // ---------------------------------------------------------------- page chrome
  function initChrome() {
    $("#nav").innerHTML = Object.keys(S.sections).map(function (id) { return '<a href="#' + id + '" data-nav="' + id + '">' + esc(S.sections[id].nav) + "</a>"; }).join("");
    var mode = "s";
    try { mode = localStorage.getItem("blueprint-mode") === "e" ? "e" : "s"; } catch (e) { /* storage may be blocked */ }
    function setMode(v) {
      document.body.className = "mode-" + v;
      $$("[data-mode]").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.mode === v); });
      try { localStorage.setItem("blueprint-mode", v); } catch (e) { /* fine */ }
    }
    $$("[data-mode]").forEach(function (b) { b.addEventListener("click", function () { setMode(b.dataset.mode); }); });
    setMode(mode);
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          $$("[data-nav]").forEach(function (a) {
            var on = a.dataset.nav === e.target.id;
            a.classList.toggle("on", on);
            if (on) { a.setAttribute("aria-current", "true"); var nav = $("#nav"); nav.scrollLeft = a.offsetLeft - nav.clientWidth / 2 + a.clientWidth / 2; } else a.removeAttribute("aria-current");
          });
        });
      }, { rootMargin: "-45% 0px -50% 0px" });
      Object.keys(S.sections).forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
    }
    // count up the hero numbers
    if (!reduced) {
      $$(".count").forEach(function (el) {
        var to = Number(el.dataset.to);
        if (!isFinite(to)) return;
        var t0 = performance.now();
        (function tick(t) {
          var k = Math.min(1, (t - t0) / 1200), e = 1 - Math.pow(1 - k, 3);
          el.textContent = Math.round(to * e).toLocaleString("en-US");
          if (k < 1) requestAnimationFrame(tick);
        })(t0);
      });
    }
    // a still star field: decoration only
    var cv = $("#stars"), ctx = cv.getContext && cv.getContext("2d");
    function stars() {
      if (!ctx) return;
      var w = (cv.width = window.innerWidth), h = (cv.height = window.innerHeight), seed = 7;
      function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < Math.min(190, (w * h) / 7000); i++) {
        ctx.fillStyle = "rgba(232,236,246," + (0.12 + rnd() * 0.5).toFixed(2) + ")";
        var r = rnd() * 1.2 + 0.2;
        ctx.beginPath(); ctx.arc(rnd() * w, rnd() * h, r, 0, 6.3); ctx.fill();
      }
    }
    stars();
    window.addEventListener("resize", stars);
  }

  $("#app").innerHTML = hero() + machine() + journey() + storage() + features() + vesta() + honesty() + ship() + growth() +
    '<footer class="foot"><p>' + esc(S.footer) + '</p><p class="foot-links"><a class="file" href="' + LIVE + '" target="_blank" rel="noopener">Open HEARTH</a><a class="file" href="' + REPO.replace("/blob/main/", "") + '" target="_blank" rel="noopener">GitHub</a></p></footer>';
  initChrome();
  initMachine();
  initJourney();
  initStorage();
  initFeatures();
  initVesta();
  initShip();
})();
