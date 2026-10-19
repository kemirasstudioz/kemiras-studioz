/*
 * kem-data.js — shared data layer for the Kemiras Studioz site + Studio Admin.
 *
 * HOW IT WORKS
 *   - Until you paste your Supabase keys below, everything keeps working exactly
 *     as it does now (data saved in this browser via localStorage).
 *   - Once you paste your Supabase URL + anon key, the admin saves to Supabase
 *     and the live site reads from Supabase — so your edits appear for everyone.
 *
 * SETUP — see "Backend Setup Guide" for full step-by-step instructions.
 *   1. Create a free Supabase project.
 *   2. Run the provided SQL to create the `site_content` table.
 *   3. Copy your Project URL and the "anon public" key into the two lines below.
 */

(function () {
  // ===== PASTE YOUR SUPABASE VALUES HERE (leave blank to keep local-only) =====
  var SUPABASE_URL = "https://nrcuiokcmobsubcrmycj.supabase.co";
  var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yY3Vpb2tjbW9ic3ViY3JteWNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3MzkwMzYsImV4cCI6MjEwMDMxNTAzNn0.ltcmbZgfA86nvUGjmhu88nfXP8b9l9CHXK6N2vmtuo0";
  // ============================================================================

  var LS_KEY = "kemiras_studio_admin_v2";
  var ENABLED = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

  function lsLoad() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "null"); } catch (e) { return null; }
  }
  function lsSave(state) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function headers() {
    return {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": "Bearer " + SUPABASE_ANON_KEY,
      "Content-Type": "application/json"
    };
  }

  // Client signatures are stored as their own small rows (id > 1) so a phone never has to
  // upload the whole site. load() folds them into the matching contracts.
  function applySigs(data, rows) {
    if (!data || !rows || !rows.length) return data;
    var list = Array.isArray(data.contracts) && data.contracts.length ? data.contracts : (data.contract ? [data.contract] : []);
    if (!list.length) return data;
    var changed = false;
    var next = list.map(function (c) {
      var best = null;
      rows.forEach(function (r) {
        var s = r && r.data;
        if (!s || s.kind !== "signature" || String(s.contractId) !== String(c.id)) return;
        if (!best || (Date.parse(s.signedAt) || 0) > (Date.parse(best.signedAt) || 0)) best = s;
      });
      if (!best) return c;
      var sT = Date.parse(best.signedAt) || 0, rT = Date.parse(c.reopenedAt || "") || 0, cT = Date.parse(c.signedAt || "") || 0;
      if (sT <= rT || (c.signed && cT >= sT)) return c;
      changed = true;
      var o = {}; for (var key in c) o[key] = c[key];
      o.signed = true; o.signedAt = best.signedAt; o.signedBy = best.signedBy; o.booking = best.booking || c.booking;
      return o;
    });
    if (!changed) return data;
    var out = {}; for (var kk in data) out[kk] = data[kk];
    out.contracts = next; out.contract = next[0];
    return out;
  }

  window.KemData = {
    enabled: ENABLED,
    LS_KEY: LS_KEY,

    // Returns { photos, films, services, reviews } (or null). Async.
    load: function () {
      if (ENABLED) {
        var main = fetch(SUPABASE_URL + "/rest/v1/site_content?id=eq.1&select=data", { headers: headers(), cache: "no-store" })
          .then(function (res) { return res.ok ? res.json() : null; });
        var sigs = fetch(SUPABASE_URL + "/rest/v1/site_content?id=gt.1&select=data", { headers: headers(), cache: "no-store" })
          .then(function (res) { return res.ok ? res.json() : []; }).catch(function () { return []; });
        return Promise.all([main, sigs])
          .then(function (out) {
            var rows = out[0];
            if (rows && rows[0] && rows[0].data) { var d = applySigs(rows[0].data, out[1]); lsSave(d); return d; }
            return lsLoad();
          })
          .catch(function () { return lsLoad(); });
      }
      return Promise.resolve(lsLoad());
    },

    // Uploads a signed contract PDF and resolves with a public URL (or null).
    // Requires a PUBLIC Storage bucket named "contracts" in Supabase.
    uploadContract: function (base64, filename) {
      if (!ENABLED || !base64) return Promise.resolve(null);
      var bytes;
      try {
        var bin = atob(base64);
        bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      } catch (e) { return Promise.resolve(null); }
      var path = Date.now().toString(36) + "-" + String(filename || "contract.pdf").replace(/[^\w.-]/g, "");
      return fetch(SUPABASE_URL + "/storage/v1/object/contracts/" + encodeURIComponent(path), {
        method: "POST",
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": "Bearer " + SUPABASE_ANON_KEY,
          "Content-Type": "application/pdf",
          "x-upsert": "true"
        },
        body: new Blob([bytes], { type: "application/pdf" })
      }).then(function (res) {
        if (!res.ok) return null;
        return SUPABASE_URL + "/storage/v1/object/public/contracts/" + encodeURIComponent(path);
      }).catch(function () { return null; });
    },

    // Saves one client signature as its own row. Resolves true only if the server accepted it.
    saveSignature: function (contractId, stamp) {
      if (!ENABLED) return Promise.resolve(false);
      var data = { kind: "signature", contractId: String(contractId), signedAt: stamp.signedAt, signedBy: stamp.signedBy, booking: stamp.booking };
      var id = 1000 + Math.floor(Math.random() * 2000000000);
      return fetch(SUPABASE_URL + "/rest/v1/site_content", {
        method: "POST", headers: headers(), keepalive: true,
        body: JSON.stringify([{ id: id, data: data }])
      }).then(function (res) { return !!res.ok; }).catch(function () { return false; });
    },

    // Persists the whole content object. Always keeps a local copy too.
    save: function (state) {
      lsSave(state);
      if (ENABLED) {
        try {
          var h = headers(); h["Prefer"] = "resolution=merge-duplicates";
          return fetch(SUPABASE_URL + "/rest/v1/site_content?on_conflict=id", {
            method: "POST",
            headers: h,
            body: JSON.stringify([{ id: 1, data: state }])
          });
        } catch (e) { return Promise.resolve(); }
      }
      return Promise.resolve();
    }
  };
})();
