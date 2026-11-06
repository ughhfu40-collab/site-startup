import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {database} from '../server/database.mjs';
import {bootstrapAdmin} from '../server/bootstrap-admin.mjs';
import {hashPassword,verifyPassword} from '../server/security.mjs';
test('Private admin bootstrap creates once and preserves changed passwords',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studyhour-admin-'));const file=join(dir,'admin.json');const db=database(':memory:');
 try{
 assert.equal(await bootstrapAdmin(db,file),false);
 await writeFile(file,JSON.stringify({email:'Owner@Example.com',password:'test-password-123'}));
 assert.equal(await bootstrapAdmin(db,file),true);
 let u=db.prepare('SELECT * FROM users').get();assert.equal(u.email,'owner@example.com');assert.equal(u.role,'admin');assert.ok(await verifyPassword('test-password-123',u.password_hash));
 const changed=await hashPassword('changed-password-456');db.prepare('UPDATE users SET password_hash=?').run(changed);
 assert.equal(await bootstrapAdmin(db,file),false);assert.equal(db.prepare('SELECT password_hash FROM users').get().password_hash,changed);
 db.prepare("UPDATE users SET role='user'").run();await assert.rejects(bootstrapAdmin(db,file),/does not match/);
 assert.equal(db.prepare('SELECT role FROM users').get().role,'user');
 await writeFile(file,JSON.stringify({email:'owner@example.com',password:'changed-password-456'}));assert.equal(await bootstrapAdmin(db,file),true);
 }finally{db.close();await rm(dir,{recursive:true,force:true});}
});
