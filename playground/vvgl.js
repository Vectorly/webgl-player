const initRenderer = (function(canvas, options={}) {


    const gl = getContext(canvas);

    const bezierProgram = initBezierProgram();

    gl.useProgram(bezierProgram);

    const locations = getVariableLocations(bezierProgram);

    const width = options.width || 2560;
    const height= options.height || 1440;

    const  num_bezier_vertices = initBuffers();


    let time = 0;
    let frame = 0;

    const data = {};

    prepareCanvas();



    function getContext(canvas) {
        return document.getElementById(canvas).getContext("webgl", {stencil:true});
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


            "float unpack(vec4 v){",
            "v *=255.0;   ",
            "  float s = v.a >= 128.0 ? 1.0 : -1.0;",
            "  float e = v.a - (v.a >= 128.0 ? 128.0 : 0.0) - 63.0;",
            "  float m = 1.0 + v.x/256.0/256.0/256.0 + v.y/256.0/256.0 + v.z/256.0;",
            "  return s * pow(2.0, e) * m;",
            "}",

            "vec2 unpack16(vec4 v){",
            "v *=255.0;   ",
            "  return vec2(256.0*v[0] + v[1], 256.0*v[2] + v[3]);",
            "}",


            "attribute float i;",
            "uniform float bezier_modulo;",
            "uniform float num_bezier_vertices;",
            "uniform float vertex_modulo;",
            "uniform sampler2D u_vertices;",
            "uniform sampler2D u_bezier;",
            "uniform sampler2D u_shape;",
            "uniform vec2 resolution;",
            "varying lowp vec4 vColor;",

            "vec2 bezier_point(float bezier_index, float j){",
            "float h =  floor((bezier_index*6.0 + j ) / bezier_modulo);",
            "float w = (bezier_index*6.0 + j) - h*bezier_modulo;",
            "vec4 data = texture2D(u_bezier, vec2((w)/bezier_modulo, (h)/bezier_modulo));",
            "return unpack16(data);",
            "}",

            "float get_t_vec_value(float vertex_index, float j){",
            "float h =  floor((vertex_index*4.0 + j ) / vertex_modulo);",
            "float w = (vertex_index*4.0 + j) - h*vertex_modulo;",
            "vec4 data = texture2D(u_vertices, vec2((w)/vertex_modulo, (h)/vertex_modulo));",
            "return unpack(data);",
            "}",
            "vec4 get_t_vec(float vertex_index){",

            "float tA = get_t_vec_value(vertex_index, 0.0);",
            "float tB = get_t_vec_value(vertex_index, 1.0);",
            "float tC = get_t_vec_value(vertex_index, 2.0);",
            "float tD = get_t_vec_value(vertex_index, 3.0);",
            "return vec4(tA, tB, tC, tD)/pow(2.0, 24.0);",
            "}",


            "void main(void) {",


            "float bezier_index =  floor(i / num_bezier_vertices);",
            "float vertex_index =  i- bezier_index*num_bezier_vertices;",

            "vec4 t_vector = get_t_vec(vertex_index);",

            "vec2 p1 = bezier_point(bezier_index, 0.0);",
            "vec2 c1 = bezier_point(bezier_index, 1.0);",
            "vec2 c2 = bezier_point(bezier_index, 2.0);",
            "vec2 p2 = bezier_point(bezier_index, 3.0);",
            "vec2 offset = bezier_point(bezier_index, 4.0);",


            "vec4 x_vector = vec4(p1[0], c1[0], c2[0], p2[0]);",
            "vec4 y_vector = vec4(p1[1], c1[1], c2[1], p2[1]);",

            "float x = 2.0*(dot(t_vector, x_vector) + offset[0])/resolution[0] - 1.0;",
            "float y = 2.0*(dot(t_vector, y_vector) + offset[1])/resolution[1] - 1.0;",


            "float h =  floor((bezier_index*6.0 + 5.0 ) / bezier_modulo);",
            "float w = (bezier_index*6.0 + 5.0) - h*bezier_modulo;",

            "vColor = texture2D(u_bezier, vec2((w+0.5)/bezier_modulo, (h+0.5)/bezier_modulo));",

            "gl_Position = vec4(x, y, 0, 1);",
            "}"
        ].join("\n"));


        let gFragmentShader = createAndCompileShader(gl.FRAGMENT_SHADER, [
            "varying lowp vec4 vColor;",
            "void main(void) {",
            "gl_FragColor = vec4(vColor.x, vColor.y, vColor.z, 1.0);",
            "}"
        ].join("\n"));


        return createAndLinkProgram(gVertexShader, gFragmentShader);
    }


    function getVariableLocations(program) {

        const locations = {};


        const uniforms = ["num_bezier_vertices", "u_vertices", "u_bezier", "bezier_modulo", "resolution", "vertex_modulo"];
        const attributes = ["i"];

        uniforms.forEach(key => locations[key] = gl.getUniformLocation(program, key));
        attributes.forEach(key => locations[key] = gl.getAttribLocation(program, key));

        return locations;

    }

    function fract(x){
        return x - Math.floor(x);
    }

    function packFloat(x) {

        if(x ===0) return [0, 0, 0, 0];

        let s = x > 0 ? 1 : -1;
        let e = Math.floor(Math.log(s*x) / Math.LN2);
        let m = s*x/Math.pow(2, e);

        const data = new Array(4);

        data[0] = Math.floor(fract((m-1)*256*256)*256)||0;
        data[1] = Math.floor(fract((m-1)*256)*256)||0;
        data[2] = Math.floor(fract((m-1))*256)||0;
        data[3] = ((e+63) + (x>0?128:0))||0;


        return data;

    }


    function initBuffers() {


        const index_array = new Float32Array(1000000);

        index_array.forEach(function (el, i) {
            index_array[i] = i;
        });

        const index_buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, index_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, index_array, gl.STATIC_DRAW);
        gl.vertexAttribPointer(locations["i"], 1, gl.FLOAT, false, 0, 0);


        let step = 10;

        const t_array = [];


        for (let i=0; i <= step; i++){

            let t = i/step;

            t_array.push(Math.pow(1-t, 3));
            t_array.push(3*t*Math.pow(1-t, 2));
            t_array.push(3*(1-t)*Math.pow(t, 2));
            t_array.push(Math.pow(t, 3));

        }


        let num_bezier_vertices = t_array.length/4;
        gl.uniform1f(locations["num_bezier_vertices"], num_bezier_vertices);

        const bezierVertexArray = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, bezierVertexArray);
        const textureSize = fitTextureSide(num_bezier_vertices*4);

        gl.uniform1f(locations["vertex_modulo"], textureSize);

        const buffer_data = new Uint8Array(textureSize*textureSize*4);

        for(let i =0; i < t_array.length; i++){

            const data = packFloat(Math.floor(t_array[i]*Math.pow(2, 24)));

            buffer_data[4*i] = data[0];
            buffer_data[4*i+1] = data[1];
            buffer_data[4*i+2] = data[2];
            buffer_data[4*i+3] = data[3];

        }


        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);


        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, textureSize, textureSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, buffer_data);


        gl.uniform1i(locations["u_vertices"], 0);


        gl.uniform2fv(locations["resolution"], [width, height]);

        return num_bezier_vertices;


    }

    function fitTextureSide(elements){
        return Math.pow(2, Math.ceil(Math.log(Math.sqrt(elements))/Math.log(2)));
    }


    function prepareCanvas() {

        gl.enable(gl.STENCIL_TEST);
        gl.enable(gl.DEPTH_TEST);
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    }


    function setBezierTexture(json) {


        let shapes = json.shapes;
        let total_bezier_curves = json.num_bezier_curves;


        const bezierTexture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, bezierTexture);

        const bezier_array_size = fitTextureSide(total_bezier_curves*6);

        gl.uniform1f(locations["bezier_modulo"] , bezier_array_size);

        const bezier_buffer_data = new Uint8Array(bezier_array_size*bezier_array_size*4);


        let offset = 0;
        let curves = 0;


        const offsets = new Array(shapes.length);


        for(let i =0; i <shapes.length; i++){

            let shape = shapes[i];

            offsets[i] = offset;

            for(let j = 0; j < shape.bezier_curves.length; j++){
                let curve = shape.bezier_curves[j];

                let idx = offset + j*24;

                if(!shape.hidden)  bezier_buffer_data.set(curve, idx);

                bezier_buffer_data.set(shape.data, idx+16);
                curves++;

            }

            offset += 24*shape.max_curves;

        }



        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);


        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, bezier_array_size, bezier_array_size, 0, gl.RGBA, gl.UNSIGNED_BYTE, bezier_buffer_data);

        gl.uniform1i(locations["u_bezier"], 1);

        data.bezier_buffer = bezier_buffer_data;


    }




    function load(json) {

        json.shapes = json.shapes.slice(0,10);

        data.shapes = json.shapes;
        data.num_bezier_curves = json.num_bezier_curves;
        data.updates = [];



        setBezierTexture(json);
    }

    function update(time) {

        frame ++;

    }

    function render() {

        gl.clearColor(0, 0, 0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);



        gl.enableVertexAttribArray(locations["i"]);

        gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);

        let offset = 0;
        let l = 0;

        for(let i =0; i < data.shapes.length; i++){


            let shape = data.shapes[i];
            gl.stencilFunc(gl.ALWAYS, (i%100+1) , 0xff);
            gl.stencilMask((i%100+1));
            gl.depthMask(false);
            gl.colorMask(false, false, false, false);

            let this_offset = 0;


            for(let j =0; j < shape.contour_lengths.length; j++){

                l = num_bezier_vertices*shape.contour_lengths[j];


                if(l > 0){
                    gl.drawArrays(gl.TRIANGLE_FAN, offset + this_offset,l);
                    this_offset +=l;
                }


            }


            offset += num_bezier_vertices*shape.max_curves;


        }


        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);


        offset = 0;

        for(let i =0; i < data.shapes.length; i++){

            let shape = data.shapes[i];
            gl.stencilFunc(gl.EQUAL, i%100+1 , 0xff);
            gl.stencilMask(i%100+1);
            gl.depthMask(false);
            gl.colorMask(true, true, true, true);


            let this_offset = 0;


            for(let j =0; j < shape.contour_lengths.length; j++){

                l = num_bezier_vertices*shape.contour_lengths[j];


                if(l > 0){
                    gl.drawArrays(gl.TRIANGLE_FAN, offset + this_offset,l);
                    this_offset +=l;
                }


            }


            offset += num_bezier_vertices*shape.max_curves;
        }

    }

    function step() {

        update();
        render();

        if(frame < 150) return window.requestAnimationFrame(step);
        else{
            console.log(`Done`);
        }
    }

    function play() {


        window.requestAnimationFrame(step);


    }




    return {
        load: load,
        play: play
    };




});

