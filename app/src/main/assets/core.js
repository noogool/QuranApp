/* منطق خالص برنامه (بدون DOM): نرمال‌سازی متن، ساخت پایگاه داده، جستجو، انتخاب تصادفی */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------- normalize
  // علائم اعراب، علائم قرآنی، کشیده و نویسه‌های جهت‌دار
  var MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ࣓-ࣿ‌-‏]/;
  // انواع الف (در رسم‌الخط عثمانی و املای معمولی متفاوتند، پس برای تطبیق حذف می‌شوند)
  var ALEF = /[آأإاٱٲٳٵ]/;
  var MAP = {
    'ى': 'ي', // ى → ي
    'ی': 'ي', // ی (فارسی) → ي
    'ک': 'ك', // ک (فارسی) → ك
    'ة': 'ه', // ة → ه
    'ہ': 'ه',
    'ھ': 'ه',
    'ۀ': 'ه',
    'ە': 'ه',
    'ؤ': 'و', // ؤ → و
    'ئ': 'ي', // ئ → ي
    'ء': ''        // ء حذف
  };

  function normChar(ch) {
    if (MARKS.test(ch) || ALEF.test(ch)) return '';
    var m = MAP[ch];
    return m === undefined ? ch : m;
  }

  /** نسخه‌ی نرمال‌شده + نگاشت هر نویسه‌ی نرمال به اندیس نویسه‌ی اصلی */
  function normMap(s) {
    var out = '';
    var map = [];
    for (var k = 0; k < s.length; k++) {
      var ch = s.charAt(k);
      if (ch === 'و') {
        // «و» + الف خنجری (مثل ٱلصَّلَوٰةَ) ← املای «صلاة» با حذف الف یکسان می‌شود
        var m = k + 1;
        while (m < s.length && /[ً-ٟ]/.test(s.charAt(m))) m++;
        if (s.charAt(m) === 'ٰ') continue;
      }
      var c = normChar(ch);
      if (c) {
        out += c;
        map.push(k);
      }
    }
    return { n: out, map: map };
  }

  function norm(s) {
    return normMap(String(s)).n;
  }

  function tokens(q) {
    return norm(q).split(/\s+/).filter(Boolean);
  }

  function fromDigits(s) {
    return String(s)
      .replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); })
      .replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---------------------------------------------------------------- basmala
  var BASMALA_WORDS = ['بسم', 'الله', 'الرحمن', 'الرحيم'].map(norm);

  /** بعضی منابع «بسم الله…» را به اول آیه‌ی اول هر سوره می‌چسبانند؛ اینجا جدا می‌شود */
  function stripBasmala(text) {
    var words = text.trim().split(/\s+/);
    if (words.length <= 4) return text;
    for (var k = 0; k < 4; k++) {
      if (norm(words[k]) !== BASMALA_WORDS[k]) return text;
    }
    return words.slice(4).join(' ');
  }

  // ---------------------------------------------------------------- database
  /**
   * raw: پاسخ api.alquran.cloud (ویرایش quran-uthmani) یا هر JSON هم‌ساختار
   *   { data: { surahs: [ { number, name, englishName, revelationType,
   *                         ayahs: [ { number, text, numberInSurah, juz, page } ] } ] } }
   */
  function buildDb(raw, names) {
    var sr = raw && ((raw.data && raw.data.surahs) || raw.surahs);
    if (!Array.isArray(sr) || sr.length === 0) throw new Error('bad-format');
    names = names || { fa: [], alias: {} };

    var db = {
      surahs: [], all: [], pages: [], pageCount: 0,
      juzStart: [], basmala: '', total: 0
    };

    sr.forEach(function (s, si) {
      var sn = s.number || si + 1;
      var arWords = String(s.name || '').trim().split(/\s+/);
      var arShort = (arWords.length > 1 && norm(arWords[0]) === 'سوره')
        ? arWords.slice(1).join(' ') : arWords.join(' ');
      var fa = names.fa[sn - 1] || String(s.englishName || sn);
      var aliases = (names.alias && names.alias[sn]) || [];
      var sur = {
        n: sn,
        ar: String(s.name || ''),
        arShort: arShort,
        en: String(s.englishName || ''),
        type: s.revelationType === 'Medinan' ? 'Medinan' : 'Meccan',
        fa: fa,
        count: 0,
        start: 0,
        ayahs: [],
        keys: [norm(fa), norm(s.name || '')].concat(aliases.map(norm)),
        enKey: String(s.englishName || '').toLowerCase().replace(/[^a-z]/g, '')
      };

      (s.ayahs || []).forEach(function (a, ai) {
        var idx = a.numberInSurah || ai + 1;
        var text = String(a.text);
        if (sn === 1 && idx === 1) db.basmala = text;
        if (idx === 1 && sn !== 1 && sn !== 9) text = stripBasmala(text);
        var ay = {
          g: a.number || db.all.length + 1,
          s: sn, i: idx, t: text,
          j: a.juz, p: a.page,
          n: norm(text)
        };
        sur.ayahs.push(ay);
        db.all.push(ay);
        if (!db.pages[ay.p]) db.pages[ay.p] = [];
        db.pages[ay.p].push(ay);
        if (ay.p > db.pageCount) db.pageCount = ay.p;
        if (!db.juzStart[ay.j]) db.juzStart[ay.j] = ay;
      });

      sur.count = sur.ayahs.length;
      sur.start = sur.count ? sur.ayahs[0].p : 0;
      db.surahs.push(sur);
    });

    for (var p = 1; p <= db.pageCount; p++) if (!db.pages[p]) db.pages[p] = [];
    db.total = db.all.length;
    if (!db.basmala) db.basmala = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
    return db;
  }

  // ---------------------------------------------------------------- search
  /** جستجوی کلمه: همه‌ی کلمه‌های پرسش باید در آیه باشند (ترتیب و فاصله مهم نیست) */
  function searchWord(db, q) {
    var toks = tokens(q);
    if (!toks.length) return [];
    return db.all.filter(function (a) {
      for (var k = 0; k < toks.length; k++) if (a.n.indexOf(toks[k]) < 0) return false;
      return true;
    });
  }

  /** متن اصلی آیه را با <mark> دور کلمه‌های یافت‌شده برمی‌گرداند */
  function highlight(text, toks) {
    var nm = normMap(text);
    var ranges = [];
    toks.forEach(function (t) {
      if (!t) return;
      var from = 0;
      for (;;) {
        var k = nm.n.indexOf(t, from);
        if (k < 0) break;
        var s = nm.map[k];
        var e = nm.map[k + t.length - 1] + 1;
        while (e < text.length && MARKS.test(text.charAt(e))) e++;
        ranges.push([s, e]);
        from = k + 1;
      }
    });
    if (!ranges.length) return escapeHtml(text);
    ranges.sort(function (a, b) { return a[0] - b[0]; });
    var merged = [ranges[0].slice()];
    for (var r = 1; r < ranges.length; r++) {
      var last = merged[merged.length - 1];
      if (ranges[r][0] <= last[1]) last[1] = Math.max(last[1], ranges[r][1]);
      else merged.push(ranges[r].slice());
    }
    var html = '';
    var pos = 0;
    merged.forEach(function (m) {
      html += escapeHtml(text.slice(pos, m[0]));
      html += '<mark>' + escapeHtml(text.slice(m[0], m[1])) + '</mark>';
      pos = m[1];
    });
    html += escapeHtml(text.slice(pos));
    return html;
  }

  /** جستجوی سوره با نام فارسی/عربی/لاتین یا شماره */
  function matchSurahs(db, q) {
    var raw = String(q || '').trim();
    if (!raw) return db.surahs.slice();
    var digits = fromDigits(raw);
    if (/^\d+$/.test(digits)) {
      var num = parseInt(digits, 10);
      return db.surahs.filter(function (s) { return s.n === num; });
    }
    var nq = norm(raw);
    var lq = raw.toLowerCase().replace(/[^a-z]/g, '');
    var scored = [];
    db.surahs.forEach(function (s) {
      var score = 9;
      if (nq) {
        if (s.keys.some(function (k) { return k === nq; })) score = 0;
        else if (s.keys.some(function (k) { return k.indexOf(nq) === 0; })) score = 1;
        else if (s.keys.some(function (k) { return k.indexOf(nq) >= 0; })) score = 2;
      }
      if (score === 9 && lq && s.enKey.indexOf(lq) >= 0) score = 3;
      if (score < 9) scored.push([score, s]);
    });
    scored.sort(function (a, b) { return a[0] - b[0] || a[1].n - b[1].n; });
    return scored.map(function (x) { return x[1]; });
  }

  // ---------------------------------------------------------------- random
  function secureRandomInt(max) {
    var c = root.crypto || root.msCrypto;
    if (c && c.getRandomValues) {
      var a = new Uint32Array(1);
      var limit = Math.floor(0x100000000 / max) * max;
      do { c.getRandomValues(a); } while (a[0] >= limit);
      return a[0] % max;
    }
    return Math.floor(Math.random() * max);
  }

  /** یک آیه‌ی کاملاً تصادفی از کل قرآن (احتمال یکسان برای همه‌ی ۶۲۳۶ آیه) */
  function randomAyah(db, rand) {
    var r = rand || secureRandomInt;
    return db.all[r(db.all.length)];
  }

  var Core = {
    norm: norm, normMap: normMap, tokens: tokens, fromDigits: fromDigits,
    escapeHtml: escapeHtml, stripBasmala: stripBasmala, buildDb: buildDb,
    searchWord: searchWord, highlight: highlight, matchSurahs: matchSurahs,
    randomAyah: randomAyah, secureRandomInt: secureRandomInt
  };

  root.Core = Core;
  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
})(typeof window !== 'undefined' ? window : globalThis);
