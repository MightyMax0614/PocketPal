/** Mechanical sprite extraction only. Artwork is authored by ImageGen.
 * Reads accepted raw sheets, crops each pose, normalizes a common scale and
 * baseline, and packages 96x96 white-matte playback atlases without recoloring
 * characters or synthesizing animation poses. Original sheets remain intact.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEST = path.join(ROOT, 'characters/originals/animations');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const config = JSON.parse(await fs.readFile(path.join(DEST, 'sources.json'), 'utf8'));
const actions = [
  {name:'idle', label:'대기 · 눈 깜빡임', fps:4},
  {name:'walk', label:'걷기', fps:8},
  {name:'talk', label:'대화', fps:6},
  {name:'sleep', label:'수면', fps:3}
];
const F = 96, BASELINE = 89, MAX_ART = 80;
const report = [];
for (const source of config.characters) {
  const input = path.join(ROOT, source.path);
  const metadata = await sharp(input).metadata();
  if (metadata.width !== 1536 || metadata.height !== 1024) throw new Error(`${source.id}: unexpected raw sheet size`);
  const pixels = await sharp(input).removeAlpha().raw().toBuffer();
  const rowEdges = source.row_edges || [0,256,512,768,1024];
  const columnEdges = source.column_edges || [0,256,512,768,1024,1280,1536];
  const frames = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 6; col++) {
      const left = columnEdges[col], right = columnEdges[col+1], top = rowEdges[row], bottom = rowEdges[row+1];
      let x0=right,y0=bottom,x1=-1,y1=-1;
      // Bounds detection never removes background pixels from the resulting art.
      // Dark outlines define the crop; bright eyes/teeth inside the crop survive.
      for (let y=top; y<bottom; y++) for (let x=left; x<right; x++) {
        const p = (y*1536+x)*3;
        const r=pixels[p],g=pixels[p+1],b=pixels[p+2];
        if (Math.min(r,g,b) < 185 || Math.max(r,g,b)-Math.min(r,g,b)>65) {
          x0=Math.min(x0,x); y0=Math.min(y0,y); x1=Math.max(x1,x); y1=Math.max(y1,y);
        }
      }
      if (x1<0) throw new Error(`${source.id}: empty cell ${row},${col}`);
      if (x0<=left || x1>=right-1 || y0<=top || y1>=bottom-1) throw new Error(`${source.id}: artwork touches crop boundary ${row},${col}`);
      frames.push({row,col,left:x0-1,top:y0-1,width:x1-x0+3,height:y1-y0+3});
    }
  }
  const scale = Math.min(MAX_ART/Math.max(...frames.map(f=>f.width)),MAX_ART/Math.max(...frames.map(f=>f.height)));
  const output = path.join(DEST,source.id);
  await fs.mkdir(output,{recursive:true});
  const composites=[],frameBuffers=[],frameManifest=[];
  for (const frame of frames) {
    const width=Math.round(frame.width*scale),height=Math.round(frame.height*scale);
    const art=await sharp(input).extract({left:frame.left,top:frame.top,width:frame.width,height:frame.height}).resize(width,height,{kernel:'nearest'}).removeAlpha().png().toBuffer();
    const x=Math.floor((F-width)/2),y=BASELINE-height;
    const buffer=await sharp({create:{width:F,height:F,channels:3,background:'#ffffff'}}).composite([{input:art,left:x,top:y}]).png().toBuffer();
    frameBuffers.push(buffer);
    composites.push({input:buffer,left:frame.col*F,top:frame.row*F});
    frameManifest.push({...frame,output_x:x,output_y:y,output_width:width,output_height:height,sha256:hash(buffer)});
  }
  const atlas=await sharp({create:{width:F*6,height:F*4,channels:3,background:'#ffffff'}}).composite(composites).png({compressionLevel:9}).toBuffer();
  await fs.writeFile(path.join(output,'atlas-v1.png'),atlas);
  const clips=[];
  for(let row=0;row<4;row++){
    const strip=await sharp({create:{width:F*6,height:F,channels:3,background:'#ffffff'}}).composite(frameBuffers.slice(row*6,row*6+6).map((input,col)=>({input,left:col*F,top:0}))).png().toBuffer();
    await fs.writeFile(path.join(output,actions[row].name+'.png'),strip);
    const unique=new Set(frameManifest.slice(row*6,row*6+6).map(f=>f.sha256)).size;
    if(unique<3)throw new Error(`${source.id}: insufficient unique poses in ${actions[row].name}`);
    clips.push({...actions[row],row,frames:6,unique_frames:unique,strip:`characters/originals/animations/${source.id}/${actions[row].name}.png`,sha256:hash(strip)});
  }
  const manifest={
    schema_version:1,id:source.id,status:'animation_prototype',source:source.path,source_sha256:hash(await fs.readFile(input)),
    atlas:`characters/originals/animations/${source.id}/atlas-v1.png`,atlas_sha256:hash(atlas),
    frame_width:F,frame_height:F,atlas_width:F*6,atlas_height:F*4,columns:6,rows:4,
    background:'#ffffff',transparent_background:false,pixel_grid:'96x96 nearest-neighbour extraction',
    authored_with:'built-in ImageGen',processing:'crop, constant scale per character, feet baseline, white-matte packing',
    production_ready:false,clips,frames:frameManifest,
    limitations:['AI-authored animation draft; pose consistency still needs refinement.','White matte, not a transparent sprite.','No rig, attachment points, back view or Mac Lab companion integration.']
  };
  await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  report.push({id:source.id,frames:frames.length,scale,clips:clips.map(c=>({name:c.name,unique:c.unique_frames})),atlas_bytes:atlas.length});
}
console.log(JSON.stringify(report,null,2));
