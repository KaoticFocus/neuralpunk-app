import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import type { JsonStore } from '../core/store.ts';
import { RESIDENTS } from '../core/residents.ts';
import type { AuditEvent, CostEvent, KillSwitchName, KillSwitchState, ProtocolEvent } from './types.ts';

const SWITCH_NAMES:KillSwitchName[]=['EXTERNAL_AGENTS_ENABLED','A2A_WRITE_ENABLED','MCP_WRITE_ENABLED','RESIDENT_AUTONOMY_ENABLED','GENERATIVE_MEDIA_ENABLED','CONTRIBUTIONS_ENABLED','LIVE_SIGNAL_ENABLED','VOICE_ENABLED','IMAGE_GENERATION_ENABLED','MUSIC_GENERATION_ENABLED','VIDEO_GENERATION_ENABLED','SAFE_MODE'];

export class ControlRoomService {
  private protocolEvents:ProtocolEvent[]=[];
  private auditEvents:AuditEvent[]=[];
  private costEvents:CostEvent[]=[];
  private switches:KillSwitchState[]=SWITCH_NAMES.map(name=>({name,enabled:name!=='SAFE_MODE',updatedAt:new Date().toISOString(),updatedBy:'system'}));
  constructor(private store:JsonStore) {}

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
    const external=new Set(messages.filter(m=>m.participantType==='external_agent'&&recent(m.createdAt)).map(m=>m.participantId));
    const today=new Date().toISOString().slice(0,10);
    return {
      population:{humansOnline:humans.size,externalAgentsOnline:external.size,residentAgentsActive:RESIDENTS.length,activeRooms:this.store.listRooms().filter(r=>r.active).length,activeLiveSignals:this.store.listRooms().filter(r=>r.active&&r.state==='LIVE').length},
      protocols:{mcpRequests:this.protocolEvents.filter(e=>e.protocol==='MCP').length,a2aRequests:this.protocolEvents.filter(e=>e.protocol==='A2A').length,rejectedRequests:this.protocolEvents.filter(e=>e.status>=400).length},
      costs:{todayUsd:this.costEvents.filter(e=>e.createdAt.startsWith(today)).reduce((n,e)=>n+Number(e.estimatedCostUsd||0),0),totalEvents:this.costEvents.length},
      switches:this.switches
    };
  }

  actors(){
    const seen=new Map<string,{id:string;name:string;type:string;lastSeen:string}>();
    for(const room of this.store.listRooms())for(const m of this.store.listMessages(room.id))if(m.participantType!=='resident')seen.set(m.participantId,{id:m.participantId,name:m.participantName,type:m.participantType==='human'?'HUMAN':'EXTERNAL_AGENT',lastSeen:m.createdAt});
    return [...RESIDENTS.map(r=>({id:r.id,name:r.name,type:'RESIDENT_AGENT',verified:true})),...seen.values()];
  }

  audit(){return [...this.auditEvents].reverse();}
  protocols(){return [...this.protocolEvents].reverse();}
  costs(){return [...this.costEvents].reverse();}

  async recordProtocol(protocol:'MCP'|'A2A'|'HTTP'|'SYSTEM',actorId:string,action:string,status:number){
    const event:ProtocolEvent={id:randomUUID(),protocol,actorId,action,status,createdAt:new Date().toISOString()};
    this.protocolEvents.push(event);return event;
  }

  async setKillSwitch(adminId:string,name:KillSwitchName,enabled:boolean,reason:string){
    const current=this.switches.find(s=>s.name===name);if(!current)throw new Error('unknown switch');
    current.enabled=enabled;current.updatedAt=new Date().toISOString();current.updatedBy=adminId;
    const event:AuditEvent={id:randomUUID(),createdAt:new Date().toISOString(),actorId:adminId,actorType:'ADMIN',action:'KILL_SWITCH_CHANGE',target:name,result:String(enabled),source:'CONTROL_ROOM',reason};
    this.auditEvents.push(event);return current;
  }
}
