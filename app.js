const canvas=document.querySelector("#world"),ctx=canvas.getContext("2d");
const minimapCanvas=document.querySelector("#minimapCanvas"),minimapCtx=minimapCanvas.getContext("2d");
const worldMapCanvas=document.querySelector("#worldMapCanvas"),worldMapCtx=worldMapCanvas.getContext("2d");
const TILE=32,MAP_W=84,MAP_H=64,PLAYER_SCALE=3;
let width=0,height=0,dpr=1,last=0,dragging=false,dragOrigin={x:0,y:0},pointerStart={x:0,y:0},moved=false,target=null,mapTick=0;
const keys=new Set(),camera={x:0,y:0},player={x:40*TILE,y:35*TILE,dir:0,frame:0,hop:0,speed:118};
const terrain=[],objects=[];

function rnd(x,y,s=0){const n=Math.sin(x*127.1+y*311.7+s*73.3)*43758.5453;return n-Math.floor(n)}
function fade(t){return t*t*(3-2*t)}
function noise(x,y,s=0){const ix=Math.floor(x),iy=Math.floor(y),fx=fade(x-ix),fy=fade(y-iy);return(rnd(ix,iy,s)*(1-fx)+rnd(ix+1,iy,s)*fx)*(1-fy)+(rnd(ix,iy+1,s)*(1-fx)+rnd(ix+1,iy+1,s)*fx)*fy}
function fbm(x,y,s=0){let v=0,a=.55,f=1;for(let i=0;i<4;i++){v+=noise(x*f,y*f,s+i)*a;f*=2;a*=.5}return v}

