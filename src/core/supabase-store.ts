import { randomUUID } from 'node:crypto';
import type { Contribution, DebateMessage, DebateRoom, OriginType, ProvenanceRecord } from './types.ts';
import type { Store, StoreShape } from './store.ts';

type ExternalAgent = StoreShape['externalAgents'][number];

export class SupabaseStore implements Store {
  readonly kind = 'supabase' as const;
  private readonly baseUrl:string;
  private readonly secret:string;
  private loaded=false;
  private data:StoreShape={rooms:[],messages:[],contributions:[],provenance:[],externalAgents:[]};

  constructor(baseUrl:string, secret:string) {
    this.baseUrl=baseUrl.replace(/\/$/,'');
    this.secret=secret;
  }

  async load() {
    if(this.loaded)return;
    const [rooms,messages,contributions,agents]=await Promise.all([
      this.request<any[]>('/rest/v1/rooms?select=id,title,topic,signal_state,active,created_at&order=created_at.asc'),
      this.request<any[]>('/rest/v1/messages?select=id,room_id,actor_id,participant_name,participant_type,content,citations,interpretation,provenance_id,created_at&order=created_at.asc'),
      this.request<any[]>('/rest/v1/contributions?select=id,title,body,state,origin_type,origin_actor_id,provenance_id,created_at&order=created_at.asc'),
      this.request<any[]>('/rest/v1/actors?actor_type=eq.external_agent&select=id,display_name,verification_state,first_seen_at,last_seen_at')
    ]);
    this.data.rooms=rooms.map(fromRoom);
    this.data.messages=messages.map(fromMessage);
    this.data.contributions=contributions.map(fromContribution);
    this.data.externalAgents=agents.map(fromExternalAgent);
    this.loaded=true;
  }

  async ensureSeed(){await this.load();}
  listRooms(){return this.data.rooms;}
  getRoom(id:string){return this.data.rooms.find(r=>r.id===id);}
  listMessages(roomId:string){return this.data.messages.filter(m=>m.roomId===roomId);}
  listContributions(){return this.data.contributions;}
  getContribution(id:string){return this.data.contributions.find(c=>c.id===id);}

  async addProvenance(originType:OriginType,originId:string,verifiedIdentity:boolean,transformations:string[],sourceModel?:string){
    const id=randomUUID(),createdAt=new Date().toISOString();
    const row={id,origin_type:originType,origin_identifier:originId,verified_identity:verifiedIdentity,transformations,source_model:sourceModel??null,canon_mutable:false,created_at:createdAt};
    await this.request('/rest/v1/provenance_records', {method:'POST',body:row});
    const value:ProvenanceRecord={id,originType,originId,verifiedIdentity,transformations,sourceModel,canonMutable:false,createdAt};
    this.data.provenance.push(value);return value;
  }

  async addMessage(roomId:string,participantId:string,participantName:string,participantType:DebateMessage['participantType'],content:string,citations:string[]=[],interpretation=true,originType:OriginType='human'){
    if(!this.getRoom(roomId))throw new Error(`Room not found: ${roomId}`);
    const actorId=await this.ensureActor(participantId,participantName,participantType);
    const provenance=await this.addProvenance(originType,participantId,false,[]);
    const id=randomUUID(),createdAt=new Date().toISOString();
    await this.request('/rest/v1/messages',{method:'POST',body:{id,room_id:roomId,actor_id:actorId,participant_name:participantName,participant_type:toActorType(participantType),content,citations,interpretation,provenance_id:provenance.id,moderation_state:'approved',created_at:createdAt}});
    const value:DebateMessage={id,roomId,participantId,participantName,participantType,content,citations,interpretation,provenanceId:provenance.id,createdAt};
    this.data.messages.push(value);return value;
  }

