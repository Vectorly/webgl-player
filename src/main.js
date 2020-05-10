const vvgl = (function(canvas, options={}) {


    const vvgl = this;

    const {context, isWebGL2} = getContext(canvas);

    const gl = context;

    let shape_list;
    let bucket_manager;



    const bezierProgram = initBezierProgram();
    const polygonProgram = initPolygonProgram();

    const t_buffer = gl.createBuffer();
    const bezier_buffer = gl.createBuffer();
    const element_array_index_buffer = gl.createBuffer();

    gl.useProgram(bezierProgram);
    const {bezierLocations, bezierAttributes} = getBezierVariableLocations(bezierProgram);

    gl.useProgram(polygonProgram);
    const {polygonLocations, polygonAttributes} = getPolygonVariableLocations(polygonProgram);


    const t_array = [];


    let width = 2560;
    let height= 1440;

    let offset_w = 0;
    let offset_h = 0;


    const  num_bezier_vertices = initBuffers();

    let frame = 0;

    const data = {};
    const extensions = {};

    const array_index = new Uint16Array(50000);
    const bezier_index = new Uint16Array(50000);


    if(isWebGL2){

        array_index.fill(0xffff);
        for(let i = 0; i < bezier_index.length; i++){
            bezier_index[i] = i;
        }

    } else{
        extensions.angle = gl.getExtension('ANGLE_instanced_arrays');
    }






    function getContext(canvas) {

       // let context = document.getElementById(canvas).getContext("webgl2", {stencil:true});

        let context;

        let isWebGL2 = (typeof  context !== "undefined");


        if(!isWebGL2) context = document.getElementById(canvas).getContext("webgl", {stencil:true});

        return {context, isWebGL2};
    }


    function createAndCompileShader(type, source) {
        let shader = gl.createShader(type);

        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(shader));
        }

        return shader;
    }

    function createAndLinkProgram(glVertexShader, glFragmentShader) {
        let glProgram = gl.createProgram();

        gl.attachShader(glProgram, glVertexShader);
        gl.attachShader(glProgram, glFragmentShader);
        gl.linkProgram(glProgram);

        if (!gl.getProgramParameter(glProgram, gl.LINK_STATUS)) {
            throw new Error("Could not initialise shaders");
        }

        return glProgram;
    }


    function initBezierProgram() {

        const gVertexShader = createAndCompileShader(gl.VERTEX_SHADER, [

            "attribute vec4 t_vector;",
            "attribute vec4 x_vector;",
            "attribute vec4 y_vector;",
            "attribute vec3 color;",
            "attribute vec2 offset;",
            "uniform vec2 camera_offset;",
            "uniform vec2 resolution;",
            "varying lowp vec3 vColor;",

            "void main(void) {",

            "vec2 point = (vec2(dot(t_vector, x_vector), dot(t_vector, y_vector)) + offset + camera_offset)*resolution - 1.0;",
            "vColor = color/256.0;",
            "gl_Position = vec4(point, 0, 1);",
            "}"
        ].join("\n"));


        let gFragmentShader = createAndCompileShader(gl.FRAGMENT_SHADER, [
            "varying lowp vec3 vColor;",
            "void main(void) {",
            "gl_FragColor = vec4(vColor, 1);",
            "}"
        ].join("\n"));


        return createAndLinkProgram(gVertexShader, gFragmentShader);
    }




    function initPolygonProgram() {

        let gVertexShader = createAndCompileShader(gl.VERTEX_SHADER, [
            "attribute float x1;",
            "attribute float y1;",
            "attribute vec3 color;",
            "attribute vec2 offset;",
            "uniform vec2 resolution;",
            "uniform vec2 camera_offset;",
            "varying lowp vec3 vColor;",
            "void main(void) {",

            "vec2 point = (vec2(x1, y1)+offset + camera_offset)*resolution - 1.0; ",

            "vColor = color/256.0;",
            "gl_Position = vec4(point, 0, 1.0);",
            "}"
        ].join("\n"));

        let gFragmentShader = createAndCompileShader(gl.FRAGMENT_SHADER, [
            "varying lowp vec3 vColor;",
            "void main(void) {",
            "gl_FragColor = vec4(vColor, 1);",
            "}"
        ].join("\n"));

        return createAndLinkProgram(gVertexShader, gFragmentShader);
    }


    function getBezierVariableLocations(program) {

        const locations = {};


        const uniforms = ["resolution", "camera_offset"];
        const attributes = ["t_vector", "x_vector", "y_vector",  "offset", "color"];


        uniforms.forEach(key => locations[key] = gl.getUniformLocation(program, key));
        attributes.forEach(key => locations[key] = gl.getAttribLocation(program, key));



        return {bezierLocations: locations, bezierAttributes: attributes};

    }



    function getPolygonVariableLocations(program) {

        const locations = {};


        const uniforms = ["resolution", "camera_offset"];
        const attributes = [ "offset", "color", "x1", "y1"];


        uniforms.forEach(key => locations[key] = gl.getUniformLocation(program, key));
        attributes.forEach(key => locations[key] = gl.getAttribLocation(program, key));


        return {polygonLocations: locations, polygonAttributes: attributes};

    }



    function initBuffers() {


        let step = 5;


        for (let i=0; i <= step; i++){

            let t = i/step;

            t_array.push(Math.pow(1-t, 3));
            t_array.push(3*t*Math.pow(1-t, 2));
            t_array.push(3*(1-t)*Math.pow(t, 2));
            t_array.push(Math.pow(t, 3));

        }



        return t_array.length/4;


    }



    function prepareCanvas() {

        gl.enable(gl.STENCIL_TEST);
        gl.enable(gl.DEPTH_TEST);
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);


        polygonPointers();

        polygonAttributes.forEach(function (attribute) {
            gl.enableVertexAttribArray(polygonLocations[attribute]);
        });



        bezierPointers();

        bezierAttributes.forEach(function (attribute) {
            gl.enableVertexAttribArray(bezierLocations[attribute]);
        });



        gl.useProgram(polygonProgram);
        gl.uniform2fv(polygonLocations["resolution"], [2/width, 2/height]);

        gl.useProgram(bezierProgram);
        gl.uniform2fv(bezierLocations["resolution"], [2/width, 2/height]);

    }


    function setBufferData() {



        const bezier_buffer_data = new Float32Array((shape_list.size+1)*13);

        bezier_buffer_data.set(shape_list.getBufferData(), 0);


        gl.bindBuffer(gl.ARRAY_BUFFER, bezier_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, bezier_buffer_data, gl.DYNAMIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, t_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(t_array), gl.STATIC_DRAW);


    }




    function setCamera(scene) {



        width = scene.width;
        height = scene.height;


        offset_w = scene.offset_w;
        offset_h = scene.offset_h;


        gl.useProgram(polygonProgram);
        gl.uniform2fv(polygonLocations["resolution"], [2/width, -2/height]);
        gl.uniform2fv(polygonLocations["camera_offset"], [offset_w, offset_h]);

        gl.useProgram(bezierProgram);
        gl.uniform2fv(bezierLocations["resolution"], [2/width, -2/height]);
        gl.uniform2fv(bezierLocations["camera_offset"], [offset_w, offset_h]);

    }


    function updateCamera(update) {

        width = update.w - update.x;
        height = update.h - update.y;

        let offset_x = offset_w - update.x;
        let offset_y = offset_h - update.y-260;


        gl.useProgram(polygonProgram);
        gl.uniform2fv(polygonLocations["resolution"], [2/width, 2/height]);
        gl.uniform2fv(polygonLocations["camera_offset"], [offset_x, offset_y ]);

        gl.useProgram(bezierProgram);
        gl.uniform2fv(bezierLocations["resolution"], [2/width, 2/height]);
        gl.uniform2fv(bezierLocations["camera_offset"], [offset_x, offset_y]);



    }


    function update(time) {

        frame ++;

        const updates = data.updates[frame];

        if(!updates) return null;

        updates.forEach(function (update) {


            if(update.type === "camera") return updateCamera(update);

            let shape_id = update.i;


            let shape = data.shapes[shape_id];

            let offset = data.offsets[shape_id]*13;


            data.bezier_buffer.fill(0, offset, offset + shape.max_curves*13);

            if(update.type === "hide") return null;

            for(let j = 0; j < update.bezier_curves.length; j++){
                let curve = update.bezier_curves[j];

                let idx = offset + j*13;

                data.bezier_buffer.set(curve, idx);

                data.bezier_buffer.set(shape.data, idx+8);

            }

            if(update.type === "morph") {


                let contour_offsets = new Array(update.contour_lengths.length);

                let contour_offset= shape.offset;
                let index_offset = 0;

                if(isWebGL2) array_index.fill(0xffff, shape.index_offset,   shape.index_offset + shape.max_curves + shape.max_contours );


                for(let j = 0; j < update.contour_lengths.length; j++){

                    if(isWebGL2) array_index.set(bezier_index.slice(contour_offset,  contour_offset + update.contour_lengths[j]), index_offset + shape.index_offset);
                    else contour_offsets[j] = contour_offset;
                    index_offset +=  update.contour_lengths[j] + 1;
                    contour_offset +=  update.contour_lengths[j];

                }


                if(!isWebGL2){
                    data.shapes[shape_id].contour_lengths = update.contour_lengths;
                    data.shapes[shape_id].contour_offsets = contour_offsets;
                }



            }

        });


        if(isWebGL2){
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, element_array_index_buffer);
            gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0,  array_index ,  0, data.foreground_index_length);
            gl.bindBuffer(gl.ARRAY_BUFFER, bezier_buffer);
        }

        gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.bezier_buffer, 0, data.foreground_length);

    }

    function polygonPointers() {

        gl.useProgram(polygonProgram);


        gl.bindBuffer(gl.ARRAY_BUFFER, bezier_buffer);
        gl.vertexAttribPointer(polygonLocations["x1"], 4, gl.FLOAT, false, 52, 0);
        gl.vertexAttribPointer(polygonLocations["y1"], 4, gl.FLOAT, false, 52, 16);
        gl.vertexAttribPointer(polygonLocations["offset"], 4, gl.FLOAT, false, 52, 32);
        gl.vertexAttribPointer(polygonLocations["color"], 4, gl.FLOAT, false, 52, 40);


        if(isWebGL2){
            gl.vertexAttribDivisor(polygonLocations["x1"], 0);
            gl.vertexAttribDivisor(polygonLocations["y1"], 0);
            gl.vertexAttribDivisor(polygonLocations["color"], 0);
            gl.vertexAttribDivisor(polygonLocations["offset"], 0);
        } else{

            extensions.angle.vertexAttribDivisorANGLE(polygonLocations["x1"], 0);
            extensions.angle.vertexAttribDivisorANGLE(polygonLocations["y1"], 0);
            extensions.angle.vertexAttribDivisorANGLE(polygonLocations["color"], 0);
            extensions.angle.vertexAttribDivisorANGLE(polygonLocations["offset"], 0);
        }



    }

    function bezierPointers() {

        gl.useProgram(bezierProgram);


        gl.bindBuffer(gl.ARRAY_BUFFER, t_buffer);
        gl.vertexAttribPointer(bezierLocations["t_vector"], 4, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, bezier_buffer);

        gl.vertexAttribPointer(bezierLocations["x_vector"], 4, gl.FLOAT, false, 52, 0);
        gl.vertexAttribPointer(bezierLocations["y_vector"], 4, gl.FLOAT, false, 52, 16);
        gl.vertexAttribPointer(bezierLocations["offset"], 4, gl.FLOAT, false, 52, 32);
        gl.vertexAttribPointer(bezierLocations["color"], 4, gl.FLOAT, false, 52, 40);

        
        if(isWebGL2){
            gl.vertexAttribDivisor(bezierLocations["x_vector"], 1);
            gl.vertexAttribDivisor(bezierLocations["y_vector"], 1);
            gl.vertexAttribDivisor(bezierLocations["color"], 1);
            gl.vertexAttribDivisor(bezierLocations["offset"], 1);

        } else {
            extensions.angle.vertexAttribDivisorANGLE(bezierLocations["x_vector"], 1);
            extensions.angle.vertexAttribDivisorANGLE(bezierLocations["y_vector"], 1);
            extensions.angle.vertexAttribDivisorANGLE(bezierLocations["color"], 1);
            extensions.angle.vertexAttribDivisorANGLE(bezierLocations["offset"], 1);
        }


    }


    function renderShapes2(offset, i) {

        if(data.bucket_index_lengths[i] > 0) gl.drawElements(gl.TRIANGLE_FAN, data.bucket_index_lengths[i],  gl.UNSIGNED_SHORT, offset*2);

        return offset + data.bucket_index_lengths[i];
    }


    function renderShapes(bucket) {

        bucket.shapes.forEach(function (shape) {

            for (let i = 0; i < shape.contours.length; i++){

                if(shape.size > 0 && shape.contours[i].size > 0){

                    gl.drawArrays(gl.TRIANGLE_FAN, shape.offset + shape.contours[i].offset,  shape.contours[i].size);
                }


            }

        });
    }




    function renderBeziers(offset, i) {

        let l = bucket_manager.buckets[i].length;


        if(l > 0){

            gl.vertexAttribPointer(bezierLocations["x_vector"], 4, gl.FLOAT, false, 52, 52*offset);
            gl.vertexAttribPointer(bezierLocations["y_vector"], 4, gl.FLOAT, false, 52, 16 + 52*offset);
            gl.vertexAttribPointer(bezierLocations["offset"], 4, gl.FLOAT, false, 52, 32 + 52*offset);
            gl.vertexAttribPointer(bezierLocations["color"], 4, gl.FLOAT, false, 52, 40 + 52*offset);

            if(isWebGL2) gl.drawArraysInstanced(gl.TRIANGLE_FAN,  0, num_bezier_vertices, l);
            else extensions.angle.drawArraysInstancedANGLE(gl.TRIANGLE_FAN,  0, num_bezier_vertices, l);

        }

        return offset +l;
    }



    function render() {

        gl.clearColor(0, 0, 0, 1.0);
        gl.clear( gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);


        gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);

        polygonPointers();

        let offset = 0;


        for(let i =0; i < bucket_manager.num_buckets; i++){

            gl.stencilFunc(gl.ALWAYS, i+1 , 0xff);
            gl.stencilMask(i+1);
            gl.depthMask(false);
            gl.colorMask(false, false, false, false);

            if(isWebGL2){
                offset =  renderShapes2(offset, i)
            }  else{

                renderShapes(bucket_manager.buckets[i]);
            }

        }


        offset = 0;
        bezierPointers();

        gl.stencilOp( gl.KEEP,  gl.KEEP, gl.INVERT);

        for(let i =0; i < bucket_manager.num_buckets; i++){

            gl.stencilFunc(gl.ALWAYS, (i+1) , 0xff);
            gl.stencilMask(i+1);
            gl.depthMask(false);
            gl.colorMask(false, false, false, false);

            offset =  renderBeziers(offset, i);

        }


        polygonPointers();


        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);


        offset = 0;

        for(let i =0; i < bucket_manager.num_buckets; i++){

            gl.stencilFunc(gl.EQUAL, (i+1) , 0xff);
            gl.stencilMask(i+1);
            gl.depthMask(false);
            gl.colorMask(true, true, true, true);


            if(isWebGL2){
                offset =  renderShapes2(offset, i)
            }  else{
                renderShapes(bucket_manager.buckets[i]);
            }

        }


        offset = 0;


        bezierPointers();
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);

        for(let i =0; i < bucket_manager.num_buckets; i++){

            gl.stencilFunc(gl.EQUAL, i+1 , 0xff);
            gl.stencilMask(255-(i+1));
            gl.depthMask(false);
            gl.colorMask(true, true, true, true);

            offset =  renderBeziers(offset, i);

        }

    }

    function step() {

        update();

        render();

        if(frame < data.updates.length) return window.requestAnimationFrame(step);
        else{
            console.log(`Done`);
        }
    }



    function play() {

        render();
       // window.requestAnimationFrame(step);

    }


    class KeyPoint {

        constructor(point){

            this.x = point[0];
            this.y = point[1];
        }

        update(dx, dy){

            this.x = this.x + dx;
            this.y = this.y + dy;

        }


    }

    class Segment{

        constructor(curves, key_first, key_last){

            this.curves = [];
            this.key_first = key_first;
            this.key_last = key_last;

            this.size = curves.length;

            let start = key_first;
            let end = key_last;



            for( let i = 0; i < curves.length; i++){

                let curve = curves[i];

                if(i === curves.length - 1){

                    if(curve.length ===0)curve = [start.x, start.x, end.x, end.x, start.y, start.y, end.y, end.y];
                    else curve = [start.x,  curve[0], curve[1], end.x, start.y,curve[2], curve[3], end.y];


                } else {


                    if(curve.length ===2)curve = [start.x, start.x, curve[0], curve[0], start.y, start.y,curve[1], curve[1] ];
                    else curve = [start.x,  curve[0], curve[1], curve[2], start.y,curve[3], curve[4], curve[5]];

                }




                start = {x: curve[3], y: curve[7]};

                this.curves.push(curve);


            }


        }

        update_curve(new_curve){


        }



    }




    class Contour {

        constructor(data){


            let key_points = data[0];
            let segments = data[1];

            let l = segments.length;

            let size = 0;

            this.segments = [];
            this.key_points = [];



            for (let i =0; i < l; i++){
                this.key_points.push(new KeyPoint(key_points[i]));
            }


            for (let i =0; i < l; i++){

                let segment = new Segment(segments[i], this.key_points[i], this.key_points[(i+1)%l]);
                segment.offset = size;
                this.segments.push(segment);
                size +=segment.size;
            }

            this.size = size;


        }




    }




    class Shape {

        constructor(data){


            this.xy = data.xy;
            this.size = data.max_curves;
            this.id = data.rid;
            this.color = data.color;

            this.contours = [];

            let offset= 0;

            for (let i=0; i < data.contours.length; i++){

                let contour = new Contour(data.contours[i]);

                contour.offset = offset;
                this.contours.push(contour);

                offset+=contour.size;


            }



        }

        getBufferData(){


            const data = new Float32Array(this.size*13);
            const shape = this;


            for (let i = 0; i < this.contours.length; i++){

                let contour = this.contours[i];



                for(let j = 0; j < contour.segments.length; j++){

                    let segment = contour.segments[j];


                    for (let k = 0; k < segment.curves.length;k++){

                        let offset = (contour.offset + segment.offset + k)*13;

                        data.set(segment.curves[k], offset);

                        data.set(shape.xy, offset+8);
                        data.set(shape.color, offset+10);

                    }


                }

            }



            return data;
        }



    }

    class ShapeList {

        constructor(shapes){


            this.shapes = [];

            let size = 0;

            for (let i=0; i < shapes.length; i++){

                let shape =  new Shape(shapes[i]);
                shape.offset  = size;

                size += shape.size;

                this.shapes.push(shape);

            }


            this.size = size;

        }

        getBufferData(){

            let data = [];

            this.shapes.forEach(function (shape) {
                data.push.apply(data, shape.getBufferData());
            });


            return data;
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

            this.num_buckets = 50;

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





    function load(json) {

        shape_list = new ShapeList(json.shapes);
        bucket_manager = new BucketManager(shape_list.shapes);

        setBufferData();
        prepareCanvas();


    }





    return {
        load: load,
        play: play
    };




});

