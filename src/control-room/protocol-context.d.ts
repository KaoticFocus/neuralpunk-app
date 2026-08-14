import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Store } from '../core/store.ts';
import type { Guardrails } from '../core/guardrails.ts';

export {};

declare module '../protocols/a2a.ts' {
  export function handleA2aMessage(
    req: IncomingMessage,
    res: ServerResponse,
    body: unknown,
    store: Store,
    guardrails: Guardrails,
    context?: unknown
  ): Promise<void>;
}
