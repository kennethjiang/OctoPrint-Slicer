'use strict';

var ModelArranger = {

    applyPackResult: function(rect, packer) {
        rect.model.position.x = rect.fit.x - packer.root.w*0.5 + rect.w*0.5;
        rect.model.position.y = rect.fit.y - packer.root.h*0.5 + rect.h*0.5;
    },

    projectedRectOnXY: function( model ) {
        var margin = 10.0;
        var modelClone = model.clone(true);
        modelClone.rotation.reorder("ZYX");
        var modelBox = new THREE.Box3().setFromObject(modelClone);
        var width = modelBox.max.x - modelBox.min.x + margin;
        var height = modelBox.max.y - modelBox.min.y + margin;
        return { w: width, h: height, model: model };
    },

    arrange: function(models) {
        var rects = models.map( ModelArranger.projectedRectOnXY );

        // find a square that will likely fit all models
        var totalArea = rects.reduce( function(area, rect) {
            return area + rect.w * rect.h;
        }, 0);

        var largestSide = rects.reduce( function(largest, rect) {
            return Math.max(largest, rect.w, rect.h);
        }, 0);

        var side = Math.max(largestSide, Math.sqrt(totalArea));

        while ( rects.some( function(rect) { return !rect.fit; } ) ) {
            side *= 1.1; // increase 10% if not fit
            var packer = new GrowingPacker();
            rects.sort(function(a,b) { return (b.w * b.h > a.w * a.h); }); // sort inputs for best results
            packer.fit(rects);
            rects.forEach( function( rect ) { ModelArranger.applyPackResult(rect, packer); });
        }


    }
};

// browserify support
if ( typeof module === 'object' ) {
    module.exports = ModelArranger;
}
