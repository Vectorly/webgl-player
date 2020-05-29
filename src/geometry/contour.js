const math = require('mathjs');

class Contour {

    constructor(path, start){

        this.length = 0;
        this.curves = [];


        let i = 0;
        let x,y;

        let last_curve = ['m'];

        start[0] += path[0];
        start[1] += path[1];

        i += 2;

        while (i < path.length) {

            let element = path[i];


            if (element === 0) {

                x = [0, 0, path[i + 1], path[i + 1]].map(x => x + start[0]);
                y = [0, 0, path[i + 2], path[i + 2]].map(y => y + start[1]);

                last_curve = ['l'];

                start[0] = x[3];
                start[1] = y[3];

                this.length += 1;
                this.curves.push(...x, ...y);

                i += 3;
            } else {


                if(last_curve && !isNaN(last_curve[0])){

                    let l = last_curve.length;

                    let dx = path[i + 2];
                    let dy = path[i + 3];

                    let norm = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));

                    let nx = -dy/norm;
                    let ny = dx/norm;
                    let fx = dx/norm;
                    let fy = dy/norm;

                    let f2 =  path[i+1];
                    let n =path[i];

                    let c2x = n*nx + f2*fx + dx;
                    let c2y = n*ny + f2*fy + dy;

                    let last_dx = last_curve[l-2];
                    let last_dy = last_curve[l-1];

                    let last_norm = Math.sqrt(Math.pow(last_dx, 2) + Math.pow(last_dy, 2));
                    let last_nx = -last_dy/last_norm;
                    let last_ny = last_dx/last_norm;
                    let last_fx = last_dx/last_norm;
                    let last_fy = last_dy/last_norm;

                    let last_f2 = last_curve[l-3];
                    let last_n = last_curve[0];

                    let px = last_n*last_nx + last_f2*last_fx;
                    let py = last_n*last_ny + last_f2*last_fy;

                    let p = [px, py];
                    let phat = math.divide(p, math.norm(p));

                    let q = math.divide(n, math.dot(phat, [-nx, -ny]));

                    let c1 = math.multiply(phat, -1*q);

                    let c1x = c1[0];
                    let c1y = c1[1];

                    if(Math.abs(c1y) > 200 || Math.abs(c1x) > 200){
                        c1y = 0;
                        c1x = 0;
                    }

                    x = [0, c1x, c2x, dx].map(x => x + start[0]);
                    y = [0, c1y, c2y,dy].map(y => y + start[1]);


                    start[0] = x[3];
                    start[1] = y[3];

                    this.length += 1;
                    this.curves.push(...x, ...y);

                    last_curve = path.slice(i, i+4);
                    i += 4;

                } else{

                    let dx = path[i + 3];
                    let dy = path[i + 4];

                    let norm = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));




                    let nx = -dy/norm;
                    let ny = dx/norm;
                    let fx = dx/norm;
                    let fy = dy/norm;

                    let f1 = path[i+1];
                    let f2 =  path[i+2];
                    let n =path[i];

                    let c1x = n*nx + f1*fx;
                    let c1y = n*ny + f1*fy;

                    let c2x = n*nx + f2*fx + dx;
                    let c2y = n*ny + f2*fy + dy;


                    x = [0, c1x, c2x, dx].map(x => x + start[0]);
                    y = [0,c1y, c2y,dy].map(y => y + start[1]);

                    start[0] = x[3];
                    start[1] = y[3];

                    this.length += 1;
                    this.curves.push(...x, ...y);


                    last_curve = path.slice(i, i+5);
                    i += 5;

                }

            }

        }



    }





}

module.exports = Contour;