/* ReFi Hub staking site: claim rendering and live data.
   Every number on the page comes from claims.json. Claims with check "live" are refreshed
   from public sources on page load; if a fetch fails the saved value and its date stay. */
(function () {
  'use strict';
  document.documentElement.classList.remove('no-js');

  var REG = null, C = {}, SRC = {}, ORGS = {}, CL = {};
  // Web3Forms access key (free plan). Submissions from the contact form and newsletter boxes
  // are emailed to the inbox this key was created for. Public by design: it can only send to that inbox.
  var FORM_KEY = 'f1591609-237b-42b0-a39e-0c9537b5bc61';
  var dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  var timeFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  var clockFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
  function when(iso) {
    var d = new Date(iso), n = new Date();
    return d.toDateString() === n.toDateString() ? clockFmt.format(d) : timeFmt.format(d);
  }

  /* ---------- helpers ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c != null) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function trimNum(v, d) { return Number(v.toFixed(d)).toLocaleString('en-US', { maximumFractionDigits: d }); }
  function short(a) { return a.slice(0, 6) + '...' + a.slice(-4); }

  function getJSON(url, opts, ms) {
    var ctl = new AbortController();
    var t = setTimeout(function () { ctl.abort(); }, ms || 15000);
    return fetch(url, Object.assign({}, opts || {}, { signal: ctl.signal, cache: 'no-store' }))
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .finally(function () { clearTimeout(t); });
  }
  // Public RPCs in order. api.mainnet-beta refuses most browser requests, so publicnode goes first.
  function rpc(method, params) {
    var urls = C.rpcs.slice();
    function attempt() {
      var url = urls.shift();
      return getJSON(url, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: method, params: params })
      }).then(function (j) { if (j.error) throw new Error(j.error.message); return j.result; })
        .catch(function (e) { if (urls.length) return attempt(); throw e; });
    }
    return attempt();
  }
  function b64(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function stakewizTime(s) { // "2026-10-13 12:28:07.007098+02"
    if (!s) return null;
    var iso = s.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00');
    var d = new Date(iso); return isNaN(d) ? null : d.toISOString();
  }

  /* ---------- on-chain decoders ---------- */
  // SPL stake pool account (Solana stake pool program v1.0 layout, also used by Sanctum's fork).
  function decodeStakePool(bytes) {
    var dv = new DataView(bytes.buffer), o = 0;
    function u8() { return bytes[o++]; }
    function u64() { var v = dv.getBigUint64(o, true); o += 8; return Number(v); }
    function fee() { var den = u64(), num = u64(); return den ? (num / den) * 100 : 0; }
    function future() { return u8() ? fee() : null; }
    function optKey() { if (u8()) o += 32; }
    o = 1 + 32 * 3 + 1 + 32 * 5;
    var total = u64(), supply = u64(); u64(); // last_update_epoch
    o += 48; // lockup
    var epochFee = fee(); future();
    optKey(); optKey();
    var stakeDep = fee(), stakeWd = fee(); future(); u8();
    optKey(); var solDep = fee(); u8();
    optKey(); var solWd = fee();
    return {
      totalLamports: total, supply: supply / 1e9, rate: total / supply,
      fees: { epoch: epochFee, deposit: Math.max(stakeDep, solDep), withdraw: Math.max(stakeWd, solWd) }
    };
  }

  function feeRate(v) {
    var c = v.commission / 10000, j = v.jito_commission_bps / 10000;
    return (v.staking_apy / (1 - c)) * c / 100 + (v.jito_apy / (1 - j)) * j / 100;
  }

  /* ---------- live fetchers (memoised) ---------- */
  var memo = {};
  function once(key, fn) { if (!memo[key]) memo[key] = fn(); return memo[key]; }
  var F = {
    'stakewiz.validator': function () {
      return once('swv', function () { return getJSON('https://api.stakewiz.com/validator/' + C.voteAccount); });
    },
    'stakewiz.peer': function (spec) {
      return once('swp:' + spec.vote, function () { return getJSON('https://api.stakewiz.com/validator/' + spec.vote); });
    },
    'stakewiz.epoch': function () {
      return once('swe', function () { return getJSON('https://api.stakewiz.com/epoch_info'); });
    },
    'stakewiz.stakes': function () {
      return once('sws', function () { return getJSON('https://api.stakewiz.com/validator_stakes/' + C.voteAccount); });
    },
    'stakewiz.delinquencies': function () {
      return once('swd', function () { return getJSON('https://api.stakewiz.com/validator_delinquencies/' + C.voteAccount); });
    },
    'jupiter.price': function () {
      return once('jp', function () {
        var qs = '/price/v3?ids=' + C.solMint;
        return getJSON('https://lite-api.jup.ag' + qs).catch(function () { return getJSON('https://api.jup.ag' + qs); })
          .then(function (j) { return j[C.solMint].usdPrice; });
      });
    },
    // Share of a stake's yearly rewards that we earn as fees (commission on staking rewards plus MEV commission).
    'derived.fees': function (spec) {
      return F['stakewiz.validator']().then(function (v) { return spec.stakeSol * feeRate(v); });
    },
    // Fees we earn on a stake for a year, times the impact share, in USD, divided by the price of one coral.
    'derived.corals': function (spec) {
      return Promise.all([F['stakewiz.validator'](), F['jupiter.price']()]).then(function (r) {
        return spec.stakeSol * feeRate(r[0]) * spec.share * r[1] / spec.coralUsd;
      });
    },
    'stakewiz.all': function () {
      return once('swa', function () { return getJSON('https://api.stakewiz.com/validators', null, 30000); });
    },
    'rpc.account': function (addr) {
      return once('acc:' + addr, function () { return rpc('getAccountInfo', [addr, { encoding: 'base64' }]).then(function (r) { return r.value; }); });
    },
    'rpc.refisolPool': function () {
      return F['rpc.account'](C.refisolPool).then(function (v) { var d = decodeStakePool(b64(v.data[0])); d.owner = v.owner; return d; });
    },
    'rpc.jitoPool': function () {
      return F['rpc.account'](C.jitosolPool).then(function (v) { return decodeStakePool(b64(v.data[0])); });
    },
    'rpc.marinade': function () {
      // Marinade State: 8 discriminator + 4 pubkeys + 2 bumps + rent u64, then reward_fee {basis_points: u32}.
      return F['rpc.account'](C.marinadeState).then(function (v) {
        var b = b64(v.data[0]); return { rewardFeeBps: new DataView(b.buffer).getUint32(146, true) };
      });
    },
    'jupiter.token': function () {
      return once('jt', function () {
        var qs = '/tokens/v2/search?query=' + C.refisolMint;
        return getJSON('https://lite-api.jup.ag' + qs).catch(function () { return getJSON('https://api.jup.ag' + qs); }).then(function (list) {
          var t = (list || []).filter(function (x) { return x.id === C.refisolMint; })[0];
          if (!t) throw new Error('token not found'); return t;
        });
      });
    },
    'jupiter.quotes': function (spec) {
      return once('jq', function () {
        return F['rpc.refisolPool']().then(function (pool) {
          return Promise.all(spec.sizes.map(function (sol, i) {
            var amt = Math.round(sol / pool.rate * 1e9);
            var qs = '/swap/v1/quote?inputMint=' + C.refisolMint + '&outputMint=' + C.solMint + '&amount=' + amt + '&slippageBps=50';
            return sleep(i * 350).then(function () {
              return getJSON('https://lite-api.jup.ag' + qs).catch(function () { return getJSON('https://api.jup.ag' + qs); });
            }).then(function (q) {
              var fair = amt * pool.rate;
              return { sol: sol, drop: Math.max(0, (1 - Number(q.outAmount) / fair) * 100) };
            }).catch(function () { return { sol: sol, drop: null }; });
          }));
        });
      });
    }
  };

  function pick(o, path) { return path.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); }

  // Turns raw fetched data into the claim's value. Returns {value, asOf}.
  function resolve(claim) {
    var L = claim.live, f = F[L.fetch];
    if (!f) return Promise.reject(new Error('no fetcher ' + L.fetch));
    return f(L).then(function (d) {
      var now = new Date().toISOString(), v;
      switch (L.fetch) {
        case 'stakewiz.validator':
        case 'stakewiz.peer':
          if (L.derive === 'client') v = (d.is_jito ? 'Jito-Solana ' : 'Agave ') + d.version;
          else if (L.derive === 'city') v = d.ip_city + ', ' + d.ip_country;
          else if (L.derive === 'network') v = d.ip_org + ', ' + d.ip_asn;
          else if (L.derive === 'superminority') v = d.superminority_penalty === 0 ? 'Outside the superminority' : 'In the superminority';
          else if (L.derive === 'versionValid') v = d.version_valid ? 'Stakewiz marks this version as valid.' : 'Stakewiz flags this version.';
          else { v = pick(d, L.path); if (L.scale) v = v * L.scale; }
          return { value: v, asOf: stakewizTime(d.updated_at) || now };
        case 'stakewiz.delinquencies':
          var since = Date.now() - 365 * 864e5;
          var mins = d.filter(function (x) { return new Date(x.date + 'T00:00:00Z').getTime() >= since; })
                      .reduce(function (a, x) { return a + Number(x.delinquent_minutes || 0); }, 0);
          return { value: (1 - mins / (365 * 1440)) * 100, asOf: now };
        case 'jupiter.price':
        case 'derived.fees':
        case 'derived.corals':
          return { value: d, asOf: now };
        case 'stakewiz.epoch':
          return { value: d.duration_seconds / 86400, asOf: now };
        case 'stakewiz.stakes':
          v = d.filter(function (s) { return L.authorities.indexOf(s.withdraw_authority) > -1; })
               .reduce(function (a, s) { return a + (s.active_stake || 0); }, 0) / 1e9;
          return { value: v, asOf: now };
        case 'stakewiz.all':
          v = d.filter(function (x) { return x.ip_country === 'Argentina' && !x.delinquent && x.activated_stake > 0; });
          return { value: v.length, asOf: now, extra: { includesUs: v.some(function (x) { return x.vote_identity === C.voteAccount; }) } };
        case 'rpc.refisolPool':
          if (L.derive === 'fees') v = d.fees;
          else if (L.derive === 'rate') v = d.rate;
          else if (L.derive === 'supply') v = d.supply;
          else if (L.derive === 'owner') v = d.owner;
          return { value: v, asOf: now };
        case 'rpc.jitoPool':
          return { value: d.fees, asOf: now };
        case 'rpc.marinade':
          return { value: Object.assign({}, claim.value, { epoch: d.rewardFeeBps / 100 }), asOf: now };
        case 'jupiter.token':
          return { value: pick(d, L.path), asOf: d.updatedAt || now };
        case 'jupiter.quotes':
          if (d.every(function (q) { return q.drop == null; })) throw new Error('no quotes');
          return { value: d, asOf: now };
      }
      throw new Error('unhandled ' + L.fetch);
    });
  }

  /* ---------- formatting ---------- */
  function fmt(claim, v) {
    if (v == null) return null;
    switch (claim.format) {
      case 'pct2': return trimNum(v, 2) + '%';
      case 'pct0': return trimNum(v, 1) + '%';
      case 'solK': return trimNum(v / 1000, 1) + 'K SOL';
      case 'int': return Math.round(v).toLocaleString('en-US');
      case 'num2': return trimNum(v, 2);
      case 'sol4': return trimNum(v, 4) + ' SOL';
      case 'rate': return v.toFixed(4) + ' SOL';
      case 'days': return trimNum(v * 24, 0) + ' hours';
      case 'code': case 'program': case 'text': return String(v);
      case 'compare': return trimNum(v.ours, 2) + '% vs ' + trimNum(v.min, 2) + '-' + trimNum(v.max, 2) + '%';
      case 'round10': return (Math.round(v / 10) * 10).toLocaleString('en-US');
      case 'usd': return '$' + trimNum(v, 2);
      case 'activity': return v.txs + ' transactions, last on ' + dateFmt.format(new Date(v.last));
      default: return String(v);
    }
  }
  // Short text for values fmt() can't print in one line (used on the audit page).
  function brief(claim, v) {
    if (v == null) return null;
    switch (claim.format) {
      case 'poolFees': return trimNum(v.epoch, 2) + '% on rewards, ' + trimNum(v.deposit, 2) + '% deposit, ' + trimNum(v.withdraw, 2) + '% withdraw';
      case 'exitCost': return v.map(function (q) { return q.sol.toLocaleString('en-US') + ' SOL: ' + (q.drop == null ? 'no quote' : trimNum(q.drop, 2) + '%'); }).join(', ');
      case 'rows': return v.length + (v.length === 1 ? ' donation' : ' donations') + ' listed';
      case 'links': return v.map(function (a) { return a.name; }).join(', ');
      default: return fmt(claim, v);
    }
  }
  function cur(claim) { return claim._cur || { value: claim.value, asOf: claim.asOf, live: false }; }
  function isUnverified(claim) { return claim.status !== 'verified'; }
  // The audit page lists verified claims that appear on a linked page. "not shown", "none" and the unlinked
  // donations page are left off, and so are claims not yet verifiable or still pending.
  function onAudit(claim) { return claim.status === 'verified' && !/^(not shown|none|donations$)/.test(claim.page); }

  /* ---------- source chip ---------- */
  function orgLogo(slug, dark) {
    var o = ORGS[slug];
    if (!o) return null;
    var src = dark ? (o.logoDark || o.logo) : o.logo;
    if (!src) return null;
    var img = el('img', { src: src, alt: o.name, loading: 'lazy' });
    img.onerror = function () { img.replaceWith(el('span', { class: 'logo-text', text: o.name })); };
    return img;
  }
  function sourceLink(key, href, label) {
    var s = SRC[key] || { name: key };
    var url = href || s.url;
    var n = el(url ? 'a' : 'span', { class: 'src', href: url, target: url ? '_blank' : null, rel: url ? 'noopener' : null });
    var logo = s.logo && ORGS[s.logo] && ORGS[s.logo].logo ? el('img', { src: ORGS[s.logo].logo, alt: '' }) : null;
    if (logo) n.appendChild(logo);
    n.appendChild(document.createTextNode(label || s.name));
    return n;
  }
  function chip(claim, opts) {
    opts = opts || {};
    var wrap = el('span', { class: 'chip-wrap' });
    var c = cur(claim), s = SRC[claim.source] || { name: claim.source };
    var url = claim.sourceUrl || s.url;
    if (isUnverified(claim)) {
      wrap.appendChild(el('span', { class: 'badge', title: claim.note || 'Not verified yet', tabindex: '0', text: 'unverified' }));
      if (url && claim.value != null && !opts.badgeOnly) { wrap.appendChild(document.createTextNode(' ')); wrap.appendChild(sourceLink(claim.source, url)); }
      return wrap;
    }
    var label, cls = 'src';
    if (claim.check === 'live') {
      if (c.live) { label = s.name + ' · live ' + when(c.asOf); cls += ' is-live'; }
      else if (claim._failed) { label = s.name + ' · saved ' + dateFmt.format(new Date(c.asOf)); cls += ' is-saved'; }
      else { label = s.name + ' · loading'; }
    } else if (claim.check === 'link') {
      label = s.name + ' · checked ' + dateFmt.format(new Date(claim.asOf));
    } else {
      label = s.name + (claim.asOf ? ' · ' + dateFmt.format(new Date(claim.asOf)) : '');
    }
    if (claim._fails) cls += ' is-off';
    var a = el(url ? 'a' : 'span', { class: cls, href: url, target: url ? '_blank' : null, rel: url ? 'noopener' : null,
      title: claim._failed ? 'Live fetch failed. Showing the last saved value.' : (claim.note || '') });
    if (claim.check === 'live') a.appendChild(el('span', { class: 'dot' }));
    var logo = s.logo && ORGS[s.logo] && ORGS[s.logo].logo ? el('img', { src: ORGS[s.logo].logo, alt: '' }) : null;
    if (logo) a.appendChild(logo);
    a.appendChild(document.createTextNode(opts.prefix ? opts.prefix + label : label));
    wrap.appendChild(a);
    (claim.also || []).concat(opts.also ? opts.also.split(',') : []).forEach(function (k) {
      wrap.appendChild(document.createTextNode(' '));
      wrap.appendChild(sourceLink(k));
    });
    return wrap;
  }

  /* ---------- render ---------- */
  function renderValues() {
    $$('[data-claim]').forEach(function (n) {
      var claim = CL[n.dataset.claim]; if (!claim) return;
      var v = cur(claim).value;
      if (n.dataset.part && v && n.dataset.part !== 'range') v = v[n.dataset.part];
      var text;
      if (n.dataset.part === 'range' && claim.format === 'compare') { v = cur(claim).value; text = trimNum(v.min, 2) + '-' + trimNum(v.max, 2) + '%'; }
      else if (n.dataset.part && claim.format === 'compare') text = trimNum(v, 2) + '%';
      else text = n.dataset.part && claim.format === 'poolFees' ? trimNum(v, 2) + '%' : fmt(claim, v);
      n.classList.add('val');
      n.classList.toggle('check-fail', !!claim._fails);
      if (text == null) { n.textContent = 'pending'; n.classList.add('pending'); }
      else { n.textContent = text; n.classList.remove('pending'); }
      if (n.tagName === 'A' && claim.format === 'code' && claim.sourceUrl == null) n.href = (SRC[claim.source] || {}).url;
      if (n.tagName === 'A' && n.hasAttribute('data-mailto') && text != null) n.href = 'mailto:' + text;
    });
    $$('[data-chip]').forEach(function (n) {
      var claim = CL[n.dataset.chip]; if (!claim) return;
      n.replaceChildren(chip(claim, { badgeOnly: n.hasAttribute('data-badge-only'), also: n.dataset.also, prefix: n.dataset.prefix }));
    });
    $$('[data-render]').forEach(function (n) { var r = R[n.dataset.render]; if (r) r(n); });
  }

  var R = {
    yieldTable: function (n) {
      var ours = CL['validator.netApy'];
      var peers = ['coinbase', 'figment', 'kiln', 'everstake'].map(function (k) { return CL['yield.peer.' + k]; });
      var t = el('table', { class: 'tbl' }, [
        el('thead', null, [el('tr', null, [el('th', { text: 'Validator' }), el('th', { text: 'Net APY' })])]),
        el('tbody', null, [el('tr', { class: 'us' }, [el('td', null, [el('a', { href: SRC.stakewiz.url, target: '_blank', rel: 'noopener', text: 'ReFi Hub' })]), el('td', { text: fmt(ours, cur(ours).value) })])].concat(
          peers.map(function (p) {
            return el('tr', null, [el('td', null, [el('a', { href: p.sourceUrl, target: '_blank', rel: 'noopener', text: p.text })]), el('td', { text: fmt(p, cur(p).value) })]);
          })))
      ]);
      n.replaceChildren(el('div', { class: 'tbl-wrap' }, [t]));
    },
    stakedBy: function (n) {
      var slugs = n.dataset.orgs.split(',');
      n.replaceChildren.apply(n, slugs.map(function (slug) {
        var claim = CL['stakedBy.' + slug], o = ORGS[slug] || { name: slug };
        var logo = orgLogo(slug, n.hasAttribute('data-dark')) || el('span', { class: 'logo-text', text: o.name });
        var box = o.url ? el('a', { href: o.url, target: '_blank', rel: 'noopener', class: 'logo-box', 'aria-label': o.name }, [logo]) : el('div', { class: 'logo-box' }, [logo]);
        return el('div', { class: 'logo-card' }, [
          box,
          el('div', { class: 'logo-meta' }, [
            el('span', { class: 'small org-name', text: o.name }),
            el('span', { class: 'amt val', text: claim ? fmt(claim, cur(claim).value) : 'pending' })
          ])
        ]);
      }));
    },
    partners: function (n) {
      var slugs = n.dataset.orgs.split(','), claim = CL['impact.partners'];
      n.replaceChildren.apply(n, slugs.map(function (slug) {
        var o = ORGS[slug] || { name: slug };
        var logo = orgLogo(slug, false) || el('span', { class: 'logo-text', text: o.name });
        var box = o.url ? el('a', { href: o.url, target: '_blank', rel: 'noopener', class: 'logo-box', 'aria-label': o.name }, [logo]) : el('div', { class: 'logo-box' }, [logo]);
        return el('a', { class: 'logo-card', href: o.url, target: '_blank', rel: 'noopener' }, [el('div', { class: 'logo-box' }, [logo]), el('span', { class: 'small muted', text: o.name })]);
      }));
    },
    orgLogo: function (n) {
      var slug = n.dataset.org, o = ORGS[slug] || { name: slug };
      n.replaceChildren(orgLogo(slug, n.hasAttribute('data-dark')) || el('span', { class: 'logo-text', text: o.name }));
    },
    lstFees: function (n) {
      var rows = [['refiSOL', 'refisol.poolFees'], ['jitoSOL', 'lst.jitosolFees'], ['mSOL', 'lst.msolFees']];
      var t = el('table', { class: 'tbl' }, [
        el('thead', null, [el('tr', null, ['Token', 'On rewards', 'Deposit', 'Withdraw'].map(function (h) { return el('th', { text: h }); }))]),
        el('tbody', null, rows.map(function (r) {
          var c = CL[r[1]], v = cur(c).value || {};
          return el('tr', null, [el('td', { text: r[0] }), el('td', { text: trimNum(v.epoch, 2) + '%' }), el('td', { text: trimNum(v.deposit, 2) + '%' }),
            el('td', { text: trimNum(v.withdraw, 2) + '%' })]);
        }))
      ]);
      n.replaceChildren(el('div', { class: 'tbl-wrap' }, [t]));
    },
    exitCost: function (n) {
      var c = CL['refisol.exitCost'], v = cur(c).value || [];
      var t = el('table', { class: 'tbl' }, [
        el('thead', null, [el('tr', null, [el('th', { text: 'Swap back' }), el('th', { text: 'Below SOL value' })])]),
        el('tbody', null, v.map(function (q) {
          return el('tr', null, [el('td', { text: q.sol.toLocaleString('en-US') + ' SOL' }), el('td', { class: q.drop == null ? 'pending' : '', text: q.drop == null ? 'no quote' : trimNum(q.drop, 2) + '%' })]);
        }))
      ]);
      n.replaceChildren(el('div', { class: 'tbl-wrap' }, [t]));
    },
    audits: function (n) {
      var c = CL['refisol.audits'];
      var kids = [];
      c.value.forEach(function (a, i) { if (i) kids.push(', '); kids.push(el('a', { href: a.url, target: '_blank', rel: 'noopener', text: a.name })); });
      n.replaceChildren.apply(n, kids);
    },
    // Sample quarterly receipt for 100K SOL, built from today's live numbers.
    receipt: function (n) {
      var stake = 100000, q = 4;
      var ours = cur(CL['validator.netApy']).value;
      var peers = ['coinbase', 'figment', 'kiln', 'everstake'].map(function (k) { return cur(CL['yield.peer.' + k]).value; });
      var avg = peers.reduce(function (a, b) { return a + b; }, 0) / peers.length;
      var share = cur(CL['impact.institutionalShare']).value / 100;
      var withUs = stake * ours / 100 / q, atCust = stake * avg / 100 / q;
      var impact = cur(CL['impact.feesPer100k']).value * share / q;
      var corals = cur(CL['impact.coralsPer100k']).value / q;
      var sol = function (v, d) { return trimNum(v, d || 0) + ' SOL'; };
      function set(k, t) { var e = $('[data-r="' + k + '"]', n); if (e) e.textContent = t; }
      set('with', sol(withUs)); set('withApy', ours.toFixed(2) + '% net APY');
      set('cust', sol(atCust)); set('custApy', avg.toFixed(2) + '% average');
      var extra = withUs - atCust;
      set('extra', (extra >= 0 ? '+' : '') + sol(extra)); $('[data-r="extra"]', n).classList.toggle('neg', extra < 0);
      set('impact', sol(impact, 1)); set('corals', 'about ' + Math.round(corals) + ' corals');
    },
    swapMock: function (n) {
      var input = $('input', n), out = $('[data-out]', n), rateEl = $('[data-rate]', n);
      var rate = cur(CL['refisol.rate']).value;
      function upd() {
        var sol = parseFloat(input.value) || 0;
        out.textContent = sol > 0 ? trimNum(sol / rate, 4) : '0.00';
        if (rateEl) rateEl.textContent = '1 SOL ≈ ' + trimNum(1 / rate, 4) + ' refiSOL';
      }
      if (!input._wired) { input.addEventListener('input', upd); input._wired = true; }
      upd();
    },
    donations: function (n) {
      var c = CL['donations.rows'];
      var t = el('table', { class: 'tbl wide' }, [
        el('thead', null, [el('tr', null, ['Date', 'Partner', 'Amount', 'What it planted', 'Receipt'].map(function (h) { return el('th', { text: h }); }))]),
        el('tbody', null, c.value.map(function (r) {
          return el('tr', null, [
            el('td', { text: dateFmt.format(new Date(r.date + 'T12:00:00Z')) }),
            el('td', null, [r.partner ? r.partner : el('span', { class: 'pending', text: 'pending' })]),
            el('td', null, [el('span', { text: r.amount }), el('br'), el('span', { class: 'small muted', text: r.flow })]),
            el('td', null, [r.planted ? r.planted : el('span', { class: 'pending', text: 'pending' })]),
            el('td', null, [el('a', { href: 'https://solscan.io/tx/' + r.tx, target: '_blank', rel: 'noopener', text: 'Solscan' })])
          ]);
        }))
      ]);
      n.replaceChildren(el('div', { class: 'tbl-wrap' }, [t]));
    },
    // Audit page: every claim on the site, grouped, with its value, status, check method and source.
    // Rows are built once; later calls (after each live fetch) only refresh the value and source cells.
    register: function (n) {
      if (!n._rows) {
        n._rows = [];
        var groups = REG_GROUPS.map(function (g) { return { title: g[0], prefixes: g[1], claims: [] }; });
        var other = { title: 'Other', prefixes: [], claims: [] };
        REG.claims.filter(onAudit).forEach(function (c) {
          var g = groups.filter(function (g) { return g.prefixes.some(function (p) { return c.id.indexOf(p) === 0; }); })[0] || other;
          g.claims.push(c);
        });
        n.replaceChildren.apply(n, groups.concat(other).filter(function (g) { return g.claims.length; }).map(function (g) {
          return el('div', { class: 'reg-group' }, [
            el('h2', { text: g.title }),
            el('div', { class: 'reg-head', 'aria-hidden': 'true' }, [el('span', { text: 'Claim' }), el('span', { text: 'Value' }), el('span', { text: 'Status and source' })])
          ].concat(g.claims.map(function (c) {
            var row = { claim: c, val: el('div', { class: 'reg-val' }), src: el('div', { class: 'reg-src' }) };
            n._rows.push(row);
            return el('div', { class: 'reg-row', id: c.id }, [
              el('div', null, [el('p', { class: 'reg-name', text: c.label || c.text }), c.note ? el('p', { class: 'reg-note small muted', text: c.note }) : null]),
              row.val, row.src
            ]);
          })));
        }));
        var t = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
        // The rows did not exist when the browser looked for the #claim-id, so jump and highlight here.
        if (t && n.contains(t)) { t.classList.add('is-target'); t.scrollIntoView({ block: 'start', behavior: 'instant' }); }
      }
      n._rows.forEach(function (r) {
        var c = r.claim, v = cur(c).value, s = SRC[c.source] || {}, url = c.sourceUrl || s.url, val;
        if (c.format === 'links' && v) {
          val = el('span');
          v.forEach(function (a, i) { if (i) val.appendChild(document.createTextNode(', ')); val.appendChild(el('a', { href: a.url, target: '_blank', rel: 'noopener', text: a.name })); });
        } else {
          var text = brief(c, v);
          val = text == null ? el('span', { class: 'pending', text: 'pending' }) : el('span', { class: c._fails ? 'check-fail' : '', text: text });
        }
        r.val.replaceChildren(val);
        r.src.replaceChildren(
          el('span', { class: 'badge st-' + c.status, text: REG_STATUS[c.status] || c.status }),
          el('span', { class: 'reg-check', text: REG_CHECK[c.check] || c.check }),
          isUnverified(c) ? (url ? sourceLink(c.source, url) : '') : chip(c)
        );
      });
    },
    registerSummary: function (n) {
      var shown = REG.claims.filter(onAudit);
      function count(k, v) { return shown.filter(function (c) { return c[k] === v; }).length; }
      n.textContent = shown.length + ' verified numbers and facts on this site. ' + count('check', 'live') + ' are fetched live from public sources each time you open a page, ' +
        count('check', 'link') + ' link to a public source and ' + count('check', 'manual') + ' are confirmed by our team. Register last updated ' + dateFmt.format(new Date(REG.updated)) + '.';
    }
  };
  var REG_GROUPS = [
    ['Validator', ['validator.', 'network.']],
    ['Yield vs the big custodians', ['yield.']],
    ['Who stakes with us', ['stakedBy.']],
    ['refiSOL and other liquid staking tokens', ['refisol.', 'lst.']],
    ['Impact', ['impact.']],
    ['Donations', ['donations.']],
    ['Operations and security', ['ops.']],
    ['Company and contact', ['company.', 'contact.']]
  ];
  var REG_STATUS = { verified: 'Verified', 'unverifiable-yet': 'Not yet verifiable', placeholder: 'Pending' };
  var REG_CHECK = { live: 'Fetched live', link: 'Linked source', manual: 'Confirmed by our team' };

  /* ---------- live run ---------- */
  function runLive() {
    var used = {};
    $$('[data-claim],[data-chip]').forEach(function (n) { used[n.dataset.claim || n.dataset.chip] = 1; });
    $$('[data-render]').forEach(function (n) {
      var r = n.dataset.render;
      if (r === 'yieldTable') ['validator.netApy', 'yield.compare', 'yield.peer.coinbase', 'yield.peer.figment', 'yield.peer.kiln', 'yield.peer.everstake'].forEach(function (k) { used[k] = 1; });
      if (r === 'stakedBy') n.dataset.orgs.split(',').forEach(function (s) { used['stakedBy.' + s] = 1; });
      if (r === 'lstFees') ['refisol.poolFees', 'lst.jitosolFees', 'lst.msolFees'].forEach(function (k) { used[k] = 1; });
      if (r === 'exitCost') used['refisol.exitCost'] = 1;
      if (r === 'swapMock') used['refisol.rate'] = 1;
      if (r === 'register') REG.claims.filter(onAudit).forEach(function (c) { used[c.id] = 1; });
      if (r === 'receipt') ['validator.netApy', 'yield.peer.coinbase', 'yield.peer.figment', 'yield.peer.kiln', 'yield.peer.everstake', 'impact.feesPer100k', 'impact.coralsPer100k'].forEach(function (k) { used[k] = 1; });
    });
    if (used['yield.compare']) ['validator.netApy', 'yield.peer.coinbase', 'yield.peer.figment', 'yield.peer.kiln', 'yield.peer.everstake'].forEach(function (k) { used[k] = 1; });

    var jobs = Object.keys(used).map(function (id) {
      var claim = CL[id];
      if (!claim || claim.check !== 'live' || !claim.live || claim.live.fetch === 'stakewiz.peers') return null;
      return resolve(claim).then(function (r) {
        if (r.value == null || (typeof r.value === 'number' && isNaN(r.value))) throw new Error('empty live value');
        claim._cur = { value: r.value, asOf: r.asOf, live: true };
        if (claim.id === 'validator.onlyArgentina') claim._fails = !(r.value === 1 && r.extra.includesUs);
        if (claim.expect) claim._fails = !(r.value >= claim.expect.min && r.value <= claim.expect.max);
      }).catch(function (e) {
        claim._failed = true;
        if (window.console) console.warn('[claims] live fetch failed for', claim.id, e && e.message);
      }).then(renderValues);
    }).filter(Boolean);

    // derived comparison once ours and peers are in
    if (used['yield.compare']) {
      Promise.all(jobs).then(function () {
        var cmp = CL['yield.compare'], ours = CL['validator.netApy'];
        var peers = ['coinbase', 'figment', 'kiln', 'everstake'].map(function (k) { return CL['yield.peer.' + k]; });
        var all = [ours].concat(peers);
        if (all.every(function (c) { return c._cur && c._cur.live; })) {
          var pv = peers.map(function (p) { return p._cur.value; });
          var v = { ours: ours._cur.value, min: Math.min.apply(null, pv), max: Math.max.apply(null, pv) };
          v.holds = v.ours > v.max;
          cmp._cur = { value: v, asOf: ours._cur.asOf, live: true };
          cmp._fails = !v.holds;
        } else cmp._failed = true;
        renderValues();
      });
    }
  }

  /* ---------- page chrome ---------- */
  function chrome() {
    var top = $('.top');
    if (top) addEventListener('scroll', function () { top.classList.toggle('scrolled', scrollY > 8); }, { passive: true });
    var btn = $('.menu-btn'), nav = $('.nav');
    if (btn && nav) btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open'); btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    $$('.nav a').forEach(function (a) { a.addEventListener('click', function () { nav.classList.remove('open'); btn && btn.setAttribute('aria-expanded', 'false'); }); });
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if ('IntersectionObserver' in window && !reduce) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: .12 });
      $$('.rv').forEach(function (n) { io.observe(n); });
    } else $$('.rv').forEach(function (n) { n.classList.add('in'); });
    $$('a[aria-disabled="true"]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); }); });
    $$('form.signup').forEach(function (f) {
      wireForm(f, function () {
        return { subject: 'Newsletter signup: ' + f.elements.email.value, email: f.elements.email.value };
      }, 'Thanks, you are on the list.');
    });
    $$('[data-copy]').forEach(function (b) {
      b.addEventListener('click', function () {
        var label = $('em', b);
        if (!navigator.clipboard || !b.dataset.copy) return;
        navigator.clipboard.writeText(b.dataset.copy).then(function () {
          label.textContent = 'Copied';
          setTimeout(function () { label.textContent = 'Copy'; }, 1500);
        });
      });
    });
    var cf = $('.contact-form');
    if (cf) wireForm(cf, function () {
      var v = cf.elements;
      return {
        subject: 'Stake insight inquiry: ' + v.name.value + ' (' + v.org.value + ')',
        name: v.name.value,
        email: v.email.value,
        'Organization': v.org.value,
        'SOL to stake': v.size.value,
        'Custodian or wallet': v.custody.value,
        'Message': v.msg.value,
        'Wants diligence pack': v.pack.checked ? 'Yes' : 'No'
      };
    }, 'Thanks, we have your message. We reply within one business day.');
  }

  // Send a form to Web3Forms by email. fields() returns what goes in the email.
  function wireForm(form, fields, thanks) {
    var note = $('.form-note', form), btn = $('button[type="submit"]', form);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var data = fields();
      data.access_key = FORM_KEY;
      data.from_name = 'ReFi Hub staking site';
      data.page = location.pathname.split('/').pop() || 'index.html';
      data.botcheck = form.elements.botcheck && form.elements.botcheck.checked;
      btn.disabled = true;
      note.textContent = 'Sending...';
      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data)
      }).then(function (r) { return r.json(); }).then(function (r) {
        if (!r.success) throw new Error(r.message);
        form.reset();
        note.textContent = thanks;
      }).catch(function () {
        note.textContent = 'Sorry, that did not send. Please try again, or message us on X.';
      }).then(function () { btn.disabled = false; });
    });
  }

  function constLinks() {
    $$('[data-const-href]').forEach(function (a) { var v = C[a.dataset.constHref]; if (v) a.href = v; });
    $$('[data-const]').forEach(function (n) { var v = C[n.dataset.const]; if (v) n.textContent = v; });
    $$('[data-copy-const]').forEach(function (b) { var v = C[b.dataset.copyConst]; if (v) b.dataset.copy = v; });
    $$('[data-claim-href]').forEach(function (a) { var c = CL[a.dataset.claimHref]; if (c) a.href = c.sourceUrl || (SRC[c.source] || {}).url; });
  }

  /* ---------- Jupiter swap widget ----------
     Uses the pinned copy in assets/vendor/jupiter-plugin (see its README). The fallback
     card stays visible until the widget has actually rendered, and stays if it never does. */
  function jupiterSwap() {
    var card = $('[data-swap]'), mount = $('#jupiter-swap');
    if (!card || !mount || !window.Jupiter || !window.Jupiter.init || !C.refisolMint || !C.solMint) return;
    try {
      window.Jupiter.init({
        displayMode: 'integrated',
        integratedTargetId: 'jupiter-swap',
        containerStyles: { height: '520px' },
        defaultExplorer: 'Solscan',
        formProps: {
          initialInputMint: C.solMint,
          initialOutputMint: C.refisolMint,
          fixedMint: C.refisolMint
        }
      });
    } catch (e) {
      if (window.console) console.warn('[swap] Jupiter widget failed to start', e && e.message);
      return;
    }
    var tries = 0, t = setInterval(function () {
      var host = $$('*', mount).filter(function (n) { return n.shadowRoot; })[0];
      if (host && host.shadowRoot.querySelector('form')) {
        clearInterval(t);
        card.classList.add('is-live');
      } else if (++tries > 150) clearInterval(t); // ~15s, then keep the fallback
    }, 100);
  }

  // Open the FAQ answer a link points to (for example index.html#faq-fees).
  function openFromHash() {
    var id = location.hash.slice(1), d = id && document.getElementById(id);
    if (d && d.tagName === 'DETAILS') { d.open = true; d.scrollIntoView({ block: 'start' }); }
  }
  addEventListener('hashchange', openFromHash);

  /* ---------- analytics ---------- */
  // Umami (cloud.umami.is) counts page views on its own. This adds a few click events:
  // main buttons, links that leave the site, copying the vote account, and form sends.
  function track(name, data) { if (window.umami) window.umami.track(name, data); }
  function analytics() {
    document.addEventListener('click', function (e) {
      var n = e.target.closest('a, button'); if (!n) return;
      var label = n.textContent.replace(/\s+/g, ' ').trim().slice(0, 60);
      if (n.hasAttribute('data-copy')) track('copy-address');
      else if (n.tagName === 'A' && n.hostname && n.hostname !== location.hostname) track('outbound-link', { to: n.hostname, label: label });
      else if (n.classList.contains('btn') && n.tagName === 'A') track('cta-click', { label: label, to: n.getAttribute('href') });
    });
    document.addEventListener('submit', function (e) {
      var f = e.target, email = $('input[type="email"]', f);
      if (!f.checkValidity() || (email && !email.value)) return;
      track(f.classList.contains('contact-form') ? 'contact-form' : 'newsletter-signup');
    });
  }

  analytics();
  chrome();
  openFromHash();
  getJSON('claims.json').then(function (reg) {
    REG = reg; C = reg.constants; SRC = reg.sources; ORGS = reg.orgs;
    reg.claims.forEach(function (c) { CL[c.id] = c; });
    window.REFI_CLAIMS = CL;
    constLinks();
    jupiterSwap();
    renderValues();
    runLive();
  }).catch(function (e) {
    $$('[data-claim]').forEach(function (n) { n.textContent = 'unavailable'; n.classList.add('pending'); });
    if (window.console) console.error('[claims] could not load claims.json', e);
  });
})();
