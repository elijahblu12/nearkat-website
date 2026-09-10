(function () {
  'use strict';
  var MINT = '6UtY9iTZMQQ5QZVrbzFnNaJntV7oySm9k97mvwnuZcxr';
  var TOTAL_SUPPLY = 1000000000;
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
  function pct(value, digits) {
    if (value == null || !isFinite(value)) return '—';
    return (value * 100).toLocaleString('en-US', { maximumFractionDigits: digits == null ? 2 : digits }) + '%';
  }
  function nearAmount(value) {
    if (value == null || !isFinite(value)) return '—';
    var d = Math.abs(value) < 1 ? 4 : Math.abs(value) < 100 ? 2 : 1;
    return num(value, d);
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
  function positionEstimate(data, tokens) {
    var tokenPrice = Number(data && data.token && data.token.priceUsd) || 0;
    var nearUsd = Number(data && data.prices && data.prices.nearUsd) || 0;
    var configuredSupply = Number(data && data.calibration && data.calibration.eligibleSupply);
    var supply = configuredSupply > 0 ? configuredSupply : TOTAL_SUPPLY;
    var poolNearDay = Number(data && data.observed && data.observed.nearPerDay);
    var position = Math.max(0, Number(tokens) || 0);
    var valueUsd = tokenPrice ? position * tokenPrice : 0;
    var share = supply ? Math.min(position / supply, 1) : 0;
    var nearDay = isFinite(poolNearDay) ? poolNearDay * share : null;
    var usdDay = nearDay != null && nearUsd ? nearDay * nearUsd : null;
    return {
      tokens: position,
      tokenPrice: tokenPrice,
      nearUsd: nearUsd,
      supply: supply,
      valueUsd: valueUsd,
      share: share,
      poolNearDay: poolNearDay,
      nearDay: nearDay,
      usdDay: usdDay,
      dailyRate: valueUsd && usdDay != null ? usdDay / valueUsd : null
    };
  }
  function rationStatus(tokens, valueUsd) {
    if (!(Number(tokens) > 0)) return { key: 'empty', label: 'no kat in this hole.' };
    if (Number(valueUsd) >= 20) return { key: 'eligible', label: 'eligible' };
    return { key: 'under', label: 'under the $20 ration line' };
  }
  var liveRewardData = null;
  function fetchRewardData() {
    return getJSON('/api/nearkat/rewards').then(function (data) {
      liveRewardData = data;
      return data;
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
    var done = function () { say('CA copied. Welcome to the mob.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ca).then(done, function () { fallback(ca); done(); });
    else { fallback(ca); done(); }
  });
  function fallback(t) {
    var ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta);
  }

  /* ---------- reward calculator ---------- */
  var calcRoot = $('reward-calc');
  if (calcRoot) {
    var calcMode = 'tokens';
    var calcData = null;
    var calcInput = $('calc-balance');

    function calcText(id, value) {
      var el = $(id);
      if (el) el.textContent = value;
    }
    function parseAmount(value) {
      var clean = String(value || '').trim().toLowerCase().replace(/[$,\s_]/g, '');
      var match = /^(\d*\.?\d+)([kmb])?$/.exec(clean);
      if (!match) return 0;
      var amount = Number(match[1]);
      var mult = match[2] === 'k' ? 1e3 : match[2] === 'm' ? 1e6 : match[2] === 'b' ? 1e9 : 1;
      return isFinite(amount) ? Math.min(Math.max(amount * mult, 0), 1e12) : 0;
    }
    function inputFormat(value) {
      return Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
    }
    function setPresetButtons() {
      var tokenPresets = [250000, 1000000, 5000000, 10000000];
      var usdPresets = [100, 500, 1000, 5000];
      var list = calcMode === 'tokens' ? tokenPresets : usdPresets;
      Array.prototype.forEach.call(document.querySelectorAll('#calc-presets button'), function (button, index) {
        var value = list[index];
        button.dataset.value = value;
        button.textContent = calcMode === 'tokens'
          ? (value >= 1e6 ? (value / 1e6) + 'M' : (value / 1e3) + 'K')
          : '$' + value.toLocaleString('en-US');
        button.classList.toggle('active', parseAmount(calcInput.value) === value);
      });
    }
    function renderCalculator() {
      setPresetButtons();
      if (!calcData) return;

      var entered = parseAmount(calcInput.value);
      var tokenPrice = Number(calcData.token && calcData.token.priceUsd) || 0;
      var observed = calcData.observed || {};
      var tokens = calcMode === 'tokens' ? entered : (tokenPrice ? entered / tokenPrice : 0);
      var estimate = positionEstimate(calcData, tokens);
      var supply = estimate.supply;
      var valueUsd = estimate.valueUsd;
      var share = estimate.share;
      var poolNearDay = estimate.poolNearDay;
      var nearDay = estimate.nearDay;
      var usdDay = estimate.usdDay;
      var dailyRate = estimate.dailyRate;

      calcText('calc-worth', valueUsd ? usd(valueUsd) : '$0');
      calcText('calc-token-price', tokenPrice ? 'at ' + usd(tokenPrice, 5) : '');
      calcText('calc-near-day', nearAmount(nearDay));
      calcText('calc-usd-day', usdDay != null ? usd(usdDay, usdDay < 1 ? 2 : 0) : '—');
      calcText('calc-near-7', nearAmount(nearDay == null ? null : nearDay * 7));
      calcText('calc-usd-7', usdDay == null ? '≈ —' : '≈ ' + usd(usdDay * 7));
      calcText('calc-near-30', nearAmount(nearDay == null ? null : nearDay * 30));
      calcText('calc-usd-30', usdDay == null ? '≈ —' : '≈ ' + usd(usdDay * 30));
      calcText('calc-position', tokens >= 10000 ? compact(tokens).replace('$', '') : num(tokens, 2));
      calcText('calc-value', valueUsd ? usd(valueUsd) : '$0');
      calcText('calc-value-sub', tokenPrice ? 'at ' + usd(tokenPrice, 5) : 'price unavailable');
      calcText('calc-share', pct(share, share < .001 ? 4 : 2));
      calcText('calc-rate', pct(dailyRate, dailyRate && dailyRate < .001 ? 3 : 2));
      calcText('calc-rate-sub', dailyRate == null ? 'simple annualized' : pct(dailyRate * 365, 0) + ' simple annualized');

      if (isFinite(poolNearDay)) {
        $('calc-equation').innerHTML = nearAmount(poolNearDay) + ' $NEAR per day at the observed pace × your ' + pct(share, 4) + ' share = <strong>' + nearAmount(nearDay) + ' $NEAR / day</strong>';
      }

      var lamboDays = usdDay && usdDay > 0 ? 270000 / usdDay : null;
      calcText('calc-lambo', lamboDays == null ? '—' : (lamboDays <= 1 ? 'today' : num(Math.ceil(lamboDays)) + ' days'));

      var observedHours = Number(observed.observedHours);
      var calibration = calcData.calibration || {};
      var note = calibration.calibrated
        ? 'Eligible supply uses the latest calibrated estimate.'
        : 'Eligible supply is not calibrated yet, so the calculator divides by the full ' + compact(supply).replace('$', '') + '. Your real share may be larger.';
      if (isFinite(observedHours)) note += ' Rate window: ' + (observed.method === 'launch_average' ? 'average since launch, ' : '') + (observedHours / 24).toFixed(1) + ' days.';
      note += ' Estimates are not guaranteed.';
      calcText('calc-note', note);
    }
    function loadCalculator() {
      fetchRewardData().then(function (data) {
        calcData = data;
        var status = $('calc-status');
        status.classList.remove('error');
        status.lastChild.nodeValue = ' Live · updated ' + ago(data.updatedAt || data.dataAt);
        renderCalculator();
      }).catch(function () {
        var status = $('calc-status');
        status.classList.add('error');
        status.lastChild.nodeValue = ' Live rate unavailable · retrying';
      });
    }

    calcInput.addEventListener('input', renderCalculator);
    calcInput.addEventListener('blur', function () { calcInput.value = inputFormat(parseAmount(calcInput.value)); renderCalculator(); });
    $('calc-presets').addEventListener('click', function (event) {
      var button = event.target.closest('button[data-value]');
      if (!button) return;
      calcInput.value = inputFormat(Number(button.dataset.value));
      renderCalculator();
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-calc-mode]'), function (button) {
      button.addEventListener('click', function () {
        calcMode = button.dataset.calcMode;
        Array.prototype.forEach.call(document.querySelectorAll('[data-calc-mode]'), function (item) {
          item.setAttribute('aria-pressed', String(item === button));
        });
        $('calc-prefix').hidden = calcMode !== 'usd';
        $('calc-suffix').hidden = calcMode !== 'tokens';
        calcInput.setAttribute('aria-label', calcMode === 'tokens' ? 'NEARKAT balance' : 'Position value in USD');
        calcInput.value = calcMode === 'tokens' ? '1,000,000' : '1,000';
        renderCalculator();
      });
    });

    loadCalculator();
    setInterval(loadCalculator, 45000);
  }

  /* ---------- public wallet lookout ---------- */
  var lookoutRoot = $('lookout');
  if (lookoutRoot) {
    var BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    var lookoutForm = $('lookout-form');
    var lookoutInput = $('lookout-address');
    var lookoutButton = $('lookout-submit');
    var lookoutResult = $('lookout-result');
    var lastLookoutAddress = '';

    function isSolanaAddress(value) {
      var address = String(value || '').trim();
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return false;
      var number = 0n;
      for (var i = 0; i < address.length; i++) {
        var digit = BASE58.indexOf(address[i]);
        if (digit < 0) return false;
        number = number * 58n + BigInt(digit);
      }
      var payloadBytes = number === 0n ? 0 : Math.ceil(number.toString(16).length / 2);
      var leading = (address.match(/^1*/) || [''])[0].length;
      return payloadBytes + leading === 32;
    }
    function lookoutText(id, value) {
      var el = $(id);
      if (el) el.textContent = value;
    }
    function setLookoutMessage(text, error) {
      var message = $('lookout-message');
      message.textContent = text || '';
      message.classList.toggle('error', !!error);
    }
    function truncateAddress(address) {
      return address.slice(0, 6) + '…' + address.slice(-6);
    }
    function setLookoutLoading(loading) {
      lookoutButton.disabled = loading;
      lookoutButton.textContent = loading ? 'lookout moving…' : 'post lookout';
    }
    function renderLookout(address, data, balance) {
      var estimate = positionEstimate(data, balance);
      var status = rationStatus(balance, estimate.valueUsd);

      lastLookoutAddress = address;
      try { localStorage.setItem('nearkat-lookout-wallet', address); } catch (e) {}
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', '/?w=' + encodeURIComponent(address) + '#lookout');
      }

      lookoutText('lookout-wallet', truncateAddress(address));
      $('lookout-solscan').href = 'https://solscan.io/account/' + encodeURIComponent(address);
      lookoutText('lookout-bag', num(balance, balance < 1 ? 4 : 0) + ' NEARKAT');
      lookoutText('lookout-worth', usd(estimate.valueUsd) + ' at ' + usd(estimate.tokenPrice, 5));
      lookoutText('lookout-share', pct(estimate.share, estimate.share < .001 ? 4 : 2) + ' of ' + compact(estimate.supply).replace('$', ''));

      var eligibility = $('lookout-eligibility');
      eligibility.textContent = status.label;
      eligibility.className = status.key;

      lookoutText('lookout-near-day', nearAmount(estimate.nearDay) + ' NEAR');
      lookoutText('lookout-usd-day', estimate.usdDay == null ? '≈ —' : '≈ ' + usd(estimate.usdDay, estimate.usdDay < 1 ? 2 : 0));
      lookoutText('lookout-near-7', nearAmount(estimate.nearDay == null ? null : estimate.nearDay * 7) + ' NEAR');
      lookoutText('lookout-usd-7', estimate.usdDay == null ? '≈ —' : '≈ ' + usd(estimate.usdDay * 7));
      lookoutText('lookout-near-30', nearAmount(estimate.nearDay == null ? null : estimate.nearDay * 30) + ' NEAR');
      lookoutText('lookout-usd-30', estimate.usdDay == null ? '≈ —' : '≈ ' + usd(estimate.usdDay * 30));

      var calibration = data.calibration || {};
      var note = calibration.calibrated
        ? 'this is a lookout, not a claim.\nrations land in the wallet that holds.\nshare uses the latest calibrated eligible supply.\nestimates are not guaranteed.'
        : 'this is a lookout, not a claim.\nrations land in the wallet that holds.\neligible supply is not calibrated yet, so share uses the full 1.00B.\nestimates are not guaranteed.';
      $('lookout-result').querySelector('.lookout-note').textContent = note;
      lookoutResult.hidden = false;
      setLookoutMessage(status.key === 'empty' ? status.label : '', false);
    }
    function runLookout(value) {
      var address = String(value || '').trim();
      lookoutInput.value = address;
      if (!isSolanaAddress(address)) {
        lookoutResult.hidden = true;
        setLookoutMessage('that is not a Solana tunnel.', true);
        return Promise.resolve(false);
      }

      setLookoutLoading(true);
      setLookoutMessage('lookout moving…', false);
      return Promise.all([
        fetch('/api/nearkat/lookout', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ address: address })
        }).then(function (response) {
          if (!response.ok) throw new Error('balance lookup failed');
          return response.json();
        }),
        liveRewardData ? Promise.resolve(liveRewardData) : fetchRewardData()
      ]).then(function (results) {
        renderLookout(address, results[1], Number(results[0].balance) || 0);
        return true;
      }).catch(function () {
        lookoutResult.hidden = true;
        setLookoutMessage('lookout lost the trail. try again.', true);
        return false;
      }).then(function (success) {
        setLookoutLoading(false);
        return success;
      });
    }
    function startupAddress() {
      var url = new URL(window.location.href);
      var address = url.searchParams.get('w');
      var fromUrl = !!address;
      if (!address && url.hash.indexOf('?') >= 0) {
        address = new URLSearchParams(url.hash.split('?')[1]).get('w');
        fromUrl = !!address;
      }
      if (!address) {
        var pathMatch = url.pathname.match(/^\/lookout\/([^/]+)\/?$/);
        if (pathMatch) {
          try { address = decodeURIComponent(pathMatch[1]); } catch (e) { address = pathMatch[1]; }
          fromUrl = true;
        }
      }
      if (!address) {
        try { address = localStorage.getItem('nearkat-lookout-wallet'); } catch (e) {}
      }
      return { address: address, fromUrl: fromUrl };
    }

    lookoutForm.addEventListener('submit', function (event) {
      event.preventDefault();
      runLookout(lookoutInput.value);
    });
    $('lookout-copy').addEventListener('click', function () {
      if (!lastLookoutAddress) return;
      var done = function () { say('Address copied.'); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(lastLookoutAddress).then(done, function () { fallback(lastLookoutAddress); done(); });
      } else {
        fallback(lastLookoutAddress); done();
      }
    });

    var startup = startupAddress();
    if (startup.address) {
      runLookout(startup.address);
      if (startup.fromUrl && location.hash.indexOf('lookout') < 0) {
        setTimeout(function () { lookoutRoot.scrollIntoView(); }, 0);
      }
    }
  }
})();
