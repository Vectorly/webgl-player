const Contour= require('./contour');


class Shape {

    constructor(data){


        this.xy = data.xy;
        this.color = data.color;

        let length = this.set(data.contours);

        this.hidden =data.foreground ? data.hidden: false;

        if(data.foreground) this.size = data.max_curves;
        else this.size = length;

        this.original_contours = data.contours;

        this.original_hidden = data.hidden;


    }

    reset(){

        this.hidden = this.original_hidden;

        this.set(this.original_contours);
    }


    set(contours){


        this.contours = [];

        let offset= 0;
        let start = [0, 0];



        for (let i=0; i < contours.length; i++){


            let contour = new Contour(contours[i], start);

            contour.offset = offset;

            this.contours.push(contour);

            offset+=contour.length;


        }

        return offset;




    }

    update(update){


        if(update.type ==="morph"){
            this.set(update.contours);
        } else if(update.type === "show"){
            this.hidden = false;
        } else if(update.type === "hide"){

            this.hidden = true;
        }



    }



    getBufferData(){

        const data = new Float32Array(this.size*13);
        const shape = this;

        let offset = 0;

        for (let i = 0; i < this.contours.length; i++){


            let contour = this.contours[i];

            for (let j = 0; j < contour.length; j++){


                data.set(contour.curves.slice(j*8, (j+1)*8), offset);
                data.set(shape.xy, offset+8);
                data.set(shape.color, offset+10);


                offset+=13;

            }




        }


        return data;
    }



}


module.exports = Shape;