function pixel(canvasContext,x,y,w,h,color){canvasContext.fillStyle=color;canvasContext.fillRect(x,y,w,h)}
function makePlayerSheet(){
  const sheet=document.createElement("canvas");sheet.width=16*4;sheet.height=24*4;
  const c=sheet.getContext("2d");c.imageSmoothingEnabled=false;
  for(let direction=0;direction<4;direction++)for(let frame=0;frame<4;frame++){
    const ox=frame*16,oy=direction*24,bob=frame===1||frame===3?-1:0;
    // Corpo redondo maior, desenhado pixel a pixel.
    pixel(c,ox+4,oy+12+bob,8,9,"#f2ccb0");pixel(c,ox+3,oy+15+bob,10,5,"#f2ccb0");
    pixel(c,ox+5,oy+20+bob,3,2,"#dba98d");pixel(c,ox+9,oy+20+bob,3,2,"#dba98d");
    pixel(c,ox+3,oy+16+bob,1,3,"#d9a489");pixel(c,ox+12,oy+16+bob,1,3,"#d9a489");
    // Cabeça redonda menor.
    pixel(c,ox+5,oy+5+bob,7,7,"#f5d1b5");pixel(c,ox+4,oy+7+bob,9,3,"#f5d1b5");
    pixel(c,ox+5,oy+4+bob,7,3,"#6a422d");pixel(c,ox+4,oy+6+bob,2,3,"#6a422d");pixel(c,ox+11,oy+5+bob,2,2,"#6a422d");
    if(direction===0){pixel(c,ox+6,oy+8+bob,1,1,"#392d29");pixel(c,ox+10,oy+8+bob,1,1,"#392d29")}
    else if(direction===1)pixel(c,ox+5,oy+8+bob,1,1,"#392d29");
    else if(direction===2)pixel(c,ox+11,oy+8+bob,1,1,"#392d29");
    // Folha presa à cintura, cobrindo a frente.
    if(direction!==3){pixel(c,ox+7,oy+15+bob,4,5,"#477d3d");pixel(c,ox+6,oy+16+bob,2,3,"#5a934a");pixel(c,ox+9,oy+14+bob,1,7,"#315f32")}
    else pixel(c,ox+5,oy+14+bob,7,2,"#477d3d");
  }
  return sheet;
}
function makeNatureSheet(){
  const sheet=document.createElement("canvas");sheet.width=32*4;sheet.height=48;
  const c=sheet.getContext("2d");c.imageSmoothingEnabled=false;
  for(let type=0;type<4;type++){const x=type*32;
    if(type<3){
      pixel(c,x+13,26,7,18,type===2?"#5a3d2a":"#65442d");pixel(c,x+11,37,11,4,"#4c3828");
      const dark=type===2?"#234c39":"#285638",mid=type===1?"#467a46":"#376d42",light=type===1?"#6a9854":"#56864b";
      if(type===2){for(let i=0;i<3;i++){c.fillStyle=dark;c.beginPath();c.moveTo(x+16,2+i*9);c.lineTo(x+3+i,29+i*5);c.lineTo(x+29-i,29+i*5);c.fill()}pixel(c,x+12,10,5,3,light)}
      else{pixel(c,x+7,10,19,21,dark);pixel(c,x+3,16,25,12,dark);pixel(c,x+10,4,14,22,mid);pixel(c,x+4,19,8,7,mid);pixel(c,x+15,7,8,6,light);pixel(c,x+8,13,5,4,light)}
    }else{pixel(c,x+6,31,20,5,"#505653");pixel(c,x+9,23,15,9,"#74766d");pixel(c,x+12,20,9,5,"#969587");pixel(c,x+10,24,5,3,"#aaa899")}
  }return sheet;
}
function makeGroundSheet(){
  const sheet=document.createElement("canvas");sheet.width=32*5;sheet.height=32;const c=sheet.getContext("2d");
  const colors=["#62884b","#3f6843","#98905a","#817d55","#427b79"];
  for(let t=0;t<5;t++){pixel(c,t*32,0,32,32,colors[t]);for(let i=0;i<13;i++){const x=t*32+Math.floor(rnd(i,t,5)*30),y=Math.floor(rnd(t,i,7)*30);const detail=t===4?"#6b9a8e":t===2?"#6d713f":t===3?"#646746":"#365f38";pixel(c,x,y,t===4?6:1,t===4?1:3,detail)}}
  return sheet;
}
function makePropSheet(){
  const sheet=document.createElement("canvas");sheet.width=16*4;sheet.height=16;const c=sheet.getContext("2d");
  pixel(c,1,9,14,5,"#315d38");pixel(c,4,5,6,7,"#477d42");pixel(c,9,7,5,6,"#568c4b");
  pixel(c,19,12,1,4,"#32633b");pixel(c,18,9,3,3,"#e9ca5c");pixel(c,25,11,1,5,"#32633b");pixel(c,24,8,3,3,"#d997b2");
  for(let i=0;i<4;i++){pixel(c,34+i*3,12-i%2*3,1,4+i%2*3,"#426c3d");pixel(c,35+i*3,10-i%2*3,1,2,"#6f9555")}
  pixel(c,50,11,14,3,"#536d4b");pixel(c,52,5,1,7,"#638358");pixel(c,57,3,1,9,"#638358");pixel(c,62,6,1,6,"#638358");
  return sheet;
}
const sheets={player:makePlayerSheet(),nature:makeNatureSheet(),ground:makeGroundSheet(),props:makePropSheet()};

