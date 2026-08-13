export type SignalState = 'CANON' | 'LIVE' | 'SIMULATION' | 'RAW' | 'PROPOSED';
export type ParticipantType = 'resident' | 'human' | 'external_agent' | 'system';
export type OriginType = 'resident_ai' | 'human' | 'external_ai' | 'system';

export interface ResidentAgent {
  id: string;
  name: string;
  philosophy: string;
  principles: string[];
  evidenceStandard: string;
}

export interface DebateMessage {
  id: string;
  roomId: string;
  participantId: string;
  participantName: string;
  participantType: ParticipantType;
  content: string;
  createdAt: string;
  citations: string[];
  provenanceId: string;
  interpretation: boolean;
}

export interface DebateRoom {
  id: string;
  title: string;
  state: SignalState;
  topic: string;
  active: boolean;
  createdAt: string;
}

export interface Contribution {
  id: string;
  title: string;
  body: string;
  state: 'PROPOSED' | 'RAW';
  originType: OriginType;
  originId: string;
  createdAt: string;
  provenanceId: string;
}

export interface ProvenanceRecord {
  id: string;
  originType: OriginType;
  originId: string;
  createdAt: string;
  sourceModel?: string;
  verifiedIdentity: boolean;
  transformations: string[];
  canonMutable: false;
}
