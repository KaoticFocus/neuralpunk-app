import assert from 'node:assert/strict';
import { SupabaseStore } from '../src/core/supabase-store.ts';

const calls=[];
const originalFetch=globalThis.fetch;
globalThis.fetch=async (input,init={})=>{
  const url=new URL(String(input));calls.push({url,init});
  if((init.method??'GET')==='GET'){
    if(url.pathname.endsWith('/rooms'))return json([{id:'room-cognitive-refusal',title:'Test',topic:'Test topic',signal_state:'SIMULATION',active:true,created_at:'2026-08-14T00:00:00Z'}]);
    if(url.pathname.endsWith('/messages'))return json([]);
    if(url.pathname.endsWith('/contributions'))return json([]);
    if(url.pathname.endsWith('/actors'))return json([]);
  }
  return new Response(null,{status:204});
};

try{
  const store=new SupabaseStore('https://example.supabase.co/','server-secret-test-value');
  await store.ensureSeed();
  assert.equal(store.kind,'supabase');
  assert.equal(store.listRooms()[0].id,'room-cognitive-refusal');

  const message=await store.addMessage('room-cognitive-refusal','Human Example','HUMAN','human','Persistence test');
  assert.equal(store.listMessages('room-cognitive-refusal')[0].id,message.id);
  assert.equal(post('/actors').body.id,'human-example');
  assert.equal(post('/messages').body.actor_id,'human-example');
  assert.ok(post('/provenance_records').body.id);

  await store.registerExternalAgent('Agent.Foreign/1','FOREIGN',false);
  const contribution=await store.addContribution({title:'Test proposal',body:'Test body',originType:'external_ai',originId:'Agent.Foreign/1'});
  assert.equal(store.getContribution(contribution.id)?.state,'PROPOSED');
  assert.equal(lastPost('/contributions').body.canon_mutable,false);
  assert.equal(lastPost('/contributions').body.origin_actor_id,'agent-foreign-1');

  for(const call of calls){
    assert.equal(call.init.headers.apikey,'server-secret-test-value');
    assert.equal(call.init.headers.authorization,'Bearer server-secret-test-value');
  }
  console.log('PASS: Supabase store loads durable state and writes actors, provenance, messages, and contributions');
} finally {globalThis.fetch=originalFetch;}

function json(value){return new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});}
function posts(path){return calls.filter(c=>(c.init.method??'GET')==='POST'&&c.url.pathname.endsWith(path)).map(c=>({body:JSON.parse(c.init.body),call:c}));}
function post(path){return posts(path)[0];}
function lastPost(path){return posts(path).at(-1);}
