const vvgl = (function(canvas, options={}) {


    const vvgl = this;

    const {context, isWebGL2} = getContext(canvas);

    const gl = context;

    const bezierProgram = initBezierProgram();
    const polygonProgram = initPolygonProgram();

    const t_buffer = gl.createBuffer();
    const bezier_buffer = gl.createBuffer();
    const element_array_index_buffer = gl.createBuffer();

    gl.useProgram(bezierProgram);
    const {bezierLocations, bezierAttributes} = getBezierVariableLocations(bezierProgram);

    gl.useProgram(polygonProgram);
    const {polygonLocations, polygonAttributes} = getPolygonVariableLocations(polygonProgram);


    let shape_list;
    let bucket_manager;
    let update_manager;


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



    prepareCanvas();


    function getContext(canvas) {

     //   let context = document.getElementById(canvas).getContext("webgl2", {stencil:true});

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


    function setBufferData() {


        gl.bindBuffer(gl.ARRAY_BUFFER, bezier_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, shape_list.buffer_data, gl.DYNAMIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, t_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(t_array), gl.STATIC_DRAW);


    }



    function prepareCanvas() {

        gl.enable(gl.STENCIL_TEST);
        gl.enable(gl.DEPTH_TEST);
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);



        gl.useProgram(polygonProgram);
        gl.uniform2fv(polygonLocations["resolution"], [2/width, 2/height]);

        gl.useProgram(bezierProgram);
        gl.uniform2fv(bezierLocations["resolution"], [2/width, 2/height]);

    }



    class Contour {

        constructor(data){

            this.size = 0;
            this.curves = [0];

        }



        update(){

        }



    }






    class Shape {

        constructor(data){


            this.xy = data.xy;
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

        update(update){




        }



        getBufferData(){

            const data = new Float32Array(this.size*21);
            const shape = this;

            let offset = 0;


            for (let i = 0; i < this.contours.length; i++){

                let contour = this.contours[i];


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


            const bezier_buffer_data = new Float32Array((this.size+1)*21);


            this.shapes.forEach(function (shape) {

                bezier_buffer_data.set(shape.getBufferData(), shape.offset*21);
            });



            return bezier_buffer_data;
        }

        update(shape_index, update){



            try{

                let shape = this.index[shape_index];

                shape.update(update);

                this.buffer_data.fill(0,shape.offset*21, (shape.offset + shape.size)*21);
                this.buffer_data.set(shape.getBufferData(), shape.offset*21);
            } catch (e){


                console.warn(`Shape ${shape_index} had an error updating on  frame ${frame}`);


                if(!this.errors[shape_index]) this.errors[shape_index] = 1;
                else  this.errors[shape_index] +=1;

                console.warn(e);
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


    class UpdateManager{

        constructor(updates, shape_list){

            this.updates = updates;

            this.duration = updates.length;

            this.shape_list = shape_list;


        }


        update(){


            let updates = this.updates[frame];

            if(!updates) return null;



            for (const update of updates){

                this.shape_list.update(update[0], update[1]);

            }


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








    function load(json) {


        shape_list = new ShapeList(json.shapes);
        bucket_manager = new BucketManager(shape_list.shapes);
        update_manager = new UpdateManager(json.updates, shape_list);


        setBufferData();
        prepareCanvas();


    }



    function setCamera(scene) {



        width = scene.width;
        height = scene.height;


        offset_w = scene.offset_w;
        offset_h = scene.offset_h;


        gl.useProgram(polygonProgram);
        gl.uniform2fv(polygonLocations["resolution"], [2/width, 2/height]);
        gl.uniform2fv(polygonLocations["camera_offset"], [offset_w, offset_h]);

        gl.useProgram(bezierProgram);
        gl.uniform2fv(bezierLocations["resolution"], [2/width, 2/height]);
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

        return null;

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


    function renderShapes(shapes) {

        shapes.forEach(function (shape) {

            for (let i = 0; i < shape.contour_lengths.length; i++){
                gl.drawArrays(gl.TRIANGLE_FAN, shape.contour_offsets[i],  shape.contour_lengths[i] );
            }

        });
    }




    function renderBeziers(offset, i) {


        if(data.bucket_lengths[i] > 0){

            gl.vertexAttribPointer(bezierLocations["x_vector"], 4, gl.FLOAT, false, 52, 52*offset);
            gl.vertexAttribPointer(bezierLocations["y_vector"], 4, gl.FLOAT, false, 52, 16 + 52*offset);
            gl.vertexAttribPointer(bezierLocations["offset"], 4, gl.FLOAT, false, 52, 32 + 52*offset);
            gl.vertexAttribPointer(bezierLocations["color"], 4, gl.FLOAT, false, 52, 40 + 52*offset);


            if(isWebGL2) gl.drawArraysInstanced(gl.TRIANGLE_FAN,  0, num_bezier_vertices, data.bucket_lengths[i]-1);
            else extensions.angle.drawArraysInstancedANGLE(gl.TRIANGLE_FAN,  0, num_bezier_vertices, data.bucket_lengths[i]-1);

        }

        return offset + data.bucket_lengths[i];
    }



    function render() {

        gl.clearColor(0, 0, 0, 1.0);
        gl.clear( gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);


        gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);

        polygonPointers();

        let offset = 0;


        for(let i =0; i < data.num_buckets; i++){

            gl.stencilFunc(gl.ALWAYS, i+1 , 0xff);
            gl.stencilMask(i+1);
            gl.depthMask(false);
            gl.colorMask(false, false, false, false);

            if(isWebGL2){
                offset =  renderShapes2(offset, i)
            }  else{
                renderShapes(data.buckets[i]);
            }

        }


        offset = 0;
        bezierPointers();

        gl.stencilOp( gl.KEEP,  gl.KEEP, gl.INVERT);

        for(let i =0; i < data.num_buckets; i++){

            gl.stencilFunc(gl.ALWAYS, (i+1) , 0xff);
            gl.stencilMask(i+1);
            gl.depthMask(false);
            gl.colorMask(false, false, false, false);

            offset =  renderBeziers(offset, i);

        }


        polygonPointers();


        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);


        offset = 0;

        for(let i =0; i < data.num_buckets; i++){

            gl.stencilFunc(gl.EQUAL, (i+1) , 0xff);
            gl.stencilMask(i+1);
            gl.depthMask(false);
            gl.colorMask(true, true, true, true);


            if(isWebGL2){
                offset =  renderShapes2(offset, i)
            }  else{
                renderShapes(data.buckets[i]);
            }

        }


        offset = 0;


        bezierPointers();
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);

        for(let i =0; i < data.num_buckets; i++){

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

        if(frame < update_manager.duration) return window.requestAnimationFrame(step);
        else{
            console.log(`Done`);
        }
    }



    function play() {


        render();
        window.requestAnimationFrame(step);


    }




    return {
        load: load,
        play: play
    };




});

export default vvgl;