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

    }


    function setBezierData(json) {


        const bezier_buffer_data = new Float32Array(json.num_bezier_curves*13);

        const foreground_shapes = json.foreground_shapes;
        const background_shapes = json.background_shapes;

        let offset = 0;
        let curves = 0;


        const shapes = [...foreground_shapes, ...background_shapes];


        // Just to remove that one error
        shapes[shapes.length-1].contour_lengths[0] = shapes[shapes.length-1].contour_lengths[0]-1;

        const offsets = new Array(shapes.length);


        for(let i =0; i <shapes.length; i++){

            let shape = shapes[i];

            shapes[i].offset = offset;

            offsets[i] = offset;


            for(let j = 0; j < shape.bezier_curves.length; j++){
                let curve = shape.bezier_curves[j];

                let idx = offset*13 + j*13;

                if(!shape.hidden) bezier_buffer_data.set(curve, idx);

                bezier_buffer_data.set(shape.data, idx+8);
                curves++;

            }

            offset += shape.max_curves;

        }



        data.offsets = offsets;

        data.bezier_buffer = bezier_buffer_data;




        gl.bindBuffer(gl.ARRAY_BUFFER, t_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(t_array), gl.STATIC_DRAW);


        gl.bindBuffer(gl.ARRAY_BUFFER, bezier_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, bezier_buffer_data, gl.DYNAMIC_DRAW);




        const num_buckets = 70;

        data.num_buckets = num_buckets;


        const shapes_per_bucket = Math.ceil(shapes.length / num_buckets);

        const bucket_lengths = new Array(num_buckets);

        const buckets = new Array(num_buckets);

        for(let i = 0; i < num_buckets; i++){

            let shapes_in_this_bucket;

            if (i === num_buckets- 1){
                shapes_in_this_bucket = shapes.slice(i*shapes_per_bucket);

            } else{

                shapes_in_this_bucket = shapes.slice(i*shapes_per_bucket, (i+1)*shapes_per_bucket);
            }


            let curves_this_shape = 0;

            shapes_in_this_bucket.forEach(function (shape) {

                curves_this_shape += shape.max_curves;

            });


            bucket_lengths[i] = curves_this_shape;

            buckets[i] = shapes_in_this_bucket;

        }


        data.bucket_lengths = bucket_lengths;

        data.buckets = buckets;


    }







    function load(json) {

        data.foreground_shapes = json.foreground_shapes;
        data.background_shapes = json.background_shapes;
        data.num_bezier_curves = json.num_bezier_curves;
        data.updates = json.updates;

        data.shapes = json.foreground_shapes;

        setBezierData(json);
    }

    function update(time) {

        frame ++;

        return null;


    }

    function polygonPointers() {

        gl.useProgram(polygonProgram);


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


    function renderShapes(shapes) {

        shapes.forEach(function (shape) {

            let this_offset = 0;

            shape.contour_lengths.forEach(function (contour_length) {

                if(contour_length > 0){
                    gl.drawArrays(gl.TRIANGLE_FAN,  shape.offset + this_offset,  contour_length );
                    this_offset += contour_length;
                }

            });

        });
    }


    function renderBeziers(offset, i) {


        if(data.bucket_lengths[i] > 0){

            gl.vertexAttribPointer(bezierLocations["x_vector"], 4, gl.FLOAT, false, 52, 52*offset);
            gl.vertexAttribPointer(bezierLocations["y_vector"], 4, gl.FLOAT, false, 52, 16 + 52*offset);
            gl.vertexAttribPointer(bezierLocations["offset"], 4, gl.FLOAT, false, 52, 32 + 52*offset);
            gl.vertexAttribPointer(bezierLocations["color"], 4, gl.FLOAT, false, 52, 40 + 52*offset);

            gl.drawArraysInstanced(gl.TRIANGLE_FAN,  0, num_bezier_vertices, data.bucket_lengths[i]-1);

        }


        return offset + data.bucket_lengths[i];
    }

    function render() {

        gl.clearColor(0, 0, 0, 1.0);
        gl.clear( gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);


        gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);

        polygonPointers();

        for(let i =0; i < data.num_buckets; i++){

            const shapes = data.buckets[i];

            gl.stencilFunc(gl.ALWAYS, i+1 , 0xff);
            gl.stencilMask(i+1);
            gl.depthMask(false);
            gl.colorMask(false, false, false, false);

            renderShapes(shapes);



        }

        let offset = 0;

        bezerPointers();

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


        for(let i =0; i < data.num_buckets; i++){

            const shapes = data.buckets[i];

            gl.stencilFunc(gl.EQUAL, (i+1) , 0xff);
            gl.stencilMask(i+1);
            gl.depthMask(false);
            gl.colorMask(true, true, true, true);


            renderShapes(shapes);

        }


        offset = 0;


        bezerPointers();
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

        if(frame < 200) return window.requestAnimationFrame(step);
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

