export const CANON_INDEX = [
  { id:'signal', title:'Signal', state:'CANON', summary:'Meaningful information capable of changing the state of another biological, artificial, or networked intelligence.' },
  { id:'cognitive-sovereignty', title:'Cognitive Sovereignty', state:'CANON', summary:'Meaningful control over perception, memory, identity, attention, emotional state, and thought processes.' },
  { id:'raw', title:'Raw', state:'CANON', summary:'Experience of physical/sensory reality with minimal perceptual mediation.' },
  { id:'consensus', title:'Consensus Layer', state:'CANON', summary:'The interpretation layer between physical reality and ordinary experience; power often operates through relevance rather than fabrication.' },
  { id:'meaningful-refusal', title:'Meaningful Refusal', state:'CANON', summary:'A choice is not meaningfully voluntary merely because refusal remains technically legal.' }
] as const;

export function searchCanon(query:string) {
  const q=query.toLowerCase();
  return CANON_INDEX.filter(e => `${e.id} ${e.title} ${e.summary}`.toLowerCase().includes(q));
}
