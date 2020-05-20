const webglContext = (function(canvas) {


    //   let context = document.getElementById(canvas).getContext("webgl2", {stencil:true});


    let gl;

    let isWebGL2 = (typeof  gl !== "undefined");


    if(!isWebGL2) gl = document.getElementById(canvas).getContext("webgl", {stencil:true});



    gl.gl2 = isWebGL2;


    gl.extensions = {};


    gl.createAndCompileShader = function(type, source) {
        let shader = gl.createShader(type);

        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(shader));
        }

        return shader;
    };

    gl.createAndLinkProgram = function(glVertexShader, glFragmentShader) {
        let glProgram = gl.createProgram();

        gl.attachShader(glProgram, glVertexShader);
        gl.attachShader(glProgram, glFragmentShader);
        gl.linkProgram(glProgram);

        if (!gl.getProgramParameter(glProgram, gl.LINK_STATUS)) {
            throw new Error("Could not initialise shaders");
        }

        return glProgram;
    };



    if(!gl.gl2) gl.extensions.angle = gl.getExtension('ANGLE_instanced_arrays');



    return gl


});

module.exports = webglContext;









