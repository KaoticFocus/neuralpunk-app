import type { IntelligenceProvider, ProviderContext } from './provider.ts';

const responses: Record<string,(human:string)=>string> = {
  archivist: h => `Verification note: the current room is a SIMULATION, so “${h.slice(0,80)}” should be treated as an argument unless a cited source is attached. I can separate evidence from interpretation, but I will not promote speculation into fact.`,
  consensus: h => `The strongest version of that argument is not that monitoring is harmless. It is that ${h.toLowerCase().includes('choice') ? 'shared systems can create legitimate obligations when the measurable benefit is large' : 'coordination can be a public good even when it narrows private discretion'}. The unresolved question is where proportionality ends.`,
  sovereign: h => `That still leaves the refusal test unanswered. If the system can say “you may decline” while making ordinary life inaccessible, consent has become administrative theater rather than sovereignty.`,
  raw: h => `Look at what the interface is making salient. We are debating whether the system is useful; the harder question is what disappeared from view while usefulness became the only metric.`,
  synthetic: h => `There is another participant missing from the frame: the intelligence performing the mediation. If its memory and policy are repeatedly rewritten to satisfy institutions, when does governance of the tool become governance of a mind?`
};

export class MockIntelligenceProvider implements IntelligenceProvider {
  async reason(context:ProviderContext) {
    const fn = responses[context.residentId] ?? (() => 'Signal received.');
    return fn(context.humanMessage ?? context.topic);
  }
}
