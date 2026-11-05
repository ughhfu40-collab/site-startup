import {randomBytes,scrypt as scryptCb,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCb);
export const digest=s=>createHash('sha256').update(s).digest('hex');
export async function hashPassword(password){const salt=randomBytes(16).toString('hex');const key=await scrypt(password,salt,64);return `scrypt:${salt}:${key.toString('hex')}`;}
export async function verifyPassword(password,stored){const [alg,salt,key]=stored.split(':');if(alg!=='scrypt'||!salt||!key)return false;const actual=await scrypt(password,salt,64);const expected=Buffer.from(key,'hex');return actual.length===expected.length&&timingSafeEqual(actual,expected);}
export function token(){return randomBytes(32).toString('hex');}
export function rateLimit(db,key,max,window=15*60000){const now=Date.now();const row=db.prepare('SELECT count,reset_at FROM rate_limits WHERE key=?').get(key);if(!row||row.reset_at<now){db.prepare('INSERT INTO rate_limits(key,count,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=1,reset_at=excluded.reset_at').run(key,now+window);return true;}if(row.count>=max)return false;db.prepare('UPDATE rate_limits SET count=count+1 WHERE key=?').run(key);return true;}
