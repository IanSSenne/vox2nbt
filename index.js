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
for (let i = 0; i < files.length; i++) {
  try {
    let pallette = [];
    function createBlock(pos, state) {
      id = pallette.findIndex((item) => item.Name.value === state);
      if (id === -1) {
        id = pallette.length;
        pallette.push({
          Name: {
            type: "string",
            value: state,
          },
        });
      }
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
    let p = files[i];
    const data = pmv(fs.readFileSync(p));
    console.log(data);
    const colors = data.RGBA.map(toHex);
    debugger;
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
              const colorData = colors[cube.c];
              if (!config[colorData]) {
                console.log(`Error: color ${colorData} not found in config.`);
                process.exit(1);
              }
              const blockData = config[colorData];

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
    fs.writeFileSync(p.replace(/\.vox$/g,"") + ".nbt", zlib.gzipSync(nbtlib.writeUncompressed(nbt)));
  } catch (e) {
    console.log(`error converting file '${files[i]}'`);
    console.log(e);
  }
}