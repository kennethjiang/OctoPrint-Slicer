'use strict';

export var RectanglePacker = {
  // Keeps track of an infinite space of rectangles.  The infinite
  // grid starts initialized to the initialValue.  Rectangles in the
  // infinite grid can be filled with other values.  Points and
  // rectangles can be queried for their current value.  There is
  // currently no optimization to reduce space if many rectangles are
  // merged.
  RectangleGrid: function(initialValue) {
    var self = this;
    // Cuts across the entire grid.
    var verticalCuts = [0];
    var horizontalCuts = [0];
    var contents = [[initialValue]];  // Access as contents[x][y]

    // Finds location of element in a sorted list.  If the element is not
    // found, returns one less than the the negative of where the element
    // could be inserted to maintain the sort order.
    var binarySearch =
        function(ar, el,
                 compareFn = function(a,b) { return a-b; }) {
          var m = 0;
          var n = ar.length - 1;
          while (m <= n) {
            var k = (n + m) >> 1;
            var cmp = compareFn(el, ar[k]);
            if (cmp > 0) {
              m = k + 1;
            } else if(cmp < 0) {
              n = k - 1;
            } else {
              return k;
            }
          }
          return -m-1;
        }

    // Add a vertical cut if there isn't one.  Returns index of the
    // cut.  Input must be non-negative.
    var cutVertically = function(x) {
      var cutLocation = binarySearch(verticalCuts, x);
      if (cutLocation >= 0) {
        // Already have a cut, do nothing.
        return cutLocation;
      }
      var newCutLocation = -cutLocation - 1;
      // We need to insert a cut at -cutLocation-1.
      verticalCuts.splice(newCutLocation, 0, x);
      contents.splice(newCutLocation, 0,
                      contents[newCutLocation-1].slice(0));
      return newCutLocation;
    }

    // Add a horizontal cut if needed.  Returns index of the cut.
    var cutHorizontally = function(y) {
      var cutLocation = binarySearch(horizontalCuts, y);
      if (cutLocation >= 0) {
        // Already have a cut, do nothing.
        return cutLocation;
      }
      var newCutLocation = -cutLocation - 1;
      // We need to insert a cut at -cutLocation-1.
      horizontalCuts.splice(newCutLocation, 0, y);
      for (var i = 0; i < verticalCuts.length; i++) {
        contents[i].splice(newCutLocation,
                           0, contents[i][newCutLocation-1]);
      }
      return newCutLocation;
    }

    // Set all spots in a rectangle to a new value.  If the width or
    // height are -1, that indicates a rectangle with no end.
    self.setRectangle = function(x, y, width, height, value) {
      if (width == 0 || height == 0) {
        return;
      }
      var xStart = cutVertically(x);
      if (width > 0) {
        var xEnd = cutVertically(x+width);
      } else {
        var xEnd = verticalCuts.length;
      }
      var yStart = cutHorizontally(y);
      if (height > 0) {
        var yEnd = cutHorizontally(y+height);
      } else {
        var yEnd = horizontalCuts.length;
      }
      for (var xIndex = xStart; xIndex < xEnd; xIndex++) {
        for (var yIndex = yStart; yIndex < yEnd; yIndex++) {
          contents[xIndex][yIndex] = value;
        }
      }
    }

    // Returns the values in the part of the RectangleGrid specified
    // as an object with keys.  The keys in the return value are the
    // output of keyFn on each rectangle.  keyFn should return a
    // string.
    self.getRectangle = function(x, y, width, height,
                                  keyFn = function(r) { return String(r); }) {
      if (width == 0 || height == 0) {
        return {};
      }

      var xStart = binarySearch(verticalCuts, x);
      if (xStart < 0) {
        xStart = -xStart-2;
      }
      var xEnd = binarySearch(verticalCuts, x + width);
      if (xEnd < 0) {
        xEnd = -xEnd-1;
      }
      var yStart = binarySearch(horizontalCuts, y);
      if (yStart < 0) {
        yStart = -yStart-2;
      }
      var yEnd = binarySearch(horizontalCuts, y + height);
      if (yEnd < 0) {
        yEnd = -yEnd-1;
      }
      var values = {};
      for (var xIndex = xStart; xIndex < xEnd; xIndex++) {
        for (var yIndex = yStart; yIndex < yEnd; yIndex++) {
          values[keyFn(contents[xIndex][yIndex])] = true;
        }
      }
      return values;
    }

    // Check if all values in the area provided are equal to the input
    // value.  This is like the getRectangle but more efficient if the
    // search is for just one element.
    self.isRectangle = function(x, y, width, height, value) {
      if (width == 0 || height == 0) {
        return {};
      }

      var xStart = binarySearch(verticalCuts, x);
      if (xStart < 0) {
        xStart = -xStart-2;
      }
      var xEnd = binarySearch(verticalCuts, x + width);
      if (xEnd < 0) {
        xEnd = -xEnd-1;
      }
      var yStart = binarySearch(horizontalCuts, y);
      if (yStart < 0) {
        yStart = -yStart-2;
      }
      var yEnd = binarySearch(horizontalCuts, y + height);
      if (yEnd < 0) {
        yEnd = -yEnd-1;
      }
      for (var xIndex = xStart; xIndex < xEnd; xIndex++) {
        for (var yIndex = yStart; yIndex < yEnd; yIndex++) {
          if (contents[xIndex][yIndex] != value) {
            return false;
          }
        }
      }
      return true;
    }

    // Displays the grid just at points where there was a cut.
    self.cutsToString = function(padding) {
      var result = padding;
      for (var i=0; i < verticalCuts.length; i++) {
        result += String(padding + verticalCuts[i]).slice(-padding.length);
      }
      result += "\n";
      for (var y=0; y < horizontalCuts.length; y++) {
        result += String(padding + horizontalCuts[y]).slice(-padding.length);
        for (var x=0; x < verticalCuts.length; x++) {
          result += String(padding + contents[x][y]).slice(-padding.length);
        }
        result += "\n";
      }
      return result;
    }

    // Displays the grid as points, from 0,0 to x,y, stepping by step
    // size.  The padding should be a series of spaces at least as
    // wide as the output of toStringFn.  toStringFn should convert
    // each rectange to a string.
    self.gridToString = function(x, y, step, padding,
                                 toStringFn = function (x) { return x; }) {
      var result = "";
      for (var j=0; j < y; j += step) {
        for (var i=0; i < x; i += step) {
          result += (padding + toStringFn(self.getValue(i, j)))
            .slice(-padding.length);
        }
        result += "\n";
      }
      return result;
    }

    // Get the value at x,y.
    self.getValue = function(x, y) {
      var xIndex = binarySearch(verticalCuts, x);
      if (xIndex < 0) {
        xIndex = -xIndex-2;
      }
      var yIndex = binarySearch(horizontalCuts, y);
      if (yIndex < 0) {
        yIndex = -yIndex-2;
      }
      return contents[xIndex][yIndex];
    }

    // Visit every top-left corner of the cells in rectangleGrid.  The
    // corners are visited from the top left to the bottom right,
    // visiting a column from top to bottom before moving to the
    // column to the right.  yields objects with x,y,value, the
    // coordinates of the top-left corner of the cell and the value
    // there.
    self.traverse = function*() {
      for (var xIndex = 0; xIndex < verticalCuts.length; xIndex++) {
        for (var yIndex = 0; yIndex < horizontalCuts.length; yIndex++) {
          yield {x: verticalCuts[xIndex],
                 y: horizontalCuts[yIndex],
                 value: contents[xIndex][yIndex]};
        }
      }
    }

    // Like traverse but visits in reverse order.
    self.reverseTraverse = function*(fn) {
      for (var xIndex = verticalCuts.length-1; xIndex >= 0; xIndex--) {
        for (var yIndex = horizontalCuts.length-1; yIndex >= 0; yIndex--) {
          yield {x: verticalCuts[xIndex],
                 y: horizontalCuts[yIndex],
                 value: contents[xIndex][yIndex]};
        }
      }
    }
  },

  // Inserts all rectangles into an RectangleGrid of given size in the
  // order provided.  Rectangles should have height and width and
  // unique name.  Each rectangle is inserted at minimum x possible.
  // If there are multiple spots that are at minimum x, choose the one
  // with minimum y.  Returns the new RectangleGrid.  The maxWidth is
  // an exclusive condition so if packing reaches it, packing will
  // fail.
  //
  // We also keep track of the minimum height change that might make a
  // difference in the packing.  That's based on the height of the
  // overlap of each attempt to place with the lower boundary.  The
  // rectangles are inserted in the order that they are provided.  To
  // make this algorithm optimal, all possible sortings would need to
  // be tried.
  //
  // Returns an object with rectangleGrid, placements,
  // minDeltaHeight, width, and height.  The rectangleGrid is the
  // grid created and useful for printing or debugging.  placements
  // is a map from name to the input rectangle, x, and y.
  // minDeltaHeight is the minimum height to add to the boundary to
  // make a difference in this run.
  packRectangles: function(rectangles,
                           maxHeight = Infinity,
                           maxWidth = Infinity
                          ) {
    var EMPTY = {name: "."};  // name must not be a number, will conflict

    var rectangleGrid = new RectanglePacker.RectangleGrid(EMPTY);
    if (rectangles.length == 0) {
      return {"rectangleGrid": rectangleGrid,
              "placements": {},
              "minDeltaHeight": 0};
    }

    // Minimum height needed to have made a difference in any of the
    // rectangles.
    var minDeltaHeight = Infinity;
    var totalWidth = 0;
    var totalHeight = 0
    var placements = {};
    for (var i = 0; i < rectangles.length; i++) {
      var rectangle = rectangles[i];
      var width = rectangle.width;
      var height = rectangle.height;
      var placementSuccess = false;
      for (var t of rectangleGrid.traverse()) {
        var x = t.x;
        var y = t.y;
        if (x + width >= maxWidth) {
          // Give up because all attempts will only be at this x or
          // greater.
          placementSuccess = false;
          break;
        }
        // If true, maybe there's place for this rectangle.
        var allEmpty = rectangleGrid.isRectangle(
            x, y, width, height, EMPTY);
        if (allEmpty) {
          // No overlapping other rectangles.
          var deltaHeight = y + height - maxHeight;
          if (deltaHeight <= 0) {
            // Not out of boundary.
            rectangleGrid.setRectangle(x, y, width, height, rectangle);
            placements[rectangle.name] = {"x": x, "y": y};
            totalWidth = Math.max(totalWidth, x + width);
            totalHeight = Math.max(totalHeight, y + height);
            placementSuccess = true;  // End the traverse with success.
            break;
          } else {
            // Out of boundary.  Could have placed if the maxHeight
            // were bigger.
            if (deltaHeight < minDeltaHeight) {
              minDeltaHeight = deltaHeight;
            }
          }
        }
      }
      if (!placementSuccess) {
        // Didn't succeed in one of the placements, don't keep trying.
        // Caller can read placements to see how many worked.
        break;
      }
    }
    return {"rectangleGrid": rectangleGrid,
            "placements": placements,
            "minDeltaHeight": minDeltaHeight,
            "width": totalWidth,
            "height": totalHeight,
            "placementsCount": i,
            "placementSuccess": i == rectangles.length
           };
  },

  // If compareFn is defined, it is used to compare inputs to remove
  // duplicate permutations.  stringFn should convert an element into
  // a string for comparing so that only unique permutations are
  // returned.  If stringFn is null, don't remove duplicates.
  permute: function*(inputs, toStringFn =
                     function() {
                       return JSON.stringify(arguments);
                     }) {
    var inputsCopy = inputs.slice(0);
    var swap = function(a,b) {
      var temp = inputsCopy[a];
      inputsCopy[a] = inputsCopy[b];
      inputsCopy[b] = temp;
    };
    var p = function*(position) {
      if (position >= inputsCopy.length-1) {
        yield inputsCopy;
      } else {
        let valuesSeen = new Set();
        for (let i=position; i < inputsCopy.length; i++) {
          let key = null;
          if (toStringFn) {
            key = toStringFn(inputsCopy[i]);
          }
          if (key == null || !valuesSeen.has(key)) {
            valuesSeen.add(key);
            swap(position, i);
            yield* p(position+1);
            swap(position, i);
          }
        }
      }
    }
    yield* p(0);
  },

  // Provide a function to memoize fn.  Optionally provide a function
  // that will convert arguments to fn to strings.  Returns a function
  // that can be run and will have answers memoized.
  memoize: function(fn,
                    toStringFn = function() {
                      return JSON.stringify(
                        arguments);
                    }) {
    var results = {};

    return function() {
      var inputString = toStringFn.apply(null, arguments);
      if (results.hasOwnProperty(inputString)) {
        return results[inputString];
      } else {
        results[inputString] = fn.apply(null, arguments);
        return results[inputString];
      }
    };
  },

  // Given a list of lists, yields a list of elements, one picked from
  // each list in the input list.  All such combinations are yielded.
  // Each member of inputs must be a non-empty list.
  combinations: function*(inputs) {
    var indices = [];
    var combination = [];
    for (var i = 0; i < inputs.length; i++) {
      indices.push(0);
      combination.push(inputs[i][0]);
    }
    while (1) {
      yield combination;
      var i;
      for (i=0; i < inputs.length; i++) {
        if(indices[i]+1 < inputs[i].length) {
          indices[i]++;
          combination[i] = inputs[i][indices[i]];
          break;
        } else {
          indices[i] = 0;
          combination[i] = inputs[i][indices[i]];
        }
      }
      if (i >= inputs.length) {
        return;
      }
    }
  },

  // Packs rectangles without rotating them.  Attempts all interesting
  // sizes of output rectangle given the input rectangle.  yields each
  // result.  The rectangles are inserted in the order that they are
  // provided.  Sorting them from tallest to shortest yields good
  // results.
  //
  // skipFn takes as input the current width and height and returns
  // them possibly modified.
  packWithoutRotation: function*(
    rectangles,
    skipFn = function(w,h) {
      return {"width": w, "height": h};}) {
    var tallest = 0;
    var widest = 0;
    for (var i = 0; i < rectangles.length; i++) {
      var tallest = Math.max(tallest, rectangles[i].height);
      var widest = Math.max(widest, rectangles[i].width);
    }

    var currentHeight = tallest;
    var currentWidth = Infinity;
    var result;
    do {
      var newWH = skipFn(currentWidth, currentHeight);
      currentHeight = newWH.height;
      currentWidth = newWH.width;
      //console.log("current: " + currentWidth + "x" + currentHeight);
      var packResult =
          RectanglePacker.packRectangles(rectangles, currentHeight, currentWidth);
      yield packResult;
      currentHeight = currentHeight + packResult.minDeltaHeight;
      if (packResult.placementsCount == rectangles.length) {
        // If we succeeded, set a new target width.
        currentWidth = packResult.width;
      }
    } while (currentWidth >= widest && packResult.minDeltaHeight < Infinity);
  },

  // Sorts by height, then by width, biggest first.
  sortRectangles: function(rectangles) {
    return rectangles.sort(function (a,b) {
      if (a.height != b.height) {
        return b.height-a.height;
      }
      return b.width-a.width;
    });
  },

  /* Packs rectangles as above but the input is a list of lists with
   * all the relavant rotations. The result is the same as pack above
   * but with an extra member, rotation, alongside x and y in the
   * placements.  */
  packWithRotation: function*(rectangles, skipFn) {
    var rotatedRectangles = rectangles;
    var memoizedPacker = RectanglePacker.memoize(
      RectanglePacker.packWithoutRotation,
      function (rectangles) {
        // Convert rectangles to a string that indicates uniqueness.
        return rectangles.map(function (r) {
          return r.width + "x" + r.height;
        }).join(",");
      });
    var toStringFn = function (permutationElement) {
      return permutationElement.height + "x" + permutationElement.width;
    };
    let seenCombinations = new Set();
    for (var combination of RectanglePacker.combinations(rotatedRectangles)) {
      var combinationCopy = RectanglePacker.sortRectangles(combination.slice());
      let combinationKey = combinationCopy.reduce(
        function (sum, value) { return sum + "_" + toStringFn(value); },
        "");
      if (seenCombinations.has(combinationKey)) {
        continue;
      }
      seenCombinations.add(combinationKey);
      for (var permutation of RectanglePacker.permute(combinationCopy, toStringFn)) {
        for (var packResult of memoizedPacker(permutation, skipFn)) {
          // Copy the members from the original object.
          for (var i=0; i < permutation.length; i++) {
            if (packResult.placements.hasOwnProperty(permutation[i].name)) {
              for (let prop of Object.getOwnPropertyNames(permutation[i])) {
                packResult.placements[permutation[i].name][prop] =
                  permutation[i][prop];
              }
            }
          }
          yield packResult;
        }
      }
    }
  },

  // Pack rectangles into as small a space as possible.
  //
  // rectangles is a list of a list of objects.  Each object must have
  // height, width, and a name which is a simple data type, like a
  // string or number.  pack will yield a packResult for every unique
  // combination and permutation of packing.  The packResult includes
  // a placement object which maps from rectangle name to x,y
  // coordinates for the top-left corner of the rectangle.  packResult
  // also has a placementCount which is the number of successfully
  // placed rectangles and placementSuccess, which indicates if
  // placement of all rectangles was successful.
  pack: function*(rectangles) {
    var bestHW = {}
    var skipFn = function (w,h) {
      // Narrow the available width if it is worse than an already
      // seen better width.
      var newWidth = w;
      for (var bestHeight in bestHW) {
        if (bestHeight <= h &&
            bestHW[bestHeight] < newWidth) {
          newWidth = bestHW[bestHeight];
        }
      }
      return {"height": h,
              "width": newWidth};
    };
    for (var packResult of RectanglePacker.packWithRotation(rectangles, skipFn)) {
      if (packResult.placementSuccess) {
        //console.log("found " + packResult.width + "x" +packResult.height);
        if (!bestHW.hasOwnProperty(packResult.height) ||
            bestHW[packResult.height] > packResult.width) {
          // Save the best width for each height.
          bestHW[packResult.height] = packResult.width;
        }
      }
      yield packResult;
    }
  }
};

// browserify support
if ( typeof module === 'object' ) {
  module.exports = RectanglePacker;
}
/*
var rectangles = [
  {name: 0, height:5, width:4},
  {name: 0, height:6, width:4},
  {name: 0, height:7, width:4},
  {name: 0, height:8, width:4},
  {name: 0, height:9, width:4},
  {name: 0, height:1, width:4},
  {name: 0, height:2, width:4}
];
for (var x of RectanglePacker.pack(rectangles)) {
  if (x.placementSuccess) {
    console.log("result: " + x.width + "x" + x.height);
  }
}
*/
