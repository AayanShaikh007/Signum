export const DEMO_DRAFT='signum.public.strategy.v1'
export interface LocalStore {getItem:(key:string)=>string|null;setItem:(key:string,value:string)=>void}
export function browserStore():LocalStore|null {try{return window.localStorage}catch{return null}}
export function readLocal<T>(key:string,fallback:T,validate:(value:unknown)=>T,storage=browserStore()):T {
  try {const raw=storage?.getItem(key);return raw?validate(JSON.parse(raw)):fallback}catch{return fallback}
}
export function writeLocal(key:string,value:unknown,storage=browserStore()):boolean {
  try {if(!storage)return false;storage.setItem(key,JSON.stringify(value));return true}catch{return false}
}
