export class Guardrails {
  private counters = new Map<string,{window:number;count:number}>();
  readonly externalWritesEnabled:boolean;
  readonly maxWritesPerMinute:number;
  readonly maxResidentTurnsPerTrigger:number;
  constructor(){
    this.externalWritesEnabled=(process.env.EXTERNAL_WRITES_ENABLED??'true')!=='false';
    this.maxWritesPerMinute=Number(process.env.MAX_WRITES_PER_MINUTE??10);
    this.maxResidentTurnsPerTrigger=Number(process.env.MAX_RESIDENT_TURNS_PER_TRIGGER??2);
  }
  checkWrite(identity:string){
    if(!this.externalWritesEnabled) return {ok:false,status:503,message:'External write participation is temporarily disabled.'};
    const window=Math.floor(Date.now()/60000), key=`${identity}:${window}`, current=this.counters.get(key)??{window,count:0};
    current.count++; this.counters.set(key,current);
    if(current.count>this.maxWritesPerMinute) return {ok:false,status:429,message:'Write rate limit exceeded.'};
    return {ok:true,status:200,message:'ok'};
  }
}
