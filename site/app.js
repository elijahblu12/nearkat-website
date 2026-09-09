(function () {
  'use strict';
  var MINT = '6UtY9iTZMQQ5QZVrbzFnNaJntV7oySm9k97mvwnuZcxr';
  var SF = 'https://www.stonkfun.xyz/api/public/v1/tokens/' + MINT;
  var $ = function (id) { return document.getElementById(id); };
  function setAll(sel, t) { Array.prototype.forEach.call(document.querySelectorAll(sel), function (e) { e.textContent = t; }); }

  /* ---------- formatting ---------- */
  function num(n, d) {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toLocaleString('en-US', { maximumFractionDigits: d == null ? 0 : d, minimumFractionDigits: d == null ? 0 : d });
  }
  function usd(n, d) {
    if (n == null || isNaN(n)) return '—';
    return '$' + num(n, d == null ? 0 : d);
  }
  function compact(n) {
    if (n == null || isNaN(n)) return '—';
    n = Number(n);
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n.toFixed(0);
  }
  function ago(iso) {
    if (!iso) return '—';
    var s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return Math.round(s) + 's ago';
    if (s < 3600) return Math.round(s / 60) + 'm ago';
    if (s < 86400) return (s / 3600).toFixed(1) + 'h ago';
    return (s / 86400).toFixed(1) + 'd ago';
  }
  function getJSON(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.json();
    });
  }

  /* ---------- NEAR price (two sources) ---------- */
  function nearPrice() {
    return getJSON('https://api.coingecko.com/api/v3/simple/price?ids=near&vs_currencies=usd')
      .then(function (j) { return j && j.near && j.near.usd ? Number(j.near.usd) : null; })
      .catch(function () { return null; })
      .then(function (p) {
        if (p) return p;
        return getJSON('https://api.dexscreener.com/latest/dex/tokens/3ZLekZYq2qkZiSpnSvabjit34tUkjSwD1JFuW9as9wBG')
          .then(function (j) {
            var ps = (j && j.pairs) || [];
            var best = null;
            ps.forEach(function (x) {
              if (x.baseToken && x.baseToken.address === '3ZLekZYq2qkZiSpnSvabjit34tUkjSwD1JFuW9as9wBG' && x.priceUsd) {
                if (!best || (x.liquidity && x.liquidity.usd > (best.liquidity ? best.liquidity.usd : 0))) best = x;
              }
            });
            return best ? Number(best.priceUsd) : null;
          })
          .catch(function () { return null; });
      });
  }

  /* ---------- live feed ---------- */
  var lastPayoutIso = null;
  function load() {
    return Promise.all([
      getJSON(SF + '/rewards').catch(function () { return null; }),
      getJSON(SF).catch(function () { return null; }),
      nearPrice()
    ]).then(function (res) {
      var rw = res[0] && res[0].data && res[0].data.rewards;
      var tk = res[1] && res[1].data && res[1].data.token;
      var price = res[2];

      if (rw) {
        var paid = Number(rw.distributedTokens || 0);
        var paidUsd = price ? paid * price : null;
        $('s-near').textContent = num(paid, 2);
        $('s-usd').textContent = paidUsd ? '≈ ' + usd(paidUsd) + ' at $' + num(price, 2) + ' / NEAR' : 'USD price unavailable';
        $('s-payouts').textContent = num(rw.payoutCount);
        $('s-holders').textContent = num(rw.holderCount);
        var avg = rw.holderCount ? paid / rw.holderCount : null;
        $('s-avg').textContent = avg != null ? num(avg, 2) + ' NEAR' : '—';
        lastPayoutIso = rw.lastPayoutAt || null;
        $('s-last').textContent = ago(lastPayoutIso);
        setAll('.chip-near', num(paid, 0) + ' $NEAR');
        setAll('.chip-usd', paidUsd ? '≈ ' + usd(paidUsd) + ' · ' + num(rw.holderCount) + ' wallets fed' : num(rw.holderCount) + ' wallets fed');
      } else {
        setAll('.chip-usd', 'the den is quiet, try again shortly');
      }

      if (tk && tk.market) {
        var m = tk.market;
        $('s-mcap').textContent = compact(m.marketCapUsd);
        $('s-vol').textContent = compact(m.volume24hUsd);
        var ch = Number(m.priceChange24h);
        var mc = $('s-mcap');
        mc.classList.remove('up', 'down');
        if (!isNaN(ch)) mc.classList.add(ch >= 0 ? 'up' : 'down');
        var meta = [];
        if (m.priceUsd) meta.push('price $' + Number(m.priceUsd).toFixed(6));
        if (!isNaN(ch)) meta.push('24h ' + (ch >= 0 ? '+' : '') + ch.toFixed(1) + '%');
        if (m.peakMarketCapUsd) meta.push('peak cap ' + compact(m.peakMarketCapUsd));
        if (m.volume24hUsd) meta.push('≈ ' + compact(m.volume24hUsd * 0.03) + ' of rations from today\'s volume');
        $('s-meta').textContent = 'Live from StonkFun · ' + meta.join(' · ');
      }
    });
  }
  load();
  setInterval(load, 30000);
  setInterval(function () { if (lastPayoutIso) $('s-last').textContent = ago(lastPayoutIso); }, 5000);

  /* ---------- depth meter ---------- */
  var depthEl = $('depth'), locEl = $('loc');
  var chambers = Array.prototype.slice.call(document.querySelectorAll('.chamber'));
  var surface = document.getElementById('surface');
  var lastLoc = '';
  function depth() {
    var ground = surface.offsetHeight;
    var y = window.scrollY + window.innerHeight * 0.45;
    var m = Math.max(0, (y - ground) / 100);
    depthEl.textContent = (m > 0 ? '−' : '') + m.toFixed(1) + ' m';
    var loc = 'SURFACE';
    for (var i = 0; i < chambers.length; i++) {
      var r = chambers[i].getBoundingClientRect();
      if (r.top < window.innerHeight * 0.55 && r.bottom > window.innerHeight * 0.3) {
        loc = chambers[i].querySelector('.m-name').textContent;
      }
    }
    if (m > 0 && loc === 'SURFACE') loc = 'TUNNEL';
    if (loc !== lastLoc) { locEl.textContent = loc; lastLoc = loc; }
  }
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (!ticking) { requestAnimationFrame(function () { depth(); ticking = false; }); ticking = true; }
  }, { passive: true });
  window.addEventListener('resize', depth);
  depth();

  /* ---------- chamber lighting + redaction reveal ---------- */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        e.target.classList.toggle('lit', e.isIntersecting);
        if (e.isIntersecting && e.intersectionRatio > 0.35) e.target.classList.add('clear');
      });
    }, { threshold: [0, 0.35, 0.6] });
    chambers.forEach(function (c) { io.observe(c); });
  } else {
    chambers.forEach(function (c) { c.classList.add('lit', 'clear'); });
  }

  /* ---------- copy CA ---------- */
  var toast = document.createElement('div');
  toast.className = 'toast';
  document.body.appendChild(toast);
  function say(t) {
    toast.textContent = t; toast.classList.add('show');
    clearTimeout(say._t); say._t = setTimeout(function () { toast.classList.remove('show'); }, 1800);
  }
  var copyBtn = $('copy');
  if (copyBtn) copyBtn.addEventListener('click', function () {
    var ca = $('ca').textContent.trim();
    var done = function () { say('CA copied. Welcome to the clan.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ca).then(done, function () { fallback(ca); done(); });
    else { fallback(ca); done(); }
  });
  function fallback(t) {
    var ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta);
  }
})();