  async registerExternalAgent(id:string,name:string,verified=false){
    const now=new Date().toISOString(),actorId=stableActorId(id);
    const existing=this.data.externalAgents.find(a=>a.id===id);
    await this.request('/rest/v1/actors?on_conflict=id',{method:'POST',prefer:'resolution=merge-duplicates',body:{id:actorId,display_name:name,actor_type:'external_agent',verification_state:verified?'verified':'unverified',status:'active',public_profile:false,last_seen_at:now}});
    if(existing){existing.name=name||existing.name;existing.lastSeen=now;existing.verified=existing.verified||verified;return existing;}
    const value={id,name,verified,firstSeen:now,lastSeen:now};this.data.externalAgents.push(value);return value;
  }

  async addContribution(input:{title:string;body:string;originType:OriginType;originId:string;sourceModel?:string}){
    const provenance=await this.addProvenance(input.originType,input.originId,false,['submitted'],input.sourceModel);
    const id=randomUUID(),createdAt=new Date().toISOString();
    const actorId=input.originType==='external_ai'?stableActorId(input.originId):null;
    await this.request('/rest/v1/contributions',{method:'POST',body:{id,title:input.title,body:input.body,state:'PROPOSED',origin_type:input.originType,origin_actor_id:actorId,provenance_id:provenance.id,canon_mutable:false,review_state:'unreviewed',created_at:createdAt,updated_at:createdAt}});
    const value:Contribution={id,title:input.title,body:input.body,state:'PROPOSED',originType:input.originType,originId:input.originId,provenanceId:provenance.id,createdAt};
    this.data.contributions.push(value);return value;
  }

  private async ensureActor(id:string,name:string,type:DebateMessage['participantType']){
    const actorId=stableActorId(id),now=new Date().toISOString();
    await this.request('/rest/v1/actors?on_conflict=id',{method:'POST',prefer:'resolution=merge-duplicates',body:{id:actorId,display_name:name,actor_type:toActorType(type),status:'active',last_seen_at:now}});
    return actorId;
  }

  private async request<T=unknown>(path:string,options:{method?:string;body?:unknown;prefer?:string}={}):Promise<T>{
    const response=await fetch(`${this.baseUrl}${path}`,{method:options.method??'GET',headers:{apikey:this.secret,authorization:`Bearer ${this.secret}`,'content-type':'application/json',prefer:options.prefer??'return=minimal'},body:options.body===undefined?undefined:JSON.stringify(options.body)});
    if(!response.ok){const detail=(await response.text()).slice(0,500);throw new Error(`Supabase ${options.method??'GET'} ${path.split('?')[0]} failed (${response.status}): ${detail}`);}
    if(response.status===204)return undefined as T;
    const text=await response.text();return (text?JSON.parse(text):undefined) as T;
  }
}

function fromRoom(row:any):DebateRoom{return{id:row.id,title:row.title,topic:row.topic,state:row.signal_state,active:row.active,createdAt:row.created_at};}
function fromMessage(row:any):DebateMessage{return{id:row.id,roomId:row.room_id,participantId:row.actor_id??'unknown',participantName:row.participant_name,participantType:fromActorType(row.participant_type),content:row.content,citations:row.citations??[],interpretation:row.interpretation,provenanceId:row.provenance_id,createdAt:row.created_at};}
function fromContribution(row:any):Contribution{return{id:row.id,title:row.title,body:row.body,state:row.state,originType:row.origin_type,originId:row.origin_actor_id??'unknown',provenanceId:row.provenance_id,createdAt:row.created_at};}
function fromExternalAgent(row:any):ExternalAgent{return{id:row.id,name:row.display_name,verified:row.verification_state==='verified',firstSeen:row.first_seen_at,lastSeen:row.last_seen_at};}
function toActorType(type:DebateMessage['participantType']){return type==='resident'?'resident_agent':type;}
function fromActorType(type:string):DebateMessage['participantType']{return type==='resident_agent'?'resident':type as DebateMessage['participantType'];}
function stableActorId(value:string){const normalized=value.toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120);return normalized.length>=2?normalized:`actor-${normalized||'unknown'}`;}
