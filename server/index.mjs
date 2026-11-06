import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {database} from './database.mjs';
import {createApi} from './app.mjs';
const dev=process.argv.includes('--dev');
const arg=name=>process.argv.includes(name)?process.argv[process.argv.indexOf(name)+1]:null;
const port=Number(arg('--port')||process.env.PORT||(dev?5173:3000));
const host=arg('--host')||process.env.HOST||'0.0.0.0';
const origin=process.env.APP_ORIGIN||`http://localhost:${port}`;
if(process.env.NODE_ENV==='production'&&!process.env.APP_ORIGIN)throw Error('Set APP_ORIGIN to the public origin before starting production.');
const secure=process.env.COOKIE_SECURE==='true'||origin.startsWith('https://');
if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT must be between 1 and 65535.');
try{const u=new URL(origin);if(!['http:','https:'].includes(u.protocol)||u.origin!==origin)throw Error();}catch{throw Error('APP_ORIGIN must be an origin such as https://studyhour.example without a trailing slash.');}
if(!dev){try{await stat(resolve('dist/index.html'));}catch{throw Error('Build not found. Run npm install --include=dev and npm run build before npm start.');}}
const db=database();const api=createApi(db,{origin,secure,additionalOrigins:dev?[`http://127.0.0.1:${port}`,`http://localhost:${port}`]:[]});
let vite;if(dev){let createServer;try{({createServer}=await import('vite'));}catch{throw Error('Vite is missing. Run npm install --include=dev, then npm run dev.');}vite=await createServer({server:{middlewareMode:true},appType:'spa'});}
const root=resolve('dist');const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
 if(req.url.startsWith('/api/'))return api(req,res);
 if(dev)return vite.middlewares(req,res);
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
 try{let pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);let file=resolve(root,'.'+pathname);if(!file.startsWith(root+sep)&&file!==root){res.writeHead(403);return res.end();}let info;try{info=await stat(file);}catch{}if(!info?.isFile()){if(extname(pathname)){res.writeHead(404);return res.end('Not found');}file=resolve(root,'index.html');}const data=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','X-Frame-Options':'SAMEORIGIN','Referrer-Policy':'same-origin','Cache-Control':file.includes('/assets/')?'public, max-age=31536000, immutable':'no-cache','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"});res.end(req.method==='HEAD'?undefined:data);}catch{res.writeHead(500);res.end('Application unavailable');}
});server.requestTimeout=15000;server.headersTimeout=10000;
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is already in use. Stop the other server or choose another PORT.`:error.message);process.exit(1);});
server.listen(port,host,()=>console.log(`StudyHour running at http://${host==='0.0.0.0'?'localhost':host}:${port}`));
const cleanup=setInterval(()=>{db.prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now());db.prepare('DELETE FROM rate_limits WHERE reset_at<?').run(Date.now());},60000);cleanup.unref();
async function close(){clearInterval(cleanup);await new Promise(r=>server.close(r));if(vite)await vite.close();db.close();process.exit(0);}process.on('SIGTERM',close);process.on('SIGINT',close);
