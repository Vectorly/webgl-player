
const Camera = (function(gl, bezierProgram, polygonProgram) {


    let width  = 2560;
    let height = 1440;

    let offset_w = 0;
    let offset_h = 0;



    const camera= {
        height,
        width,
        offset_h,
        offset_w
    };


    camera.set = function (scene) {

        offset_w = scene.offset_w;
        offset_h = scene.offset_h;


        gl.useProgram(polygonProgram);
        gl.uniform2fv(polygonProgram.locations["resolution"], [2/width, 2/height]);
        gl.uniform2fv(polygonProgram.locations["camera_offset"], [offset_w, offset_h]);

        gl.useProgram(bezierProgram);
        gl.uniform2fv(bezierProgram.locations["resolution"], [2/width, -2/height]);
        gl.uniform2fv(bezierProgram.locations["camera_offset"], [offset_w, offset_h]);

    };


    camera.update = function (update) {

        width = update.w - update.x;
        height = update.h - update.y;

        let offset_x = offset_w - update.x;
        let offset_y = offset_h - update.y-260;


        gl.useProgram(polygonProgram);
        gl.uniform2fv(polygonProgram.locations["resolution"], [2/width, 2/height]);
        gl.uniform2fv(polygonProgram.locations["camera_offset"], [offset_x, offset_y ]);

        gl.useProgram(bezierProgram);
        gl.uniform2fv(bezierProgram.locations["resolution"], [2/width, 2/height]);
        gl.uniform2fv(bezierProgram.locations["camera_offset"], [offset_x, offset_y]);

    };



    return camera;


});


module.exports = Camera;

