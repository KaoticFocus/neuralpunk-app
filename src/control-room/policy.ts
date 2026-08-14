export type ActorControlAction = 'THROTTLE' | 'READ_ONLY' | 'QUARANTINE' | 'SUSPEND' | 'RESTORE';
export interface ActorControlRecord { id:string; actorId:string; action:ActorControlAction; reason:string; createdAt:string; adminId:string; active:boolean; }
export function blocksWrites(action:ActorControlAction){return action==='READ_ONLY'||action==='QUARANTINE'||action==='SUSPEND';}