function createWorld(){
  for(let y=0;y<MAP_H;y++){terrain[y]=[];for(let x=0;x<MAP_W;x++){
    const wet=fbm(x/18,y/18,2),elev=fbm(x/23,y/23,8),river=53+Math.sin(y*.18)*4+Math.sin(y*.055)*7;
    let type=0;if(Math.abs(x-river)<1.25)type=4;else if(elev>.72)type=3;else if(wet>.67)type=1;else if(wet<.4)type=2;
    terrain[y][x]=type;
  }}
  for(let y=2;y<MAP_H-2;y++)for(let x=2;x<MAP_W-2;x++){const t=terrain[y][x],r=rnd(x,y,12);
    if(t===1&&r>.48)objects.push({sprite:r>.88?2:Math.floor(rnd(x,y,13)*2),x:x*TILE+16,y:y*TILE+25,solid:true,scale:1});
    else if(t===0&&r>.92)objects.push({sprite:0,x:x*TILE+16,y:y*TILE+25,solid:true,scale:.9});
    else if(t===3&&r>.79)objects.push({sprite:3,x:x*TILE+16,y:y*TILE+26,solid:true,scale:.8});
    else if(t===0&&r>.72)objects.push({prop:r>.88?1:0,x:x*TILE+16,y:y*TILE+26,solid:false});
    else if(t===4&&r>.86)objects.push({prop:3,x:x*TILE+16,y:y*TILE+28,solid:false});
    else if(t===2&&r>.88)objects.push({prop:2,x:x*TILE+16,y:y*TILE+27,solid:false});
  }
  for(let i=objects.length-1;i>=0;i--)if(Math.hypot(objects[i].x-player.x,objects[i].y-player.y)<120)objects.splice(i,1);
}
function resize(){dpr=Math.min(devicePixelRatio,2);width=innerWidth;height=innerHeight;canvas.width=width*dpr;canvas.height=height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=false}
function isVisible(x,y,pad=90){return x>camera.x-pad&&x<camera.x+width+pad&&y>camera.y-pad&&y<camera.y+height+pad}
function drawTerrain(){
  const sx=Math.max(0,Math.floor(camera.x/TILE)-1),ex=Math.min(MAP_W,Math.ceil((camera.x+width)/TILE)+1),sy=Math.max(0,Math.floor(camera.y/TILE)-1),ey=Math.min(MAP_H,Math.ceil((camera.y+height)/TILE)+1);
  const wind=Math.floor(performance.now()/260);
  for(let y=sy;y<ey;y++)for(let x=sx;x<ex;x++){const type=terrain[y][x],dx=Math.round(x*TILE-camera.x),dy=Math.round(y*TILE-camera.y);ctx.drawImage(sheets.ground,type*32,0,32,32,dx,dy,32,32);if(type===4){const shift=Math.floor(performance.now()/180+x*3+y*5)%8;ctx.fillStyle="#80aca1";ctx.fillRect(dx+shift,dy+8,9,1);ctx.fillRect(dx+(shift+14)%25,dy+23,7,1)}else if(type!==3){const sway=(wind+x+y)%3-1;ctx.fillStyle=type===2?"#77763f":"#3c6b3d";ctx.fillRect(dx+8+sway,dy+10,1,5);ctx.fillRect(dx+23-sway,dy+25,1,4)}}
}
function drawObject(o){const phase=performance.now()/520+o.x*.017+o.y*.011,sway=Math.round(Math.sin(phase)*(o.prop!==undefined?2:1.5)),x=Math.round(o.x-camera.x),y=Math.round(o.y-camera.y);if(o.prop!==undefined){const lift=o.prop===1?Math.round(Math.sin(phase*1.7)):0;ctx.drawImage(sheets.props,o.prop*16,0,16,16,x-16+sway,y-32+lift,32,32)}else{const scale=o.scale||1,w=64*scale,h=96*scale;ctx.fillStyle="#172d2450";ctx.fillRect(x-18*scale,y-5,36*scale,6);ctx.drawImage(sheets.nature,o.sprite*32,0,32,48,x-w/2+sway,y-h,w,h)}}
function drawPlayer(){
  const moving=keys.size>0||target!==null,hop=moving?Math.abs(Math.sin(player.hop))*13:0,frame=moving?Math.floor(player.hop/Math.PI*2)%4:0,x=Math.round(player.x-camera.x),y=Math.round(player.y-camera.y);
  ctx.fillStyle=`rgba(18,35,28,${.3-hop/90})`;ctx.fillRect(x-15+hop*.22,y+6,30-hop*.44,6);
  ctx.drawImage(sheets.player,frame*16,player.dir*24,16,24,x-24,y-72-hop,48,72);
}
function blocked(x,y){const tx=Math.floor(x/TILE),ty=Math.floor(y/TILE);if(tx<0||ty<0||tx>=MAP_W||ty>=MAP_H||terrain[ty][tx]===4)return true;return objects.some(o=>o.solid&&Math.abs(o.x-x)<17*(o.scale||1)&&Math.abs(o.y-y)<13*(o.scale||1))}
function update(dt){
  let dx=0,dy=0;if(keys.has("w")||keys.has("arrowup"))dy--;if(keys.has("s")||keys.has("arrowdown"))dy++;if(keys.has("a")||keys.has("arrowleft"))dx--;if(keys.has("d")||keys.has("arrowright"))dx++;
  if(keys.size)target=null;
  if(target&&!dx&&!dy){const tx=target.x-player.x,ty=target.y-player.y,distance=Math.hypot(tx,ty);if(distance>6){dx=tx/distance;dy=ty/distance}else target=null}
  if(dx||dy){const len=Math.hypot(dx,dy),beforeX=player.x,beforeY=player.y;dx/=len;dy/=len;const pace=player.speed*dt,nx=player.x+dx*pace,ny=player.y+dy*pace;if(!blocked(nx,player.y))player.x=nx;if(!blocked(player.x,ny))player.y=ny;if(target&&player.x===beforeX&&player.y===beforeY)target=null;player.hop+=dt*7;if(Math.abs(dx)>Math.abs(dy))player.dir=dx<0?1:2;else player.dir=dy<0?3:0}
}
function draw(){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=false;drawTerrain();const shown=objects.filter(o=>isVisible(o.x,o.y)).sort((a,b)=>a.y-b.y);let playerDone=false;for(const o of shown){if(!playerDone&&o.y>player.y){drawPlayer();playerDone=true}drawObject(o)}if(!playerDone)drawPlayer();ctx.fillStyle="#10251d0c";ctx.fillRect(0,0,width,height)}
function drawMap(mapContext,mapCanvas,showCamera){
  const mw=mapCanvas.width,mh=mapCanvas.height,cellW=mw/MAP_W,cellH=mh/MAP_H,colors=["#739457","#315f40","#a39b62","#777957","#477f7d"];
  mapContext.imageSmoothingEnabled=false;mapContext.clearRect(0,0,mw,mh);
  for(let y=0;y<MAP_H;y++)for(let x=0;x<MAP_W;x++){mapContext.fillStyle=colors[terrain[y][x]];mapContext.fillRect(Math.floor(x*cellW),Math.floor(y*cellH),Math.ceil(cellW),Math.ceil(cellH))}
  for(const object of objects){if(object.prop!==undefined&&object.prop!==0)continue;mapContext.fillStyle=object.sprite===3?"#77776d":"#203f2c";const size=Math.max(1,cellW*.7);mapContext.fillRect(object.x/(MAP_W*TILE)*mw-size/2,object.y/(MAP_H*TILE)*mh-size/2,size,size)}
  if(target){mapContext.strokeStyle="#f7e3a2";mapContext.lineWidth=Math.max(1,mw/400);mapContext.beginPath();mapContext.arc(target.x/(MAP_W*TILE)*mw,target.y/(MAP_H*TILE)*mh,Math.max(2,mw/180),0,Math.PI*2);mapContext.stroke()}
  if(showCamera){mapContext.strokeStyle="#fff2c8";mapContext.lineWidth=Math.max(1,mw/350);mapContext.strokeRect(camera.x/(MAP_W*TILE)*mw,camera.y/(MAP_H*TILE)*mh,Math.min(width,MAP_W*TILE)/(MAP_W*TILE)*mw,Math.min(height,MAP_H*TILE)/(MAP_H*TILE)*mh)}
  const px=player.x/(MAP_W*TILE)*mw,py=player.y/(MAP_H*TILE)*mh;mapContext.fillStyle="#f2d57e";mapContext.beginPath();mapContext.arc(px,py,Math.max(3,mw/120),0,Math.PI*2);mapContext.fill();mapContext.strokeStyle="#342c22";mapContext.lineWidth=Math.max(1,mw/500);mapContext.stroke();
}
function redrawMaps(){drawMap(minimapCtx,minimapCanvas,true);if(!document.querySelector("#worldMap").classList.contains("hidden"))drawMap(worldMapCtx,worldMapCanvas,true)}
function loop(time){const dt=Math.min(.04,(time-last)/1000||0);last=time;update(dt);draw();if(mapTick++%6===0)redrawMaps();requestAnimationFrame(loop)}

