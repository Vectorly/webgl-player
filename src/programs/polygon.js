
const polygonProgram = (function(gl) {

    let gVertexShader = gl.createAndCompileShader(gl.VERTEX_SHADER, [
        "attribute float x1;",
        "attribute float y1;",
        "attribute vec3 color;",
        "attribute vec2 offset;",
        "uniform vec2 resolution;",
        "uniform vec2 camera_offset;",
        "varying lowp vec3 vColor;",
        "void main(void) {",

        "vec2 point = (vec2(x1, y1)+offset + camera_offset)*resolution + vec2(-1.0, 1.0); ",

        "vColor = color/256.0;",
        "gl_Position = vec4(point, 0, 1.0);",
        "}"
    ].join("\n"));

    let gFragmentShader = gl.createAndCompileShader(gl.FRAGMENT_SHADER, [
        "varying lowp vec3 vColor;",
        "void main(void) {",
        "gl_FragColor = vec4(vColor, 1);",
        "}"
    ].join("\n"));



    const program = gl.createAndLinkProgram(gVertexShader, gFragmentShader);



    gl.useProgram(program);

    const locations = {};


    const uniforms = ["resolution", "camera_offset"];
    const attributes = [ "offset", "color", "x1", "y1"];


    uniforms.forEach(key => locations[key] = gl.getUniformLocation(program, key));
    attributes.forEach(key => locations[key] = gl.getAttribLocation(program, key));

    program.locations = locations;
    program.attributes = attributes;


    program.enableAttributes = function () {

        attributes.forEach(function (attribute) {
            gl.enableVertexAttribArray(locations[attribute]);
        });
    };



    program.setPointers = function(bezier_buffer) {

        gl.useProgram(program);

        gl.bindBuffer(gl.ARRAY_BUFFER, bezier_buffer);
        gl.vertexAttribPointer(locations["x1"], 4, gl.FLOAT, false, 52, 0);
        gl.vertexAttribPointer(locations["y1"], 4, gl.FLOAT, false, 52, 16);
        gl.vertexAttribPointer(locations["offset"], 4, gl.FLOAT, false, 52, 32);
        gl.vertexAttribPointer(locations["color"], 4, gl.FLOAT, false, 52, 40);


        if(gl.gl2){
            gl.vertexAttribDivisor(locations["x1"], 0);
            gl.vertexAttribDivisor(locations["y1"], 0);
            gl.vertexAttribDivisor(locations["color"], 0);
            gl.vertexAttribDivisor(locations["offset"], 0);
        } else{

            gl.extensions.angle.vertexAttribDivisorANGLE(locations["x1"], 0);
            gl.extensions.angle.vertexAttribDivisorANGLE(locations["y1"], 0);
            gl.extensions.angle.vertexAttribDivisorANGLE(locations["color"], 0);
            gl.extensions.angle.vertexAttribDivisorANGLE(locations["offset"], 0);
        }



    };



    return program;


});


module.exports = polygonProgram;

