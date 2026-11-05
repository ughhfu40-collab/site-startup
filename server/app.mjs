import {randomUUID} from 'node:crypto';
import {quote,catalog} from '../src/catalog.ts';
import {hashPassword,verifyPassword,digest,token,rateLimit} from './security.mjs';
import {excel} from './excel.mjs';
const publicUser=u=>({id:u.id,name:u.name,email:u.email,role:u.role,createdAt:u.created_at});
const publicBooking=b=>({id:b.id,service:b.service,units:b.units,total:b.total,startsAt:b.starts_at,status:b.status,createdAt:b.created_at,...(b.email?{email:b.email,name:b.name}:{})});
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function err(status,message){return Object.assign(new Error(message),{status});}
async function body(req){if(!(req.headers['content-type']||'').startsWith('application/json'))throw err(415,'Нужен JSON-запрос');const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>16384)throw err(413,'Запрос слишком большой');chunks.push(chunk);}let data;try{data=JSON.parse(Buffer.concat(chunks).toString());}catch{throw err(400,'Некорректный запрос');}if(!data||typeof data!=='object'||Array.isArray(data))throw err(400,'Некорректный запрос');return data;}
function validatePassword(p){if(typeof p!=='string'||p.length<10||p.length>128)throw err(400,'Пароль должен содержать от 10 до 128 символов');}
export function createApi(db,{origin='http://localhost:3000',secure=false,additionalOrigins=[]}={}){
 const dummyHashPromise=hashPassword('not-a-user-password');
 const cookie=(value,age)=>`studyhour_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure?'; Secure':''}`;
 function session(req){const raw=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('studyhour_session='))?.split('=')[1];if(!raw||!/^[a-f0-9]{64}$/.test(raw))return null;const u=db.prepare('SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires_at>?').get(digest(raw),Date.now());return u?{user:u,hash:digest(raw)}:null;}
 function signed(req){const s=session(req);if(!s)throw err(401,'Войди в аккаунт, чтобы продолжить');return s;}
 function admin(req){const s=signed(req);if(s.user.role!=='admin')throw err(403,'Только для администратора');return s;}
 function issue(res,userId){const raw=token();db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(raw),userId,Date.now()+7*86400000);res.setHeader('Set-Cookie',cookie(raw,7*86400));}
 function limit(req,category,max){const ip=req.socket.remoteAddress||'unknown';if(!rateLimit(db,digest(category+ip),max))throw err(429,'Слишком много попыток. Попробуй через 15 минут.');}
 function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
 return async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','SAMEORIGIN');
  const path=new URL(req.url,'http://local').pathname,method=req.method;
  try{
   if(!['GET','HEAD'].includes(method)&&![origin,...additionalOrigins].includes(req.headers.origin))throw err(403,'Запрос с другого сайта отклонён');
   if(path==='/api/health'&&method==='GET')return json(res,200,{ok:true});
   if(path==='/api/auth/me'&&method==='GET'){const s=session(req);return json(res,200,{user:s?publicUser(s.user):null});}
   if(path==='/api/auth/register'&&method==='POST'){
    limit(req,'register',10);const b=await body(req);const email=typeof b.email==='string'?b.email.trim().toLowerCase():'';const name=typeof b.name==='string'?b.name.trim():'';if(!emailPattern.test(email)||email.length>254)throw err(400,'Проверь адрес email');if(name.length<2||name.length>60)throw err(400,'Имя: от 2 до 60 символов');validatePassword(b.password);
    if(db.prepare('SELECT id FROM users WHERE email=?').get(email))throw err(409,'Этот email уже зарегистрирован. Войди в аккаунт.');
    const hash=await hashPassword(b.password);const id=randomUUID(),createdAt=new Date().toISOString();try{db.prepare('INSERT INTO users(id,email,name,password_hash,created_at) VALUES(?,?,?,?,?)').run(id,email,name,hash,createdAt);}catch(e){if(String(e.message).includes('UNIQUE'))throw err(409,'Этот email уже зарегистрирован');throw e;}
    issue(res,id);return json(res,201,{user:{id,name,email,role:'user',createdAt}});
   }
   if(path==='/api/auth/login'&&method==='POST'){
    limit(req,'login',30);const b=await body(req);const email=typeof b.email==='string'?b.email.trim().toLowerCase():'';if(typeof b.password!=='string'||b.password.length>128)throw err(400,'Проверь email и пароль');if(!rateLimit(db,digest('login-email:'+email),10))throw err(429,'Слишком много попыток для этого email. Попробуй через 15 минут.');const u=db.prepare('SELECT * FROM users WHERE email=?').get(email);const valid=await verifyPassword(b.password,u?.password_hash||await dummyHashPromise);if(!u||!valid)throw err(401,'Неверный email или пароль');db.prepare('DELETE FROM rate_limits WHERE key=?').run(digest('login-email:'+email));issue(res,u.id);return json(res,200,{user:publicUser(u)});
   }
   if(path==='/api/auth/logout'&&method==='POST'){const s=session(req);if(s)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(s.hash);res.setHeader('Set-Cookie',cookie('',0));return json(res,200,{ok:true});}
   if(path==='/api/profile'&&method==='PATCH'){const {user}=signed(req),b=await body(req);const name=typeof b.name==='string'?b.name.trim():'';if(name.length<2||name.length>60)throw err(400,'Имя: от 2 до 60 символов');db.prepare('UPDATE users SET name=? WHERE id=?').run(name,user.id);return json(res,200,{user:{...publicUser(user),name}});}
   if(path==='/api/auth/password'&&method==='POST'){const {user}=signed(req);limit(req,'password',10);const b=await body(req);if(typeof b.currentPassword!=='string'||b.currentPassword.length>128)throw err(400,'Введи текущий пароль');validatePassword(b.password);if(!await verifyPassword(b.currentPassword,user.password_hash))throw err(400,'Текущий пароль неверен');const hash=await hashPassword(b.password);db.exec('BEGIN');try{db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash,user.id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}issue(res,user.id);return json(res,200,{ok:true});}
   if(path==='/api/bookings'&&method==='GET'){const {user}=signed(req);const rows=db.prepare('SELECT * FROM bookings WHERE user_id=? ORDER BY created_at DESC LIMIT 500').all(user.id);return json(res,200,rows.map(publicBooking));}
   if(path==='/api/bookings'&&method==='POST'){const {user}=signed(req);limit(req,'booking',40);const b=await body(req);let q;try{q=quote(b.service,b.hours);}catch{throw err(400,'Выбери корректный тариф');}if(typeof b.startsAt!=='string')throw err(400,'Выбери время');const start=new Date(b.startsAt);if(!Number.isFinite(start.getTime())||start.getTime()<Date.now()-60000||start.getTime()>Date.now()+30*86400000)throw err(400,'Выбери время в ближайшие 30 дней');const id=randomUUID(),now=new Date().toISOString();db.prepare('INSERT INTO bookings(id,user_id,service,units,total,starts_at,created_at) VALUES(?,?,?,?,?,?,?)').run(id,user.id,q.item.id,q.units,q.total,start.toISOString(),now);return json(res,201,publicBooking(db.prepare('SELECT * FROM bookings WHERE id=?').get(id)));}
   if(path==='/api/bookings'&&method==='DELETE'){const {user}=signed(req),b=await body(req);if(typeof b.id!=='string')throw err(400,'Нет номера заявки');const r=db.prepare("UPDATE bookings SET status='cancelled' WHERE id=? AND user_id=? AND status='requested'").run(b.id,user.id);return json(res,200,{ok:r.changes>0});}
   if(path==='/api/admin/bookings'&&method==='GET'){admin(req);const rows=db.prepare('SELECT b.*,u.email,u.name FROM bookings b JOIN users u ON u.id=b.user_id ORDER BY b.created_at DESC LIMIT 1000').all();return json(res,200,rows.map(publicBooking));}
   if(path==='/api/admin/export'&&method==='GET'){admin(req);const rows=db.prepare('SELECT b.*,u.email,u.name FROM bookings b JOIN users u ON u.id=b.user_id ORDER BY b.created_at DESC').all();const file=excel([['Номер','Имя','Email','Сервис','Часы / проверки','Сумма, ₸','Начало (UTC)','Статус','Создано (UTC)'],...rows.map(b=>[b.id,b.name,b.email,catalog.find(p=>p.id===b.service)?.name||b.service,b.service==='study'?2:b.units,b.total,b.starts_at,b.status==='cancelled'?'Отменена':'Предзаказ',b.created_at])]);res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="StudyHour_bookings.xlsx"','Cache-Control':'no-store'});return res.end(file);}
   throw err(404,'Страница не найдена');
  }catch(e){const status=e.status||500;if(status===500)console.error('API request failed:',e.message);if(!res.headersSent)json(res,status,{error:status===500?'Ошибка сервера. Попробуй ещё раз.':e.message});else res.end();}
 };
}
