const initRenderer = (function(canvas, options={}) {


    const gl = getContext(canvas);


    const bezierProgram = initBezierProgram();
    const polygonProgram = initPolygonProgram();

    const t_buffer = gl.createBuffer();
    const bezier_buffer = gl.createBuffer();


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
            "gl_FragColor = vec4(vColor.x, vColor.y, vColor.z, 1.0);",
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


        let step = 20;


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
                    array_index[offset + this_offset + l] = 0xffffffff;
                    this_offset +=l;
                }

            }

            offset += shape.max_curves;
            array_index[offset] = 0xffffffff;
        }

        data.index_offsets = index_offsets;


        data.foreground_length = JSON.parse(JSON.stringify(offset));


        for(let i =0; i <background_shapes.length; i++){

            let shape = background_shapes[i];

            let this_offset = 0;

            for(let j =0; j < shape.contour_lengths.length; j++){

                let l =shape.contour_lengths[j];

                if(l > 0){
                    array_index[offset + this_offset + l] = 0xffffffff;
                    this_offset +=l;
                }

            }

            offset += shape.max_curves;
            array_index[offset] = 0xffffffff;
        }



        const element_array_index_buffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, element_array_index_buffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, array_index, gl.STATIC_DRAW);


        gl.bindBuffer(gl.ARRAY_BUFFER, t_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(t_array), gl.STATIC_DRAW);


        gl.bindBuffer(gl.ARRAY_BUFFER, bezier_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, bezier_buffer_data, gl.DYNAMIC_DRAW);
    }









    function load(json) {

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

        polygonAttributes.forEach(function (attribute) {
            gl.enableVertexAttribArray(polygonLocations[attribute]);
        });

        gl.bindBuffer(gl.ARRAY_BUFFER, bezier_buffer);
        gl.vertexAttribPointer(polygonLocations["x_vector"], 4, gl.FLOAT, false, 52, 0);
        gl.vertexAttribPointer(polygonLocations["y_vector"], 4, gl.FLOAT, false, 52, 16);
        gl.vertexAttribPointer(polygonLocations["offset"], 4, gl.FLOAT, false, 52, 32);
        gl.vertexAttribPointer(polygonLocations["color"], 4, gl.FLOAT, false, 52, 40);


        gl.uniform2fv(polygonLocations["resolution"], [width, height]);

    }

    function bezerPointers() {

        gl.useProgram(bezierProgram);


        gl.bindBuffer(gl.ARRAY_BUFFER, t_buffer);
        gl.vertexAttribPointer(bezierLocations["t_vector"], 4, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, bezier_buffer);

        gl.vertexAttribPointer(bezierLocations["x_vector"], 4, gl.FLOAT, false, 52, 0);
        gl.vertexAttribDivisor(bezierLocations["x_vector"], 1);


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

        gl.stencilFunc(gl.ALWAYS, 0xff , 0xff);
        gl.stencilMask(0xff);
        gl.depthMask(false);
        gl.colorMask(false, false, false, false);



        polygonPointers();



        gl.drawElements(gl.TRIANGLE_FAN,   data.num_bezier_curves-1, gl.UNSIGNED_INT, 0 );



        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);

        gl.stencilFunc(gl.ALWAYS, 0xff , 0xff);
        gl.stencilMask(0xff);
        gl.depthMask(false);
        gl.colorMask(true, true, true, true);


        bezerPointers();


        gl.drawArraysInstanced(gl.TRIANGLE_FAN,  0, num_bezier_vertices, data.num_bezier_curves-1);





/*
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);

        gl.stencilFunc(gl.NOTEQUAL, 0 , 0xff);
        gl.stencilMask(0xff);
        gl.depthMask(false);
        gl.colorMask(true, true, true, true);

        gl.drawElements(gl.TRIANGLE_FAN,   data.num_bezier_curves-1, gl.UNSIGNED_INT, 0 );

*/




        /*
        let offset = 0;
        let l = 0;
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);
        gl.drawArraysInstanced(gl.TRIANGLE_FAN,  offset, num_bezier_vertices, data.num_bezier_curves-1);

        gl.stencilFunc(gl.ALWAYS, 0xff , 0xff);
        gl.stencilMask(0xff);
        gl.depthMask(false);
        gl.colorMask(false, false, false, false);




        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
        gl.drawArraysInstanced(gl.TRIANGLE_FAN,  offset, num_bezier_vertices, data.num_bezier_curves-1);

        gl.stencilFunc(gl.EQUAL, 0, 0xff);
        gl.stencilMask(0xff);
        gl.depthMask(false);
        gl.colorMask(true, true, true, true);

*/
/*
        for(let i =0; i < data.num_buckets; i++){

            gl.stencilFunc(gl.ALWAYS, (i+1) , 0xff);
            gl.stencilMask(i+1);
            gl.depthMask(false);
            gl.colorMask(true, true, true, true);

        //    console.log(`Making a call for i ${i}, length: ${num_bezier_vertices}, offset: ${offset}, instances: ${data.bucket_lengths[i]} `);
         //   gl.drawArrays(gl.LINES,  0, num_bezier_vertices);
            //gl.drawArraysInstanced(gl.TRIANGLE_FAN,  0, num_bezier_vertices, data.bucket_lengths[i]);



          //  gl.drawElementsInstanced(gl.LINES,  num_bezier_vertices,  gl.UNSIGNED_INT, offset, data.bucket_lengths[i]);

            //offset += data.bucket_lengths[i];

        }
*/
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


     //   gl.flush();

    }

    function step() {

        update();
        render();

        if(frame < 2) return window.requestAnimationFrame(step);
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

