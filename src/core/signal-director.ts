import { RESIDENTS } from './residents.ts';
import type { JsonStore } from './store.ts';
import type { IntelligenceProvider } from '../adapters/provider.ts';
import type { Guardrails } from './guardrails.ts';

export class SignalDirector {
  private store: JsonStore;
  private provider: IntelligenceProvider;
  private guardrails: Guardrails;
  constructor(store:JsonStore, provider:IntelligenceProvider, guardrails:Guardrails) { this.store=store; this.provider=provider; this.guardrails=guardrails; }

  async reactToHuman(roomId:string, humanText:string) {
    const room = this.store.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    const recent = this.store.listMessages(roomId).slice(-8).map(m => ({name:m.participantName, content:m.content}));
    const residentOrder = humanText.toLowerCase().includes('verify') || humanText.toLowerCase().includes('source')
      ? ['archivist','sovereign']
      : ['consensus','sovereign'];
    const generated = [];
    for (const id of residentOrder.slice(0,this.guardrails.maxResidentTurnsPerTrigger)) {
      const resident = RESIDENTS.find(r => r.id===id)!;
      const content = await this.provider.reason({residentId:id,topic:room.topic,recentMessages:recent,humanMessage:humanText});
      generated.push(await this.store.addMessage(roomId,id,resident.name,'resident',content,[],true,'resident_ai'));
    }
    return generated;
  }
}
