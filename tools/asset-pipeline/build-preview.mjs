/** Produce an animated contact sheet from the same atlas frames as the catalog. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp');
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const DEST=path.join(ROOT,'characters/originals/animations');
const ids=['H1','D1','A3','A4'];
const names=['Adventurer','Gentle Dino','Hippo','Pig'];
const actions=['IDLE + BLINK','WALK','TALK','SLEEP'];
const fps=[4,8,6,3],width=960,height=348;
const atlases=await Promise.all(ids.map(id=>fs.readFile(path.join(DEST,id,'atlas-v1.png'))));
const frames=await Promise.all(atlases.map(async atlas=>Promise.all(Array.from({length:24},(_,n)=>sharp(atlas).extract({left:n%6*96,top:Math.floor(n/6)*96,width:96,height:96}).resize(192,192,{kernel:'nearest'}).png().toBuffer()))));
const pages=[],delays=[];
for(let row=0;row<4;row++){
 const heading=Buffer.from(`<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="white"/><g font-family="DejaVu Sans,sans-serif" fill="#263a32"><text x="24" y="35" font-size="21" font-weight="bold">PocketPal</text><text x="936" y="33" font-size="14" text-anchor="end">ORIGINAL ANIMATION DRAFTS</text><text x="480" y="78" font-size="21" font-weight="bold" text-anchor="middle">${actions[row]}</text>${ids.map((id,i)=>`<text x="${i*240+120}" y="326" text-anchor="middle" font-size="16">${id} / ${names[i]}</text>`).join('')}</g></svg>`);
 const base=await sharp(heading).png().toBuffer();
 for(let step=0;step<12;step++){
  const frame=step%6;
  const composite=sharp(base).composite(frames.map((arr,i)=>({input:arr[row*6+frame],left:i*240+24,top:106})));
  if(step===0&&row===0)await composite.clone().png().toFile(path.join(DEST,'PocketPal_Original_Animation_Preview.png'));
  pages.push(await composite.removeAlpha().raw().toBuffer());
  delays.push(Math.round(1000/fps[row]));
 }
}
const dest=path.join(DEST,'PocketPal_Original_Animation_Preview.gif');
const gif=await sharp(Buffer.concat(pages),{raw:{width,height:height*pages.length,channels:3,pageHeight:height}}).gif({loop:0,delay:delays,colours:256,dither:0}).toBuffer();
if(gif[gif.length-1]!==0x3b)throw new Error('GIF trailer is missing');
await fs.writeFile(dest,gif);
const metadata=await sharp(dest,{animated:true}).metadata();
if(metadata.pages!==48)throw new Error(`Expected 48 GIF frames, got ${metadata.pages}`);
await sharp(dest,{animated:true}).raw().toBuffer();
console.log(JSON.stringify({path:dest,frames:metadata.pages,width:metadata.width,pageHeight:metadata.pageHeight,bytes:gif.length,decoded:true}));
