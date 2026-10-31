import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'

export default function InfoTip({label,children}:{label:string;children:string}) {
  const [open,setOpen]=useState(false),[position,setPosition]=useState({left:12,top:12})
  const trigger=useRef<HTMLButtonElement>(null),popup=useRef<HTMLDivElement>(null)
  const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),id=useId()
  function show(){clearTimeout(timer.current);setOpen(true)}
  function hide(){timer.current=setTimeout(()=>setOpen(false),120)}
  useLayoutEffect(()=>{
    if(!open)return
    function place(){
      const button=trigger.current?.getBoundingClientRect(),tip=popup.current?.getBoundingClientRect()
      if(!button||!tip)return
      setPosition({left:Math.max(12,Math.min(button.left,window.innerWidth-tip.width-12)),top:button.bottom+tip.height+12<window.innerHeight?button.bottom+8:Math.max(12,button.top-tip.height-8)})
    }
    place();window.addEventListener('resize',place);window.addEventListener('scroll',place,true)
    return ()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true)}
  },[open])
  useEffect(()=>{
    function escape(event:KeyboardEvent){if(event.key==='Escape')setOpen(false)}
    function outside(event:PointerEvent){if(!trigger.current?.contains(event.target as Node)&&!popup.current?.contains(event.target as Node))setOpen(false)}
    if(open){document.addEventListener('keydown',escape);document.addEventListener('pointerdown',outside)}
    return ()=>{document.removeEventListener('keydown',escape);document.removeEventListener('pointerdown',outside)}
  },[open])
  useEffect(()=>()=>clearTimeout(timer.current),[])
  return <><button ref={trigger} type="button" className="info-tip-button" aria-label={`About ${label}`} aria-describedby={open?id:undefined} onMouseEnter={show} onMouseLeave={hide} onFocus={()=>{if(trigger.current?.matches(':focus-visible'))show()}} onBlur={()=>setOpen(false)} onClick={event=>{event.preventDefault();event.stopPropagation();show()}}><Info size={15}/></button>{open&&createPortal(<div ref={popup} id={id} role="tooltip" className="info-tip-popup" style={position} onMouseEnter={show} onMouseLeave={hide}>{children}</div>,document.body)}</>
}
