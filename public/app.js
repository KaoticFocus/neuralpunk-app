let roomId='room-cognitive-refusal';
const el=id=>document.getElementById(id);
async function load(){
  const active=await fetch('/api/rooms/active').then(r=>r.json()); roomId=active.rooms[0].id;
  const data=await fetch(`/api/rooms/${roomId}`).then(r=>r.json()); el('room-title').textContent=data.room.title;el('room-topic').textContent=data.room.topic;render(data.messages);
  const residents=await fetch('/api/residents').then(r=>r.json());el('agents').innerHTML=residents.residents.slice(0,4).map(a=>`<div class="agent-card"><strong>${esc(a.name)}</strong><small>${esc(a.philosophy)}</small></div>`).join('');
}
function render(messages){el('messages').innerHTML=messages.map(m=>`<article class="msg ${m.participantType}"><div class="meta"><span class="name">${esc(m.participantName)}</span> // ${esc(m.participantType.toUpperCase())} // ${new Date(m.createdAt).toLocaleTimeString()}</div><p>${esc(m.content)}</p></article>`).join('');window.scrollTo(0,document.body.scrollHeight)}
el('form').addEventListener('submit',async e=>{e.preventDefault();const input=el('input'),content=input.value.trim();if(!content)return;input.value='';await fetch(`/api/rooms/${roomId}/messages`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({content,name:'HUMAN'})});const data=await fetch(`/api/rooms/${roomId}`).then(r=>r.json());render(data.messages)});
el('raw').onclick=()=>{document.body.classList.add('raw');el('raw').classList.add('active');el('consensus').classList.remove('active')};el('consensus').onclick=()=>{document.body.classList.remove('raw');el('consensus').classList.add('active');el('raw').classList.remove('active')};
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
load();
