import {apiFetch} from './api';
import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import Dashboard from './Dashboard';
import './styles.css';
export type User={id:string;name:string;email:string;role:string;createdAt:string};
function App(){const[user,setUser]=useState<User|null>(null),[ready,setReady]=useState(false),[error,setError]=useState('');async function reload(){try{const r=await apiFetch('/api/auth/me');if(!r.ok)throw Error('Сервер недоступен. Попробуй обновить страницу.');const data=await r.json();setUser(data.user);setReady(true);}catch(e){setError((e as Error).message);}}useEffect(()=>{reload()},[]);if(!ready)return <div className="startup"><div className="brand-icon">Ƶ</div><h2>StudyHour</h2><p>{error||'Открываем твоё пространство…'}</p>{error&&<button className="primary" onClick={reload}>Повторить</button>}</div>;return <Dashboard user={user} onUser={setUser}/>;}createRoot(document.getElementById('root')!).render(<App/>);
