const vvgl = (function(canvas, options={}) {


    const vvgl = this;

    const {context, isWebGL2} = getContext(canvas);

    const gl = context;

    let shape_list;
    let bucket_manager;
    let update_manager;





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
            "attribute vec2 first;",
            "attribute vec2 last;",
            "attribute vec2 next;",
            "attribute vec2 previous;",
            "uniform vec2 camera_offset;",
            "uniform vec2 resolution;",
            "varying lowp vec3 vColor;",

            "void main(void) {",

            "if(1 < 0){",
                "vec2 point = (vec2(dot(t_vector, x_vector), dot(t_vector, y_vector)) + first + offset + camera_offset)*resolution - 1.0;",
                "vColor = color/256.0;",
                "gl_Position = vec4(point, 0, 1);",
            "}",
            "else{",


                "vec2 point=  vec2(dot(t_vector, x_vector), dot(t_vector, y_vector));",

                "vec2 s = (last-first)/length(last-first);",
                "vec2 d = (next-previous)/length(last-first);",

                "vec2 sp  = vec2(-s.y, s.x);",
                "vec2 dp  = vec2(-d.y, d.x);",

                "float f = dot(point, s);",
                "float n = dot(point, sp);",

                "vec2 transformed = (f*d + n*dp  + previous+offset + camera_offset)*resolution - 1.0; ",

                "vColor = color/256.0;",
                "gl_Position = vec4(transformed, 0, 1);",
            "}",

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
            "attribute vec2 first;",
            "attribute vec2 last;",
            "attribute vec2 next;",
            "attribute vec2 previous;",
            "varying lowp vec3 vColor;",
            "void main(void) {",

                "if(1 < 0){",

                    "vec2 point = (vec2(x1, y1) + previous + offset + camera_offset)*resolution - 1.0; ",

                    "vColor = color/256.0;",
                    "gl_Position = vec4(point, 0, 1.0);",


                "}",
                "else{",

                    "vec2 point = vec2(x1, y1);",

                    "vec2 s = (last-first)/length(last-first);",
                    "vec2 d = (next-previous)/length(last-first);",

                    "vec2 sp  = vec2(-s.y, s.x);",
                    "vec2 dp  = vec2(-d.y, d.x);",

                    "float f = dot(point, s);",
                    "float n = dot(point, sp);",

                    "vec2 transformed = (f*d + n*dp + previous +offset + camera_offset)*resolution - 1.0; ",

                    "vColor = color/256.0;",
                    "gl_Position = vec4(transformed, 0, 1.0);",



                "}",
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
        const attributes = ["t_vector", "x_vector", "y_vector",  "offset", "color", "first", "last", "next", "previous"];


        uniforms.forEach(key => locations[key] = gl.getUniformLocation(program, key));
        attributes.forEach(key => locations[key] = gl.getAttribLocation(program, key));



        return {bezierLocations: locations, bezierAttributes: attributes};

    }



    function getPolygonVariableLocations(program) {

        const locations = {};


        const uniforms = ["resolution", "camera_offset"];
        const attributes = [ "offset", "color", "x1", "y1", "first", "last", "next", "previous"];


        uniforms.forEach(key => locations[key] = gl.getUniformLocation(program, key));
        attributes.forEach(key => locations[key] = gl.getAttribLocation(program, key));


        return {polygonLocations: locations, polygonAttributes: attributes};

    }



    function initBuffers() {


        let step = 10;


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


        gl.bindBuffer(gl.ARRAY_BUFFER, bezier_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, shape_list.buffer_data, gl.DYNAMIC_DRAW);

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

        update_manager.update();

        gl.bufferSubData(gl.ARRAY_BUFFER, 0, shape_list.buffer_data, 0, shape_list.buffer_data.length);


        return null;


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
        gl.vertexAttribPointer(polygonLocations["x1"], 4, gl.FLOAT, false, 84, 0);
        gl.vertexAttribPointer(polygonLocations["y1"], 4, gl.FLOAT, false, 84, 16);
        gl.vertexAttribPointer(polygonLocations["first"], 4, gl.FLOAT, false, 84, 32);
        gl.vertexAttribPointer(polygonLocations["previous"], 4, gl.FLOAT, false, 84, 40);
        gl.vertexAttribPointer(polygonLocations["next"], 4, gl.FLOAT, false, 84, 48);
        gl.vertexAttribPointer(polygonLocations["last"], 4, gl.FLOAT, false, 84, 56);
        gl.vertexAttribPointer(polygonLocations["offset"], 4, gl.FLOAT, false, 84, 64);
        gl.vertexAttribPointer(polygonLocations["color"], 4, gl.FLOAT, false, 84, 72);


        if(isWebGL2){
            gl.vertexAttribDivisor(polygonLocations["x1"], 0);
            gl.vertexAttribDivisor(polygonLocations["y1"], 0);
            gl.vertexAttribDivisor(polygonLocations["color"], 0);
            gl.vertexAttribDivisor(polygonLocations["offset"], 0);
            gl.vertexAttribDivisor(polygonLocations["next"], 0);
            gl.vertexAttribDivisor(polygonLocations["previous"], 0);
            gl.vertexAttribDivisor(polygonLocations["first"], 0);
            gl.vertexAttribDivisor(polygonLocations["last"], 0);
        } else{

            extensions.angle.vertexAttribDivisorANGLE(polygonLocations["x1"], 0);
            extensions.angle.vertexAttribDivisorANGLE(polygonLocations["y1"], 0);
            extensions.angle.vertexAttribDivisorANGLE(polygonLocations["color"], 0);
            extensions.angle.vertexAttribDivisorANGLE(polygonLocations["previous"], 0);
            extensions.angle.vertexAttribDivisorANGLE(polygonLocations["offset"], 0);
            extensions.angle.vertexAttribDivisorANGLE(polygonLocations["next"], 0);
            extensions.angle.vertexAttribDivisorANGLE(polygonLocations["first"], 0);
            extensions.angle.vertexAttribDivisorANGLE(polygonLocations["last"], 0);
        }



    }

    function bezierPointers() {

        gl.useProgram(bezierProgram);


        gl.bindBuffer(gl.ARRAY_BUFFER, t_buffer);
        gl.vertexAttribPointer(bezierLocations["t_vector"], 4, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, bezier_buffer);

        gl.vertexAttribPointer(bezierLocations["x_vector"], 4, gl.FLOAT, false, 84, 0);
        gl.vertexAttribPointer(bezierLocations["y_vector"], 4, gl.FLOAT, false, 84, 16);
        gl.vertexAttribPointer(bezierLocations["first"], 4, gl.FLOAT, false, 84, 32);
        gl.vertexAttribPointer(bezierLocations["previous"], 4, gl.FLOAT, false, 84, 40);
        gl.vertexAttribPointer(bezierLocations["next"], 4, gl.FLOAT, false, 84, 48);
        gl.vertexAttribPointer(bezierLocations["last"], 4, gl.FLOAT, false, 84, 56);
        gl.vertexAttribPointer(bezierLocations["offset"], 4, gl.FLOAT, false, 84, 64);
        gl.vertexAttribPointer(bezierLocations["color"], 4, gl.FLOAT, false, 84, 72);

        
        if(isWebGL2){
            gl.vertexAttribDivisor(bezierLocations["x_vector"], 1);
            gl.vertexAttribDivisor(bezierLocations["y_vector"], 1);
            gl.vertexAttribDivisor(bezierLocations["color"], 1);
            gl.vertexAttribDivisor(bezierLocations["offset"], 1);
            gl.vertexAttribDivisor(bezierLocations["next"], 1);
            gl.vertexAttribDivisor(bezierLocations["previous"], 1);
            gl.vertexAttribDivisor(bezierLocations["first"], 1);
            gl.vertexAttribDivisor(bezierLocations["last"], 1);


        } else {
            extensions.angle.vertexAttribDivisorANGLE(bezierLocations["x_vector"], 1);
            extensions.angle.vertexAttribDivisorANGLE(bezierLocations["y_vector"], 1);
            extensions.angle.vertexAttribDivisorANGLE(bezierLocations["color"], 1);
            extensions.angle.vertexAttribDivisorANGLE(bezierLocations["offset"], 1);
            extensions.angle.vertexAttribDivisorANGLE(bezierLocations["previous"], 1);
            extensions.angle.vertexAttribDivisorANGLE(bezierLocations["next"], 1);
            extensions.angle.vertexAttribDivisorANGLE(bezierLocations["first"], 1);
            extensions.angle.vertexAttribDivisorANGLE(bezierLocations["last"], 1);
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

            gl.vertexAttribPointer(bezierLocations["x_vector"], 4, gl.FLOAT, false, 84, 84*offset);
            gl.vertexAttribPointer(bezierLocations["y_vector"], 4, gl.FLOAT, false, 84, 16 + 84*offset);

            gl.vertexAttribPointer(bezierLocations["first"], 4, gl.FLOAT, false, 84, 32 + 84*offset);
            gl.vertexAttribPointer(bezierLocations["previous"], 4, gl.FLOAT, false, 84, 40 + 84*offset);
            gl.vertexAttribPointer(bezierLocations["next"], 4, gl.FLOAT, false, 84, 48 + 84*offset);
            gl.vertexAttribPointer(bezierLocations["last"], 4, gl.FLOAT, false, 84, 56 + 84*offset);

            gl.vertexAttribPointer(bezierLocations["offset"], 4, gl.FLOAT, false, 84, 64 + 84*offset);
            gl.vertexAttribPointer(bezierLocations["color"], 4, gl.FLOAT, false, 84, 72 + 84*offset);

           // if(isWebGL2) gl.drawArraysInstanced(gl.TRIANGLE_FAN,  0, num_bezier_vertices, l);
        //    else extensions.angle.drawArraysInstancedANGLE(gl.TRIANGLE_FAN,  0, num_bezier_vertices, l);

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

        if(frame < 155) return window.requestAnimationFrame(step);
        else{
            console.log(`Done`);
        }
    }



    function play() {

        render();
        window.requestAnimationFrame(step);

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

        array(){

            return [this.x, this.y];
        }


    }

    class Segment{

        constructor(curves, key_first, key_last){


            this.key_previous = key_first;
            this.key_next = key_last;

            this.set(curves);


        }

        set(curves){

            this.curves = [];

            this.size = curves.length;

            let start = {x: 0, y: 0};

            this.key_last = new KeyPoint(JSON.parse(JSON.stringify(this.key_next.array())));
            this.key_first = new KeyPoint(JSON.parse(JSON.stringify(this.key_previous.array())));

            let end = this.key_last;

            let ox = this.key_first.x;
            let oy =this.key_first.y;


            for( let i = 0; i < curves.length; i++){

                let curve = curves[i];

                if(i === curves.length - 1){

                    if(curve.length ===0)curve = [start.x, start.x, end.x-ox, end.x-ox, start.y, start.y, end.y-oy, end.y-oy];
                    else curve = [start.x,  curve[0], curve[1], end.x-ox, start.y,curve[2], curve[3],end.y-oy];

                } else {

                    if(curve.length ===2 )curve = [start.x, start.x, curve[0], curve[0], start.y, start.y,curve[1], curve[1] ];
                    else curve = [start.x,  curve[0], curve[1], curve[2], start.y,curve[3], curve[4], curve[5]];

                }

                start = {x: curve[3], y: curve[7]};

                this.curves.push(curve);



            }


        }

        update(curves){


            this.set(curves);



        }



    }




    class Contour {

        constructor(data, keypoints, segments){


            if(data) this.init(data);
            else this.add(keypoints, segments);

        }

        init(data){


            let key_points = data[0];
            let segments = data[1];

            let l = segments.length;

            let size = 0;

            this.segments = [];
            this.key_points = [];
            this.key_point_ids = [];



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


        update(){

            this.size = 0;
            for (const segment of this.segments){
                this.size += segment.size;
            }
        }

        add(key_points, segments){

            this.size = 0;

            this.segments = segments;
            this.key_points = key_points;

            for (const segment of segments){
                segment.offset = this.size;
                this.size +=segment.size;
            }

        }



        hide(){
            this.segments = [];
            this.key_points = [];
            this.size= 0;


        }




    }




    class Shape {

        constructor(data){


            this.xy = data.xy;
            this.size = data.max_curves*2;
            this.id = data.rid;
            this.color = data.color;
            this.points = [];
            this.segments = {};

            this.contours = [];

            let offset= 0;

            let point_id=0;


            for (let i=0; i < data.contours.length; i++){



                let contour = new Contour(data.contours[i]);


                for(let j = this.points.length; j < this.points.length + contour.key_points.length; j++){
                    contour.key_point_ids.push(j);
                }

                // Global key points
                this.points.push(... contour.key_points);


                // Global Segments
                let first_point_this_segment = JSON.parse(JSON.stringify(point_id));

                for(let j = 0; j < contour.segments.length; j++){
                    let first_point_id = point_id;
                    let next_point_id = first_point_id+1;

                    if(j === contour.segments.length){
                        next_point_id = first_point_this_segment;
                    }


                    this.segments[`${first_point_id}-${next_point_id}`] = contour.segments[j];

                    point_id++;
                }

                contour.offset = offset;

                // Global Contours

                if(i ===0) this.contours.push(contour);

                offset+=contour.size;


            }





        }

        update(update){



                                    let additions = update[0];


                                    let key_point_additions = additions[0];
                                    let segment_additions = additions[1];
                                    let contour_additions = additions[2];


                                    for(const add of key_point_additions){
                                        this.points.push(new KeyPoint(add))
                                    }


                                    for(const add of segment_additions){

                                        let id = add[0];
                                        let curves = add[1];

                                        let point_ids = id.split('-');
                                        let first_point = this.points[Number(point_ids[0])];
                                        let next_point = this.points[Number(point_ids[0])];

                                        this.segments[id] = new Segment(curves, first_point, next_point);
                                    }



/*

                                    for(const add of contour_additions){

                                        let id = add[0];

                                        if(add[1] ===0) this.contours[id].hide();
                                        else{

                                            let key_point_ids = add[1];
                                            this.contours.push(this.new_contour(key_point_ids));


                                        }
                                    }



*/

                        let edits = update[1];



                        let key_point_edits = edits[0];
                        let segment_edits = edits[1];
                        let contour_edits = edits[2];




                        for(const edit of key_point_edits){

                            let id = edit[0];
                            let dx = edit[1];
                            let dy = edit[2];


                            if(this.points[id]){


                                this.points[id].x +=dx;
                                this.points[id].y +=dy;


                            }

                        }

                        let old_curves = 0;
                        let new_curves_count = 0;



                        for(const edit of segment_edits){

                            let id = edit[0];
                            let new_curves = edit[1];




                            if(this.segments[id]){

                                this.segments[id].update(new_curves);

                            } else{

                                console.log(`Wanted to update id ${id} but it doesn't exist`);
                            }

                        }

                        for (const contour of this.contours){
                            contour.update();
                        }





                        console.log(`There were a total of ${old_curves} curves before`);
                        console.log(`There are a total of ${new_curves_count} curves now`);


            for(const edit of contour_edits){

                let id = edit[0];
                let diffs= edit[1];


                if(id ===0){

                    let key_point_ids = this.contours[id].key_point_ids;
                  //  let key_point_ids  = this.constructor.parse_diffs(this.contours[id].key_point_ids, diffs);

               //     console.log(`New key point ids`);
               //     console.log(key_point_ids);



                //    this.contours[id] = this.new_contour(key_point_ids);

                }

              //  this.contours[id] = this.new_contour(key_point_ids);



            }



        }

        static parse_diffs(array, diffs){


            let b = JSON.parse(JSON.stringify(array));


            for (const diff of diffs){

                const code = diff[0];

                if(code===0){

                    b.splice(diff[1], diff[2]);

                } else if(code ===1){

                    b = [b.slice(0,diff[1]), diff[2], b.slice(diff[1])].flat();

                } else if(code ===2){

                    b.splice(diff[1], diff[2], diff[3]);
                    b = b.flat();
                }



            }

            return b;

        }

        new_contour(key_point_ids){


            let key_points = [];
            let segments = [];

            for(let i=0; i <key_point_ids.length; i++){

                let first_id = key_point_ids[i];
                let next_id = key_point_ids[(i+1)%key_point_ids.length];

                key_points.push(this.points[first_id]);
                segments.push(this.segments[`${first_id}-${next_id}`]);
            }

            const contour = new Contour(null, key_points, segments);
            contour.key_point_ids = key_point_ids;


            return contour;

        }

        getBufferData(){


            console.log("Getting buffer data");
            const data = new Float32Array(this.size*21);
            const shape = this;

            let offset = 0;


            for (let i = 0; i < this.contours.length; i++){

                let contour = this.contours[i];



                for(let j = 0; j < contour.segments.length; j++){

                    let segment = contour.segments[j];
                 //   console.log(segment);

                    for (let k = 0; k < segment.curves.length;k++){

                    //    console.log(segment.curves[k]);

                        data.set(segment.curves[k], offset);
                        data.set(segment.key_first.array(), offset+8);
                        data.set(segment.key_previous.array(), offset+10);
                        data.set(segment.key_next.array(), offset+12);
                        data.set(segment.key_last.array(), offset+14);
                        data.set(shape.xy, offset+16);
                        data.set(shape.color, offset+18);

                        offset+=21;

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

            let shape = this.shapes[shape_index];

            shape.update(update);
           // this.buffer_data.fill(0);
            this.buffer_data.set(shape.getBufferData(), shape.offset*21);
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

        constructor(relative_updates, shape_list, num_frames){

            this.updates = new Array(num_frames);


            this.duration = num_frames;

            let n = 0;

            for (const update of relative_updates){
                 if(typeof update === "number") n+=update;
                 else  this.updates[n] = update;
            }

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
        update_manager = new UpdateManager(json.updates, shape_list, json.duration);


        setBufferData();
        prepareCanvas();


    }





    return {
        load: load,
        play: play
    };




});

export default vvgl;


