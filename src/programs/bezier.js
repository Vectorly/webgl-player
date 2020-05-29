
const bezierProgram = (function(gl) {


    const gVertexShader = gl.createAndCompileShader(gl.VERTEX_SHADER, [

        "attribute vec4 t_vector;",
        "attribute vec4 x_vector;",
        "attribute vec4 y_vector;",
        "attribute vec3 color;",
        "attribute vec2 offset;",
        "uniform vec2 camera_offset;",
        "uniform vec2 resolution;",
        "varying lowp vec3 vColor;",

        "void main(void) {",

        "vec2 point = (vec2(dot(t_vector, x_vector), dot(t_vector, y_vector)) + offset + camera_offset)*resolution + vec2(-1.0, 1.0);",
        "vColor = color/256.0;",
        "gl_Position = vec4(point, 0, 1);",
        "}"
    ].join("\n"));
    let gFragmentShader = gl.createAndCompileShader(gl.FRAGMENT_SHADER, [
        "varying lowp vec3 vColor;",
        "void main(void) {",
        "gl_FragColor = vec4(vColor, 1);",
        "}"
    ].join("\n"));


    const program = gl.createAndLinkProgram(gVertexShader, gFragmentShader);

    const t_buffer = gl.createBuffer();
    const t_array = initTArray();

    gl.bindBuffer(gl.ARRAY_BUFFER, t_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(t_array), gl.STATIC_DRAW);

    const  num_bezier_vertices = t_array.length/4;


    gl.useProgram(program);

    const locations = {};


    const uniforms = ["resolution", "camera_offset"];
    const attributes = ["t_vector", "x_vector", "y_vector",  "offset", "color"];


    uniforms.forEach(key => locations[key] = gl.getUniformLocation(program, key));
    attributes.forEach(key => locations[key] = gl.getAttribLocation(program, key));

    program.locations = locations;
    program.attributes = attributes;

    program.num_bezier_vertices = num_bezier_vertices;


    program.enableAttributes = function () {

        attributes.forEach(function (attribute) {
            gl.enableVertexAttribArray(locations[attribute]);
        });
    };


    program.setPointers = function (bezier_buffer) {

        gl.useProgram(program);


        gl.bindBuffer(gl.ARRAY_BUFFER, t_buffer);
        gl.vertexAttribPointer(locations["t_vector"], 4, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, bezier_buffer);

        gl.vertexAttribPointer(locations["x_vector"], 4, gl.FLOAT, false, 52, 0);
        gl.vertexAttribPointer(locations["y_vector"], 4, gl.FLOAT, false, 52, 16);
        gl.vertexAttribPointer(locations["offset"], 4, gl.FLOAT, false, 52, 32);
        gl.vertexAttribPointer(locations["color"], 4, gl.FLOAT, false, 52, 40);


        if(gl.gl2){
            gl.vertexAttribDivisor(locations["x_vector"], 1);
            gl.vertexAttribDivisor(locations["y_vector"], 1);
            gl.vertexAttribDivisor(locations["color"], 1);
            gl.vertexAttribDivisor(locations["offset"], 1);

        } else {
            gl.extensions.angle.vertexAttribDivisorANGLE(locations["x_vector"], 1);
            gl.extensions.angle.vertexAttribDivisorANGLE(locations["y_vector"], 1);
            gl.extensions.angle.vertexAttribDivisorANGLE(locations["color"], 1);
            gl.extensions.angle.vertexAttribDivisorANGLE(locations["offset"], 1);
        }


    };


    program.setBufferOffset = function (offset) {

        gl.vertexAttribPointer(locations["x_vector"], 4, gl.FLOAT, false, 52, 52*offset);
        gl.vertexAttribPointer(locations["y_vector"], 4, gl.FLOAT, false, 52, 16 + 52*offset);
        gl.vertexAttribPointer(locations["offset"], 4, gl.FLOAT, false, 52, 32 + 52*offset);
        gl.vertexAttribPointer(locations["color"], 4, gl.FLOAT, false, 52, 40 + 52*offset);



    };



    return program;


});


function initTArray() {

    const t_array = [];

    let step = 10;


    for (let i=0; i <= step; i++){

        let t = i/step;

        t_array.push(Math.pow(1-t, 3));
        t_array.push(3*t*Math.pow(1-t, 2));
        t_array.push(3*(1-t)*Math.pow(t, 2));
        t_array.push(Math.pow(t, 3));

    }


    return t_array;


}



module.exports = bezierProgram;

