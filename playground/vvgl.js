const initRenderer = (function(canvas, options={}) {


    const gl = getContext(canvas);


    const bezierProgram = initBezierProgram();

    gl.useProgram(bezierProgram);


    const array_index = new Uint32Array(1000000);


    array_index.forEach(function (el, i) {
        array_index[i] = i;
    });



    const {locations, attributes} = getVariableLocations(bezierProgram);

    const width = options.width || 2560;
    const height= options.height || 1440;

    const  num_bezier_vertices = initBuffers();


    let frame = 0;

    const data = {};

    prepareCanvas();



    function getContext(canvas) {
        return document.getElementById(canvas).getContext("webgl2", {stencil:true});
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
        //    "attribute vec3 color;",
            "attribute vec2 offset;",

            "uniform vec2 resolution;",
         //   "varying highp vec3 vColor;",

            "void main(void) {",


                "float x = 2.0*(dot(t_vector, x_vector) + offset[0])/resolution[0] - 1.0;",
                "float y = 2.0*(dot(t_vector, y_vector) + offset[1])/resolution[1] - 1.0;",
            //    "vColor = color;",
                "gl_Position = vec4(x, y, 0, 1);",
            "}"
        ].join("\n"));


        let gFragmentShader = createAndCompileShader(gl.FRAGMENT_SHADER, [
         //   "varying highp vec3 vColor;",
            "void main(void) {",
            "gl_FragColor = vec4(1.0, 0.0, 0.5, 1.0);",
            "}"
        ].join("\n"));


        return createAndLinkProgram(gVertexShader, gFragmentShader);
    }


    function getVariableLocations(program) {

        const locations = {};


        const uniforms = ["resolution"];
        const attributes = ["t_vector", "x_vector", "y_vector",  "offset"];

   //     const attributes = ["t_vector", "x_vector", "y_vector"];

        //"color",

        uniforms.forEach(key => locations[key] = gl.getUniformLocation(program, key));
        attributes.forEach(key => locations[key] = gl.getAttribLocation(program, key));


        return {locations, attributes};

    }


    function initBuffers() {


        let step = 10;

        const t_array = [];


        for (let i=0; i <= step; i++){

            let t = i/step;

            t_array.push(Math.pow(1-t, 3));
            t_array.push(3*t*Math.pow(1-t, 2));
            t_array.push(3*(1-t)*Math.pow(t, 2));
            t_array.push(Math.pow(t, 3));

        }



        const t_buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, t_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(t_array), gl.STATIC_DRAW);
        gl.vertexAttribPointer(locations["t_vector"], 4, gl.FLOAT, false, 0, 0);



        return t_array.length/4;


    }



    function prepareCanvas() {

        gl.enable(gl.STENCIL_TEST);
        gl.enable(gl.DEPTH_TEST);
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);


        gl.uniform2fv(locations["resolution"], [width, height]);

        window.gl  = gl;

        attributes.forEach(function (attribute) {

            console.log(`Enabling attribute ${attribute} at location ${locations[attribute]}`);
            gl.enableVertexAttribArray(locations[attribute]);
        });

    }


    function setBezierData(json) {


     //   const bezier_buffer_data = new Float32Array(json.num_bezier_curves*13);

        const bezier_buffer_data = new Float32Array(json.num_bezier_curves*13);
        //const y_data = new Float32Array(6*4);
     //   const x_data = new Float32Array(6*4);

        const foreground_shapes = json.foreground_shapes;
        const background_shapes = json.background_shapes;

        let offset = 0;
        let curves = 0;


        const offsets = new Array(foreground_shapes.length);

/*
        for(let i =0; i <foreground_shapes.length; i++){

            let shape = foreground_shapes[i];

            offsets[i] = offset;

            for(let j = 0; j < 1; j++){
                let curve = shape.bezier_curves[j];

                let idx = offset + j*13;

                if(!shape.hidden) bezier_buffer_data.set(curve, idx);

                bezier_buffer_data.set(shape.data, idx+8);
                curves++;

            }

            offset += 13*shape.max_curves;

        }


        */
        data.offsets = offsets;


        for(let i =0; i <background_shapes.length; i++){

            let shape = background_shapes[i];

            for(let j = 0; j < shape.bezier_curves.length; j++){
                let curve = shape.bezier_curves[j];
                let idx = offset + j*13;
                bezier_buffer_data.set(curve, idx);
                bezier_buffer_data.set(shape.data, idx+8);
                curves++;
            }

            offset += 13*shape.max_curves;

        }





        console.log("Bezier buffer data");
        console.log(bezier_buffer_data);



        const x_buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, x_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, bezier_buffer_data, gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(locations["x_vector"], 4, gl.FLOAT, false, 52, 0);
        gl.vertexAttribDivisor(locations["x_vector"], 1);


        const y_buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, y_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, bezier_buffer_data, gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(locations["y_vector"], 4, gl.FLOAT, false, 52, 16);
        gl.vertexAttribDivisor(locations["y_vector"], 1);

        const offset_buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, offset_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, bezier_buffer_data, gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(locations["offset"], 4, gl.FLOAT, false, 52, 32);
        gl.vertexAttribDivisor(locations["offset"], 1);
/*
        const color_buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, color_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, bezier_buffer_data, gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(locations["color"], 4, gl.FLOAT, false, 52, 40);
        gl.vertexAttribDivisor(locations["color"], 1);
*/



     //   data.bezier_buffer = bezier_buffer_data;



        console.log(`Num bezier vertices`);
        console.log(num_bezier_vertices);


      //  console.log(`Bezier buffer data`);
       // console.log(bezier_buffer_data);
        offset = 0;


        const index_offsets = new Array(foreground_shapes.length);

        for(let i =0; i <foreground_shapes.length; i++){

            index_offsets[i] = offset;

            let shape = foreground_shapes[i];

            let this_offset = 0;

            for(let j =0; j < shape.contour_lengths.length; j++){

                let l = num_bezier_vertices*shape.contour_lengths[j];

                if(l > 0){
                    array_index[offset + this_offset + l] = 0xffffffff;
                    this_offset +=l;
                }

            }

            offset += num_bezier_vertices*shape.max_curves;
            array_index[offset] = 0xffffffff;
        }

        data.index_offsets = index_offsets;


        data.foreground_length = JSON.parse(JSON.stringify(offset));


        for(let i =0; i <background_shapes.length; i++){

            let shape = background_shapes[i];

            let this_offset = 0;

            for(let j =0; j < shape.contour_lengths.length; j++){

                let l = num_bezier_vertices*shape.contour_lengths[j];

                if(l > 0){
                    array_index[offset + this_offset + l] = 0xffffffff;
                    this_offset +=l;
                }

            }

            offset += num_bezier_vertices*shape.max_curves;
            array_index[offset] = 0xffffffff;
        }




        const element_array_index_buffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, element_array_index_buffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, array_index, gl.STATIC_DRAW);

        data.index_buffer = element_array_index_buffer;

        const num_buckets = 1;

        data.num_buckets = num_buckets;

        const shapes = [...foreground_shapes, ...background_shapes];

        const shapes_per_bucket = Math.ceil(shapes.length / num_buckets);

        const bucket_lengths = new Array(num_buckets);

        for(let i = 0; i < num_buckets; i++){

            let shapes_in_this_bucket;

            if (i === num_buckets- 1){
                shapes_in_this_bucket = shapes.slice(i*shapes_per_bucket);

            } else{

                shapes_in_this_bucket = shapes.slice(i*shapes_per_bucket, (i+1)*shapes_per_bucket);
            }

            let curves_this_shape = 0;

            shapes_in_this_bucket.forEach(function (shape) {
                curves_this_shape +=shape.max_curves;
            });


            bucket_lengths[i] = curves_this_shape;

        }




        data.bucket_lengths = bucket_lengths;

    }




    function load(json) {

        json.foreground_shapes = [];
        json.background_shapes = json.background_shapes.slice(0, 100);

        data.foreground_shapes = json.foreground_shapes;
        data.background_shapes = json.background_shapes;
        data.num_bezier_curves = json.num_bezier_curves;
        data.updates = json.updates;

        setBezierData(json);
    }

    function update(time) {

        frame ++;

        return null;


        const updates = data.updates[frame];

        if(!updates) return null;

        updates.forEach(function (update) {


            let shape_id = update.i;


            let shape = data.foreground_shapes[shape_id];

            let offset = data.offsets[shape_id];


            if(update.type === "hide") return data.bezier_buffer.fill(0, offset, offset + shape.max_curves*24);

            data.bezier_buffer.fill(0, offset, offset + shape.max_curves*24);

            for(let j = 0; j < update.bezier_curves.length; j++){
                let curve = update.bezier_curves[j];

                let idx = offset + j*24;

                data.bezier_buffer.set(curve, idx);

                data.bezier_buffer.set(shape.data, idx+16);

            }


            offset = data.index_offsets[shape_id];

            if(update.type === "morph") {

                let this_offset = 0;

                for(let j =0; j < shape.contour_lengths.length; j++){

                    let l = num_bezier_vertices*shape.contour_lengths[j];

                    if(l > 0){
                        array_index[offset + this_offset + l] =  offset + this_offset + l;
                        this_offset +=l;
                    }
                }


                this_offset = 0;

                for(let j =0; j < update.contour_lengths.length; j++){

                    let l = num_bezier_vertices*update.contour_lengths[j];

                    if(l > 0){
                        array_index[offset + this_offset + l] = 0xffffffff;
                        this_offset +=l;
                    }
                }

                array_index[offset] = 0xffffffff;

                array_index[offset + num_bezier_vertices*shape.max_curves] = 0xffffffff;

                data.foreground_shapes[shape_id].contour_lengths = update.contour_lengths;

            }

        });


        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0 , 0,data.bezier_array_size, data.bezier_array_size,  gl.RGBA, gl.UNSIGNED_BYTE, data.bezier_buffer, 0);

        gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, array_index, 0, data.foreground_length);


    }

    function render() {

        gl.clearColor(0, 0, 0, 1.0);



        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);

        let offset = 0;
        let l = 0;


        for(let i =0; i < data.num_buckets; i++){

            gl.stencilFunc(gl.ALWAYS, (i+1) , 0xff);
            gl.stencilMask(i+1);
            gl.depthMask(false);
            gl.colorMask(true, true, true, true);

        //    console.log(`Making a call for i ${i}, length: ${num_bezier_vertices}, offset: ${offset}, instances: ${data.bucket_lengths[i]} `);
         //   gl.drawArrays(gl.LINES,  0, num_bezier_vertices);
            //gl.drawArraysInstanced(gl.TRIANGLE_FAN,  0, num_bezier_vertices, data.bucket_lengths[i]);


            //gl.drawArraysInstanced(gl.LINES,  offset, num_bezier_vertices, data.bucket_lengths[i]);
            gl.drawElementsInstanced(gl.LINES,  num_bezier_vertices,  gl.UNSIGNED_INT, offset, data.bucket_lengths[i]);

          //  offset += data.bucket_lengths[i]*4;

        }

/*

        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);


        offset = 0;

        for(let i =0; i <  data.num_buckets; i++){

            gl.stencilFunc(gl.EQUAL, i+1 , 0xff);
            gl.stencilMask(i+1);
            gl.depthMask(false);
            gl.colorMask(true, true, true, true);

            gl.drawElementsInstanced(gl.TRIANGLE_FAN,  num_bezier_vertices,  gl.UNSIGNED_INT, offset, data.bucket_lengths[i]);

            offset += data.bucket_lengths[i]*4;

        }

*/
        gl.clear( gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

     //   gl.flush();

    }

    function step() {

       // update();
        render();

        if(frame < 1) return window.requestAnimationFrame(step);
        else{
            console.log(`Done`);
        }
    }

    function play() {

        render();

     //   window.requestAnimationFrame(step);


    }




    return {
        load: load,
        play: play
    };




});

