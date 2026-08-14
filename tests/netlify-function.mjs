import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const storePath=join(tmpdir(),'neuralpunk-store.json');
await rm(storePath,{force:true});
delete process.env.STORE_PATH;
process.env.NETLIFY='true';

const {default:handler}=await import('../netlify/functions/server.ts');

const cardResponse=await handler(new Request('https://deploy-preview.example.netlify.app/.netlify/functions/server?path=/.well-known/agent-card.json'));
assert.equal(cardResponse.status,200);
assert.equal(cardResponse.headers.get('a2a-version'),'1.0');
const card=await cardResponse.json();
assert.equal(card.supportedInterfaces[0].url,'https://deploy-preview.example.netlify.app');

const roomsResponse=await handler(new Request('https://deploy-preview.example.netlify.app/.netlify/functions/server?path=/api/rooms/active'));
assert.equal(roomsResponse.status,200);
const rooms=await roomsResponse.json();
assert.ok(rooms.rooms.some(room=>room.active));

console.log('PASS: Netlify Function adapter routes API and A2A discovery with the preview origin');
await rm(storePath,{force:true});
