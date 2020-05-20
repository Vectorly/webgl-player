const vvgl = (function(canvas, options={}) {


    const JSZip = require('jszip');

    const msgpack = require("msgpack-lite");

    const math = require('mathjs');

    const WebGLContext = require('./webgl');
    const BezierProgram = require('./programs/bezier');
    const PolygonProgram = require('./programs/polygon');

    const UpdateManager = require('./update');


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



    vvgl.frame = 0;

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



    class Contour {

        constructor(path, start){

            this.length = 0;
            this.curves = [];


            let i = 0;
            let x,y;

            let last_curve = ['m'];

            start[0] += path[0];
            start[1] += path[1];

            i += 2;

            while (i < path.length) {

                let element = path[i];


                if (element === 0) {

                    x = [0, 0, path[i + 1], path[i + 1]].map(x => x + start[0]);
                    y = [0, 0, path[i + 2], path[i + 2]].map(y => y + start[1]);

                    last_curve = ['l'];

                    start[0] = x[3];
                    start[1] = y[3];

                    this.length += 1;
                    this.curves.push(...x, ...y);

                    i += 3;
                } else {


                    if(last_curve && !isNaN(last_curve[0])){

                        let l = last_curve.length;

                        let dx = path[i + 2];
                        let dy = path[i + 3];

                        let norm = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));

                        let nx = -dy/norm;
                        let ny = dx/norm;
                        let fx = dx/norm;
                        let fy = dy/norm;

                        let f2 =  path[i+1];
                        let n =path[i];

                        let c2x = n*nx + f2*fx + dx;
                        let c2y = n*ny + f2*fy + dy;

                        let last_dx = last_curve[l-2];
                        let last_dy = last_curve[l-1];

                        let last_norm = Math.sqrt(Math.pow(last_dx, 2) + Math.pow(last_dy, 2));
                        let last_nx = -last_dy/last_norm;
                        let last_ny = last_dx/last_norm;
                        let last_fx = last_dx/last_norm;
                        let last_fy = last_dy/last_norm;

                        let last_f2 = last_curve[l-3];
                        let last_n = last_curve[0];

                        let px = last_n*last_nx + last_f2*last_fx;
                        let py = last_n*last_ny + last_f2*last_fy;

                        let p = [px, py];
                        let phat = math.divide(p, math.norm(p));

                        let q = math.divide(n, math.dot(phat, [-nx, -ny]));

                        let c1 = math.multiply(phat, -1*q);

                        let c1x = c1[0];
                        let c1y = c1[1];

                        if(Math.abs(c1y) > 200 || Math.abs(c1x) > 200){
                            c1y = 0;
                            c1x = 0;
                        }

                        x = [0, c1x, c2x, dx].map(x => x + start[0]);
                        y = [0, c1y, c2y,dy].map(y => y + start[1]);


                        start[0] = x[3];
                        start[1] = y[3];

                        this.length += 1;
                        this.curves.push(...x, ...y);

                        last_curve = path.slice(i, i+4);
                        i += 4;

                    } else{

                        let dx = path[i + 3];
                        let dy = path[i + 4];

                        let norm = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));




                        let nx = -dy/norm;
                        let ny = dx/norm;
                        let fx = dx/norm;
                        let fy = dy/norm;

                        let f1 = path[i+1];
                        let f2 =  path[i+2];
                        let n =path[i];

                        let c1x = n*nx + f1*fx;
                        let c1y = n*ny + f1*fy;

                        let c2x = n*nx + f2*fx + dx;
                        let c2y = n*ny + f2*fy + dy;


                        x = [0, c1x, c2x, dx].map(x => x + start[0]);
                        y = [0,c1y, c2y,dy].map(y => y + start[1]);

                        start[0] = x[3];
                        start[1] = y[3];

                        this.length += 1;
                        this.curves.push(...x, ...y);


                        last_curve = path.slice(i, i+5);
                        i += 5;

                    }

                }

            }



        }





    }






    class Shape {

        constructor(data){


            this.xy = data.xy;
            this.color = data.color;

            let length = this.set(data.contours);

            this.hidden =data.foreground ? data.hidden: false;

            if(data.foreground) this.size = data.max_curves;
            else this.size = length;


        }


        set(contours){


            this.contours = [];

            let offset= 0;
            let start = [0, 0];



            for (let i=0; i < contours.length; i++){


                let contour = new Contour(contours[i], start);

                contour.offset = offset;

                this.contours.push(contour);

                offset+=contour.length;


            }

            return offset;




        }

        update(update){


            if(update.type ==="morph"){
                this.set(update.contours);
            } else if(update.type === "show"){
                this.hidden = false;
            } else if(update.type === "hide"){




                this.hidden = true;
            }



        }



        getBufferData(){

            const data = new Float32Array(this.size*13);
            const shape = this;

            let offset = 0;

            for (let i = 0; i < this.contours.length; i++){


                let contour = this.contours[i];

                for (let j = 0; j < contour.length; j++){


                    data.set(contour.curves.slice(j*8, (j+1)*8), offset);
                    data.set(shape.xy, offset+8);
                    data.set(shape.color, offset+10);


                    offset+=13;

                }




            }


            return data;
        }



    }



    class ShapeList {

        constructor(shapes){


            this.shapes = [];
            this.index = {};

            this.errors = {};

            let size = 0;

            for (let i=0; i < shapes.length; i++){

                let shape =  new Shape(shapes[i]);
                shape.offset  = size;


                size += shape.size;

                this.index[shape.id] = shape;
                this.shapes.push(shape);


            }


            this.size = size;

            this.buffer_data = this.getBufferData();

        }

        getBufferData(){


            const bezier_buffer_data = new Float32Array((this.size+1)*13);


            this.shapes.forEach(function (shape) {
                if(shape.hidden) return null;

                bezier_buffer_data.set(shape.getBufferData(), shape.offset*13);
            });



            return bezier_buffer_data;
        }

        update(update){

            let shape = this.shapes[update.i];

            shape.update(update);


            this.buffer_data.fill(0,shape.offset*13, (shape.offset + shape.size)*13);

            if(!shape.hidden){


                this.buffer_data.set(shape.getBufferData(), shape.offset*13);
            }


        }

    }

    class Bucket{

        constructor(shapes){

            this.shapes = shapes;
            this.length = 0;

            for(const shape of shapes){
                this.length+= shape.size;
            }


        }

        push(shape){

            this.shapes.push(shape);
            this.length += shape.size;
        }

    }




    class BucketManager{


        constructor(shapes){

            this.num_buckets = 250;

            const shapes_per_bucket = Math.ceil(shapes.length / this.num_buckets);

            this.buckets = [];

            for(let i = 0; i <  this.num_buckets; i++){

                if (i === this.num_buckets- 1){
                    this.buckets.push(new Bucket(shapes.slice(i*shapes_per_bucket)));
                } else{
                    this.buckets.push(new Bucket(shapes.slice(i*shapes_per_bucket, (i+1)*shapes_per_bucket)));
                }
            }


        }
    }








    function load(data, callback) {


        const zip = new JSZip();

        zip.loadAsync(data).then(function(contents) {

            contents.file('data.bl').async('arraybuffer').then(function(content) {

                const json = msgpack.decode(new Uint8Array(content));


                shape_list = new ShapeList(json.shapes);
                bucket_manager = new BucketManager(shape_list.shapes);

                update_manager = new UpdateManager(vvgl, json.updates, shape_list, json.duration);


                vvgl.duration = update_manager.duration;


                setBufferData();
                prepareCanvas();


                callback();



            });
        });




    }



    function update(time) {

        vvgl.frame ++;

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