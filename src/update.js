class UpdateManager{

    constructor(updates, shape_list, duration){

        this.duration = duration;

        this.updates = this.unpack(updates);
        this.frame = 0;
        this.shape_list = shape_list;



    }

    unpack(updates){

        const updates_by_frame = new Array(this.duration);


        for (const update of updates){

            if(!updates_by_frame[update.frame]) updates_by_frame[update.frame] = [];

            updates_by_frame[update.frame].push(update);
        }



        return updates_by_frame;

    }


    update(){


        this.frame ++;

        let updates = this.updates[this.frame];

        if(!updates) return null;

        for (const update of updates){

            this.shape_list.update(update);

        }


    }

}


module.exports = UpdateManager;