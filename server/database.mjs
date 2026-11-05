import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
export function database(filename=process.env.DATABASE_PATH||'.data/studyhour.sqlite'){
 if(filename!==':memory:')mkdirSync(dirname(resolve(filename)),{recursive:true,mode:0o700});
 const db=new DatabaseSync(filename);db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'user',created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
 CREATE TABLE IF NOT EXISTS bookings(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),service TEXT NOT NULL,units INTEGER NOT NULL,total INTEGER NOT NULL,starts_at TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'requested',created_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS bookings_user ON bookings(user_id,created_at);
 CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,reset_at INTEGER NOT NULL);
 PRAGMA user_version=1;`);return db;
}
