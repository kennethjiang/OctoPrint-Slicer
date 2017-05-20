'use strict';

import * as THREE from 'three';
import { RectanglePacker } from './RectanglePacker';

export var ArrangeModels = function () {
  var self = this;
  // Get the bounding rectangles for all models.  Try rotating them a
  // bit to make the bounding boxes smaller.  If any lengths are very
  // similar (within 1%), round up the smaller (to save computation
  // time when trying all possibilities).  All rectangles are
  // increased in size by margin.  Returns a list that is the same
  // length as the list of stlFiles.  Each element is a possible
  // width/height/rotation.  Any rotatiion that is strictly worse than
  // all the ones already found is not reported.
  var getSmallestRectangles = function () {
    var rectangles = [];
    var dimensions = []; // A list of all the widths and heights that we've encountered.
    for (var i = 0; i < stlFiles.length; i++ ) {
      var model = stlFiles[i];
      var currentRectangles = []
      // Try all rotations of the model from 0 to 90, then swap
      // dimensions to add 90 degrees.  No need to try beyond 180,
      // which has no effect on the dimensions of the rectangle.
      var originalRotationOrder = model.rotation.order;
      model.rotation.reorder("ZYX");
      var originalRotation = model.rotation.z;
      for (var rotationDegrees = 0; rotationDegrees < 90;
           rotationDegrees += 15) {
        let rotation = THREE.Math.degToRad(rotationDegrees);
        model.rotation.z = originalRotation + rotation;
        var modelBox = model.userData.box3FromObject();
        var width = modelBox.max.x - modelBox.min.x + margin;
        var height = modelBox.max.y - modelBox.min.y + margin;
        currentRectangles.push(
          {"name": i,
           "width": width,
           "height": height,
           "prerotation": model.rotation.z});
        // also insert at -90 degrees
        currentRectangles.push(
          {"name": i,
           "width": height,
           "height": width,
           "prerotation": model.rotation.z - THREE.Math.degToRad(90)});
        dimensions.push(width);
        dimensions.push(height);
      }
      model.rotation.z = originalRotation;
      model.rotation.reorder(originalRotationOrder);
      rectangles.push(currentRectangles);
    }

    // Round up dimensions if needed.  Having fewer unique lengths
    // makes the computation faster.
    if (dimensions.length > 0) {
      // See if we can round up any dimensions.
      dimensions.sort(function (a,b) { return b-a; }); // Sort largest to smallest.
      var dimensionsMap = {};
      var current = dimensions[0];
      dimensionsMap[current] = current;
      for (var i = 1; i < dimensions.length; i++) {
        if (dimensions[i]/current < 0.99) {
          current = dimensions[i];
        }
        dimensionsMap[dimensions[i]] = current;
      }
      for (let variants of rectangles) {
        for (let rectangle of variants) {
          rectangle.width = dimensionsMap[rectangle.width];
          rectangle.height = dimensionsMap[rectangle.height];
        }
      }
      // Now remove rectangles that are strictly worse than the others
      // in their own list.
      rectangles = rectangles.map(function (variants) {
        variants.sort(function (r0, r1) {
          return r0.height - r1.height;
        });
        // heights are increasing.
        let currentWidth = Infinity;
        let newVariants = [];
        for (let i = 0; i < variants.length; i++) {
          if (variants[i].width < currentWidth) {
            newVariants.push(variants[i]);
            currentWidth = variants[i].width;
          }
        }
        return newVariants;
      });
      // Finally, sort them by area because smallest area will
      // probably be best.
      rectangles.forEach(function (variants) {
        variants.sort(function (r0, r1) {
          return r0.width*r0.height - r1.width*r1.height;
        });
      });
    }

    return rectangles;
  };

  // Returns true if pack result a is strictly better than b.
  var isBetterPackResult = function(a, b, bedsize_x_mm, bedsize_y_mm) {
    if (!a) {
      return false;  // No result is worst.
    }
    if (!a.placementSuccess) {
      return false;  // Didn't place all models.
    }
    if (!b) {
      return true;  // Anything is better than nothing
    }
    // How much empty space around the edges of the platform?
    var a_margin = Math.min(bedsize_x_mm - a.width,
                            bedsize_y_mm - a.height);
    var b_margin = Math.min(bedsize_x_mm - b.width,
                            bedsize_y_mm - b.height);
    if (a_margin != b_margin) {
      return a_margin > b_margin;
    }
    if (a.width * a.height < b.width * b.height) {
      return true;  // Smaller total area.
    }
    return false;
  };

  var applyPackResult = function(packResult) {
    // Apply the pack result to the models.
    for (var i = 0; i < stlFiles.length; i++ ) {
      var model = stlFiles[i];
      var oldOrder = model.rotation.order;
      model.rotation.reorder("ZYX");
      model.rotation.z = packResult.placements[i].prerotation;
      model.rotation.reorder(oldOrder);
      // i is the name in the placements and also the index in the
      // stlFiles.  The RectanglePacker assumes the back left corner
      // is 0,0 and y grows downward, which is opposite from the
      // printer so y needs to be negative.
      var width =  packResult.placements[i].width;
      var height = packResult.placements[i].height;
      var modelBox3 = model.userData.box3FromObject();
      model.position.x +=  packResult.placements[i].x - (packResult.width /2) + packResult.placements[i].width/2 - (modelBox3.max.x + modelBox3.min.x)/2;
      model.position.y += -packResult.placements[i].y + (packResult.height /2) - packResult.placements[i].height/2 - (modelBox3.max.y + modelBox3.min.y)/2;
    }
  };

  var needStartOver = function(modelPositions, bedsize_x_mm_, bedsize_y_mm_, margin_) {
    // If the previousLayout matches the current configuration, that
    // means that we can continue packing from where we left off.  If
    // not, it means that the user moved something and we should start
    // over.
    if (!modelPositions) {
      return true;
    }
    if (bedsize_x_mm_ != bedsize_x_mm ||
        bedsize_y_mm_ != bedsize_y_mm ||
        margin_ != margin) {
      return true;
    }
    if (stlFiles.length != modelPositions.length) {
      return true;
    }
    for (var i = 0; i < stlFiles.length; i++) {
      // TODO: Don't compute boundingbox, use Box3
      stlFiles[i].children[0].geometry.computeBoundingBox();
      if (!stlFiles[i].position.equals(modelPositions[i].position) ||
          !stlFiles[i].rotation.equals(modelPositions[i].rotation) ||
          !stlFiles[i].scale.equals(modelPositions[i].scale) ||
          !stlFiles[i].children[0].geometry.boundingBox.equals(modelPositions[i].boundingBox)) {
        return true;
      }
    }
    return false;
  };

  var getModelPositions = function() {
    // Return all the new model layout after placement is done.  This
    // is compared when arranging starts to see if we can continue
    // where we left off or if we must start over.
    var modelPositions = [];
    for (var i = 0; i < stlFiles.length; i++) {
      stlFiles[i].children[0].geometry.computeBoundingBox();
      modelPositions.push({
        position: stlFiles[i].position.clone(),
        rotation: stlFiles[i].rotation.clone(),
        scale: stlFiles[i].scale.clone(),
        boundingBox: stlFiles[i].children[0].geometry.boundingBox.clone()
      });
    }
    return modelPositions;
  };

  var rectangles;
  var stlFiles;

  // if these changed since the last run, we need to start over.
  var previousModelPositions;
  var bedsize_x_mm;
  var bedsize_y_mm;
  var margin;

  // Generates successively better pack results.  Yields null when the
  // endTime is passed.
  var arrangeHelper = function*(rectangles, bedsize_x_mm_, bedsize_y_mm_,
                                margin, endTime) {
    var bestPackResult = null;
    for(var newPackResult of RectanglePacker.pack(rectangles)) {
      if (isBetterPackResult(newPackResult, bestPackResult, bedsize_x_mm_, bedsize_y_mm_)) {
        bestPackResult = newPackResult;
        endTime = yield bestPackResult;
      }
      if (performance.now() > endTime) {
        yield null;
      }
    }
  };

  var arrangementGenerator = null;
  // Arrange the models on the platform.  Leave at least margin around
  // each object.  Stops in timeout milliseconds or fewer.  If the
  // return value is true, it finished trying all possibilities.  If
  // false, arrange can be run again to continue attempts to arrange.
  // If the forceStartOver is set, will start all the possibilities
  // again.
  self.arrange = function(stlFiles_, bedsize_x_mm_, bedsize_y_mm_,
                          margin_, timeoutMilliseconds, renderFn, forceStartOver = false) {
    stlFiles = stlFiles_;
    var endTime = performance.now() + timeoutMilliseconds;
    if (forceStartOver || !arrangementGenerator ||
        needStartOver(previousModelPositions, bedsize_x_mm_, bedsize_y_mm_, margin_)) {
      bedsize_x_mm = bedsize_x_mm_;
      bedsize_y_mm = bedsize_y_mm_;
      margin = margin_;
      rectangles = getSmallestRectangles();
      arrangementGenerator = arrangeHelper(rectangles, bedsize_x_mm, bedsize_y_mm, margin, endTime);
    }
    var bestPackResult = arrangementGenerator.next(endTime);
    while (!bestPackResult.done && bestPackResult.value) {
      // We got a new, better pack result.
      applyPackResult(bestPackResult.value);
      renderFn();
      bestPackResult = arrangementGenerator.next(endTime);
    }
    previousModelPositions = getModelPositions();  // Save what we've
                                                   // done so far.
    // Either we ran out of time or we finished all arranging
    // possibilities.
    return bestPackResult.done;
  };
};

// browserify support
if ( typeof module === 'object' ) {
  module.exports = ArrangeModels;
}
