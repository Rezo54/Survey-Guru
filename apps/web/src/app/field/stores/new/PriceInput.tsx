'use client';
import { useRef, useState } from 'react';
import s from './price-input.module.css';
export function PriceInput({name,required,value,onValueChange}:{name:string;required?:boolean;value?:string;onValueChange?:(value:string)=>void}) {
  const [local,setLocal]=useState(''); const [open,setOpen]=useState(false); const input=useRef<HTMLInputElement>(null);
  const current=value??local;
  function change(next:string){setLocal(next);onValueChange?.(next);}
  function press(key:string){
    const start=input.current?.selectionStart??current.length;const end=input.current?.selectionEnd??current.length;
    let next=current;let cursor=start;
    if(key==='Clear'){next='';cursor=0;}
    else if(key==='⌫'){next=current.slice(0,start===end?Math.max(0,start-1):start)+current.slice(end);cursor=start===end?Math.max(0,start-1):start;}
    else {next=current.slice(0,start)+key+current.slice(end);cursor=start+1;if(key==='.' && (next.match(/\./g)?.length??0)>1)return;}
    if(next.startsWith('.')){next='0'+next;cursor+=1;}
    if(/^\d+\.\d{3,}$/.test(next))return;
    change(next);requestAnimationFrame(()=>{input.current?.focus();input.current?.setSelectionRange(cursor,cursor);});
  }
  return <span className={s.wrapper}><span className={s.entry}><input ref={input} name={name} required={required} type="text" inputMode={open?'none':'decimal'} placeholder="0.00" value={current} onChange={e=>change(e.target.value)}/><button type="button" className={s.toggle} aria-label="Open price number pad" aria-expanded={open} onClick={()=>setOpen(!open)}>123</button></span>{open?<span className={s.pad} role="group" aria-label="Price number pad">{['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(key=><button type="button" key={key} aria-label={key==='⌫'?'Backspace':key==='.'?'Decimal point':key} onPointerDown={e=>e.preventDefault()} onClick={()=>press(key)}>{key}</button>)}<button type="button" onClick={()=>press('Clear')}>Clear</button><button type="button" className={s.done} onClick={()=>setOpen(false)}>Done</button></span>:null}</span>;
}
