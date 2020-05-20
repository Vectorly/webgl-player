const vvgl = (function(canvas, options={}) {


    const JSZip = require('jszip');

    const msgpack = require("msgpack-lite");


    const WebGLContext = require('./webgl');
    const BezierProgram = require('./programs/bezier');
    const PolygonProgram = require('./programs/polygon');

    const UpdateManager = require('./update');
    const BucketManager = require('./geometry/buckets');
    const ShapeList = require('./geometry/shape_list');
    const Renderer = require('./renderer');
    const Camera = require('./camera');


    const vvgl = {};

    const gl = new WebGLContext(canvas);

    const bezierProgram = new BezierProgram(gl);
    const polygonProgram = new PolygonProgram(gl);


    const camera = new Camera(gl, bezierProgram, polygonProgram);

    const bezier_buffer = gl.createBuffer();
    const element_array_index_buffer = gl.createBuffer();


    let shape_list;
    let bucket_manager;
    let update_manager;
    let renderer;


    const array_index = new Uint16Array(50000);
    const bezier_index = new Uint16Array(50000);


    if(gl.gl2){

        array_index.fill(0xffff);
        for(let i = 0; i < bezier_index.length; i++){
            bezier_index[i] = i;
        }

    }


    prepareCanvas();




    function setBufferData() {

        gl.bindBuffer(gl.ARRAY_BUFFER, bezier_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, shape_list.buffer_data, gl.DYNAMIC_DRAW);

    }


    function prepareCanvas() {

        gl.enable(gl.STENCIL_TEST);
        gl.enable(gl.DEPTH_TEST);
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);



        polygonProgram.setPointers(bezier_buffer);

        polygonProgram.enableAttributes();



        bezierProgram.setPointers(bezier_buffer);

        bezierProgram.enableAttributes();

        camera.set();

    }





    function load(data, callback) {


        const zip = new JSZip();

        zip.loadAsync(data).then(function(contents) {

            contents.file('data.bl').async('arraybuffer').then(function(content) {

                const json = msgpack.decode(new Uint8Array(content));


                shape_list = new ShapeList(json.shapes);
                bucket_manager = new BucketManager(shape_list.shapes);

                update_manager = new UpdateManager(json.updates, shape_list, json.duration);

                renderer = new Renderer(gl, bezierProgram, polygonProgram, bucket_manager, bezier_buffer);

                vvgl.duration = update_manager.duration;
                vvgl.frame = update_manager.frame;
                vvgl.render = renderer.render;
                vvgl.update = update;


                setBufferData();
                prepareCanvas();


                callback();



            });
        });




    }



    function update(time) {


        update_manager.update();

        gl.bufferSubData(gl.ARRAY_BUFFER, 0, shape_list.buffer_data, 0, shape_list.buffer_data.length);


        return null;


    }



    vvgl.load = load;


    return vvgl;




});

export default vvgl;