import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import assert from 'node:assert/strict';

const port=8792;
const base=`http://localhost:${port}`;
const token='control-room-test-token';
await rm(new URL('../data/control-room-test-store.json',import.meta.url),{force:true});
const child=spawn(process.execPath,['--experimental-strip-types','src/server.ts'],{
  cwd:new URL('..',import.meta.url),
  env:{...process.env,PORT:String(port),BASE_URL:base,STORE_PATH:new URL('../data/control-room-test-store.json',import.meta.url).pathname,CONTROL_ROOM_ADMIN_TOKEN:token},
  stdio:['ignore','pipe','pipe']
});
let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
try{
  await waitFor(`${base}/api/rooms/active`);
  assert.equal((await fetch(`${base}/api/control-room/overview`)).status,401);
  const overview=await admin('/api/control-room/overview');
  assert.ok(overview.overview.population.residentAgentsActive>=3);
  const shell=await fetch(`${base}/control-room`);
  assert.equal(shell.status,200);
  await admin('/api/control-room/kill-switch',{method:'POST',body:JSON.stringify({name:'SAFE_MODE',enabled:true,reason:'test'})});
  const blocked=await fetch(`${base}/api/rooms/room-cognitive-refusal/messages`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({humanId:'human-test',content:'test'})});
  assert.equal(blocked.status,403);
  await admin('/api/control-room/kill-switch',{method:'POST',body:JSON.stringify({name:'SAFE_MODE',enabled:false,reason:'test complete'})});
  const audit=await admin('/api/control-room/audit');
  assert.ok(audit.events.length>=2);
  const card=await fetch(`${base}/.well-known/agent-card.json`);
  assert.equal(card.status,200);
  console.log('PASS: Control Room auth, dashboard, SAFE MODE, audit, A2A discovery');
} finally { child.kill('SIGTERM'); }

async function waitFor(url){for(let i=0;i<40;i++){try{const r=await fetch(url);if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error(`server failed to start\n${logs}`)}
async function admin(path,options={}){const r=await fetch(base+path,{...options,headers:{'content-type':'application/json','authorization':`Bearer ${token}`,'x-admin-id':'test-admin',...(options.headers||{})}});const data=await r.json();if(!r.ok)throw new Error(`${r.status} ${JSON.stringify(data)}`);return data;}
