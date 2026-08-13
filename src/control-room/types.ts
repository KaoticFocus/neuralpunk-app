export type ActorType = 'HUMAN' | 'EXTERNAL_AGENT' | 'RESIDENT_AGENT' | 'SYSTEM' | 'ADMIN';
export type KillSwitchName = 'EXTERNAL_AGENTS_ENABLED' | 'A2A_WRITE_ENABLED' | 'MCP_WRITE_ENABLED' | 'RESIDENT_AUTONOMY_ENABLED' | 'GENERATIVE_MEDIA_ENABLED' | 'CONTRIBUTIONS_ENABLED' | 'LIVE_SIGNAL_ENABLED' | 'VOICE_ENABLED' | 'IMAGE_GENERATION_ENABLED' | 'MUSIC_GENERATION_ENABLED' | 'VIDEO_GENERATION_ENABLED' | 'SAFE_MODE';
export interface KillSwitchState { name:KillSwitchName; enabled:boolean; updatedAt:string; updatedBy:string; }
export interface AuditEvent { id:string; createdAt:string; actorId:string; actorType:ActorType; action:string; target?:string; result:string; source:string; reason?:string; }
export interface ProtocolEvent { id:string; protocol:'MCP'|'A2A'|'HTTP'|'SYSTEM'; actorId:string; action:string; status:number; createdAt:string; }
export interface CostEvent { id:string; provider:string; service:string; actorId:string; createdAt:string; estimatedCostUsd:number; }
