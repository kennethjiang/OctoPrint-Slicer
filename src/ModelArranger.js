'use strict';

var ModelArranger = {

    applyPackResult: function(rect, packer) {
        rect.model.position.x = rect.fit.x - packer.root.w*0.5 + rect.w*0.5;
        rect.model.position.y = rect.fit.y - packer.root.h*0.5 + rect.h*0.5;
    },

    projectedRectOnXY: function( model ) {
        var margin = 10.0;
        var modelBox = new THREE.Box3().setFromObject(model);
        var width = modelBox.max.x - modelBox.min.x + margin;
        var height = modelBox.max.y - modelBox.min.y + margin;
        return { w: width, h: height, area: width*height, model: model };
    },

    arrange: function(models) {
        var modelRectMap = models.reduce( function( map, model ) {
            return map.set(model, ModelArranger.projectedRectOnXY(model));
        }, new Map());

        // loop through all sorting criteria, and pick the best one (with smalles overall area)
        var criteria = ['w', 'h', 'a', 'max', 'min', 'height', 'width', 'area', 'maxside'];
        var allPackers = criteria.map( function( crit ) {

            var rects = models.map( function(model) { return modelRectMap.get(model); });
            rects.sort( ModelArranger.sort[crit] );

            var packer = new GrowingPacker();
            packer.fit(rects);

            return {packer: packer, rects: rects};
        });

        var packersSortedByArea = allPackers.filter( function( result ) {
            return ! result.rects.some( function(rect) { return !rect.fit; } );
        }).sort( function(a, b) {
            return b.packer.root.area - a.packer.root.area;
        });

        if (packersSortedByArea.length > 0) {
            packersSortedByArea[0].rects.forEach( function( rect ) { ModelArranger.applyPackResult(rect, packersSortedByArea[0].packer); });
        }
    },

    sort: {

        w       : function (a,b) { return b.w - a.w; },
        h       : function (a,b) { return b.h - a.h; },
        a       : function (a,b) { return b.area - a.area; },
        max     : function (a,b) { return Math.max(b.w, b.h) - Math.max(a.w, a.h); },
        min     : function (a,b) { return Math.min(b.w, b.h) - Math.min(a.w, a.h); },

        height  : function (a,b) { return ModelArranger.sort.msort(a, b, ['h', 'w']);               },
        width   : function (a,b) { return ModelArranger.sort.msort(a, b, ['w', 'h']);               },
        area    : function (a,b) { return ModelArranger.sort.msort(a, b, ['a', 'h', 'w']);          },
        maxside : function (a,b) { return ModelArranger.sort.msort(a, b, ['max', 'min', 'h', 'w']); },

        msort: function(a, b, criteria) { /* sort by multiple criteria */
            var diff, n;
            for (n = 0 ; n < criteria.length ; n++) {
                diff = ModelArranger.sort[criteria[n]](a,b);
                if (diff != 0)
                    return diff;
            }
            return 0;
        }

    }

};

// browserify support
if ( typeof module === 'object' ) {
    module.exports = ModelArranger;
}
