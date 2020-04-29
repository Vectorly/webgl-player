/*

    This is a temporary file, which takes in background_objects and foreground_objects from vectorization, and outputs a custom data.json file
 */


const fs = require('fs-extra');

const background_objects = shuffle(fs.readJsonSync('background_objects.json'));

const foreground_objects = shuffle(fs.readJsonSync('foreground_objects.json'));


const data= {};

const foreground_shapes = [];
const background_shapes = [];

const frameUpdates = [];

const maxNumCurves = new Array(foreground_objects.length).fill(0);


let total_curves = 0;


foreground_objects.forEach(function (object, fgidx) {



    if(object.actions[0].time > 0){
        const show_frame = Math.round(object.actions[0].time*30/1000);
        if(!frameUpdates[show_frame]) frameUpdates[show_frame] = [];
        frameUpdates[show_frame].push({type: "show",  "rid": object.rid,  "i": fgidx});

    }



    let start_contours = getContours(object.path);

    let max_num_curves = numBezierCurves(start_contours);




    if(object.actions.length > 1){

        for (let i = 1; i < object.actions.length; i++){

            const action = object.actions[i];
            action.rid = object.rid;
            action.i = fgidx;

            const frame_number = Math.round(action.time*30/1000);
            if(!frameUpdates[frame_number]) frameUpdates[frame_number] = [];

            if(action.type === "morph"){



                action.contours = getContours(action.path);

                let numCurves = numBezierCurves(action.contours);

                if(numCurves > max_num_curves) max_num_curves = numCurves;


                delete action.path;

            }



            delete action.time;



            frameUpdates[frame_number].push(action);

        }



    }


    maxNumCurves[fgidx] = max_num_curves;


});


function numBezierCurves(contours) {
    let num_bezier_curves = 0;

    contours.forEach(function (contour) {
        num_bezier_curves+=contour.length;
    });

    return num_bezier_curves;
}

data.updates = frameUpdates;









// Get Init data
foreground_objects.forEach(function (object, i) {

    const shape = {
        xy: object.xy,
        rid: object.rid,
        hidden: (object.actions[0].time > 0),
        foreground:true,
        color: (typeof object.color === "string" ) ? hexToRgbA(object.color) : object.color,
    };

    shape.d_strings = object.d || object.path;
    shape.contours = getContours(shape.d_strings);

    shape.max_curves = maxNumCurves[i];

    total_curves += shape.max_curves;

    foreground_shapes.push(shape);

});



background_objects.forEach(function (object, i) {

    const shape = {
        xy: object.xy,
        rid: object.rid,
        foreground:false,
        color: (typeof object.color === "string" ) ? hexToRgbA(object.color) : object.color,
    };


    shape.d_strings = object.d || object.path;
    shape.contours = getContours(shape.d_strings);

    shape.max_curves = numBezierCurves(shape.contours);

    total_curves += shape.max_curves;

    background_shapes.push(shape);

});






function getContours(d_strings) {

    const contours = [];

    d_strings.forEach(function (d_string, d_idx) {


        const svg_key_regex =/[A-Z]/gi;


        let paths = d_string.split("z");


        let num_bezier_curves = 0;
        let num_vertices = 0;


        let current_x = 0;
        let current_y = 0;


        paths.forEach(function (path) {

            let contour = [];


            let svg_keys = [...path.matchAll(svg_key_regex)];

            let path_data = path.split(svg_key_regex);



            for (let i = 0; i < svg_keys.length; i++){

                let key = svg_keys[i][0];
                let path_info = path_data[i+1];


                path_info = path_info.replace(/[0-9]-[0-9]/g, function (str) {
                    let parts = str.split('-');
                    return `${parts[0]} -${parts[1]}`;
                });

                path_info = path_info.replace(/[0-9]-[0-9]/g, function (str) {
                    let parts = str.split('-');
                    return `${parts[0]} -${parts[1]}`;
                });



                let points = [];

                path_info.split(' ').forEach(function (element) {
                    if(element !== '') points.push(Number(element))
                });


                if(key === "M"){

                    num_vertices+=1;

                    current_x = points[0];
                    current_y = points[1];


                } else if (key === "m") {


                    num_vertices+=1;

                    current_x = points[0] + current_x;
                    current_y = points[1] + current_y;


                } else if (key ==="c"){


                    let num_curves = points.length/6;
                    num_vertices+=num_curves;
                    num_bezier_curves+=num_curves;

                    for (let j = 0; j < num_curves; j++){

                        let c1x = points[j*6] + current_x;
                        let c1y = points[j*6 + 1]  + current_y;

                        let c2x = points[j*6 + 2] + current_x;
                        let c2y = points[j*6 + 3] + current_y;

                        let dx = points[j*6 + 4]  + current_x;
                        let dy = points[j*6 + 5] + current_y;

                        let new_curve = [current_x, current_y, c1x, c1y, c2x, c2y, dx, dy];

                        contour.push(new_curve);


                        current_x =dx;
                        current_y = dy;

                    }

                } else if (key === "C"){


                    let num_curves = points.length/6;
                    num_vertices+=num_curves;
                    num_bezier_curves+=num_curves;

                    for (let j = 0; j < num_curves; j++){


                        let c1x = points[j*6];
                        let c1y = points[j*6 + 1]*-1;

                        let c2x = points[j*6 + 2];
                        let c2y = points[j*6 + 3]*-1;

                        let dx = points[j*6 + 4];
                        let dy = points[j*6 + 5];

                        let new_curve = [current_x, current_y, c1x, c1y, c2x, c2y, dx, dy];

                        contour.push(new_curve);

                        current_x =dx;
                        current_y = dy;

                    }
                }
                else if (key === "l"){
                    let num_curves = points.length/2;

                    for (let j = 0; j < num_curves; j++){


                        let dx = points[j*2]  + current_x;
                        let dy = points[j*2+1] + current_y;

                        let new_curve = [current_x, current_y, dx, dy];

                        contour.push(new_curve);

                        current_x =dx;
                        current_y = dy;

                    }

                    num_vertices+=num_curves;


                }else if(key === "L"){


                    let num_curves = points.length/2;

                    for (let j = 0; j < num_curves; j++){


                        let x = points[j*2];
                        let y = points[j*2+1];

                        let new_curve = [current_x, current_y, x, y];

                        contour.push(new_curve);

                        current_x =x;
                        current_y = y;

                    }

                    num_vertices+=num_curves;

                }
                else{
                    console.log(`Unknown key: ${key}`);

                }

            }


            contours.push(contour);

        });


    });



    return contours;
}



data.background_shapes = background_shapes;
data.foreground_shapes = foreground_shapes;
data.num_curves = total_curves;







fs.writeJsonSync('data.json', data);





function hexToRgbA(hex){
    let c;
    if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
        c= hex.substring(1).split('');
        if(c.length=== 3){
            c= [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c= '0x'+c.join('');
        return [(c>>16)&255, (c>>8)&255, c&255];
    }
    throw new Error(`Bad Hex: ${hex} `);
}


function shuffle(array) {
    let currentIndex = array.length, temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}
