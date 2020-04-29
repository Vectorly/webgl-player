# VVGL Player

WebGL Player for VVID files

VVGL is a WebGL based rendering engine for LRN files. This should be considered an alternative rendering engine to SVG, one of the major components of vv.js.

## Getting started

VVGL uses a node, webpack build environment. Make sure Node, Webpack, Yarn etc... are all installed

*Install dependencies*

    npm install


*data.json*

You need a specially formatted JSON file. One is already included in the vvid folder, and you can generate more from src/encoder.js, which takes in the outputs from vectorization, and outputs a data.json file


*Run demo file*


    yarn JSONFILE=vvid/data.json demo:serve



## Background


## Theory



https://github.com/Vectorly/web-gl-experiments/tree/master/full_frame_holes