

const Renderer =(function(gl, bezierProgram, polygonProgram, bucket_manager, bezier_buffer) {


    const renderer = {};


    function renderShapes2(offset, i) {

        if(data.bucket_index_lengths[i] > 0) gl.drawElements(gl.TRIANGLE_FAN, data.bucket_index_lengths[i],  gl.UNSIGNED_SHORT, offset*2);

        return offset + data.bucket_index_lengths[i];
    }


function renderShapes(bucket) {

    bucket.shapes.forEach(function (shape) {


        for (let i = 0; i < shape.contours.length; i++){

            if(shape.size > 0 && shape.contours[i].length > 0){


                gl.drawArrays(gl.TRIANGLE_FAN, shape.offset + shape.contours[i].offset,  shape.contours[i].length);
            }


        }

    });
}



function renderBeziers(offset, i) {

    let l = bucket_manager.buckets[i].length;


    if(l > 0){

        bezierProgram.setBufferOffset(offset);
        if(gl.gl2) gl.drawArraysInstanced(gl.TRIANGLE_FAN,  0, bezierProgram.num_bezier_vertices, l);
        else gl.extensions.angle.drawArraysInstancedANGLE(gl.TRIANGLE_FAN,  0, bezierProgram.num_bezier_vertices, l);

    }

    return offset +l;
}



renderer.render = function () {

    gl.clearColor(0, 0, 0, 1.0);
    gl.clear( gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);


    gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);


    polygonProgram.setPointers(bezier_buffer);

    let offset = 0;


    for(let i =0; i < bucket_manager.num_buckets; i++){

        gl.stencilFunc(gl.ALWAYS, i+1 , 0xff);
        gl.stencilMask(i+1);
        gl.depthMask(false);
        gl.colorMask(false, false, false, false);

        if(gl.gl2){
            offset =  renderShapes2(offset, i)
        }  else{

            renderShapes(bucket_manager.buckets[i]);
        }

    }


    offset = 0;
    bezierProgram.setPointers(bezier_buffer);

    gl.stencilOp( gl.KEEP,  gl.KEEP, gl.INVERT);

    for(let i =0; i < bucket_manager.num_buckets; i++){

        gl.stencilFunc(gl.ALWAYS, (i+1) , 0xff);
        gl.stencilMask(i+1);
        gl.depthMask(false);
        gl.colorMask(false, false, false, false);

        offset =  renderBeziers(offset, i);

    }


    polygonProgram.setPointers(bezier_buffer);


    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);


    offset = 0;

    for(let i =0; i < bucket_manager.num_buckets; i++){

        gl.stencilFunc(gl.EQUAL, (i+1) , 0xff);
        gl.stencilMask(i+1);
        gl.depthMask(false);
        gl.colorMask(true, true, true, true);


        if(gl.gl2){
            offset =  renderShapes2(offset, i)
        }  else{
            renderShapes(bucket_manager.buckets[i]);
        }

    }


    offset = 0;


    bezierProgram.setPointers(bezier_buffer);


    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);

    for(let i =0; i < bucket_manager.num_buckets; i++){

        gl.stencilFunc(gl.EQUAL, i+1 , 0xff);
        gl.stencilMask(255-(i+1));
        gl.depthMask(false);
        gl.colorMask(true, true, true, true);

        offset =  renderBeziers(offset, i);

    }


};



    return renderer;


});


module.exports = Renderer;



/*

TODO: Re-enable WebGL 2 bucket rendering of shapes

    const element_array_index_buffer = gl.createBuffer();


 const array_index = new Uint16Array(50000);
    const bezier_index = new Uint16Array(50000);


    if(gl.gl2){

        array_index.fill(0xffff);
        for(let i = 0; i < bezier_index.length; i++){
            bezier_index[i] = i;
        }

    }


 */