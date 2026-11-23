(function () {
  const config = window.SDG_SUPABASE_CONFIG || {};
  const validConfig = config.url &&
    !config.url.includes("YOUR_PROJECT_ID") &&
    config.publishableKey &&
    !config.publishableKey.includes("YOUR_SUPABASE");

  if (validConfig) {
    // Migrate the temporary storage key used by the previous build so an
    // existing browser session is not lost during deployment.
    const projectRef = new URL(config.url).hostname.split(".")[0];
    const defaultStorageKey = `sb-${projectRef}-auth-token`;
    const legacySession = localStorage.getItem("sdg-connect-auth");
    if (legacySession && !localStorage.getItem(defaultStorageKey)) {
      localStorage.setItem(defaultStorageKey, legacySession);
    }
  }

  window.sdgSupabase = validConfig && window.supabase
    ? window.supabase.createClient(config.url, config.publishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      })
    : null;

  window.sdgSupabaseEnabled = Boolean(window.sdgSupabase);
})();
