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

  window.KemData = {
    enabled: ENABLED,
    LS_KEY: LS_KEY,

    // Returns { photos, films, services, reviews } (or null). Async.
    load: function () {
      if (ENABLED) {
        return fetch(SUPABASE_URL + "/rest/v1/site_content?id=eq.1&select=data", { headers: headers() })
          .then(function (res) { return res.ok ? res.json() : null; })
          .then(function (rows) {
            if (rows && rows[0] && rows[0].data) { lsSave(rows[0].data); return rows[0].data; }
            return lsLoad();
          })
          .catch(function () { return lsLoad(); });
      }
      return Promise.resolve(lsLoad());
    },

    // Persists the whole content object. Always keeps a local copy too.
    save: function (state) {
      lsSave(state);
      if (ENABLED) {
        try {
          var h = headers(); h["Prefer"] = "resolution=merge-duplicates";
          fetch(SUPABASE_URL + "/rest/v1/site_content?on_conflict=id", {
            method: "POST",
            headers: h,
            body: JSON.stringify([{ id: 1, data: state }])
          });
        } catch (e) {}
      }
    }
  };
})();
