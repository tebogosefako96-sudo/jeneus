// assets/js/auth.js
// Lightweight auth bridging file.
// - If Auth0 is configured, it will attempt to load the SPA flow (placeholders below).
// - Otherwise it uses the local offline auth provided by app.js (registerUser/loginUser).

(function(){
  'use strict';

  // Config placeholders - replace if using Auth0
  const AUTH0_DOMAIN = '{AUTH0_DOMAIN}';
  const AUTH0_CLIENT_ID = '{AUTH0_CLIENT_ID}';

  // Public API
  window.EdgeAuth = {
    init,
    loginWithAuth0,
    logout,
    registerOffline,
    loginOffline,
    currentUser
  };

  function currentUser(){
    return window.EdgeMetrics ? window.EdgeMetrics.currentUser() : null;
  }

  async function registerOffline(email, password, name){
    if(!window.EdgeMetrics) throw new Error('EdgeMetrics runtime not loaded');
    return await window.EdgeMetrics.registerUser({email,password,name});
  }
  async function loginOffline(email, password){
    if(!window.EdgeMetrics) throw new Error('EdgeMetrics runtime not loaded');
    return await window.EdgeMetrics.loginUser(email,password);
  }

  // Lazy load Auth0 SDK if domain & client id present
  async function init(){
    if(AUTH0_DOMAIN && AUTH0_CLIENT_ID && !AUTH0_DOMAIN.includes('{AUTH0')){
      // Attempt to load Auth0 SPA SDK
      try {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@auth0/auth0-spa-js@2/dist/auth0-spa-js.production.js';
        document.head.appendChild(s);
        await new Promise((res)=> s.onload = res);
        // create client
        window._edg_auth0 = await createAuth0Client({
          domain: AUTH0_DOMAIN,
          client_id: AUTH0_CLIENT_ID,
          cacheLocation: 'localstorage'
        });
      } catch(e){
        console.warn('Auth0 init failed', e);
      }
    }
  }

  async function loginWithAuth0(){
    if(!window._edg_auth0) throw new Error('Auth0 not initialized');
    await window._edg_auth0.loginWithRedirect();
  }

  async function logout(){
    // If Auth0 session present, log out there
    if(window._edg_auth0){
      try { await window._edg_auth0.logout({returnTo: window.location.origin}); return; } catch(e){}
    }
    // Fallback: local logout
    if(window.EdgeMetrics) window.EdgeMetrics.logout();
  }

  // auto init
  document.addEventListener('DOMContentLoaded', ()=> { init().catch(()=>{}); });
})();
