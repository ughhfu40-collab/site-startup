import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {hashPassword,verifyPassword} from './security.mjs';

export async function bootstrapAdmin(db, filename='studyhour-admin.local.json') {
 let config;
 try{config=JSON.parse(await readFile(filename,'utf8'));}
 catch(error){if(error.code==='ENOENT')return false;throw new Error('Invalid private admin configuration.');}
 const email=typeof config.email==='string'?config.email.trim().toLowerCase():'';
 const password=config.password;
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||typeof password!=='string'||password.length<10||password.length>128)throw new Error('Invalid private admin configuration.');
 const existing=db.prepare('SELECT id,role,password_hash FROM users WHERE email=?').get(email);
 // Never reset an existing administrator's password on restart.
 if(existing?.role==='admin')return false;
 if(existing){
  if(!await verifyPassword(password,existing.password_hash))throw new Error('Existing account password does not match private admin configuration. Use the admin CLI to reset it explicitly.');
  db.prepare("UPDATE users SET role='admin' WHERE id=?").run(existing.id);
 }else{
  const hash=await hashPassword(password);
  db.prepare("INSERT INTO users(id,email,name,password_hash,role,created_at) VALUES(?,?,?,?,'admin',?) ON CONFLICT(email) DO NOTHING").run(randomUUID(),email,'Admin',hash,new Date().toISOString());
 }
 return true;
}