export default vvgl;


/*
    function setBezierData(json) {


        const bezier_buffer_data = new Float32Array(json.num_bezier_curves*13);

        const foreground_shapes = json.foreground_shapes;
        const background_shapes = json.background_shapes;

        let offset = 0;
        let curves = 0;

        let background_offset = 0;


        const shapes = [...foreground_shapes, ...background_shapes];

        shapes[shapes.length-1].contour_lengths[0] = shapes[shapes.length-1].contour_lengths[0]-1;

        const offsets = new Array(shapes.length);


        for(let i =0; i <shapes.length; i++){

            let shape = shapes[i];

            shapes[i].offset = offset;

            offsets[i] = offset;

            if(!shape.foreground && !background_offset) background_offset = offset;


            for(let j = 0; j < shape.bezier_curves.length; j++){
                let curve = shape.bezier_curves[j];

                let idx = offset*13 + j*13;

                if(!shape.hidden) bezier_buffer_data.set(curve, idx);

                bezier_buffer_data.set(shape.data, idx+8);
                curves++;

            }

            offset += shape.max_curves;

        }


        let background_index_offset = 0;

        let shape_index_offset = 0;

        for(let i =0; i <shapes.length; i++){


            if(!isWebGL2) shapes[i].contour_offsets = new Array(shapes[i].contour_lengths.length);

            let contour_offset= shapes[i].offset;

            let index_offset = 0;

            shapes[i].index_offset = shape_index_offset;

            if(!shapes[i].foreground && !background_offset) background_index_offset = shape_index_offset;

            for(let j = 0; j < shapes[i].contour_lengths.length; j++){

                if(isWebGL2) array_index.set(bezier_index.slice(contour_offset,  contour_offset + shapes[i].contour_lengths[j]), index_offset + shape_index_offset);
                else shapes[i].contour_offsets[j] = contour_offset;

                index_offset += shapes[i].contour_lengths[j] + 1;

                contour_offset += shapes[i].contour_lengths[j];
            }

            shape_index_offset +=  shapes[i].max_curves + shapes[i].max_contours;

        }


        data.foreground_index_length = background_index_offset;

        data.offsets = offsets;

        data.bezier_buffer = bezier_buffer_data;

        data.foreground_length = background_offset*13;


        gl.bindBuffer(gl.ARRAY_BUFFER, t_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(t_array), gl.STATIC_DRAW);


        gl.bindBuffer(gl.ARRAY_BUFFER, bezier_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, bezier_buffer_data, gl.DYNAMIC_DRAW);


        polygonPointers();

        polygonAttributes.forEach(function (attribute) {
            gl.enableVertexAttribArray(polygonLocations[attribute]);
        });


        if(isWebGL2){
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, element_array_index_buffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, array_index, gl.STATIC_DRAW);
        }


        bezierPointers();

        bezierAttributes.forEach(function (attribute) {
            gl.enableVertexAttribArray(bezierLocations[attribute]);
        });


        const num_buckets = 70;

        data.num_buckets = num_buckets;

        const shapes_per_bucket = Math.ceil(shapes.length / num_buckets);

        const bucket_lengths = new Array(num_buckets);
        const bucket_index_lengths = new Array(num_buckets);

        const buckets = new Array(num_buckets);

        for(let i = 0; i < num_buckets; i++){

            let shapes_in_this_bucket;

            if (i === num_buckets- 1){
                shapes_in_this_bucket = shapes.slice(i*shapes_per_bucket);

            } else{

                shapes_in_this_bucket = shapes.slice(i*shapes_per_bucket, (i+1)*shapes_per_bucket);
            }


            let curves_this_shape = 0;
            let bucket_indices = 0;


            shapes_in_this_bucket.forEach(function (shape) {

                console.log(shape);
                curves_this_shape += shape.max_curves;
                bucket_indices += shape.max_curves + shape.max_contours;

            });

            bucket_index_lengths[i] = bucket_indices;

            bucket_lengths[i] = curves_this_shape;

            buckets[i] = shapes_in_this_bucket;

        }

        data.bucket_lengths = bucket_lengths;
        data.bucket_index_lengths = bucket_index_lengths;
        data.buckets = buckets;


    }


*/

