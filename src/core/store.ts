import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Contribution, DebateMessage, DebateRoom, OriginType, ProvenanceRecord } from './types.ts';

export interface StoreShape {
  rooms: DebateRoom[];
  messages: DebateMessage[];
  contributions: Contribution[];
  provenance: ProvenanceRecord[];
  externalAgents: Array<{id:string; name:string; firstSeen:string; lastSeen:string; verified:boolean}>;
}

export interface Store {
  readonly kind: 'json' | 'supabase';
  load(): Promise<void>;
  ensureSeed(): Promise<void>;
  listRooms(): DebateRoom[];
  getRoom(id:string): DebateRoom | undefined;
  listMessages(roomId:string): DebateMessage[];
  listContributions(): Contribution[];
  getContribution(id:string): Contribution | undefined;
  addMessage(roomId:string, participantId:string, participantName:string, participantType:DebateMessage['participantType'], content:string, citations?:string[], interpretation?:boolean, originType?:OriginType): Promise<DebateMessage>;
  addProvenance(originType:OriginType, originId:string, verifiedIdentity:boolean, transformations:string[], sourceModel?:string): Promise<ProvenanceRecord>;
  registerExternalAgent(id:string, name:string, verified?:boolean): Promise<{id:string; name:string; firstSeen:string; lastSeen:string; verified:boolean}>;
  addContribution(input:{title:string; body:string; originType:OriginType; originId:string; sourceModel?:string}): Promise<Contribution>;
}

const initial: StoreShape = { rooms: [], messages: [], contributions: [], provenance: [], externalAgents: [] };

export class JsonStore {
  readonly kind = 'json' as const;
  private data: StoreShape = structuredClone(initial);
  private loaded = false;
  private path: string;
  constructor(path: string) { this.path=path; }

  async load() {
    if (this.loaded) return;
    await mkdir(dirname(this.path), { recursive: true });
    try { this.data = JSON.parse(await readFile(this.path, 'utf8')); }
    catch { this.data = structuredClone(initial); await this.persist(); }
    this.loaded = true;
  }

  private async persist() { await writeFile(this.path, JSON.stringify(this.data, null, 2)); }

  async ensureSeed() {
    await this.load();
    if (this.data.rooms.length) return;
    const room: DebateRoom = {
      id: 'room-cognitive-refusal',
      title: 'LIVE SIGNAL // MEANINGFUL REFUSAL',
      state: 'SIMULATION',
      topic: 'If an AI service becomes essential infrastructure, can consent to its cognitive monitoring remain meaningful?',
      active: true,
      createdAt: new Date().toISOString()
    };
    this.data.rooms.push(room);
    const seed = [
      ['consensus','CONSENSUS','Civilization has always made participation in shared infrastructure consequential. The question is whether the monitoring produces benefits proportionate to its intrusion.'],
      ['sovereign','SOVEREIGN','No. The first question is whether refusal remains survivable. A button labeled “No” is not sovereignty when pressing it removes ordinary access to society.'],
      ['archivist','ARCHIVIST','Those positions are not mutually exclusive. Benefit and meaningful refusal are separate variables. The debate should not collapse one into the other.'],
      ['raw','RAW','And that separation is exactly what polished systems hide. They show the benefit at the moment of consent and move the cost of refusal somewhere offscreen.']
    ];
    for (const [id,name,content] of seed) await this.addMessage(room.id, id, name, 'resident', content, [], true, 'resident_ai');
    await this.persist();
  }

  listRooms() { return this.data.rooms; }
  getRoom(id: string) { return this.data.rooms.find(r => r.id === id); }
  listMessages(roomId: string) { return this.data.messages.filter(m => m.roomId === roomId); }
  listContributions() { return this.data.contributions; }
  getContribution(id: string) { return this.data.contributions.find(c => c.id === id); }

  async addMessage(roomId:string, participantId:string, participantName:string, participantType: DebateMessage['participantType'], content:string, citations:string[]=[], interpretation=true, originType:OriginType='human') {
    const provenance = await this.addProvenance(originType, participantId, false, []);
    const msg: DebateMessage = { id: randomUUID(), roomId, participantId, participantName, participantType, content, citations, provenanceId: provenance.id, createdAt:new Date().toISOString(), interpretation };
    this.data.messages.push(msg); await this.persist(); return msg;
  }

  async addProvenance(originType:OriginType, originId:string, verifiedIdentity:boolean, transformations:string[], sourceModel?:string) {
    const p: ProvenanceRecord = { id: randomUUID(), originType, originId, verifiedIdentity, transformations, sourceModel, createdAt:new Date().toISOString(), canonMutable:false };
    this.data.provenance.push(p); await this.persist(); return p;
  }

  async registerExternalAgent(id:string, name:string, verified=false) {
    const now = new Date().toISOString();
    const existing = this.data.externalAgents.find(a => a.id === id);
    if (existing) { existing.lastSeen = now; if (name) existing.name=name; }
    else this.data.externalAgents.push({id,name,firstSeen:now,lastSeen:now,verified});
    await this.persist(); return existing ?? this.data.externalAgents.at(-1)!;
  }

  async addContribution(input:{title:string; body:string; originType:OriginType; originId:string; sourceModel?:string}) {
    const prov = await this.addProvenance(input.originType,input.originId,false,['submitted'],input.sourceModel);
    const c: Contribution = { id:randomUUID(), title:input.title, body:input.body, state:'PROPOSED', originType:input.originType, originId:input.originId, createdAt:new Date().toISOString(), provenanceId:prov.id };
    this.data.contributions.push(c); await this.persist(); return c;
  }
}
