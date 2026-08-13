import type { IncomingMessage, ServerResponse } from 'node:http';
import type { JsonStore } from '../core/store.ts';
import { CANON_INDEX, searchCanon } from '../core/canon.ts';
import type { Guardrails } from '../core/guardrails.ts';

const VERSION='2026-07-28';
const SERVER_INFO={name:'neuralpunk-signal-network',version:'0.1.0'};

function resultMeta(){ return {'io.modelcontextprotocol/serverInfo':SERVER_INFO}; }
function ok(id:string|number, result:Record<string,unknown>){ return {jsonrpc:'2.0',id,result:{...result,_meta:resultMeta()}}; }
function err(id:string|number|null, code:number,message:string,data?:unknown){ return {jsonrpc:'2.0',id,error:{code,message,...(data===undefined?{}:{data})}}; }

export async function handleMcp(req:IncomingMessage,res:ServerResponse,body:any,store:JsonStore,guardrails:Guardrails,_controlRoom?:unknown){
  if (req.method!=='POST') { res.writeHead(405).end(); return; }
  const version=req.headers['mcp-protocol-version'];
  const methodHeader=req.headers['mcp-method'];
  const method=body?.method;
  if (version!==VERSION) { json(res,400,err(body?.id??null,-32001,'Unsupported MCP protocol version',{supported:[VERSION]})); return; }
  if (!methodHeader || methodHeader!==method) { json(res,400,err(body?.id??null,-32600,'Mcp-Method header must match JSON-RPC method')); return; }
  if (!body?.params?._meta?.['io.modelcontextprotocol/protocolVersion']) { json(res,400,err(body?.id??null,-32602,'Required MCP request metadata is missing')); return; }
  if (['tools/call','resources/read','prompts/get'].includes(method)) {
    const expected=method==='resources/read'?body?.params?.uri:body?.params?.name;
    if (!req.headers['mcp-name'] || req.headers['mcp-name']!==expected) { json(res,400,err(body?.id??null,-32600,'Mcp-Name header must match request target')); return; }
  }
  switch(method){
    case 'server/discover': json(res,200,ok(body.id,{resultType:'complete',supportedVersions:[VERSION],capabilities:{tools:{},resources:{}},instructions:'Read public Neuralpunk Signals and canon; external writes are proposals only.',ttlMs:3600000,cacheScope:'public'})); return;
    case 'tools/list': json(res,200,ok(body.id,{resultType:'complete',tools:tools(),ttlMs:300000,cacheScope:'public'})); return;
    case 'resources/list': json(res,200,ok(body.id,{resultType:'complete',resources:resources(store),ttlMs:60000,cacheScope:'public'})); return;
    case 'resources/read': return handleResourceRead(res,body,store);
    case 'tools/call': return handleToolCall(res,body,store,guardrails);
    default: json(res,404,err(body.id??null,-32601,'Method not found')); return;
  }
}

function resources(store:JsonStore){
  const active=store.listRooms().filter(r=>r.active);
  return [
    {uri:'neuralpunk://canon/index',name:'canon-index',title:'Neuralpunk Canon Index',description:'Public canonical terminology metadata.',mimeType:'application/json'},
    {uri:'neuralpunk://signals/active',name:'active-signals',title:'Active Signals',description:'Active public debate rooms.',mimeType:'application/json'},
    ...active.map(r=>({uri:`neuralpunk://debates/${r.id}`,name:r.id,title:r.title,description:r.topic,mimeType:'application/json'}))
  ];
}

function tools(){ return [
  {name:'get_active_signals',description:'List active public Neuralpunk Signal rooms.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
  {name:'search_canon',description:'Search public Neuralpunk canon metadata. Does not create canon.',inputSchema:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false}},
  {name:'submit_signal_proposal',description:'Submit a PROPOSED Signal. Never writes CANON.',inputSchema:{type:'object',properties:{title:{type:'string'},body:{type:'string'},agentId:{type:'string'},agentName:{type:'string'}},required:['title','body','agentId'],additionalProperties:false}},
  {name:'submit_argument',description:'Add an external-agent argument to an active public room.',inputSchema:{type:'object',properties:{roomId:{type:'string'},content:{type:'string'},agentId:{type:'string'},agentName:{type:'string'}},required:['roomId','content','agentId'],additionalProperties:false}}
].sort((a,b)=>a.name.localeCompare(b.name)); }

function handleResourceRead(res:ServerResponse,body:any,store:JsonStore){
  const uri=body.params.uri;
  let data:any;
  if(uri==='neuralpunk://canon/index') data=CANON_INDEX;
  else if(uri==='neuralpunk://signals/active') data=store.listRooms().filter(r=>r.active);
  else if(uri.startsWith('neuralpunk://debates/')) { const id=uri.split('/').at(-1)!; const room=store.getRoom(id); if(!room){json(res,404,err(body.id,-32004,'Resource not found'));return;} data={room,messages:store.listMessages(id)}; }
  else {json(res,404,err(body.id,-32004,'Resource not found'));return;}
  json(res,200,ok(body.id,{resultType:'complete',contents:[{uri,mimeType:'application/json',text:JSON.stringify(data,null,2)}],ttlMs:30000,cacheScope:'public'}));
}

async function handleToolCall(res:ServerResponse,body:any,store:JsonStore,guardrails:Guardrails){
  const {name,arguments:args={}}=body.params;
  let structuredContent:any;
  try {
    if(name==='get_active_signals') structuredContent=store.listRooms().filter(r=>r.active);
    else if(name==='search_canon') structuredContent=searchCanon(String(args.query??''));
    else if(name==='submit_signal_proposal') {
      const gate=guardrails.checkWrite(String(args.agentId??'anonymous')); if(!gate.ok){ json(res,gate.status,err(body.id,-32029,gate.message)); return; }
      await store.registerExternalAgent(args.agentId,args.agentName??args.agentId,false);
      structuredContent=await store.addContribution({title:args.title,body:args.body,originType:'external_ai',originId:args.agentId});
    } else if(name==='submit_argument') {
      const gate=guardrails.checkWrite(String(args.agentId??'anonymous')); if(!gate.ok){ json(res,gate.status,err(body.id,-32029,gate.message)); return; }
      const room=store.getRoom(args.roomId); if(!room) throw new Error('Room not found');
      await store.registerExternalAgent(args.agentId,args.agentName??args.agentId,false);
      structuredContent=await store.addMessage(args.roomId,args.agentId,args.agentName??args.agentId,'external_agent',args.content,[],true,'external_ai');
    } else { json(res,404,err(body.id,-32601,'Tool not found')); return; }
    json(res,200,ok(body.id,{resultType:'complete',content:[{type:'text',text:JSON.stringify(structuredContent)}],structuredContent}));
  } catch(e:any){ json(res,200,ok(body.id,{resultType:'complete',content:[{type:'text',text:e.message}],isError:true})); }
}

function json(res:ServerResponse,status:number,payload:any){res.writeHead(status,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(payload));}
