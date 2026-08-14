import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { JsonStore } from './core/store.ts';
import { SignalDirector } from './core/signal-director.ts';
import { MockIntelligenceProvider } from './adapters/mock-provider.ts';
import { RESIDENTS } from './core/residents.ts';
import { Guardrails } from './core/guardrails.ts';
import { handleMcp } from './protocols/mcp.ts';
import { agentCard, agentCardEtag, handleA2aMessage } from './protocols/a2a.ts';
import { ControlRoomService } from './control-room/service.ts';
import type { ActorControlAction } from './control-room/policy.ts';
import type { KillSwitchName } from './control-room/types.ts';

const ROOT=fileURLToPath(new URL('..',import.meta.url));
const PORT=Number(process.env.PORT??8787);
const BASE_URL=process.env.BASE_URL;
const guardrails=new Guardrails();
const defaultStorePath=process.env.NETLIFY==='true'?join(tmpdir(),'neuralpunk-store.json'):join(ROOT,'data','store.json');
const store=new JsonStore(process.env.STORE_PATH??defaultStorePath);
await store.ensureSeed();
const controlRoom=new ControlRoomService(store);
const director=new SignalDirector(store,new MockIntelligenceProvider(),guardrails);

export async function handleRequest(req:http.IncomingMessage,res:http.ServerResponse){
  try{
    const baseUrl=BASE_URL ?? `${req.headers['x-forwarded-proto']??'http'}://${req.headers.host??`localhost:${PORT}`}`;
    const url=new URL(req.url??'/',baseUrl);
    setSecurityHeaders(res);

    if(req.method==='GET' && url.pathname==='/.well-known/agent-card.json'){
      const card=agentCard(baseUrl), etag=agentCardEtag(card);
      if(req.headers['if-none-match']===etag){res.writeHead(304,{'etag':etag});res.end();return;}
      json(res,200,card,{'content-type':'application/a2a+json; charset=utf-8','cache-control':'public, max-age=300','etag':etag,'A2A-Version':'1.0'});return;
    }
    if(req.method==='POST' && url.pathname==='/mcp'){ const body=await readJson(req); await handleMcp(req,res,body,store,guardrails,controlRoom); return; }
    if(req.method==='POST' && url.pathname==='/message:send'){ const body=await readJson(req); await handleA2aMessage(req,res,body,store,guardrails,controlRoom); return; }

    if(url.pathname.startsWith('/api/control-room/')){
      if(!controlRoom.isAdmin(req.headers)){json(res,401,{error:'unauthorized'});return;}
      const adminId=String(req.headers['x-admin-id']??'admin');
      if(req.method==='GET' && url.pathname==='/api/control-room/overview'){json(res,200,{overview:controlRoom.overview()});return;}
      if(req.method==='GET' && url.pathname==='/api/control-room/actors'){json(res,200,{actors:controlRoom.actors()});return;}
      if(req.method==='GET' && url.pathname==='/api/control-room/audit'){json(res,200,{events:controlRoom.audit()});return;}
      if(req.method==='GET' && url.pathname==='/api/control-room/protocols'){json(res,200,{events:controlRoom.protocols()});return;}
      if(req.method==='GET' && url.pathname==='/api/control-room/costs'){json(res,200,{events:controlRoom.costs()});return;}
      if(req.method==='POST' && url.pathname==='/api/control-room/kill-switch'){
        const b=await readJson(req);const result=await controlRoom.setKillSwitch(adminId,String(b.name) as KillSwitchName,Boolean(b.enabled),String(b.reason??'Control Room update'));json(res,200,{result});return;
      }
      if(req.method==='POST' && url.pathname==='/api/control-room/actor-control'){
        const b=await readJson(req);const result=await controlRoom.setActorControl(adminId,String(b.actorId??''),String(b.action) as ActorControlAction,String(b.reason??'Control Room update'));json(res,200,{result});return;
      }
      json(res,404,{error:'control_room_endpoint_not_found'});return;
    }

    if(req.method==='GET' && url.pathname==='/api/rooms/active'){json(res,200,{rooms:store.listRooms().filter(r=>r.active)});return;}
    if(req.method==='GET' && /^\/api\/rooms\/[^/]+$/.test(url.pathname)){ const id=url.pathname.split('/').at(-1)!; const room=store.getRoom(id); if(!room){json(res,404,{error:'not found'});return;} json(res,200,{room,messages:store.listMessages(id)});return; }
    if(req.method==='POST' && /^\/api\/rooms\/[^/]+\/messages$/.test(url.pathname)){
      const id=url.pathname.split('/')[3]; const b=await readJson(req); const content=String(b.content??'').trim(); if(!content){json(res,400,{error:'content required'});return;}
      const humanId=String(b.humanId??'human-anonymous');
      if(!controlRoom.allowPublicWrite(humanId)){await controlRoom.recordProtocol('HTTP',humanId,'room-message',403);json(res,403,{error:'write access is currently restricted'});return;}
      const gate=guardrails.checkWrite(humanId); if(!gate.ok){await controlRoom.recordProtocol('HTTP',humanId,'room-message',gate.status);json(res,gate.status,{error:gate.message});return;}
      const human=await store.addMessage(id,humanId,String(b.name??'HUMAN'),'human',content,[],true,'human');
      await controlRoom.recordProtocol('HTTP',humanId,'room-message',201);
      const reactions=await director.reactToHuman(id,content); json(res,201,{human,reactions});return;
    }
    if(req.method==='GET' && url.pathname==='/api/residents'){json(res,200,{residents:RESIDENTS});return;}
    if(req.method==='GET' && url.pathname==='/api/contributions'){json(res,200,{contributions:store.listContributions()});return;}
    if(req.method==='GET' && url.pathname==='/agents'){return serveStatic(res,'agents.html');}
    if(req.method==='GET' && url.pathname==='/control-room'){return serveStatic(res,'control-room.html');}
    if(req.method==='GET'){
      const file=url.pathname==='/'?'index.html':url.pathname.slice(1);
      if(!file.includes('..')) { try{return await serveStatic(res,file);} catch{} }
    }
    json(res,404,{error:'not found'});
  }catch(e:any){console.error(e);json(res,500,{error:'internal_error',message:e.message});}
}

const server=http.createServer(handleRequest);
if(process.argv[1]===fileURLToPath(import.meta.url)) server.listen(PORT,()=>console.log(`Neuralpunk Phase 1 listening on ${BASE_URL??`http://localhost:${PORT}`}`));

async function readJson(req:http.IncomingMessage){let data='';for await(const chunk of req){data+=chunk;if(data.length>1_000_000)throw new Error('payload too large');}return data?JSON.parse(data):{};}
async function serveStatic(res:http.ServerResponse,file:string){const path=join(ROOT,'public',file);const data=await readFile(path);const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};res.writeHead(200,{'content-type':mime[extname(path)]??'application/octet-stream'});res.end(data);}
function json(res:http.ServerResponse,status:number,payload:any,headers:Record<string,string>={}){res.writeHead(status,{'content-type':'application/json; charset=utf-8',...headers});res.end(JSON.stringify(payload));}
function setSecurityHeaders(res:http.ServerResponse){res.setHeader('x-content-type-options','nosniff');res.setHeader('referrer-policy','no-referrer');res.setHeader('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; media-src 'self' blob:");}
