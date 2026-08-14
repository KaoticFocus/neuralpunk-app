import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Store } from './store.ts';
import { JsonStore } from './store.ts';
import { SupabaseStore } from './supabase-store.ts';

export async function createStore(root:string):Promise<Store>{
  const isServerless=Boolean(process.env.NETLIFY||process.env.AWS_LAMBDA_FUNCTION_NAME||process.env.LAMBDA_TASK_ROOT);
  const backend=(process.env.PERSISTENCE_BACKEND??'auto').toLowerCase();
  const url=process.env.SUPABASE_URL;
  const secret=process.env.SUPABASE_SECRET_KEY??process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(backend==='supabase'||(backend==='auto'&&url&&secret)){
    if(!url||!secret)throw new Error('Supabase persistence requires SUPABASE_URL and a server-only SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY');
    const store=new SupabaseStore(url,secret);await store.ensureSeed();return store;
  }
  if(backend!=='auto'&&backend!=='json')throw new Error(`Unsupported PERSISTENCE_BACKEND: ${backend}`);
  const defaultPath=isServerless?join(tmpdir(),'neuralpunk-store.json'):join(root,'data','store.json');
  const store=new JsonStore(process.env.STORE_PATH??defaultPath);await store.ensureSeed();return store;
}
