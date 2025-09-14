// assets/js/app.js  (EdgeMetrics core client logic)
(() => {
  'use strict';
  const USERS_KEY = 'edgemetrics_users_v1';
  const TRADES_KEY = 'edgemetrics_trades_v1';
  const SESSION_KEY = 'edgemetrics_session_v1';
  const SETTINGS_KEY = 'edgemetrics_settings_v1';

  const jsonGet = (k, fallback) => {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; }
    catch(e){ return fallback; }
  };
  const jsonSet = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const genId = () => 'id_' + Math.random().toString(36).slice(2,10);

  // Broadcast channel for cross-tab updates
  const bcName = 'edgemetrics_channel_v1';
  let bc = null;
  try { bc = new BroadcastChannel(bcName); bc.onmessage = (ev)=> handleRemote(ev.data); }
  catch(e){ bc = null; window.addEventListener('storage', (ev)=> {
    if(ev.key && ev.key.startsWith('edgemetrics_')) triggerSubscribers({type:'storage', key:ev.key});
  }); }

  const subscribers = new Set();
  const subscribe = (fn) => { subscribers.add(fn); return ()=>subscribers.delete(fn); };
  const notifyAll = (msg) => { subscribers.forEach(fn=>{ try{ fn(msg); }catch(e){} }); };
  const broadcast = (msg) => {
    try { if (bc) bc.postMessage(msg); else localStorage.setItem(`edgemetrics_sync_${Date.now()}`, JSON.stringify(msg)); } catch(e){}
    notifyAll(msg);
  };
  const handleRemote = (msg) => { notifyAll(msg); };

  async function sha256Hex(text){
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  }

  // Auth (client-side offline mode)
  async function registerUser({email, password, name, plan='starter'}){
    const users = jsonGet(USERS_KEY, []);
    if (users.find(u=>u.email === email)) throw new Error('Email already exists');
    const hash = await sha256Hex(password);
    const id = genId();
    users.push({id,email,hash,name,plan,createdAt:Date.now()});
    jsonSet(USERS_KEY, users);
    broadcast({type:'users:updated', id});
    return id;
  }
  async function loginUser(email, password){
    const users = jsonGet(USERS_KEY, []);
    const user = users.find(u=>u.email === email);
    if(!user) throw new Error('User not found');
    const hash = await sha256Hex(password);
    if(hash !== user.hash) throw new Error('Invalid credentials');
    const session = {userId:user.id, createdAt:Date.now()};
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    jsonSet(SESSION_KEY, session);
    broadcast({type:'session:changed', userId:user.id});
    return user;
  }
  function logout(){
    sessionStorage.removeItem(SESSION_KEY);
    jsonSet(SESSION_KEY, null);
    broadcast({type:'session:changed', userId:null});
  }
  function currentUser(){
    const s = jsonGet(SESSION_KEY, null);
    if(!s || !s.userId) return null;
    const users = jsonGet(USERS_KEY, []);
    return users.find(u=>u.id === s.userId) || null;
  }

  // Trades CRUD
  function createTrade(trade){
    const trades = jsonGet(TRADES_KEY, []);
    const id = genId();
    const t = Object.assign({id, createdAt:Date.now()}, trade);
    trades.push(t);
    jsonSet(TRADES_KEY, trades);
    broadcast({type:'trades:created', id});
    return t;
  }
  function updateTrade(id, updates){
    const trades = jsonGet(TRADES_KEY, []);
    const idx = trades.findIndex(x=>x.id===id); if(idx===-1) throw new Error('Not found');
    trades[idx] = Object.assign(trades[idx], updates, {updatedAt:Date.now()});
    jsonSet(TRADES_KEY, trades);
    broadcast({type:'trades:updated', id});
    return trades[idx];
  }
  function deleteTrade(id){
    let trades = jsonGet(TRADES_KEY, []);
    trades = trades.filter(t=>t.id !== id);
    jsonSet(TRADES_KEY, trades);
    broadcast({type:'trades:deleted', id});
    return true;
  }
  function getTrades(){ return jsonGet(TRADES_KEY, []); }

  // UI helpers
  function attachTradeForm(formSelector, listSelector){
    const form = document.querySelector(formSelector);
    const list = document.querySelector(listSelector);
    if(!form || !list) return;
    form.addEventListener('submit', (ev)=>{
      ev.preventDefault();
      const fd = new FormData(form);
      const trade = {
        symbol: fd.get('symbol') || '',
        entry: parseFloat(fd.get('entry')) || 0,
        size: parseFloat(fd.get('size')) || 0,
        direction: fd.get('direction') || 'long',
        notes: fd.get('notes') || '',
      };
      createTrade(trade);
      form.reset();
      renderTrades(list);
    });
    subscribe(()=> renderTrades(list));
    renderTrades(list);
  }
  function renderTrades(container){
    if(!container) return;
    const trades = getTrades();
    if(trades.length === 0) { container.innerHTML = '<div class="card p-4">No trades yet. Use the form to add one.</div>'; return; }
    container.innerHTML = trades.map(t=>`
      <div class="card mb-3">
        <div class="flex justify-between items-start">
          <div>
            <div class="text-sm text-muted">${new Date(t.createdAt).toLocaleString()}</div>
            <div class="text-lg font-semibold">${t.symbol || '(no symbol)'}</div>
            <div class="text-sm">Entry ${t.entry} • Size ${t.size} • ${t.direction}</div>
            <div class="mt-2 text-sm">${t.notes || ''}</div>
          </div>
          <div class="flex flex-col gap-2">
            <button class="btn-ghost" data-action="edit" data-id="${t.id}">Edit</button>
            <button class="btn-ghost" data-action="delete" data-id="${t.id}">Delete</button>
          </div>
        </div>
      </div>
    `).join('');
    container.querySelectorAll('button[data-action="delete"]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id = btn.getAttribute('data-id'); if(!confirm('Delete trade?')) return;
        deleteTrade(id); renderTrades(container);
      });
    });
  }

  // expose api
  window.EdgeMetrics = {
    registerUser, loginUser, logout, currentUser,
    createTrade, updateTrade, deleteTrade, getTrades,
    attachTradeForm, renderTrades, subscribe
  };

  function initUI(){
    const navLogin = document.getElementById('nav-login');
    const navAccount = document.getElementById('nav-account');
    const user = currentUser();
    if(user){
      if(navLogin) navLogin.style.display = 'none';
      if(navAccount) navAccount.style.display = '';
    } else {
      if(navLogin) navLogin.style.display = '';
      if(navAccount) navAccount.style.display = 'none';
    }
    subscribe(()=> initUI());
  }
  document.addEventListener('DOMContentLoaded', initUI);
})();