addEventListener("keydown",e=>{const key=e.key.toLowerCase();if(["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"].includes(key)){keys.add(key);e.preventDefault();document.querySelector("#instructions").classList.add("hidden")}});
addEventListener("keyup",e=>keys.delete(e.key.toLowerCase()));
canvas.addEventListener("pointerdown",e=>{dragging=true;moved=false;pointerStart={x:e.clientX,y:e.clientY};dragOrigin={x:e.clientX+camera.x,y:e.clientY+camera.y};canvas.classList.add("dragging");canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener("pointermove",e=>{if(!dragging)return;if(Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)<5)return;moved=true;camera.x=dragOrigin.x-e.clientX;camera.y=dragOrigin.y-e.clientY;camera.x=Math.max(0,Math.min(MAP_W*TILE-width,camera.x));camera.y=Math.max(0,Math.min(MAP_H*TILE-height,camera.y));document.querySelector("#instructions").classList.add("hidden")});
canvas.addEventListener("pointerup",e=>{if(!moved){const rect=canvas.getBoundingClientRect(),worldX=e.clientX-rect.left+camera.x,worldY=e.clientY-rect.top+camera.y;if(!blocked(worldX,worldY))target={x:worldX,y:worldY}}dragging=false;canvas.classList.remove("dragging");document.querySelector("#instructions").classList.add("hidden")});
document.querySelector("#minimapToggle").addEventListener("click",e=>{e.stopPropagation();const minimap=document.querySelector("#minimap");minimap.classList.add("compact");document.querySelector("#minimapToggle").setAttribute("aria-label","Mapa minimizado")});
document.querySelector("#centerPlayer").addEventListener("click",e=>{e.stopPropagation();camera.x=Math.max(0,Math.min(MAP_W*TILE-width,player.x-width/2));camera.y=Math.max(0,Math.min(MAP_H*TILE-height,player.y-height/2));redrawMaps()});
document.querySelector("#minimapView").addEventListener("click",()=>{const minimap=document.querySelector("#minimap");if(minimap.classList.contains("compact")){minimap.classList.remove("compact");return}document.querySelector("#worldMap").classList.remove("hidden");redrawMaps()});
document.querySelector("#closeWorldMap").addEventListener("click",()=>document.querySelector("#worldMap").classList.add("hidden"));
document.querySelector("#worldMap").addEventListener("click",e=>{if(e.target===document.querySelector("#worldMap"))document.querySelector("#worldMap").classList.add("hidden")});
worldMapCanvas.addEventListener("click",e=>{const rect=worldMapCanvas.getBoundingClientRect(),worldX=(e.clientX-rect.left)/rect.width*MAP_W*TILE,worldY=(e.clientY-rect.top)/rect.height*MAP_H*TILE;camera.x=Math.max(0,Math.min(MAP_W*TILE-width,worldX-width/2));camera.y=Math.max(0,Math.min(MAP_H*TILE-height,worldY-height/2));document.querySelector("#worldMap").classList.add("hidden")});
addEventListener("resize",resize);
createWorld();resize();minimapCanvas.width=174;minimapCanvas.height=174;worldMapCanvas.width=840;worldMapCanvas.height=640;camera.x=Math.max(0,player.x-width/2);camera.y=Math.max(0,player.y-height/2);redrawMaps();canvas.focus();requestAnimationFrame(loop);
