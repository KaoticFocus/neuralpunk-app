export interface ProviderContext {
  residentId: string;
  topic: string;
  recentMessages: Array<{name:string; content:string}>;
  humanMessage?: string;
}

export interface IntelligenceProvider {
  reason(context: ProviderContext): Promise<string>;
  synthesizeVoice?(text:string): Promise<{mimeType:string; data:Buffer}>;
  generateImage?(prompt:string): Promise<{mimeType:string; data:Buffer}>;
  generateSound?(prompt:string): Promise<{mimeType:string; data:Buffer}>;
}
