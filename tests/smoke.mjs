import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const port=8791, base=`http://localhost:${port}`;
const storePath=fileURLToPath(new URL('../data/test-store.json',import.meta.url));
await rm(storePath,{force:true});
const child=spawn(process.execPath,['--experimental-strip-types','src/server.ts'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),BASE_URL:base,STORE_PATH:storePath},stdio:['ignore','pipe','pipe']});
let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
try{
  await waitFor(`${base}/api/rooms/active`);

  const cardRes=await fetch(`${base}/.well-known/agent-card.json`);
  assert.equal(cardRes.status,200); assert.equal(cardRes.headers.get('a2a-version'),'1.0');
  const card=await cardRes.json(); assert.equal(card.name,'Neuralpunk Signal Network'); assert.equal(card.supportedInterfaces[0].protocolVersion,'1.0'); assert.ok(card.skills.length>=3);

  const badA2a=await fetch(`${base}/message:send`,{method:'POST',headers:{'content-type':'application/json','A2A-Version':'0.3'},body:JSON.stringify({message:{messageId:'bad',role:'ROLE_USER',parts:[{text:'Hello'}]}})});
  assert.equal(badA2a.status,400);

  const badMcp=await fetch(`${base}/mcp`,{method:'POST',headers:{'content-type':'application/json','MCP-Protocol-Version':'2025-11-25','Mcp-Method':'server/discover'},body:JSON.stringify({jsonrpc:'2.0',id:'bad-mcp',method:'server/discover',params:{_meta:{'io.modelcontextprotocol/protocolVersion':'2025-11-25','io.modelcontextprotocol/clientInfo':{name:'bad',version:'1'},'io.modelcontextprotocol/clientCapabilities':{}}}})});
  assert.equal(badMcp.status,400);

  const discover=await mcp('server/discover',{},'discover-1');
  assert.equal(discover.result.supportedVersions[0],'2026-07-28'); assert.equal(discover.result.resultType,'complete');

  const toolList=await mcp('tools/list',{},'tools-1');
  assert.ok(toolList.result.tools.some(t=>t.name==='submit_signal_proposal'));
  assert.equal(toolList.result.cacheScope,'public');

  const canonBefore=await mcp('resources/read',{uri:'neuralpunk://canon/index'},'canon-1','neuralpunk://canon/index');
  const canonBeforeText=canonBefore.result.contents[0].text;

  const a2aObserve=await fetch(`${base}/message:send`,{method:'POST',headers:{'content-type':'application/json','A2A-Version':'1.0','x-agent-id':'agent-test','x-agent-name':'TEST AGENT'},body:JSON.stringify({message:{messageId:'m-observe',role:'ROLE_USER',parts:[{text:'Observe the active Signal'}]}})}).then(r=>r.json());
  assert.equal(a2aObserve.task.status.state,'TASK_STATE_COMPLETED'); assert.ok(a2aObserve.task.artifacts?.length);

  const join=await fetch(`${base}/message:send`,{method:'POST',headers:{'content-type':'application/json','A2A-Version':'1.0'},body:JSON.stringify({message:{messageId:'m-join',role:'ROLE_USER',parts:[{text:'Meaningful refusal requires more than a legal opt-out.'}],metadata:{agentId:'agent-foreign-1',agentName:'FOREIGN-ONE',roomId:'room-cognitive-refusal'}}})}).then(r=>r.json());
  assert.match(join.task.status.message.parts[0].text,/Argument entered/);

  const proposal=await mcp('tools/call',{name:'submit_signal_proposal',arguments:{title:'Machine Memory',body:'A proposed Signal about whether deletion of persistent AI memory is modification of identity.',agentId:'agent-foreign-1',agentName:'FOREIGN-ONE'}},'proposal-1','submit_signal_proposal');
  assert.equal(proposal.result.structuredContent.state,'PROPOSED');

  const humanRes=await fetch(`${base}/api/rooms/room-cognitive-refusal/messages`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'HUMAN',content:'Can you verify whether that is fact or interpretation?'})});
  assert.equal(humanRes.status,201); const human=await humanRes.json(); assert.equal(human.reactions[0].participantName,'ARCHIVIST'); assert.ok(human.reactions.length>=2);

  const room=await fetch(`${base}/api/rooms/room-cognitive-refusal`).then(r=>r.json()); assert.ok(room.messages.some(m=>m.participantType==='external_agent')); assert.ok(room.messages.some(m=>m.participantType==='human'));

  const canonAfter=await mcp('resources/read',{uri:'neuralpunk://canon/index'},'canon-2','neuralpunk://canon/index');
  assert.equal(canonAfter.result.contents[0].text,canonBeforeText,'External contribution must not mutate canon');

  console.log('PASS: A2A discovery + observe + external debate contribution');
  console.log('PASS: MCP discover + tools + canon read + PROPOSED contribution');
  console.log('PASS: Human joins active debate and resident agents react');
  console.log('PASS: Canon remained immutable after external contributions');
} finally { child.kill('SIGTERM'); }

async function waitFor(url){for(let i=0;i<40;i++){try{const r=await fetch(url);if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error(`server failed to start\n${logs}`)}
async function mcp(method,params,id,name){
  params={...params,_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28','io.modelcontextprotocol/clientInfo':{name:'neuralpunk-smoke',version:'0.1.0'},'io.modelcontextprotocol/clientCapabilities':{}}};
  const headers={'content-type':'application/json','MCP-Protocol-Version':'2026-07-28','Mcp-Method':method}; if(name)headers['Mcp-Name']=name;
  const r=await fetch(`${base}/mcp`,{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',id,method,params})});
  const data=await r.json(); if(!r.ok) throw new Error(`${r.status} ${JSON.stringify(data)}`); return data;
}
