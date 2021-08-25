#!/usr/bin/env node

const pmv = require("parse-magica-voxel");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const nbtlib = require("@bedrocker/mc-nbt");
if (!process.argv[2]) {
  console.log(`vox2nbt <file/directory> <config>

converts a .vox file to a minecraft structure file.

`);
  process.exit(0);
}
const file = path.resolve(process.cwd(), process.argv[2]);
const isFolder = fs.statSync(file).isDirectory();
const config = require(path.resolve(process.cwd(), process.argv[3]));
const Colors = Object.keys(config).filter(_=>_!=="_").map(item=>[toRgba(item),item]);
let files = [];
if (!isFolder) {
  files = [file];
} else {
  files = fs
    .readdirSync(file)
    .map((item) => path.resolve(file, item))
    .filter((item) => item.endsWith(".vox"));
}

const d = (v) => v.toString(16).padStart(2, "0");
function toHex({ r, g, b, a }) {
  return d(r) + d(g) + d(b) + d(a);
}
function toRgba(hex){
  const v = parseInt(hex,16);
  return {
    r:v>>24,
    g:v>>16 & 255,
    b:v>>8 & 255,
    a:v & 255
  }
}
const seenWarnings = new Set();
for (let i = 0; i < files.length; i++) {
  try {
    let p = files[i];
    console.log('loading',p);
    const data = pmv(fs.readFileSync(p));
    let set = 0n;
    const an = data.SIZE.x;
    const bn = data.SIZE.z*an;
    let pallette = [];
    function createBlock(pos, state,track=false) {
      id = pallette.findIndex((item) => item.Name.value === state);
      if (id === -1) {
        id = pallette.length;
        pallette.push({
          Name: {
            type: "string",
            value: state,
          },
        });
        // console.log(pallette.at(-1),id,pos);
      }
      if(track)set = set | 1n<<BigInt(pos[0]+pos[1]*an+pos[2]*bn);
      return {
        pos: {
          type: "list",
          value: {
            type: "int",
            value: pos,
          },
        },
        state: {
          type: "int",
          value: id,
        },
      };
    }
    const colors = data.RGBA.map(toHex);
    const nbt = {
      type: "compound",
      name: "",
      value: {
        size: {
          type: "list",
          value: {
            type: "int",
            value: [data.SIZE.x, data.SIZE.z, data.SIZE.y],
          },
        },
        entities: {
          type: "list",
          value: {
            type: "end",
            value: [],
          },
        },
        DataVersion: {
          type: "int",
          value: 2584,
        },
        blocks: {
          type: "list",
          value: {
            type: "compound",
            value: data.XYZI.map((cube) => {
              const colorData = colors[cube.c-1];
              let blockData = config[colorData];
              if(blockData === "minecraft:stone")debugger;
              if (!blockData) {

                if(!seenWarnings.has(colorData)){
                  seenWarnings.add(colorData);
                  console.log(`Warn: exact color ${colorData} not found in config.`);
                }
                const rgba = data.RGBA[cube.c];
                const distances = Colors.map(([item])=>{
                  return Math.sqrt((item.r-rgba.r)**2+(item.g-rgba.g)**2+(item.b+rgba.b)**2+(item.a+rgba.a)**2);
                });
                const color = Colors[distances.indexOf(Math.min(...distances))];
                blockData = config[color[1]]
              }

              return createBlock([cube.x, cube.z,cube.y ], blockData);
            }),
          },
        },
        palette: {
          type: "list",
          value: {
            type: "compound",
            value: pallette,
          },
        },
      },
    };
    if(config._){
      // fs.writeFileSync("./temp.txt",set.toString(2).length.toString());
      const total = data.SIZE.x * data.SIZE.y * data.SIZE.z;
      const percent = Math.floor(total/100);
      console.log(`filling ${total} blocks with default`);
      let proc = 0;
      const b = nbt.value.blocks.value.value;
      for(let x = 0;x<data.SIZE.x;x++){
        for(let y = 0;y<data.SIZE.y;y++){
          for(let z = 0;z<data.SIZE.z;z++){
            const index = x + y * an + z * bn;
            proc++;
            if(proc%percent === 0)console.log((proc/percent).toFixed(2)+"%");
            if(set & (1n<<BigInt(index))){
              b.push(createBlock([x,z,y],config._,true));
            }
          }
        }
      }
    }
    fs.writeFileSync(p.replace(/\.vox$/g,"") + ".nbt", zlib.gzipSync(nbtlib.writeUncompressed(nbt)));
  } catch (e) {
    console.log(`error converting file '${files[i]}'`);
    console.log(e);
  }
}
