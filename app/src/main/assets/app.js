/* رابط کاربری: خواندن صفحه‌به‌صفحه، فهرست، جستجو (سوره/کلمه/جزء) و استخاره */
(function () {
  'use strict';

  var C = window.Core;
  var ND = window.SURAH_DATA;
  var db = null;

  // ------------------------------------------------------------------ utils
  var FA = '۰۱۲۳۴۵۶۷۸۹';
  var AR = '٠١٢٣٤٥٦٧٨٩';
  function toFa(n) { return String(n).replace(/\d/g, function (d) { return FA.charAt(d); }); }
  function arNum(n) { return String(n).replace(/\d/g, function (d) { return AR.charAt(d); }); }
  var esc = C.escapeHtml;
  function $(id) { return document.getElementById(id); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function sGet(k, d) {
    try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; }
  }
  function sSet(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* ignore */ } }

  var state = {
    tab: 'reader',
    page: parseInt(sGet('page', '1'), 10) || 1,
    fs: parseInt(sGet('fs', '28'), 10) || 28,
    dark: sGet('dark', '0') === '1',
    focus: null,
    idxMode: 'surah',
    smode: 'surah',
    sq: '', wq: '', jq: '',
    wres: null, wmsg: '', wshown: 100,
    ist: null
  };

  var screen = $('screen');

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.dark ? 'dark' : 'light');
    $('themebtn').textContent = state.dark ? '☀️' : '🌙';
  }
  function applyFont() {
    document.documentElement.style.setProperty('--fs', state.fs + 'px');
  }
  function setHeader(title, sub) {
    $('title').textContent = title;
    $('subtitle').textContent = sub || '';
  }
  function surahOf(n) { return db.surahs[n - 1]; }
  function typeFa(s) { return s.type === 'Medinan' ? 'مدنی' : 'مکی'; }

  // ------------------------------------------------------------------ boot
  function boot() {
    $('loading').classList.remove('hidden');
    fetch('quran.json')
      .then(function (r) {
        if (!r.ok) { var e = new Error('missing'); e.missing = true; throw e; }
        return r.json();
      })
      .then(function (raw) {
        db = C.buildDb(raw, ND);
        if (db.total !== 6236 || db.pageCount !== 604) {
          console.log('هشدار: تعداد آیات/صفحات غیرمنتظره', db.total, db.pageCount);
        }
        $('tabs').classList.remove('hidden');
        $('loading').classList.add('hidden');
        state.page = clamp(state.page, 1, db.pageCount);
        render();
      })
      .catch(function (err) {
        if (!err.missing && window.Android && window.Android.resetData) window.Android.resetData();
        showSetup(err.missing ? '' : 'فایل داده‌ی قرآن خراب بود و پاک شد. دوباره دریافت کنید.');
      });
  }

  function showSetup(msg) {
    $('loading').classList.add('hidden');
    $('tabs').classList.add('hidden');
    setHeader('قرآن کریم', 'آماده‌سازی اولیه');
    var canDownload = !!(window.Android && window.Android.downloadQuran);
    screen.innerHTML =
      '<div class="scroll"><div class="card hint">' +
      '<div class="name" style="margin-bottom:8px">متن قرآن هنوز روی گوشی نیست</div>' +
      (msg ? '<div style="color:#b3261e;margin-bottom:8px">' + esc(msg) + '</div>' : '') +
      (canDownload
        ? 'برای اولین بار باید متن کامل قرآن (حدود ۲ مگابایت) دریافت شود. بعد از آن اپ کاملاً بدون اینترنت کار می‌کند.' +
          '<br><br><button class="btn" id="dlbtn" data-act="download">دریافت متن قرآن</button>'
        : 'فایل quran.json داخل پوشه‌ی assets پیدا نشد.') +
      '</div></div>';
  }

  window.onDownloaded = function (ok) {
    if (ok) { boot(); return; }
    var b = $('dlbtn');
    if (b) { b.disabled = false; b.textContent = 'دریافت ناموفق بود؛ دوباره تلاش کنید'; }
  };

  // ------------------------------------------------------------------ render
  function render() {
    var tabs = document.querySelectorAll('#tabs button');
    for (var k = 0; k < tabs.length; k++) {
      tabs[k].classList.toggle('active', tabs[k].getAttribute('data-tab') === state.tab);
    }
    if (state.tab === 'reader') renderReader();
    else if (state.tab === 'index') renderIndex();
    else if (state.tab === 'search') renderSearch();
    else renderIst();
  }

  function openReader(page, focus) {
    state.tab = 'reader';
    state.page = clamp(page, 1, db.pageCount);
    state.focus = focus || null;
    sSet('page', state.page);
    render();
  }

  // ------------------------------------------------------------------ reader
  function banner(s) {
    var sur = surahOf(s);
    var h = '<div class="banner"><span class="b-ar">' + esc(sur.ar) + '</span>' +
      '<span class="b-fa">سوره‌ی ' + esc(sur.fa) + ' · ' + typeFa(sur) + ' · ' + toFa(sur.count) + ' آیه</span></div>';
    if (s !== 1 && s !== 9) h += '<div class="basmala">' + esc(db.basmala) + '</div>';
    return h;
  }

  function renderReader() {
    var p = state.page;
    var ayahs = db.pages[p] || [];
    var html = '';
    var para = '';
    function flush() { if (para) { html += '<p class="ayahs">' + para + '</p>'; para = ''; } }
    ayahs.forEach(function (a) {
      if (a.i === 1) { flush(); html += banner(a.s); }
      para += '<span class="ayah" data-s="' + a.s + '" data-i="' + a.i + '">' + esc(a.t) +
        ' <span class="num">﴿' + arNum(a.i) + '﴾</span></span> ';
    });
    flush();

    // عنوان: سوره‌های موجود در صفحه
    var first = ayahs.length ? ayahs[0] : null;
    var last = ayahs.length ? ayahs[ayahs.length - 1] : null;
    var title = 'قرآن کریم';
    if (first) {
      title = 'سوره‌ی ' + surahOf(first.s).fa;
      if (last.s !== first.s) title += ' – ' + surahOf(last.s).fa;
    }
    setHeader(title, 'صفحه ' + toFa(p) + ' · جزء ' + toFa(first ? first.j : 1));

    screen.innerHTML =
      '<div class="page-scroll" id="pscroll">' + html + '</div>' +
      '<div class="page-nav">' +
      '<button data-act="prev"' + (p <= 1 ? ' disabled' : '') + '>→ قبلی</button>' +
      '<button class="fs" data-act="fsm">A−</button>' +
      '<button class="mid" data-act="goto">' + toFa(p) + ' / ' + toFa(db.pageCount) + '</button>' +
      '<button class="fs" data-act="fsp">A+</button>' +
      '<button data-act="next"' + (p >= db.pageCount ? ' disabled' : '') + '>بعدی ←</button>' +
      '</div>';

    if (state.focus) {
      var el = screen.querySelector('.ayah[data-s="' + state.focus.s + '"][data-i="' + state.focus.i + '"]');
      if (el) {
        el.classList.add('flash');
        try { el.scrollIntoView({ block: 'center' }); } catch (e) { el.scrollIntoView(); }
      }
      state.focus = null;
    }
  }

  function turn(delta) {
    var np = clamp(state.page + delta, 1, db.pageCount);
    if (np === state.page) return;
    state.page = np;
    state.focus = null;
    sSet('page', np);
    renderReader();
  }

  function setFs(delta) {
    state.fs = clamp(state.fs + delta, 18, 52);
    sSet('fs', state.fs);
    applyFont();
  }

  // ------------------------------------------------------------------ index
  function surahItem(s) {
    return '<div class="item" data-open data-page="' + s.start + '">' +
      '<div class="badge">' + toFa(s.n) + '</div>' +
      '<div class="grow"><div class="name">' + esc(s.fa) + '</div>' +
      '<div class="sub">' + typeFa(s) + ' · ' + toFa(s.count) + ' آیه · صفحه ' + toFa(s.start) + '</div></div>' +
      '<div class="ar-name">' + esc(s.arShort) + '</div></div>';
  }

  function juzItem(j) {
    var a = db.juzStart[j];
    if (!a) return '';
    var snippet = a.t.split(' ').slice(0, 6).join(' ');
    return '<div class="item" data-open data-page="' + a.p + '" data-s="' + a.s + '" data-i="' + a.i + '">' +
      '<div class="badge">' + toFa(j) + '</div>' +
      '<div class="grow"><div class="name">جزء ' + toFa(j) + '</div>' +
      '<div class="sub">سوره‌ی ' + esc(surahOf(a.s).fa) + '، آیه‌ی ' + toFa(a.i) + ' · صفحه ' + toFa(a.p) + '</div>' +
      '<div class="snippet">' + esc(snippet) + ' …</div></div></div>';
  }

  function segs(kind, cur, items) {
    return '<div class="seg">' + items.map(function (it) {
      return '<button data-act="seg" data-kind="' + kind + '" data-v="' + it[0] + '"' +
        (cur === it[0] ? ' class="on"' : '') + '>' + it[1] + '</button>';
    }).join('') + '</div>';
  }

  function renderIndex() {
    setHeader('فهرست', state.idxMode === 'surah' ? '۱۱۴ سوره' : '۳۰ جزء');
    var list = '';
    if (state.idxMode === 'surah') {
      list = db.surahs.map(surahItem).join('');
    } else {
      for (var j = 1; j <= 30; j++) list += juzItem(j);
    }
    screen.innerHTML = segs('idx', state.idxMode, [['surah', 'سوره‌ها'], ['juz', 'جزءها']]) +
      '<div class="scroll">' + list + '</div>';
  }

  // ------------------------------------------------------------------ search
  function surahResults() {
    var res = C.matchSurahs(db, state.sq);
    if (!res.length) return '<div class="hint">سوره‌ای با این نام پیدا نشد.</div>';
    return res.map(surahItem).join('');
  }

  function ayahCard(a, toks) {
    return '<div class="card result" data-open data-page="' + a.p + '" data-s="' + a.s + '" data-i="' + a.i + '">' +
      '<div class="meta">سوره‌ی ' + esc(surahOf(a.s).fa) + ' · آیه‌ی ' + toFa(a.i) +
      ' · صفحه ' + toFa(a.p) + ' · جزء ' + toFa(a.j) + '</div>' +
      '<div class="ar-text">' + (toks ? C.highlight(a.t, toks) : esc(a.t)) + '</div></div>';
  }

  function wordResultsHtml() {
    if (state.wmsg) return '<div class="hint">' + esc(state.wmsg) + '</div>';
    if (state.wres === null) {
      return '<div class="hint">یک کلمه یا چند کلمه بنویسید (فارسی یا عربی، با اعراب یا بدون اعراب) و «جستجو» را بزنید.</div>';
    }
    if (!state.wres.length) return '<div class="hint">آیه‌ای با این کلمه پیدا نشد.</div>';
    var toks = C.tokens(state.wq);
    var shown = state.wres.slice(0, state.wshown);
    var html = '<div class="count">' + toFa(state.wres.length) + ' آیه یافت شد</div>' +
      shown.map(function (a) { return ayahCard(a, toks); }).join('');
    if (state.wres.length > shown.length) {
      html += '<button class="btn alt" style="width:100%" data-act="more">نمایش بیشتر</button>';
    }
    return html;
  }

  function juzGrid() {
    var n = parseInt(C.fromDigits(state.jq), 10);
    var html = '<div class="juzgrid">';
    for (var j = 1; j <= 30; j++) {
      var a = db.juzStart[j];
      if (!a) continue;
      html += '<div class="cell' + (n === j ? ' sel' : '') + '" data-open data-page="' + a.p +
        '" data-s="' + a.s + '" data-i="' + a.i + '">' + toFa(j) + '</div>';
    }
    html += '</div>';
    if (n >= 1 && n <= 30 && db.juzStart[n]) {
      var b = db.juzStart[n];
      html = '<div class="card result" data-open data-page="' + b.p + '" data-s="' + b.s + '" data-i="' + b.i + '">' +
        '<div class="name">جزء ' + toFa(n) + '</div>' +
        '<div class="sub">شروع از سوره‌ی ' + esc(surahOf(b.s).fa) + '، آیه‌ی ' + toFa(b.i) + ' · صفحه ' + toFa(b.p) + '</div>' +
        '<div class="ar-text">' + esc(b.t) + '</div></div>' + html;
    }
    return html;
  }

  function renderSearch() {
    setHeader('جستجو', '');
    var m = state.smode;
    var body;
    if (m === 'surah') {
      body = '<div class="field"><input id="q" type="search" placeholder="نام یا شماره‌ی سوره…" value="' +
        esc(state.sq) + '" autocomplete="off"></div><div id="res">' + surahResults() + '</div>';
    } else if (m === 'word') {
      body = '<div class="field"><input id="q" type="search" enterkeyhint="search" placeholder="کلمه یا عبارت…" value="' +
        esc(state.wq) + '" autocomplete="off"><button class="btn" data-act="dosearch">جستجو</button></div>' +
        '<div id="res">' + wordResultsHtml() + '</div>';
    } else {
      body = '<div class="field"><input id="q" type="text" inputmode="numeric" placeholder="شماره‌ی جزء (۱ تا ۳۰)" value="' +
        esc(state.jq) + '" autocomplete="off"></div><div id="res">' + juzGrid() + '</div>';
    }
    screen.innerHTML = segs('search', m, [['surah', 'سوره'], ['word', 'کلمه'], ['juz', 'جزء']]) +
      '<div class="scroll">' + body + '</div>';

    var q = $('q');
    if (!q) return;
    q.addEventListener('input', function () {
      if (m === 'surah') { state.sq = q.value; $('res').innerHTML = surahResults(); }
      else if (m === 'juz') { state.jq = q.value; $('res').innerHTML = juzGrid(); }
    });
    q.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.keyCode !== 13) return;
      if (m === 'word') doSearch();
      else if (m === 'juz') goJuz();
      else q.blur();
    });
  }

  function doSearch() {
    var q = $('q') ? $('q').value : state.wq;
    state.wq = q;
    state.wshown = 100;
    if (C.norm(q).replace(/\s+/g, '').length < 2) {
      state.wres = null;
      state.wmsg = 'حداقل دو حرف وارد کنید.';
    } else {
      state.wmsg = '';
      state.wres = C.searchWord(db, q);
    }
    $('res').innerHTML = wordResultsHtml();
    if ($('q')) $('q').blur();
  }

  function goJuz() {
    var n = parseInt(C.fromDigits(state.jq), 10);
    if (n >= 1 && n <= 30 && db.juzStart[n]) {
      var a = db.juzStart[n];
      openReader(a.p, { s: a.s, i: a.i });
    }
  }

  // --------------------------------------------------------------- istikhara
  function shareText(text) {
    if (window.Android && window.Android.shareText) window.Android.shareText(text);
    else if (navigator.share) navigator.share({ text: text });
  }

  function renderIst() {
    setHeader('استخاره', 'انتخاب تصادفی یک آیه');
    var html = '<div class="card ist-intro">' +
      '<div class="big">با نیت خود، «بسم الله» بگویید</div>' +
      'سپس دکمه‌ی زیر را بزنید تا یک آیه از کل قرآن به‌صورت کاملاً تصادفی نمایش داده شود.</div>' +
      '<button class="btn ist-main" data-act="pick">' + (state.ist ? 'انتخاب دوباره' : 'انتخاب آیه') + '</button>';
    if (state.ist) {
      var a = surahOf(state.ist.s).ayahs[state.ist.i - 1];
      html += '<div class="card ist-verse"><div class="ar-text">' + esc(a.t) + ' <span class="num">﴿' + arNum(a.i) + '﴾</span></div>' +
        '<div class="meta">سوره‌ی ' + esc(surahOf(a.s).fa) + ' (' + esc(surahOf(a.s).arShort) + ') · آیه‌ی ' + toFa(a.i) +
        ' · صفحه ' + toFa(a.p) + ' · جزء ' + toFa(a.j) + '</div>' +
        '<div class="ist-actions">' +
        '<button class="btn alt" data-open data-page="' + a.p + '" data-s="' + a.s + '" data-i="' + a.i + '">رفتن به صفحه‌ی قرآن</button>' +
        '<button class="btn alt" data-act="share">اشتراک‌گذاری</button></div></div>';
    }
    screen.innerHTML = '<div class="scroll">' + html + '</div>';
  }

  // ------------------------------------------------------------------ modal
  var modalEl = null;
  function closeModal() { if (modalEl) { modalEl.parentNode.removeChild(modalEl); modalEl = null; return true; } return false; }

  function openGoto() {
    closeModal();
    modalEl = document.createElement('div');
    modalEl.className = 'overlay';
    modalEl.innerHTML = '<div class="modal"><h3>رفتن به صفحه</h3>' +
      '<input id="gp" type="text" inputmode="numeric" placeholder="۱ تا ' + toFa(db.pageCount) + '">' +
      '<div class="row"><button class="btn" style="flex:1" data-act="gogo">برو</button>' +
      '<button class="btn alt" data-act="gocancel">لغو</button></div></div>';
    document.body.appendChild(modalEl);
    var inp = $('gp');
    inp.focus();
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.keyCode === 13) goGoto(); });
  }

  function goGoto() {
    var n = parseInt(C.fromDigits($('gp').value), 10);
    if (!(n >= 1 && n <= db.pageCount)) { $('gp').style.borderColor = '#b3261e'; return; }
    closeModal();
    openReader(n);
  }

  // ------------------------------------------------------------------ events
  screen.addEventListener('click', function (e) {
    var t = e.target;
    var openEl = t.closest ? t.closest('[data-open]') : null;
    if (openEl) {
      var page = parseInt(openEl.getAttribute('data-page'), 10);
      var s = openEl.getAttribute('data-s');
      var i = openEl.getAttribute('data-i');
      openReader(page, s ? { s: parseInt(s, 10), i: parseInt(i, 10) } : null);
      return;
    }
    var actEl = t.closest ? t.closest('[data-act]') : null;
    if (!actEl) return;
    var act = actEl.getAttribute('data-act');
    if (act === 'prev') turn(-1);
    else if (act === 'next') turn(1);
    else if (act === 'fsm') setFs(-2);
    else if (act === 'fsp') setFs(2);
    else if (act === 'goto') openGoto();
    else if (act === 'seg') {
      var kind = actEl.getAttribute('data-kind');
      var v = actEl.getAttribute('data-v');
      if (kind === 'idx') state.idxMode = v; else state.smode = v;
      render();
    }
    else if (act === 'dosearch') doSearch();
    else if (act === 'more') { state.wshown += 100; $('res').innerHTML = wordResultsHtml(); }
    else if (act === 'pick') { var a = C.randomAyah(db); state.ist = { s: a.s, i: a.i }; renderIst(); }
    else if (act === 'share') {
      var ay = surahOf(state.ist.s).ayahs[state.ist.i - 1];
      shareText('﴿' + ay.t + '﴾\n— سوره‌ی ' + surahOf(ay.s).fa + '، آیه‌ی ' + toFa(ay.i));
    }
    else if (act === 'download') {
      actEl.disabled = true;
      actEl.textContent = 'در حال دریافت…';
      window.Android.downloadQuran();
    }
  });

  document.addEventListener('click', function (e) {
    var t = e.target;
    var actEl = t.closest ? t.closest('.modal [data-act]') : null;
    if (!actEl) return;
    var act = actEl.getAttribute('data-act');
    if (act === 'gogo') goGoto();
    else if (act === 'gocancel') closeModal();
  });

  $('tabs').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button[data-tab]') : null;
    if (!b || !db) return;
    closeModal();
    state.tab = b.getAttribute('data-tab');
    render();
  });

  $('themebtn').addEventListener('click', function () {
    state.dark = !state.dark;
    sSet('dark', state.dark ? '1' : '0');
    applyTheme();
  });

  // ورق زدن با کشیدن انگشت: کشیدن به راست = صفحه‌ی بعد (مثل مصحف)
  var tx = 0, ty = 0, tracking = false;
  screen.addEventListener('touchstart', function (e) {
    if (state.tab !== 'reader' || modalEl || e.touches.length !== 1) { tracking = false; return; }
    tracking = true; tx = e.touches[0].clientX; ty = e.touches[0].clientY;
  }, { passive: true });
  screen.addEventListener('touchend', function (e) {
    if (!tracking) return;
    tracking = false;
    var t = e.changedTouches[0];
    var dx = t.clientX - tx, dy = t.clientY - ty;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8) turn(dx > 0 ? 1 : -1);
  }, { passive: true });

  // دکمه‌ی بازگشت اندروید
  window.handleBack = function () {
    if (closeModal()) return true;
    if (db && state.tab !== 'reader') { state.tab = 'reader'; render(); return true; }
    return false;
  };

  applyTheme();
  applyFont();
  boot();
})();
