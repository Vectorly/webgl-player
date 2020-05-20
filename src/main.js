const vvgl = (function(canvas, options={}) {


    const JSZip = require('jszip');

    const msgpack = require("msgpack-lite");


    const WebGLContext = require('./webgl');
    const BezierProgram = require('./programs/bezier');
    const PolygonProgram = require('./programs/polygon');

    const UpdateManager = require('./update');
    const BucketManager = require('./geometry/buckets');
    const ShapeList = require('./geometry/shape_list');


    const vvgl = {};

    const gl = new WebGLContext(canvas);

    const bezierProgram = new BezierProgram(gl);
    const polygonProgram = new PolygonProgram(gl);


    const bezier_buffer = gl.createBuffer();
    const element_array_index_buffer = gl.createBuffer();


    let shape_list;
    let bucket_manager;
    let update_manager;



    let width = 2560;
    let height= 1440;


    const data = {};


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



        gl.useProgram(polygonProgram);
        gl.uniform2fv(polygonProgram.locations["resolution"], [2/width, -2/height]);

        gl.useProgram(bezierProgram);
        gl.uniform2fv(bezierProgram.locations["resolution"], [2/width, -2/height]);

    }













    function load(data, callback) {


        const zip = new JSZip();

        zip.loadAsync(data).then(function(contents) {

            contents.file('data.bl').async('arraybuffer').then(function(content) {

                const json = msgpack.decode(new Uint8Array(content));


                shape_list = new ShapeList(json.shapes);
                bucket_manager = new BucketManager(shape_list.shapes);

                update_manager = new UpdateManager(json.updates, shape_list, json.duration);

                vvgl.duration = update_manager.duration;
                vvgl.frame = update_manager.frame;


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





    function renderShapes2(offset, i) {

        if(data.bucket_index_lengths[i] > 0) gl.drawElements(gl.TRIANGLE_FAN, data.bucket_index_lengths[i],  gl.UNSIGNED_SHORT, offset*2);

        return offset + data.bucket_index_lengths[i];
    }


    function renderShapes(bucket) {

        bucket.shapes.forEach(function (shape) {


            for (let i = 0; i < shape.contours.length; i++){

                if(shape.size > 0 && shape.contours[i].length > 0){


                    gl.drawArrays(gl.TRIANGLE_FAN, shape.offset + shape.contours[i].offset,  shape.contours[i].length);
                }


            }

        });
    }



    function renderBeziers(offset, i) {

        let l = bucket_manager.buckets[i].length;


        if(l > 0){

            bezierProgram.setBufferOffset(offset);
            if(gl.gl2) gl.drawArraysInstanced(gl.TRIANGLE_FAN,  0, bezierProgram.num_bezier_vertices, l);
            else gl.extensions.angle.drawArraysInstancedANGLE(gl.TRIANGLE_FAN,  0, bezierProgram.num_bezier_vertices, l);

        }

        return offset +l;
    }





    function render() {

        gl.clearColor(0, 0, 0, 1.0);
        gl.clear( gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);


        gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);


        polygonProgram.setPointers(bezier_buffer);

        let offset = 0;


        for(let i =0; i < bucket_manager.num_buckets; i++){

            gl.stencilFunc(gl.ALWAYS, i+1 , 0xff);
            gl.stencilMask(i+1);
            gl.depthMask(false);
            gl.colorMask(false, false, false, false);

            if(gl.gl2){
                offset =  renderShapes2(offset, i)
            }  else{

                renderShapes(bucket_manager.buckets[i]);
            }

        }


        offset = 0;
        bezierProgram.setPointers(bezier_buffer);

        gl.stencilOp( gl.KEEP,  gl.KEEP, gl.INVERT);

        for(let i =0; i < bucket_manager.num_buckets; i++){

            gl.stencilFunc(gl.ALWAYS, (i+1) , 0xff);
            gl.stencilMask(i+1);
            gl.depthMask(false);
            gl.colorMask(false, false, false, false);

            offset =  renderBeziers(offset, i);

        }


        polygonProgram.setPointers(bezier_buffer);


        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);


        offset = 0;

        for(let i =0; i < bucket_manager.num_buckets; i++){

            gl.stencilFunc(gl.EQUAL, (i+1) , 0xff);
            gl.stencilMask(i+1);
            gl.depthMask(false);
            gl.colorMask(true, true, true, true);


            if(gl.gl2){
                offset =  renderShapes2(offset, i)
            }  else{
                renderShapes(bucket_manager.buckets[i]);
            }

        }


        offset = 0;


        bezierProgram.setPointers(bezier_buffer);


        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);

        for(let i =0; i < bucket_manager.num_buckets; i++){

            gl.stencilFunc(gl.EQUAL, i+1 , 0xff);
            gl.stencilMask(255-(i+1));
            gl.depthMask(false);
            gl.colorMask(true, true, true, true);

            offset =  renderBeziers(offset, i);

        }

    }


    vvgl.render = render;
    vvgl.load = load;
    vvgl.update = update;

    return vvgl;




});

export default vvgl;