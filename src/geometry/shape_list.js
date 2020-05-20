const Shape = require('./shape');

class ShapeList {

    constructor(shapes){


        this.shapes = [];
        this.index = {};

        this.errors = {};

        let size = 0;

        for (let i=0; i < shapes.length; i++){

            let shape =  new Shape(shapes[i]);
            shape.offset  = size;


            size += shape.size;

            this.index[shape.id] = shape;
            this.shapes.push(shape);


        }


        this.size = size;

        this.buffer_data = this.getBufferData();

    }

    getBufferData(){


        const bezier_buffer_data = new Float32Array((this.size+1)*13);


        this.shapes.forEach(function (shape) {
            if(shape.hidden) return null;

            bezier_buffer_data.set(shape.getBufferData(), shape.offset*13);
        });



        return bezier_buffer_data;
    }

    update(update){

        let shape = this.shapes[update.i];

        shape.update(update);


        this.buffer_data.fill(0,shape.offset*13, (shape.offset + shape.size)*13);

        if(!shape.hidden){


            this.buffer_data.set(shape.getBufferData(), shape.offset*13);
        }


    }

}

module.exports= ShapeList;