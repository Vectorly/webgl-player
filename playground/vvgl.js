const initRenderer = (function(canvas, options={}) {


    const gl = getContext(canvas);


    const bezierProgram = initBezierProgram();
    const polygonProgram = initPolygonProgram();

    const t_buffer = gl.createBuffer();
    const bezier_buffer = gl.createBuffer();
    const element_array_index_buffer = gl.createBuffer();

    gl.useProgram(bezierProgram);
    const {bezierLocations, bezierAttributes} = getBezierVariableLocations(bezierProgram);

    gl.useProgram(polygonProgram);
    const {polygonLocations, polygonAttributes} = getPolygonVariableLocations(polygonProgram);


    const array_index = new Uint32Array(25000);


    array_index.forEach(function (el, i) {
        array_index[i] = i;
    });


    const t_array = [];






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
            "attribute vec3 color;",
            "attribute vec2 offset;",

            "uniform vec2 resolution;",
            "varying lowp vec3 vColor;",

            "void main(void) {",


                "float x = 2.0*(dot(t_vector, x_vector) + offset[0])/resolution[0] - 1.0;",
                "float y = 2.0*(dot(t_vector, y_vector) + offset[1])/resolution[1] - 1.0;",
                "vColor = color/256.0;",
                "gl_Position = vec4(x, y, 0, 1);",
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
            "attribute vec4 x_vector;",
            "attribute vec4 y_vector;",
            "attribute vec3 color;",
            "attribute vec2 offset;",
            "uniform vec2 resolution;",
            "varying lowp vec3 vColor;",
            "void main(void) {",

            "float x = 2.0*(x_vector[0]+offset[0])/resolution[0] - 1.0; ",
            "float y = 2.0*(y_vector[0] + offset[1])/resolution[1] - 1.0; ",
            "vColor = color/256.0;",
            "gl_Position = vec4(x, y, 0, 1.0);",
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


        const uniforms = ["resolution"];
        const attributes = ["t_vector", "x_vector", "y_vector",  "offset", "color"];


        uniforms.forEach(key => locations[key] = gl.getUniformLocation(program, key));
        attributes.forEach(key => locations[key] = gl.getAttribLocation(program, key));



        return {bezierLocations: locations, bezierAttributes: attributes};

    }



    function getPolygonVariableLocations(program) {

        const locations = {};


        const uniforms = ["resolution"];
        const attributes = [ "offset", "color", "x_vector", "y_vector"];


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


      //  gl.useProgram(polygonProgram);

     //   gl.uniform2fv(polygonLocations["resolution"], [width, height]);

        window.gl  = gl;
/*
        attributes.forEach(function (attribute) {
            gl.enableVertexAttribArray(locations[attribute]);
        });
*/




    }


    function setBezierData(json) {


        const bezier_buffer_data = new Float32Array(json.num_bezier_curves*13);

        const foreground_shapes = json.foreground_shapes;
        const background_shapes = json.background_shapes;

        let offset = 0;
        let curves = 0;


        const offsets = new Array(foreground_shapes.length);


        for(let i =0; i <foreground_shapes.length; i++){

            let shape = foreground_shapes[i];

            offsets[i] = offset;

            for(let j = 0; j < shape.bezier_curves.length; j++){
                let curve = shape.bezier_curves[j];

                let idx = offset + j*13;

                if(!shape.hidden) bezier_buffer_data.set(curve, idx);

                bezier_buffer_data.set(shape.data, idx+8);
                curves++;

            }

            offset += 13*shape.max_curves;

        }



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



        data.bezier_buffer = bezier_buffer_data;



        offset = 0;


        const index_offsets = new Array(foreground_shapes.length);

        for(let i =0; i <foreground_shapes.length; i++){

            index_offsets[i] = offset;

            let shape = foreground_shapes[i];

            let this_offset = 0;

            for(let j =0; j < shape.contour_lengths.length; j++){

                let l = shape.contour_lengths[j];

                if(l > 0){
                    array_index[offset + this_offset + l - 1] = 0xffffffff;
                    this_offset +=l;
                }

            }

            offset += shape.max_curves;
            array_index[offset-1] = 0xffffffff;
        }

        data.index_offsets = index_offsets;


        data.foreground_length = JSON.parse(JSON.stringify(offset));


        for(let i =0; i <background_shapes.length; i++){

            let shape = background_shapes[i];

            let this_offset = 0;

            for(let j =0; j < shape.contour_lengths.length; j++){

                let l =shape.contour_lengths[j];

                if(l > 0){
                    array_index[offset + this_offset + l - 1] = 0xffffffff;
                    this_offset +=l;
                }

            }

            offset += shape.max_curves;
            array_index[offset - 1] = 0xffffffff;
        }




        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, element_array_index_buffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, array_index, gl.STATIC_DRAW);


        gl.bindBuffer(gl.ARRAY_BUFFER, t_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(t_array), gl.STATIC_DRAW);


        gl.bindBuffer(gl.ARRAY_BUFFER, bezier_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, bezier_buffer_data, gl.DYNAMIC_DRAW);




        const num_buckets = 50;

        data.num_buckets = num_buckets;

        const shapes = [...foreground_shapes, ...background_shapes];

        const shapes_per_bucket = Math.ceil(shapes.length / num_buckets);

        console.log(`Shapes per bucket`);
        console.log(shapes_per_bucket);

        const bucket_lengths = new Array(num_buckets);

        for(let i = 0; i < num_buckets; i++){

            let shapes_in_this_bucket;

            if (i === num_buckets- 1){
                shapes_in_this_bucket = shapes.slice(i*shapes_per_bucket);

            } else{

                shapes_in_this_bucket = shapes.slice(i*shapes_per_bucket, (i+1)*shapes_per_bucket);
            }

            console.log(`Shapes in bucket ${i}`);
            console.log(shapes_in_this_bucket);

            let curves_this_shape = 0;

            shapes_in_this_bucket.forEach(function (shape) {


                /*

                shape.contour_lengths.forEach(function (contour_length) {
                    curves_this_shape +=contour_length;
                });
*/

                curves_this_shape += shape.max_curves;

            });


            bucket_lengths[i] = curves_this_shape;



        }


        data.bucket_lengths = bucket_lengths;

        console.log(`Bucket lengths`);
        console.log(bucket_lengths);



    }









    function load(json) {

      //  json.background_shapes = [];
//245
       // json.foreground_shapes = [json.foreground_shapes[363], json.foreground_shapes[245]];

     //   json.foreground_shapes = [   json.foreground_shapes[245], json.foreground_shapes[363] ];
     //   json.foreground_shapes = [json.foreground_shapes[363]];

        data.foreground_shapes = json.foreground_shapes;
        data.background_shapes = json.background_shapes;
        data.num_bezier_curves = json.num_bezier_curves;
        data.updates = json.updates;

        setBezierData(json);
    }

    function update(time) {

        frame ++;

        return null;


    }

    function polygonPointers() {

        gl.useProgram(polygonProgram);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, element_array_index_buffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, array_index, gl.STATIC_DRAW);



        gl.bindBuffer(gl.ARRAY_BUFFER, bezier_buffer);
        gl.vertexAttribPointer(polygonLocations["x_vector"], 4, gl.FLOAT, false, 52, 0);
        gl.vertexAttribPointer(polygonLocations["y_vector"], 4, gl.FLOAT, false, 52, 16);
        gl.vertexAttribPointer(polygonLocations["offset"], 4, gl.FLOAT, false, 52, 32);
        gl.vertexAttribPointer(polygonLocations["color"], 4, gl.FLOAT, false, 52, 40);


        gl.vertexAttribDivisor(polygonLocations["x_vector"], 0);
        gl.vertexAttribDivisor(polygonLocations["y_vector"], 0);
        gl.vertexAttribDivisor(polygonLocations["color"], 0);
        gl.vertexAttribDivisor(polygonLocations["offset"], 0);

        gl.uniform2fv(polygonLocations["resolution"], [width, height]);


        polygonAttributes.forEach(function (attribute) {
            gl.enableVertexAttribArray(polygonLocations[attribute]);
        });

    }

    function bezerPointers() {

        gl.useProgram(bezierProgram);


        gl.bindBuffer(gl.ARRAY_BUFFER, t_buffer);
        gl.vertexAttribPointer(bezierLocations["t_vector"], 4, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, bezier_buffer);

        gl.vertexAttribPointer(bezierLocations["x_vector"], 4, gl.FLOAT, false, 52, 0);
        gl.vertexAttribDivisor(bezierLocations["x_vector"], 1);

        gl.vertexAttribPointer(bezierLocations["y_vector"], 4, gl.FLOAT, false, 52, 16);
        gl.vertexAttribDivisor(bezierLocations["y_vector"], 1);

        gl.vertexAttribPointer(bezierLocations["offset"], 4, gl.FLOAT, false, 52, 32);
        gl.vertexAttribDivisor(bezierLocations["offset"], 1);


        gl.vertexAttribPointer(bezierLocations["color"], 4, gl.FLOAT, false, 52, 40);
        gl.vertexAttribDivisor(bezierLocations["color"], 1);


        bezierAttributes.forEach(function (attribute) {
            gl.enableVertexAttribArray(bezierLocations[attribute]);
        });


        gl.uniform2fv(bezierLocations["resolution"], [width, height]);

    }


    function render() {

        gl.clearColor(0, 0, 0, 1.0);
        gl.clear( gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);


        gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);

        let  l;
        let offset = 0;

        polygonPointers();

        for(let i =0; i < data.num_buckets; i++){

            gl.stencilFunc(gl.ALWAYS, i+1 , 0xff);
            gl.stencilMask(i+1);
            gl.depthMask(false);
            gl.colorMask(false, false, false, false);


            console.log(`Running bucket ${i}`);


            if(data.bucket_lengths[i] > 0){

                console.log(`Running from bezier curve ${offset} to ${offset + data.bucket_lengths[i]}`);


                console.log("Offsets");
                console.log(data.offsets);

                console.log(`Current offset`);
                console.log(offset);

                console.log("Start location");
                console.log(13*offset/4);

                console.log(`Data from bezier curves`);
                console.log(data.bezier_buffer.slice(13*offset/4, 13*(data.bucket_lengths[i] +offset/4) ));



                gl.drawElements(gl.TRIANGLE_FAN,  data.bucket_lengths[i],  gl.UNSIGNED_INT, offset);

                offset += data.bucket_lengths[i]*4;


            }


        }


        offset = 0;



        bezerPointers();
        gl.stencilOp( gl.KEEP,  gl.KEEP, gl.INVERT);

        for(let i =0; i < data.num_buckets; i++){

            gl.stencilFunc(gl.ALWAYS, (i+1) , 0xff);
            gl.stencilMask(i+1);
            gl.depthMask(false);
            gl.colorMask(false, false, false, false);



            if(data.bucket_lengths[i] > 0){


                gl.vertexAttribPointer(bezierLocations["x_vector"], 4, gl.FLOAT, false, 52, 52*offset);
                gl.vertexAttribPointer(bezierLocations["y_vector"], 4, gl.FLOAT, false, 52, 16 + 52*offset);
                gl.vertexAttribPointer(bezierLocations["offset"], 4, gl.FLOAT, false, 52, 32 + 52*offset);
                gl.vertexAttribPointer(bezierLocations["color"], 4, gl.FLOAT, false, 52, 40 + 52*offset);


              //  gl.drawArraysInstanced(gl.TRIANGLE_FAN,  0, num_bezier_vertices, data.bucket_lengths[i]-1);
                offset += data.bucket_lengths[i];
            }


        }


        polygonPointers();



        offset = 0;

        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);

        for(let i =0; i < data.num_buckets; i++){

            gl.stencilFunc(gl.EQUAL, (i+1) , 0xff);
            gl.stencilMask(i+1);
            gl.depthMask(false);
            gl.colorMask(true, true, true, true);


            if(data.bucket_lengths[i] > 0){
                gl.drawElements(gl.TRIANGLE_FAN,  data.bucket_lengths[i],  gl.UNSIGNED_INT, offset);

                offset += data.bucket_lengths[i]*4;
            }



        }

        for (let i = 0; i < array_index.length; i++){

            if(array_index[i] === 0xffffffff){
                console.log(`Breakfpoints for array index: ${i}`);
            }
        }


        offset = 0;


        bezerPointers();
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);

        for(let i =0; i < data.num_buckets; i++){

            gl.stencilFunc(gl.NOTEQUAL, 0 , 0xff);
            gl.stencilMask(255-(i+1));
            gl.depthMask(false);
            gl.colorMask(true, true, true, true);


            if(data.bucket_lengths[i] > 0){

                gl.vertexAttribPointer(bezierLocations["x_vector"], 4, gl.FLOAT, false, 52, 52*offset);
                gl.vertexAttribPointer(bezierLocations["y_vector"], 4, gl.FLOAT, false, 52, 16 + 52*offset);
                gl.vertexAttribPointer(bezierLocations["offset"], 4, gl.FLOAT, false, 52, 32 + 52*offset);
                gl.vertexAttribPointer(bezierLocations["color"], 4, gl.FLOAT, false, 52, 40 + 52*offset);


         //      gl.drawArraysInstanced(gl.TRIANGLE_FAN,  0, num_bezier_vertices, data.bucket_lengths[i]-1);
                offset += data.bucket_lengths[i];
            }


        }

    }

    function step() {

        update();
        render();

        if(frame < 200) return window.requestAnimationFrame(step);
        else{
            console.log(`Done`);
        }
    }

    function play() {

        render();

      //  window.requestAnimationFrame(step);


    }




    return {
        load: load,
        play: play
    };




});

