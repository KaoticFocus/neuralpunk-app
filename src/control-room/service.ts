import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import type { JsonStore } from '../core/store.ts';
import type { Guardrails } from '../core/guardrails.ts';
import { RESIDENTS } from '../core/residents.ts';
import type { KillSwitchName } from './types.ts';

export class ControlRoomService {
  constructor(private store:JsonStore, private guardrails:Guardrails) {}

  isAdmin(headers:IncomingHttpHeaders){
    const expected=process.env.CONTROL_ROOM_ADMIN_TOKEN;
    if(!expected)return false;
    const raw=String(headers.authorization??'');
    const supplied=raw.startsWith('Bearer ')?raw.slice(7):'';
    if(!supplied)return false;
    const a=Buffer.from(expected),b=Buffer.from(supplied);
    return a.length===b.length&&timingSafeEqual(a,b);
  }

  overview(){
    const now=Date.now(),recent=(ts?:string)=>!!ts&&now-Date.parse(ts)<5*60_000;
    const messages=this.store.listRooms().flatMap(r=>this.store.listMessages(r.id));
    const humans=new Set(messages.filter(m=>m.participantType==='human'&&recent(m.createdAt)).map(m=>m.participantId));
    const external=this.store.listExternalAgents();
    const protocols=this.store.listProtocolEvents();
    const costs=this.store.listCostEvents();
    const today=new Date().toISOString().slice(0,10);
    return {
      population:{humansOnline:humans.size,externalAgentsOnline:external.filter(a=>recent(a.lastSeen)).length,residentAgentsActive:RESIDENTS.length,activeRooms:this.store.listRooms().filter(r=>r.active).length,activeLiveSignals:this.store.listRooms().filter(r=>r.active&&r.state==='LIVE').length},
      protocols:{mcpRequests:protocols.filter(e=>e.protocol==='MCP').length,a2aRequests:protocols.filter(e=>e.protocol==='A2A').length,rejectedRequests:protocols.filter(e=>e.status>=400).length},
      costs:{todayUsd:costs.filter(e=>e.createdAt.startsWith(today)).reduce((n,e)=>n+Number(e.estimatedCostUsd||0),0),totalEvents:costs.length},
      switches:this.store.listKillSwitches()
    };
  }

  actors(){
    const resident=RESIDENTS.map(r=>({id:r.id,name:r.name,type:'RESIDENT_AGENT',verified:true}));
    const external=this.store.listExternalAgents().map(a=>({...a,type:'EXTERNAL_AGENT'}));
    return [...resident,...external];
  }

  async recordProtocol(protocol:'MCP'|'A2A'|'HTTP'|'SYSTEM',actorId:string,action:string,status:number){
    return this.store.addProtocolEvent({id:randomUUID(),protocol,actorId,action,status,createdAt:new Date().toISOString()});
  }

  async setKillSwitch(adminId:string,name:KillSwitchName,enabled:boolean,reason:string){
    this.guardrails.setSwitch(name,enabled);
    await this.store.setKillSwitch(name,enabled,adminId);
    const event={id:randomUUID(),createdAt:new Date().toISOString(),actorId:adminId,actorType:'ADMIN' as const,action:'KILL_SWITCH_CHANGE',target:name,result:String(enabled),source:'CONTROL_ROOM',reason};
    await this.store.addAuditEvent(event);
    return this.store.listKillSwitches().find(s=>s.name===name)!;
  }
}
