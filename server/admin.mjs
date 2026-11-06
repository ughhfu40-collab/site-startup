import {database} from './database.mjs';
import {hashPassword} from './security.mjs';
import {randomUUID} from 'node:crypto';
import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';

const email=process.argv[2]?.trim().toLowerCase();
if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
 console.error('Usage: npm run admin -- owner@example.com [--create]');process.exit(1);
}
const create=process.argv.includes('--create');
let password;
if(create){
 password=process.env.ADMIN_PASSWORD;
 delete process.env.ADMIN_PASSWORD;
 if(!password){
  if(!process.stdin.isTTY){console.error('Set ADMIN_PASSWORD or run in an interactive terminal.');process.exit(1);}
  process.stdout.write('Admin password (hidden): ');
  const output=new Writable({write(_chunk,_encoding,done){done();}});
  const prompt=createInterface({input:process.stdin,output,terminal:true});
  try{password=await prompt.question('');}finally{prompt.close();process.stdout.write('\n');}
 }
 if(password.length<10 || password.length>128){console.error('Password must contain 10–128 characters.');process.exit(1);}
}
const db=database();
try{
 if(create){
  const hash=await hashPassword(password);
  db.exec('BEGIN IMMEDIATE');
  try{
   db.prepare("INSERT INTO users(id,email,name,password_hash,role,created_at) VALUES(?,?,?,?,'admin',?) ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash,role='admin'").run(randomUUID(),email,'Admin',hash,new Date().toISOString());
   db.prepare('DELETE FROM sessions WHERE user_id=(SELECT id FROM users WHERE email=?)').run(email);
   db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  console.log('Administrator account ready. Sign in with the supplied password.');
 }else{
  const result=db.prepare("UPDATE users SET role='admin' WHERE email=?").run(email);
  if(!result.changes){console.error('Account not found. Add --create to create it and set a password.');process.exitCode=1;}
  else console.log('Administrator role granted. Sign in again.');
 }
}finally{db.close();}
