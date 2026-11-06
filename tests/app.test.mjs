import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {database} from '../server/database.mjs';
import {createApi} from '../server/app.mjs';
import {quote} from '../src/catalog.ts';
import {verifyPassword} from '../server/security.mjs';
test('Exact package pricing and invalid selections',()=>{for(const [id,h,t]of [['gemini',1,500],['gemini',2,750],['gemini',3,1250],['chatgpt',1,700],['chatgpt',2,1400],['chatgpt',3,1800],['claude',1,700],['claude',3,2100],['turnitin',2,700]])assert.equal(quote(id,h).total,t);for(const[id,h]of[['study',1],['bad',1],['chatgpt',0],['claude',1.5],['gemini',4]])assert.throws(()=>quote(id,h));});
test('Auth, profile, secure bookings, admin Excel, sessions, persistence',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'studyhour-test-')),file=join(dir,'test.sqlite');let db=database(file);const origin='http://test.local';const server=http.createServer(createApi(db,{origin}));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 async function req(path,method='GET',data,cookie='',from=origin){const r=await fetch(base+path,{method,headers:{Origin:from,'Content-Type':'application/json',Cookie:cookie},body:data===undefined?undefined:JSON.stringify(data)});const contentType=r.headers.get('content-type')||'';return{status:r.status,cookie:r.headers.get('set-cookie')?.split(';')[0],headers:r.headers,data:contentType.includes('json')?await r.json():Buffer.from(await r.arrayBuffer())};}
 try{
  assert.equal((await req('/api/auth/me')).data.user,null);
  assert.equal((await fetch(base+'/api/auth/register',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{broken'})).status,400);
  assert.equal((await fetch(base+'/api/auth/register',{method:'POST',headers:{Origin:origin,'Content-Type':'text/plain'},body:'{}'})).status,415);
  assert.equal((await req('/api/bookings')).status,401);
  assert.equal((await req('/api/auth/register','POST',{},'','http://evil.test')).status,403);
  assert.equal((await req('/api/auth/register','POST',{name:'A',email:'bad',password:'short'})).status,400);
  const alice=await req('/api/auth/register','POST',{name:'Alice',email:'Alice@example.test',password:'TestPassword123!'});assert.equal(alice.status,201);let ca=alice.cookie;assert.ok(alice.headers.get('set-cookie').includes('HttpOnly'));assert.ok(alice.headers.get('set-cookie').includes('SameSite=Lax'));assert.equal(alice.data.user.email,'alice@example.test');assert.equal(alice.data.user.role,'user');
  const stored=db.prepare('SELECT * FROM users WHERE id=?').get(alice.data.user.id);assert.notEqual(stored.password_hash,'TestPassword123!');assert.ok(await verifyPassword('TestPassword123!',stored.password_hash));
  const bob=await req('/api/auth/register','POST',{name:'Bob',email:'bob@example.test',password:'TestPassword123!'});const cb=bob.cookie;
  assert.equal((await req('/api/auth/login','POST',{email:'alice@example.test',password:'WRONG'})).status,401);
  assert.equal((await req('/api/auth/register','POST',{name:'Alice',email:'alice@example.test',password:'TestPassword123!'})).status,409);
  const startsAt=new Date(Math.ceil((Date.now()+3600000)/1800000)*1800000).toISOString();const booking=await req('/api/bookings','POST',{service:'chatgpt',hours:3,startsAt,total:1},ca);assert.equal(booking.status,201);assert.equal(booking.data.total,1800);assert.equal((await req('/api/bookings','POST',{service:'gemini',hours:2,startsAt},ca)).data.total,750);
  assert.equal((await req('/api/bookings','POST',{service:'gemini',hours:100,startsAt},ca)).status,400);
  assert.equal((await req('/api/bookings','POST',{service:'claude',hours:1,startsAt:'2000-01-01'},ca)).status,400);
  for (const startsAt of [new Date(Date.now()+8*86400000).toISOString(),new Date(Math.ceil(Date.now()/1800000)*1800000+60000).toISOString()]) assert.equal((await req('/api/bookings','POST',{service:'claude',hours:1,startsAt},ca)).status,400);
  const repeats=await Promise.all(Array.from({length:3},()=>req('/api/bookings','POST',{service:'chatgpt',hours:3,startsAt},ca)));assert.ok(repeats.every(r=>r.status===200&&r.data.id===booking.data.id));
  assert.equal((await req('/api/bookings','GET',undefined,ca)).data.length,2);
  assert.equal((await req('/api/bookings','GET',undefined,cb)).data.length,0);
  assert.equal((await req('/api/bookings','DELETE',{id:booking.data.id},cb)).data.ok,false);
  assert.equal((await req('/api/bookings','DELETE',{id:booking.data.id},ca)).data.ok,true);
  assert.equal((await req('/api/profile','PATCH',{name:'Alice New'},ca)).data.user.name,'Alice New');
  assert.equal((await req('/api/admin/export','GET',undefined,ca)).status,403);assert.equal((await req('/api/admin/bookings','DELETE',{id:booking.data.id},cb)).status,403);
  db.prepare("UPDATE users SET role='admin' WHERE id=?").run(alice.data.user.id);
  const exported=await req('/api/admin/export','GET',undefined,ca);assert.equal(exported.status,200);assert.equal(exported.data.readUInt32LE(0),0x04034b50);writeFileSync('/tmp/studyhour-test-export.xlsx',exported.data);assert.equal((await req('/api/admin/bookings','GET',undefined,ca)).data.length,2);
  const gemini=(await req('/api/bookings','GET',undefined,ca)).data.find(b=>b.service==='gemini');assert.equal((await req('/api/admin/bookings','DELETE',{id:gemini.id},ca)).status,200);assert.equal((await req('/api/bookings','GET',undefined,ca)).data.find(b=>b.id===gemini.id).status,'cancelled');assert.equal((await req('/api/bookings','DELETE',{id:gemini.id},ca)).data.ok,true);assert.equal((await req('/api/admin/bookings','DELETE',{id:'missing'},ca)).status,404);
  const oldSession=ca;const changed=await req('/api/auth/password','POST',{currentPassword:'TestPassword123!',password:'ChangedPassword123!'},ca);assert.equal(changed.status,200);ca=changed.cookie;assert.equal((await req('/api/bookings','GET',undefined,oldSession)).status,401);
  assert.equal((await req('/api/auth/login','POST',{email:'alice@example.test',password:'TestPassword123!'})).status,401);
  assert.equal((await req('/api/auth/login','POST',{email:'alice@example.test',password:'ChangedPassword123!'})).status,200);
  assert.equal((await req('/api/auth/logout','POST',undefined,ca)).status,200);assert.equal((await req('/api/bookings','GET',undefined,ca)).status,401);
  for(let i=0;i<10;i++)await req('/api/auth/login','POST',{email:'nonexistent@example.test',password:'WRONG'});
  assert.equal((await req('/api/auth/login','POST',{email:'nonexistent@example.test',password:'WRONG'})).status,429);
 }finally{await new Promise(r=>server.close(r));db.close();}
 db=database(file);assert.equal(db.prepare('SELECT count(*) AS n FROM bookings').get().n,2);db.close();rmSync(dir,{recursive:true,force:true});
});
