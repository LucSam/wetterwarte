export type SwipeScope='view'|'section';

/** One gesture recognizer for real touch/mouse input and the native-preview bridge. */
export function installSwipeNavigation(navigate:(scope:SwipeScope,direction:-1|1)=>void,enabled:()=>boolean){
 let start:{id:number;x:number;y:number;at:number;scale:number;scope:SwipeScope}|undefined;
 let suppressClick=false;
 document.addEventListener('pointerdown',event=>{
  suppressClick=false;start=undefined;
  if(!event.isPrimary||event.button!==0){start=undefined;return;}
  const target=event.target instanceof Element?event.target:undefined;
  const device=target?.closest<HTMLElement>('.device');
  if(!device||!enabled()||target?.closest('input,select,textarea,a,[contenteditable],.menu-panel,.menu-dismiss,[role=dialog]'))return;
  const scope=target?.closest('.device-header')?'view':target?.closest('.device-content')?'section':undefined;
  if(!scope)return;
  start={id:event.pointerId,x:event.clientX,y:event.clientY,at:performance.now(),scale:device.getBoundingClientRect().width/device.offsetWidth,scope};
 });
 document.addEventListener('pointermove',event=>{
  if(!start||event.pointerId!==start.id)return;
  const dx=Math.abs(event.clientX-start.x),dy=Math.abs(event.clientY-start.y);
  if(dx>12*start.scale&&dx>dy*1.5)event.preventDefault();
 },{passive:false});
 document.addEventListener('pointerup',event=>{
  if(!start||event.pointerId!==start.id)return;
  const gesture=start;start=undefined;
  const dx=(event.clientX-gesture.x)/gesture.scale,dy=(event.clientY-gesture.y)/gesture.scale;
  if(!enabled()||performance.now()-gesture.at>1000||Math.abs(dx)<50||Math.abs(dx)<Math.abs(dy)*1.5)return;
  // Also suppress the browser's subsequent click, including swipes that start
  // on a menu button or an individually selectable chart point.
  event.preventDefault();suppressClick=true;
  navigate(gesture.scope,dx<0?1:-1);
 });
 document.addEventListener('pointercancel',()=>{start=undefined;});
 document.addEventListener('click',event=>{
  if(suppressClick){suppressClick=false;event.preventDefault();event.stopImmediatePropagation();}
 },true);
}
