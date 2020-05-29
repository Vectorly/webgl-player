class Bucket{

    constructor(shapes){

        this.shapes = shapes;
        this.length = 0;

        for(const shape of shapes){
            this.length+= shape.size;
        }


    }

    push(shape){

        this.shapes.push(shape);
        this.length += shape.size;
    }

}



class BucketManager{


    constructor(shapes){

        this.num_buckets = 250;

        const shapes_per_bucket = Math.ceil(shapes.length / this.num_buckets);

        this.buckets = [];

        for(let i = 0; i <  this.num_buckets; i++){

            if (i === this.num_buckets- 1){
                this.buckets.push(new Bucket(shapes.slice(i*shapes_per_bucket)));
            } else{
                this.buckets.push(new Bucket(shapes.slice(i*shapes_per_bucket, (i+1)*shapes_per_bucket)));
            }
        }


    }
}


module.exports = BucketManager;