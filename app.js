const canvas=document.querySelector("#world"),ctx=canvas.getContext("2d");
const minimapCanvas=document.querySelector("#minimapCanvas"),minimapCtx=minimapCanvas.getContext("2d");
const worldMapCanvas=document.querySelector("#worldMapCanvas"),worldMapCtx=worldMapCanvas.getContext("2d");
const TILE=32,MAP_W=84,MAP_H=64,PLAYER_SCALE=3,SEASON_DURATION=40;
const seasons=[{name:"Primavera",emoji:"🌸"},{name:"Verão",emoji:"☀️"},{name:"Outono",emoji:"🍂"},{name:"Inverno",emoji:"❄️"}];
let width=0,height=0,dpr=1,last=0,dragging=false,dragOrigin={x:0,y:0},pointerStart={x:0,y:0},moved=false,target=null,mapTick=0,cycleElapsed=81.5,lastSeason=-1,nextRabbitId=1,nextPreyId=1,nextPredatorId=1;
const keys=new Set(),camera={x:0,y:0},player={x:40*TILE,y:35*TILE,dir:0,frame:0,hop:0,speed:118};
const terrain=[],objects=[],burrows=[],rabbits=[],preyHomes=[],preyAnimals=[],predatorHomes=[],predators=[];
const preySpecies={
  deer:{maturity:55,lifespan:[480,620],gestation:32,cooldown:105,litter:[1,1],speed:28,range:230,cap:8,activeNight:false},
  mouse:{maturity:14,lifespan:[130,185],gestation:11,cooldown:38,litter:[2,3],speed:20,range:85,cap:16,activeNight:true},
  frog:{maturity:18,lifespan:[170,240],gestation:14,cooldown:48,litter:[2,3],speed:15,range:75,cap:10,activeNight:true},
  moth:{maturity:10,lifespan:[95,140],gestation:9,cooldown:32,litter:[2,3],speed:24,range:110,cap:12,activeNight:true}
};
const predatorSpecies={
  fox:{prey:"rabbit",preyFloor:6,maturity:65,lifespan:[430,560],gestation:35,cooldown:150,speed:45,range:210,cap:4,activeNight:false,size:[32,25]},
  wolf:{prey:"deer",preyFloor:2,maturity:85,lifespan:[580,720],gestation:45,cooldown:190,speed:48,range:270,cap:4,activeNight:false,size:[43,34]},
  owl:{prey:"mouse",preyFloor:4,maturity:50,lifespan:[390,520],gestation:28,cooldown:125,speed:42,range:190,cap:4,activeNight:true,size:[24,27]},
  snake:{prey:"frog",preyFloor:2,maturity:55,lifespan:[360,480],gestation:30,cooldown:135,speed:24,range:120,cap:4,activeNight:true,size:[26,9]},
  bat:{prey:"moth",preyFloor:2,maturity:38,lifespan:[280,390],gestation:24,cooldown:110,speed:50,range:180,cap:4,activeNight:true,size:[25,14]}
};

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
function makeNatureSheet(season){
  const sheet=document.createElement("canvas");sheet.width=32*4;sheet.height=48;
  const c=sheet.getContext("2d");c.imageSmoothingEnabled=false;
  for(let type=0;type<4;type++){const x=type*32;
    if(type<3){
      pixel(c,x+13,26,7,18,type===2?"#5a3d2a":"#65442d");pixel(c,x+11,37,11,4,"#4c3828");
      const palettes=[
        ["#285638","#467a46","#6a9854"],["#234f34","#3f7040","#5f8847"],
        ["#5b3829","#9a5530","#d18a3e"],["#314b3d","#637265","#dce3d9"]
      ],palette=palettes[season],dark=type===2&&season!==2?"#234c39":palette[0],mid=palette[1],light=palette[2];
      if(type===2){for(let i=0;i<3;i++){c.fillStyle=dark;c.beginPath();c.moveTo(x+16,2+i*9);c.lineTo(x+3+i,29+i*5);c.lineTo(x+29-i,29+i*5);c.fill()}pixel(c,x+12,10,5,3,light)}
      else{pixel(c,x+7,10,19,21,dark);pixel(c,x+3,16,25,12,dark);pixel(c,x+10,4,14,22,mid);pixel(c,x+4,19,8,7,mid);pixel(c,x+15,7,8,6,light);pixel(c,x+8,13,5,4,light);if(season===0){pixel(c,x+6,15,2,2,"#e7a9c0");pixel(c,x+23,19,2,2,"#f1c2d0")}if(season===3){pixel(c,x+6,12,8,3,"#edf1e8");pixel(c,x+19,17,7,3,"#edf1e8")}}
    }else{pixel(c,x+6,31,20,5,"#505653");pixel(c,x+9,23,15,9,"#74766d");pixel(c,x+12,20,9,5,"#969587");pixel(c,x+10,24,5,3,"#aaa899")}
  }return sheet;
}
function makeGroundSheet(season){
  const sheet=document.createElement("canvas");sheet.width=32*5;sheet.height=32;const c=sheet.getContext("2d");
  const palettes=[
    ["#6d934f","#436e46","#9c965c","#817d55","#427b79"],["#7f974b","#4d7240","#aa9857","#898059","#367675"],
    ["#9a7847","#675b3d","#a07d4d","#75684e","#526f6b"],["#d7ded3","#c6d2c7","#d9d3bd","#afb4a9","#9ec1c5"]
  ],colors=palettes[season];
  for(let t=0;t<5;t++){pixel(c,t*32,0,32,32,colors[t]);for(let i=0;i<13;i++){const x=t*32+Math.floor(rnd(i,t,5)*30),y=Math.floor(rnd(t,i,7)*30);const detail=t===4?(season===3?"#d8eaeb":"#6b9a8e"):season===3?"#aebbac":t===2?"#6d713f":t===3?"#646746":"#365f38";pixel(c,x,y,t===4?6:1,t===4?1:3,detail)}}
  return sheet;
}
function makePropSheet(season){
  const sheet=document.createElement("canvas");sheet.width=16*4;sheet.height=16;const c=sheet.getContext("2d");
  const bush=season===2?["#68452f","#9a6238","#b4773e"]:season===3?["#52665a","#dce4db","#edf2ec"]:["#315d38","#477d42","#568c4b"];
  pixel(c,1,9,14,5,bush[0]);pixel(c,4,5,6,7,bush[1]);pixel(c,9,7,5,6,bush[2]);
  const bloom=season===0?["#f0cf69","#e4a4bf"]:season===2?["#d1843c","#a85632"]:season===3?["#e8eee7","#cad9dc"]:["#e4bd4f","#d8899f"];
  pixel(c,19,12,1,4,"#32633b");pixel(c,18,9,3,3,bloom[0]);pixel(c,25,11,1,5,"#32633b");pixel(c,24,8,3,3,bloom[1]);
  for(let i=0;i<4;i++){pixel(c,34+i*3,12-i%2*3,1,4+i%2*3,"#426c3d");pixel(c,35+i*3,10-i%2*3,1,2,"#6f9555")}
  pixel(c,50,11,14,3,"#536d4b");pixel(c,52,5,1,7,"#638358");pixel(c,57,3,1,9,"#638358");pixel(c,62,6,1,6,"#638358");
  return sheet;
}
function makeRabbitSheet(){
  const sheet=document.createElement("canvas");sheet.width=12*4;sheet.height=10;const c=sheet.getContext("2d");c.imageSmoothingEnabled=false;
  for(let frame=0;frame<4;frame++){const x=frame*12,hop=frame===1||frame===3?-1:0;
    pixel(c,x+2,5+hop,8,4,"#a77b57");pixel(c,x+7,3+hop,4,4,"#b88b64");pixel(c,x+8,0+hop,1,4,"#9c6e4e");pixel(c,x+10,1+hop,1,3,"#9c6e4e");
    pixel(c,x+10,4+hop,1,1,"#2e2826");pixel(c,x+1,6+hop,2,2,"#e4d7c7");pixel(c,x+3,8+hop,3,1,"#75513d");pixel(c,x+8,8+hop,3,1,"#75513d");
  }return sheet;
}
function makeDeerSheet(){
  const sheet=document.createElement("canvas");sheet.width=20*4;sheet.height=24;const c=sheet.getContext("2d");c.imageSmoothingEnabled=false;
  for(let frame=0;frame<4;frame++){const x=frame*20,step=frame===1||frame===3?1:0;pixel(c,x+3,10,13,8,"#9b6947");pixel(c,x+13,5,5,9,"#a97850");pixel(c,x+15,2,2,4,"#7b5038");pixel(c,x+18,3,1,4,"#7b5038");pixel(c,x+17,7,1,1,"#251f1d");pixel(c,x+1,11,4,3,"#e7d6be");pixel(c,x+5,18,2,5-step,"#5b4033");pixel(c,x+13,18,2,4+step,"#5b4033");pixel(c,x+7,12,2,2,"#d5b28c");pixel(c,x+11,14,2,2,"#d5b28c")}
  return sheet;
}
function makeMouseSheet(){
  const sheet=document.createElement("canvas");sheet.width=7*4;sheet.height=5;const c=sheet.getContext("2d");c.imageSmoothingEnabled=false;
  for(let frame=0;frame<4;frame++){const x=frame*7;pixel(c,x+1,2,5,3,"#806f64");pixel(c,x+4,1,2,3,"#9a887a");pixel(c,x+5,0,1,1,"#b59e91");pixel(c,x+6,2,1,1,"#211e1d");pixel(c,x,3,2,1,"#b9a79d");if(frame%2)pixel(c,x,4,1,1,"#806f64")}
  return sheet;
}
function makeFrogSheet(){
  const sheet=document.createElement("canvas");sheet.width=8*4;sheet.height=6;const c=sheet.getContext("2d");c.imageSmoothingEnabled=false;
  for(let frame=0;frame<4;frame++){const x=frame*8,hop=frame===1||frame===3?-1:0;pixel(c,x+1,3+hop,6,3,"#4f793f");pixel(c,x+2,1+hop,4,3,"#6b984e");pixel(c,x+2,1+hop,1,1,"#d8d6a2");pixel(c,x+5,1+hop,1,1,"#d8d6a2");pixel(c,x+2,2+hop,1,1,"#20251e");pixel(c,x+5,2+hop,1,1,"#20251e");pixel(c,x,5+hop,3,1,"#395b34");pixel(c,x+5,5+hop,3,1,"#395b34")}
  return sheet;
}
function makeMothSheet(){
  const sheet=document.createElement("canvas");sheet.width=8*4;sheet.height=6;const c=sheet.getContext("2d");c.imageSmoothingEnabled=false;
  for(let frame=0;frame<4;frame++){const x=frame*8,open=frame%2===0;pixel(c,x+3,1,2,5,"#6b5948");if(open){pixel(c,x,1,3,3,"#d1bd83");pixel(c,x+5,1,3,3,"#d1bd83");pixel(c,x+1,0,2,1,"#aa9367");pixel(c,x+5,0,2,1,"#aa9367")}else{pixel(c,x+2,2,2,3,"#c2ad78");pixel(c,x+4,2,2,3,"#c2ad78")}}
  return sheet;
}
function makePredatorSheet(species){
  const sheet=document.createElement("canvas");sheet.width=16*4;sheet.height=12;const c=sheet.getContext("2d");c.imageSmoothingEnabled=false;
  for(let frame=0;frame<4;frame++){const x=frame*16,step=frame%2;
    if(species==="fox"||species==="wolf"){const body=species==="fox"?"#b85f32":"#59615e",light=species==="fox"?"#e2b078":"#89918c";pixel(c,x+3,5,10,5,body);pixel(c,x+11,2,4,6,body);pixel(c,x+12,1,1,2,body);pixel(c,x+14,1,1,2,body);pixel(c,x+14,4,1,1,"#171918");pixel(c,x,5,5,2,body);pixel(c,x,4,2,2,light);pixel(c,x+4,10,2,2-step,"#3f3631");pixel(c,x+11,10,2,1+step,"#3f3631");pixel(c,x+11,6,3,2,light)}
    else if(species==="owl"){pixel(c,x+5,2,7,8,"#78664e");pixel(c,x+3,4,4,6,"#9a835f");pixel(c,x+11,4,3,6,"#9a835f");pixel(c,x+6,3,2,2,"#e4d486");pixel(c,x+10,3,2,2,"#e4d486");pixel(c,x+7,4,1,1,"#171918");pixel(c,x+10,4,1,1,"#171918");pixel(c,x+8,6,2,2,"#c29a50");if(step){pixel(c,x+1,2,4,2,"#9a835f");pixel(c,x+12,2,4,2,"#9a835f")}}
    else if(species==="snake"){for(let i=0;i<6;i++)pixel(c,x+1+i*2,7+(i%2?step:-step),3,3,i%2?"#567341":"#6f8a4e");pixel(c,x+12,5,4,4,"#789557");pixel(c,x+15,6,1,1,"#171918")}
    else{pixel(c,x+6,4,4,6,"#4e4144");pixel(c,x+1,3+step,6,3,"#67565e");pixel(c,x+10,3+step,6,3,"#67565e");pixel(c,x,2+step,3,2,"#7c6871");pixel(c,x+13,2+step,3,2,"#7c6871");pixel(c,x+7,2,1,2,"#4e4144");pixel(c,x+9,2,1,2,"#4e4144")}
  }return sheet;
}
const predatorSheets=Object.fromEntries(Object.keys(predatorSpecies).map(species=>[species,makePredatorSheet(species)]));
const sheets={player:makePlayerSheet(),rabbit:makeRabbitSheet(),deer:makeDeerSheet(),mouse:makeMouseSheet(),frog:makeFrogSheet(),moth:makeMothSheet(),predators:predatorSheets,nature:seasons.map((_,i)=>makeNatureSheet(i)),ground:seasons.map((_,i)=>makeGroundSheet(i)),props:seasons.map((_,i)=>makePropSheet(i))};
function currentSeason(){return Math.floor(cycleElapsed/SEASON_DURATION)%seasons.length}
function updateSeasonIndicator(){const index=currentSeason();if(index===lastSeason)return;lastSeason=index;const indicator=document.querySelector("#seasonIndicator");indicator.textContent=seasons[index].emoji;indicator.setAttribute("aria-label",seasons[index].name)}

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
function nearestHabitableTile(startX,startY){
  for(let radius=0;radius<10;radius++)for(let y=startY-radius;y<=startY+radius;y++)for(let x=startX-radius;x<=startX+radius;x++)if(terrain[y]?.[x]!==undefined&&terrain[y][x]!==4&&terrain[y][x]!==3)return{x:x*TILE+16,y:y*TILE+20};
  return{x:startX*TILE+16,y:startY*TILE+20};
}
function spawnRabbit(home,sex,age=24,x=home.x+(rnd(nextRabbitId,1)-.5)*35,y=home.y+(rnd(nextRabbitId,2)-.5)*35){
  const rabbit={id:nextRabbitId++,homeId:home.id,sex,age,x,y,targetX:x,targetY:y,wanderTimer:rnd(nextRabbitId,3)*2,mateId:null,pregnancy:0,breedingCooldown:10+rnd(nextRabbitId,4)*15,hop:0,hidden:false,lifespan:210+rnd(nextRabbitId,5)*90};
  rabbits.push(rabbit);return rabbit;
}
function createRabbitPopulation(){
  const homes=[[16,17],[39,38],[69,17],[24,48],[66,47]].map(([x,y],id)=>({id,...nearestHabitableTile(x,y)}));
  homes.forEach(home=>{burrows.push(home);const female=spawnRabbit(home,"female",28),male=spawnRabbit(home,"male",30);female.mateId=male.id;male.mateId=female.id;female.breedingCooldown=7+rnd(home.id,9)*8});
}
function rabbitHome(rabbit){return burrows.find(home=>home.id===rabbit.homeId)}
function chooseRabbitTarget(rabbit){
  const home=rabbitHome(rabbit),angle=rnd(rabbit.id,Math.floor(rabbit.age*2),14)*Math.PI*2,distance=25+rnd(rabbit.id,Math.floor(rabbit.age*3),15)*125;
  const x=Math.max(8,Math.min(MAP_W*TILE-8,home.x+Math.cos(angle)*distance)),y=Math.max(8,Math.min(MAP_H*TILE-8,home.y+Math.sin(angle)*distance));
  if(!blocked(x,y)){rabbit.targetX=x;rabbit.targetY=y}rabbit.wanderTimer=2+rnd(rabbit.id,Math.floor(rabbit.age),16)*5;
}
function pairAdultRabbits(){
  for(const rabbit of rabbits){if(rabbit.age<20||rabbit.mateId)continue;const mate=rabbits.find(candidate=>candidate.id!==rabbit.id&&candidate.age>=20&&!candidate.mateId&&candidate.sex!==rabbit.sex&&candidate.homeId===rabbit.homeId);if(mate){rabbit.mateId=mate.id;mate.mateId=rabbit.id}}
}
function updateRabbits(dt){
  const newborns=[];pairAdultRabbits();
  for(const rabbit of rabbits){
    rabbit.age+=dt;rabbit.breedingCooldown=Math.max(0,rabbit.breedingCooldown-dt);rabbit.wanderTimer-=dt;
    const home=rabbitHome(rabbit),night=nightStrength()>.55;
    if(night){rabbit.targetX=home.x;rabbit.targetY=home.y}
    else if(rabbit.wanderTimer<=0)chooseRabbitTarget(rabbit);
    if(rabbit.sex==="female"&&rabbit.pregnancy>0){rabbit.pregnancy-=dt;if(rabbit.pregnancy<=0){const litter=2+Math.floor(rnd(rabbit.id,Math.floor(rabbit.age),19)*3);for(let i=0;i<litter&&rabbits.length+newborns.length<50;i++)newborns.push({home,sex:i%2?"male":"female",x:rabbit.x+(i-1)*2,y:rabbit.y});rabbit.breedingCooldown=35}}
    const mate=rabbits.find(candidate=>candidate.id===rabbit.mateId);
    if(rabbit.sex==="female"&&rabbit.age>=20&&mate&&rabbit.breedingCooldown<=0&&mate.breedingCooldown<=0&&Math.hypot(rabbit.x-mate.x,rabbit.y-mate.y)<42){rabbit.pregnancy=12;rabbit.breedingCooldown=47;mate.breedingCooldown=38}
    const dx=rabbit.targetX-rabbit.x,dy=rabbit.targetY-rabbit.y,distance=Math.hypot(dx,dy);
    rabbit.hidden=night;
    if(distance>3){const speed=(rabbit.age<8?15:rabbit.age<20?24:34)*dt,nx=rabbit.x+dx/distance*speed,ny=rabbit.y+dy/distance*speed;if(!blocked(nx,rabbit.y))rabbit.x=nx;if(!blocked(rabbit.x,ny))rabbit.y=ny;rabbit.hop+=dt*(rabbit.age<8?5:8)}else if(!night)rabbit.wanderTimer=0;
  }
  for(const baby of newborns)spawnRabbit(baby.home,baby.sex,0,baby.x,baby.y);
  for(let index=rabbits.length-1;index>=0;index--)if(rabbits[index].age>rabbits[index].lifespan&&rabbits.length>6){const id=rabbits[index].id;rabbits.splice(index,1);for(const rabbit of rabbits)if(rabbit.mateId===id)rabbit.mateId=null}
}
function spawnPrey(home,sex,age,x=home.x+(rnd(nextPreyId,21)-.5)*24,y=home.y+(rnd(nextPreyId,22)-.5)*24){
  const settings=preySpecies[home.species],animal={id:nextPreyId++,species:home.species,homeId:home.id,sex,age,x,y,targetX:x,targetY:y,mateId:null,pregnancy:0,cooldown:12+rnd(nextPreyId,23)*20,wanderTimer:0,hop:0,hidden:false,lifespan:settings.lifespan[0]+rnd(nextPreyId,24)*(settings.lifespan[1]-settings.lifespan[0])};
  preyAnimals.push(animal);return animal;
}
function createPreyPopulation(){
  const definitions=[["deer",44,31],["mouse",35,39],["mouse",64,43],["frog",58,34],["moth",31,24]];
  definitions.forEach(([species,tileX,tileY],id)=>{const home={id,species,...nearestHabitableTile(tileX,tileY)};preyHomes.push(home);const spacing=species==="deer"?24:8,female=spawnPrey(home,"female",preySpecies[species].maturity+8,home.x-spacing,home.y),male=spawnPrey(home,"male",preySpecies[species].maturity+10,home.x+spacing,home.y);female.mateId=male.id;male.mateId=female.id;female.cooldown=species==="deer"?28:9});
  for(let index=objects.length-1;index>=0;index--){const nearbyHome=preyHomes.find(home=>Math.hypot(objects[index].x-home.x,objects[index].y-home.y)<(home.species==="deer"?75:38));if(nearbyHome)objects.splice(index,1)}
}
function preyHome(animal){return preyHomes.find(home=>home.id===animal.homeId)}
function choosePreyTarget(animal){
  const home=preyHome(animal),settings=preySpecies[animal.species],angle=rnd(animal.id,Math.floor(animal.age*2),25)*Math.PI*2,distance=20+rnd(animal.id,Math.floor(animal.age*3),26)*settings.range;
  const x=Math.max(8,Math.min(MAP_W*TILE-8,home.x+Math.cos(angle)*distance)),y=Math.max(8,Math.min(MAP_H*TILE-8,home.y+Math.sin(angle)*distance));if(!blocked(x,y)){animal.targetX=x;animal.targetY=y}animal.wanderTimer=3+rnd(animal.id,Math.floor(animal.age),27)*7;
}
function pairPrey(){
  for(const animal of preyAnimals){const settings=preySpecies[animal.species];if(animal.age<settings.maturity||animal.mateId)continue;const mate=preyAnimals.find(candidate=>candidate.id!==animal.id&&candidate.species===animal.species&&candidate.homeId===animal.homeId&&candidate.sex!==animal.sex&&candidate.age>=settings.maturity&&!candidate.mateId);if(mate){animal.mateId=mate.id;mate.mateId=animal.id}}
}
function updatePrey(dt){
  const newborns=[];pairPrey();
  for(const animal of preyAnimals){const settings=preySpecies[animal.species],home=preyHome(animal);animal.age+=dt;animal.cooldown=Math.max(0,animal.cooldown-dt);animal.wanderTimer-=dt;
    const night=nightStrength()>.55,active=settings.activeNight?night:!night;if(!active){animal.targetX=home.x;animal.targetY=home.y}else if(animal.wanderTimer<=0)choosePreyTarget(animal);
    if(animal.sex==="female"&&animal.pregnancy>0){animal.pregnancy-=dt;if(animal.pregnancy<=0){const sameSpecies=preyAnimals.filter(candidate=>candidate.species===animal.species).length+newborns.filter(baby=>baby.home.species===animal.species).length,litter=settings.litter[0]+Math.floor(rnd(animal.id,Math.floor(animal.age),28)*(settings.litter[1]-settings.litter[0]+1));for(let i=0;i<litter&&sameSpecies+i<settings.cap;i++)newborns.push({home,sex:i%2?"male":"female",x:animal.x+i,y:animal.y});animal.cooldown=settings.cooldown}}
    const mate=preyAnimals.find(candidate=>candidate.id===animal.mateId);if(animal.sex==="female"&&animal.age>=settings.maturity&&mate&&animal.cooldown<=0&&mate.cooldown<=0&&Math.hypot(animal.x-mate.x,animal.y-mate.y)<45){animal.pregnancy=settings.gestation;animal.cooldown=settings.cooldown;mate.cooldown=settings.cooldown*.8}
    const dx=animal.targetX-animal.x,dy=animal.targetY-animal.y,distance=Math.hypot(dx,dy);animal.hidden=!active;animal.resting=!active&&distance<8;
    if(distance>3&&!animal.resting){const juvenile=Math.min(1,animal.age/settings.maturity),speed=settings.speed*(.55+.45*juvenile)*dt,nx=animal.x+dx/distance*speed,ny=animal.y+dy/distance*speed;if(!blocked(nx,animal.y))animal.x=nx;if(!blocked(animal.x,ny))animal.y=ny;animal.hop+=dt*(animal.species==="moth"?14:animal.species==="mouse"?11:animal.species==="frog"?8:5)}else if(active)animal.wanderTimer=0;
  }
  for(const baby of newborns)spawnPrey(baby.home,baby.sex,0,baby.x,baby.y);
  for(let index=preyAnimals.length-1;index>=0;index--){const animal=preyAnimals[index],floor=Object.values(predatorSpecies).find(settings=>settings.prey===animal.species)?.preyFloor||2;if(animal.age>animal.lifespan&&preyPopulation(animal.species)>floor){const id=animal.id;preyAnimals.splice(index,1);for(const survivor of preyAnimals)if(survivor.mateId===id)survivor.mateId=null}}
}
function spawnPredator(home,sex,age,x=home.x+(rnd(nextPredatorId,31)-.5)*30,y=home.y+(rnd(nextPredatorId,32)-.5)*30){
  const settings=predatorSpecies[home.species],predator={id:nextPredatorId++,species:home.species,homeId:home.id,sex,age,x,y,targetX:x,targetY:y,mateId:null,pregnancy:0,cooldown:40+rnd(nextPredatorId,33)*45,hunger:rnd(nextPredatorId,34)*12,wanderTimer:0,hop:0,hidden:false,resting:false,lifespan:settings.lifespan[0]+rnd(nextPredatorId,35)*(settings.lifespan[1]-settings.lifespan[0])};predators.push(predator);return predator;
}
function createPredatorPopulation(){
  const definitions=[["fox",20,27],["wolf",72,24],["owl",39,17],["snake",59,39],["bat",27,31]];
  definitions.forEach(([species,tileX,tileY],id)=>{const home={id,species,...nearestHabitableTile(tileX,tileY)};predatorHomes.push(home);const spacing=species==="wolf"?20:12,female=spawnPredator(home,"female",predatorSpecies[species].maturity+12,home.x-spacing,home.y),male=spawnPredator(home,"male",predatorSpecies[species].maturity+15,home.x+spacing,home.y);female.mateId=male.id;male.mateId=female.id;female.cooldown=55+rnd(id,36)*35});
  for(let index=objects.length-1;index>=0;index--)if(predatorHomes.some(home=>Math.hypot(objects[index].x-home.x,objects[index].y-home.y)<45))objects.splice(index,1);
}
function predatorHome(predator){return predatorHomes.find(home=>home.id===predator.homeId)}
function preyPopulation(species){return species==="rabbit"?rabbits.length:preyAnimals.filter(animal=>animal.species===species).length}
function huntablePrey(species){return species==="rabbit"?rabbits.filter(animal=>!animal.hidden):preyAnimals.filter(animal=>animal.species===species&&!animal.hidden)}
function consumePrey(target,species){
  const collection=species==="rabbit"?rabbits:preyAnimals,index=collection.findIndex(animal=>animal.id===target.id);if(index<0)return false;collection.splice(index,1);
  for(const animal of collection)if(animal.mateId===target.id)animal.mateId=null;return true;
}
function pairPredators(){
  for(const predator of predators){const settings=predatorSpecies[predator.species];if(predator.age<settings.maturity||predator.mateId)continue;const mate=predators.find(candidate=>candidate.id!==predator.id&&candidate.species===predator.species&&candidate.homeId===predator.homeId&&candidate.sex!==predator.sex&&candidate.age>=settings.maturity&&!candidate.mateId);if(mate){predator.mateId=mate.id;mate.mateId=predator.id}}
}
function choosePredatorTarget(predator){
  const home=predatorHome(predator),settings=predatorSpecies[predator.species],angle=rnd(predator.id,Math.floor(predator.age*2),37)*Math.PI*2,distance=35+rnd(predator.id,Math.floor(predator.age*3),38)*settings.range;
  const x=Math.max(8,Math.min(MAP_W*TILE-8,home.x+Math.cos(angle)*distance)),y=Math.max(8,Math.min(MAP_H*TILE-8,home.y+Math.sin(angle)*distance));if(!blocked(x,y)){predator.targetX=x;predator.targetY=y}predator.wanderTimer=4+rnd(predator.id,Math.floor(predator.age),39)*7;
}
function updatePredators(dt){
  const newborns=[];pairPredators();
  for(const predator of predators){const settings=predatorSpecies[predator.species],home=predatorHome(predator);predator.age+=dt;predator.cooldown=Math.max(0,predator.cooldown-dt);predator.hunger+=dt;predator.wanderTimer-=dt;
    const night=nightStrength()>.55,active=settings.activeNight?night:!night,canHunt=active&&predator.hunger>18&&preyPopulation(settings.prey)>settings.preyFloor;
    let victim=null;if(canHunt){const candidates=huntablePrey(settings.prey);for(const candidate of candidates)if(!victim||Math.hypot(predator.x-candidate.x,predator.y-candidate.y)<Math.hypot(predator.x-victim.x,predator.y-victim.y))victim=candidate}
    if(victim){predator.targetX=victim.x;predator.targetY=victim.y}else if(!active){predator.targetX=home.x;predator.targetY=home.y}else if(predator.wanderTimer<=0)choosePredatorTarget(predator);
    if(predator.sex==="female"&&predator.pregnancy>0){predator.pregnancy-=dt;if(predator.pregnancy<=0&&predators.filter(item=>item.species===predator.species).length+newborns.filter(item=>item.home.species===predator.species).length<settings.cap){newborns.push({home,sex:rnd(predator.id,Math.floor(predator.age),40)>.5?"male":"female",x:predator.x,y:predator.y});predator.cooldown=settings.cooldown}}
    const mate=predators.find(candidate=>candidate.id===predator.mateId),foodPlentiful=preyPopulation(settings.prey)>settings.preyFloor+2;if(foodPlentiful&&predator.sex==="female"&&predator.age>=settings.maturity&&mate&&predator.cooldown<=0&&mate.cooldown<=0&&Math.hypot(predator.x-mate.x,predator.y-mate.y)<48){predator.pregnancy=settings.gestation;predator.cooldown=settings.cooldown;mate.cooldown=settings.cooldown*.8}
    const dx=predator.targetX-predator.x,dy=predator.targetY-predator.y,distance=Math.hypot(dx,dy);predator.hidden=!active;predator.resting=!active&&distance<9;
    if(victim&&Math.hypot(predator.x-victim.x,predator.y-victim.y)<10&&consumePrey(victim,settings.prey)){predator.hunger=0;predator.wanderTimer=0;continue}
    if(distance>3&&!predator.resting){const juvenile=Math.min(1,predator.age/settings.maturity),speed=settings.speed*(.6+.4*juvenile)*dt,nx=predator.x+dx/distance*speed,ny=predator.y+dy/distance*speed;if(!blocked(nx,predator.y))predator.x=nx;if(!blocked(predator.x,ny))predator.y=ny;predator.hop+=dt*(predator.species==="bat"?13:predator.species==="snake"?7:6)}else if(active)predator.wanderTimer=0;
  }
  for(const baby of newborns)spawnPredator(baby.home,baby.sex,0,baby.x,baby.y);
  for(let index=predators.length-1;index>=0;index--){const predator=predators[index];if(predator.age>predator.lifespan&&predators.filter(item=>item.species===predator.species).length>2){const id=predator.id;predators.splice(index,1);for(const survivor of predators)if(survivor.mateId===id)survivor.mateId=null}}
}
function resize(){dpr=Math.min(devicePixelRatio,2);width=innerWidth;height=innerHeight;canvas.width=width*dpr;canvas.height=height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=false}
function isVisible(x,y,pad=90){return x>camera.x-pad&&x<camera.x+width+pad&&y>camera.y-pad&&y<camera.y+height+pad}
function drawTerrain(){
  const sx=Math.max(0,Math.floor(camera.x/TILE)-1),ex=Math.min(MAP_W,Math.ceil((camera.x+width)/TILE)+1),sy=Math.max(0,Math.floor(camera.y/TILE)-1),ey=Math.min(MAP_H,Math.ceil((camera.y+height)/TILE)+1);
  const season=currentSeason(),wind=Math.floor(performance.now()/(season===3?500:season===1?190:260));
  for(let y=sy;y<ey;y++)for(let x=sx;x<ex;x++){const type=terrain[y][x],dx=Math.round(x*TILE-camera.x),dy=Math.round(y*TILE-camera.y);ctx.drawImage(sheets.ground[season],type*32,0,32,32,dx,dy,32,32);if(type===4){const shift=Math.floor(performance.now()/(season===3?650:180)+x*3+y*5)%8;ctx.fillStyle=season===3?"#e1f0ef":"#80aca1";ctx.fillRect(dx+shift,dy+8,9,1);ctx.fillRect(dx+(shift+14)%25,dy+23,7,1)}else if(type!==3&&season!==3){const sway=(wind+x+y)%3-1;ctx.fillStyle=season===2?"#8b6238":type===2?"#77763f":"#3c6b3d";ctx.fillRect(dx+8+sway,dy+10,1,5);ctx.fillRect(dx+23-sway,dy+25,1,4)}}
}
function drawObject(o){const season=currentSeason(),phase=performance.now()/520+o.x*.017+o.y*.011,wind=season===3?.45:season===1?2.3:1.5,sway=Math.round(Math.sin(phase)*(o.prop!==undefined?wind*1.3:wind)),x=Math.round(o.x-camera.x),y=Math.round(o.y-camera.y);if(o.prop!==undefined){const lift=o.prop===1?Math.round(Math.sin(phase*1.7)):0;ctx.drawImage(sheets.props[season],o.prop*16,0,16,16,x-16+sway,y-32+lift,32,32)}else{const scale=o.scale||1,w=64*scale,h=96*scale;ctx.fillStyle="#172d2450";ctx.fillRect(x-18*scale,y-5,36*scale,6);ctx.drawImage(sheets.nature[season],o.sprite*32,0,32,48,x-w/2+sway,y-h,w,h)}}
function drawBurrows(){for(const burrow of burrows){if(!isVisible(burrow.x,burrow.y,25))continue;const x=Math.round(burrow.x-camera.x),y=Math.round(burrow.y-camera.y);ctx.fillStyle="#806043";ctx.fillRect(x-11,y-3,22,6);ctx.fillStyle="#2b2923";ctx.fillRect(x-8,y-4,16,6);ctx.fillStyle="#171b18";ctx.fillRect(x-5,y-3,10,4);ctx.fillStyle="#a47b4c";ctx.fillRect(x-12,y+3,5,2);ctx.fillRect(x+7,y+3,7,2)}}
function drawPreyHomes(){for(const home of preyHomes){if(!isVisible(home.x,home.y,30))continue;const x=Math.round(home.x-camera.x),y=Math.round(home.y-camera.y);if(home.species==="deer"){ctx.fillStyle="#6f6842";ctx.fillRect(x-15,y-5,30,8);ctx.fillStyle="#958557";ctx.fillRect(x-11,y-7,22,6);ctx.fillStyle="#b09a61";ctx.fillRect(x-7,y-8,14,3)}else if(home.species==="frog"){ctx.fillStyle="#334b35";ctx.fillRect(x-9,y-3,18,6);ctx.fillStyle="#58764a";ctx.fillRect(x-6,y-5,12,4);ctx.fillStyle="#26362c";ctx.fillRect(x-3,y-4,6,3)}else if(home.species==="moth"){ctx.fillStyle="#65442e";ctx.fillRect(x-5,y-12,10,14);ctx.fillStyle="#2a241f";ctx.fillRect(x-3,y-8,6,6);ctx.fillStyle="#8b633b";ctx.fillRect(x-6,y+1,12,3)}else{ctx.fillStyle="#72533c";ctx.fillRect(x-6,y-2,12,4);ctx.fillStyle="#27241f";ctx.fillRect(x-4,y-3,8,4)}}}
function drawPredatorHomes(){for(const home of predatorHomes){if(!isVisible(home.x,home.y,35))continue;const x=Math.round(home.x-camera.x),y=Math.round(home.y-camera.y);if(home.species==="owl"){ctx.fillStyle="#65442e";ctx.fillRect(x-6,y-16,12,18);ctx.fillStyle="#211f1c";ctx.fillRect(x-4,y-12,8,7)}else if(home.species==="bat"||home.species==="wolf"){ctx.fillStyle="#65655e";ctx.fillRect(x-14,y-6,28,9);ctx.fillStyle="#292a27";ctx.fillRect(x-9,y-8,18,10);ctx.fillStyle="#858279";ctx.fillRect(x-12,y-9,24,4)}else if(home.species==="snake"){ctx.fillStyle="#72694d";ctx.fillRect(x-10,y-3,20,5);ctx.fillStyle="#282822";ctx.fillRect(x-7,y-3,14,2)}else{ctx.fillStyle="#76533a";ctx.fillRect(x-12,y-4,24,7);ctx.fillStyle="#25231f";ctx.fillRect(x-8,y-6,16,8)}}}
function drawRabbit(rabbit){
  const x=Math.round(rabbit.x-camera.x),y=Math.round(rabbit.y-camera.y),hop=Math.abs(Math.sin(rabbit.hop))*(rabbit.age<8?1:4);
  if(rabbit.age<5){const size=rabbit.age<2?1:2;ctx.fillStyle="#9d7455";ctx.fillRect(x,y-hop,size,size);return}
  const maturity=Math.min(1,(rabbit.age-4)/16),w=Math.max(4,Math.round(18*maturity)),h=Math.max(3,Math.round(15*maturity)),frame=Math.floor(rabbit.hop/Math.PI*2)%4;
  ctx.fillStyle="#1b2a2150";ctx.fillRect(x-w*.35,y+1,w*.7,2);ctx.drawImage(sheets.rabbit,frame*12,0,12,10,x-w/2,y-h-hop,w,h);
}
function drawPrey(animal){
  const settings=preySpecies[animal.species],maturity=Math.min(1,animal.age/settings.maturity),x=Math.round(animal.x-camera.x),y=Math.round(animal.y-camera.y),frame=animal.resting?0:Math.floor(animal.hop/Math.PI*2)%4;
  if(animal.species==="mouse"){if(animal.age<4){ctx.fillStyle="#6e5b51";ctx.fillRect(x,y,1,1);return}const w=Math.max(3,Math.round(10*maturity)),h=Math.max(2,Math.round(7*maturity)),hop=animal.resting?0:Math.abs(Math.sin(animal.hop))*2;ctx.fillStyle="#d2b8a8";ctx.fillRect(x-w/2-3,y-2,4,1);ctx.drawImage(sheets.mouse,frame*7,0,7,5,x-w/2,y-h-hop,w,h);return}
  if(animal.species==="frog"){if(animal.age<5){ctx.fillStyle="#557b42";ctx.fillRect(x,y,1,1);return}const w=Math.max(3,Math.round(10*maturity)),h=Math.max(2,Math.round(8*maturity)),hop=animal.resting?0:Math.abs(Math.sin(animal.hop))*4;ctx.drawImage(sheets.frog,frame*8,0,8,6,x-w/2,y-h-hop,w,h);return}
  if(animal.species==="moth"){if(animal.age<4){ctx.fillStyle="#ccb983";ctx.fillRect(x,y,1,1);return}const w=Math.max(3,Math.round(9*maturity)),h=Math.max(2,Math.round(7*maturity)),hover=animal.resting?0:4+Math.sin(animal.hop)*3;ctx.drawImage(sheets.moth,frame*8,0,8,6,x-w/2,y-h-hover,w,h);return}
  const w=Math.max(7,Math.round(47*maturity)),h=Math.max(9,Math.round(56*maturity)),hop=animal.resting?0:Math.abs(Math.sin(animal.hop))*4;ctx.fillStyle="#1b2a2145";ctx.fillRect(x-w*.3,y+1,w*.6,3);
  if(animal.sex==="male"&&maturity>.8){ctx.fillStyle="#67442f";ctx.fillRect(x+8,y-h-hop-5,2,8);ctx.fillRect(x+12,y-h-hop-8,2,10);ctx.fillRect(x+5,y-h-hop-5,5,2);ctx.fillRect(x+11,y-h-hop-8,5,2)}
  ctx.drawImage(sheets.deer,frame*20,0,20,24,x-w/2,y-h-hop,w,h);
}
function drawPredator(predator){
  const settings=predatorSpecies[predator.species],maturity=Math.min(1,predator.age/settings.maturity),x=Math.round(predator.x-camera.x),y=Math.round(predator.y-camera.y);
  if(predator.age<5){ctx.fillStyle="#4a4038";ctx.fillRect(x,y,1,1);return}
  const w=Math.max(4,Math.round(settings.size[0]*maturity)),h=Math.max(3,Math.round(settings.size[1]*maturity)),frame=predator.resting?0:Math.floor(predator.hop/Math.PI*2)%4,flight=predator.species==="bat"||predator.species==="owl",hop=predator.resting?0:flight?5+Math.sin(predator.hop)*3:Math.abs(Math.sin(predator.hop))*3;
  ctx.fillStyle="#15221c55";ctx.fillRect(x-w*.3,y+1,w*.6,2);ctx.drawImage(sheets.predators[predator.species],frame*16,0,16,12,x-w/2,y-h-hop,w,h);
}
function drawPlayer(){
  const moving=keys.size>0||target!==null,hop=moving?Math.abs(Math.sin(player.hop))*13:0,frame=moving?Math.floor(player.hop/Math.PI*2)%4:0,x=Math.round(player.x-camera.x),y=Math.round(player.y-camera.y);
  ctx.fillStyle=`rgba(18,35,28,${.3-hop/90})`;ctx.fillRect(x-15+hop*.22,y+6,30-hop*.44,6);
  ctx.drawImage(sheets.player,frame*16,player.dir*24,16,24,x-24,y-72-hop,48,72);
}
function blocked(x,y){const tx=Math.floor(x/TILE),ty=Math.floor(y/TILE);if(tx<0||ty<0||tx>=MAP_W||ty>=MAP_H||terrain[ty][tx]===4)return true;return objects.some(o=>o.solid&&Math.abs(o.x-x)<17*(o.scale||1)&&Math.abs(o.y-y)<13*(o.scale||1))}
function update(dt){
  cycleElapsed+=dt;
  updateSeasonIndicator();
  let dx=0,dy=0;if(keys.has("w")||keys.has("arrowup"))dy--;if(keys.has("s")||keys.has("arrowdown"))dy++;if(keys.has("a")||keys.has("arrowleft"))dx--;if(keys.has("d")||keys.has("arrowright"))dx++;
  if(keys.size)target=null;
  if(target&&!dx&&!dy){const tx=target.x-player.x,ty=target.y-player.y,distance=Math.hypot(tx,ty);if(distance>6){dx=tx/distance;dy=ty/distance}else target=null}
  if(dx||dy){const len=Math.hypot(dx,dy),beforeX=player.x,beforeY=player.y;dx/=len;dy/=len;const pace=player.speed*dt,nx=player.x+dx*pace,ny=player.y+dy*pace;if(!blocked(nx,player.y))player.x=nx;if(!blocked(player.x,ny))player.y=ny;if(target&&player.x===beforeX&&player.y===beforeY)target=null;player.hop+=dt*7;player.dir=0}
  updateRabbits(dt);
  updatePrey(dt);
  updatePredators(dt);
}
function nightStrength(){const turn=Math.floor(cycleElapsed/10)%2,progress=cycleElapsed%10;return turn===1?Math.min(1,progress/1.5):Math.max(0,1-progress/1.5)}
function drawNight(){
  const strength=nightStrength();if(strength<=0)return;
  const px=player.x-camera.x,py=player.y-camera.y;
  const shade=ctx.createRadialGradient(px,py,45,px,py,Math.max(280,Math.min(width,height)*.62));
  shade.addColorStop(0,`rgba(8,19,42,${.2*strength})`);shade.addColorStop(.35,`rgba(8,18,39,${.44*strength})`);shade.addColorStop(1,`rgba(5,12,31,${.72*strength})`);
  ctx.fillStyle=shade;ctx.fillRect(0,0,width,height);
  for(let i=0;i<24;i++){const worldX=rnd(i,4,30)*MAP_W*TILE,worldY=rnd(i,9,31)*MAP_H*TILE,x=worldX-camera.x+Math.sin(performance.now()/700+i)*5,y=worldY-camera.y+Math.cos(performance.now()/900+i*2)*3;if(x<0||y<0||x>width||y>height)continue;const flicker=.45+.55*Math.abs(Math.sin(performance.now()/360+i));ctx.fillStyle=`rgba(245,222,111,${strength*flicker})`;ctx.fillRect(Math.round(x),Math.round(y),2,2)}
}
function drawSeasonParticles(){
  const season=currentSeason(),count=season===3?48:season===1?15:28,time=performance.now()/1000;
  for(let i=0;i<count;i++){let x=(rnd(i,2,42)*width+time*(season===3?11:season===2?34:18)+i*17)%width,y=(rnd(i,7,43)*height+time*(season===3?42:season===2?25:12)+i*11)%height;
    if(season===0){ctx.fillStyle=i%2?"#f2b8cc":"#f8d5df";ctx.fillRect(Math.round(x+Math.sin(time+i)*5),Math.round(y),2,2)}
    else if(season===1){ctx.fillStyle="#f2d87899";ctx.fillRect(Math.round(x),Math.round(y+Math.sin(time+i)*4),1,1)}
    else if(season===2){ctx.fillStyle=i%2?"#d67c36":"#a94e2f";ctx.fillRect(Math.round(x+Math.sin(time*2+i)*8),Math.round(y),3,2)}
    else{ctx.fillStyle="#f4f7f2cc";ctx.fillRect(Math.round(x+Math.sin(time+i)*7),Math.round(y),2,2)}
  }
}
function draw(){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=false;drawTerrain();drawBurrows();drawPreyHomes();drawPredatorHomes();const shown=[...objects.filter(o=>isVisible(o.x,o.y)).map(data=>({kind:"object",data})),...rabbits.filter(rabbit=>!rabbit.hidden&&isVisible(rabbit.x,rabbit.y)).map(data=>({kind:"rabbit",data})),...preyAnimals.filter(animal=>!animal.hidden&&isVisible(animal.x,animal.y)).map(data=>({kind:"prey",data})),...predators.filter(predator=>!predator.hidden&&isVisible(predator.x,predator.y)).map(data=>({kind:"predator",data}))].sort((a,b)=>a.data.y-b.data.y);let playerDone=false;for(const item of shown){if(!playerDone&&item.data.y>player.y){drawPlayer();playerDone=true}if(item.kind==="rabbit")drawRabbit(item.data);else if(item.kind==="prey")drawPrey(item.data);else if(item.kind==="predator")drawPredator(item.data);else drawObject(item.data)}if(!playerDone)drawPlayer();ctx.fillStyle="#10251d0c";ctx.fillRect(0,0,width,height);drawSeasonParticles();drawNight()}
function drawMap(mapContext,mapCanvas,showCamera){
  const mapPalettes=[
    ["#739457","#315f40","#a39b62","#777957","#477f7d"],["#879950","#3c673b","#ac995b","#817957","#3f7775"],
    ["#9b7949","#6b4c35","#a08051","#746950","#536f6b"],["#d8dfd5","#c4d0c5","#d8d1bc","#afb4aa","#9fc3c6"]
  ],mw=mapCanvas.width,mh=mapCanvas.height,cellW=mw/MAP_W,cellH=mh/MAP_H,colors=mapPalettes[currentSeason()];
  mapContext.imageSmoothingEnabled=false;mapContext.clearRect(0,0,mw,mh);
  for(let y=0;y<MAP_H;y++)for(let x=0;x<MAP_W;x++){mapContext.fillStyle=colors[terrain[y][x]];mapContext.fillRect(Math.floor(x*cellW),Math.floor(y*cellH),Math.ceil(cellW),Math.ceil(cellH))}
  for(const object of objects){if(object.prop!==undefined&&object.prop!==0)continue;mapContext.fillStyle=object.sprite===3?"#77776d":"#203f2c";const size=Math.max(1,cellW*.7);mapContext.fillRect(object.x/(MAP_W*TILE)*mw-size/2,object.y/(MAP_H*TILE)*mh-size/2,size,size)}
  mapContext.fillStyle="#4b3527";for(const burrow of burrows)mapContext.fillRect(burrow.x/(MAP_W*TILE)*mw-1,burrow.y/(MAP_H*TILE)*mh-1,3,2);
  mapContext.fillStyle="#d8b88d";for(const rabbit of rabbits)if(!rabbit.hidden)mapContext.fillRect(rabbit.x/(MAP_W*TILE)*mw,rabbit.y/(MAP_H*TILE)*mh,Math.max(1,cellW*.35),Math.max(1,cellH*.35));
  mapContext.fillStyle="#5a4534";for(const home of preyHomes)mapContext.fillRect(home.x/(MAP_W*TILE)*mw-1,home.y/(MAP_H*TILE)*mh-1,2,2);
  for(const animal of preyAnimals)if(!animal.hidden){const colors={deer:"#c59a6b",mouse:"#8c7c70",frog:"#6d9657",moth:"#d7c68e"};mapContext.fillStyle=colors[animal.species];const size=animal.species==="deer"?Math.max(2,cellW*.6):1;mapContext.fillRect(animal.x/(MAP_W*TILE)*mw-size/2,animal.y/(MAP_H*TILE)*mh-size/2,size,size)}
  mapContext.fillStyle="#3a2521";for(const home of predatorHomes)mapContext.fillRect(home.x/(MAP_W*TILE)*mw-1,home.y/(MAP_H*TILE)*mh-1,3,2);
  for(const predator of predators)if(!predator.hidden){mapContext.fillStyle="#b55338";const size=predator.species==="wolf"?Math.max(2,cellW*.65):Math.max(1,cellW*.45);mapContext.fillRect(predator.x/(MAP_W*TILE)*mw-size/2,predator.y/(MAP_H*TILE)*mh-size/2,size,size)}
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
createWorld();createRabbitPopulation();createPreyPopulation();createPredatorPopulation();resize();minimapCanvas.width=174;minimapCanvas.height=174;worldMapCanvas.width=840;worldMapCanvas.height=640;camera.x=Math.max(0,player.x-width/2);camera.y=Math.max(0,player.y-height/2);updateSeasonIndicator();redrawMaps();canvas.focus();requestAnimationFrame(loop);
