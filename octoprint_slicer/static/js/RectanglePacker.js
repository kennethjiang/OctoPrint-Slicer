'use strict';

var RectanglePacker = {
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

    // Visit every top-left corner of the cells in rectangleGrid.
    // The corners are visited from the top left to the bottom right,
    // visiting a column from top to bottom before moving to the
    // column to the right.  fn should be a function of up to 3
    // variables, x and y and value, the coordinates of the top-left
    // corner of the cell and the value there.  If fn returns true,
    // end the traverse.
    self.traverse = function(fn) {
      for (var xIndex = 0; xIndex < verticalCuts.length; xIndex++) {
        for (var yIndex = 0; yIndex < horizontalCuts.length; yIndex++) {
          if (fn(verticalCuts[xIndex],
                 horizontalCuts[yIndex],
                 contents[xIndex][yIndex])) {
            return;
          }
        }
      }
    }

    // Like traverse but visits in reverse order.
    self.reverseTraverse = function(fn) {
      for (var xIndex = verticalCuts.length-1; xIndex >= 0; xIndex--) {
        for (var yIndex = horizontalCuts.length-1; yIndex >= 0; yIndex--) {
          if (fn(verticalCuts[xIndex],
                 horizontalCuts[yIndex],
                 contents[xIndex][yIndex])) {
            return;
          }
        }
      }
    }
  },

  /* Pack rectangles.  The input is an array of rectangles.  The
   * rectangles are inserted in the order that they are provided.
   * Each rectangle is an object with height and width and name.
   * traverseFn is a function that gets an object: { rectangleGrid,
   * width, height, placements, minDeltaHeight } It can keep track of
   * the best placement so far by comparing to the previous best and
   * optionally print the rectangleGrid.  If traverseFn returns true,
   * the traverse ends.*/
  pack: function(rectangles, traverseFn) {
    var EMPTY = {name: "."};  // name must not be a number, will conflict
    var BOUNDARY = {name: "_"};  // name must not be a number, will conflict

    // Inserts all rectangles into an RectangleGrid of given height
    // from biggest to smallest.  Each rectangle is inserted at
    // minimum x possible without crossing the height.  If there are
    // multiple spots that are at minimum x, choose the one with
    // minimum y.  Returns the new RectangleGrid.  We also keep track
    // of the minimum height change that might make a difference in
    // the packing.  That's based on the height of the overlap of each
    // attempt to place with the lower boundary.  The rectangles are
    // inserted in the order that they are provided.  To make this
    // algorithm optimal, all possible sortings would need to be
    // tried.
    //
    // Returns an object with rectangleGrid, placements,
    // minDeltaHeight, width, and height.  The rectangleGrid is the
    // grid created and useful for printing or debugging.  placements
    // is a map from name to the input rectangle, x, and y.
    // minDeltaHeight is the minimum height to add to the boundary to
    // make a difference in this run
    var insertAllRectangles = function(rectangles, boundaryHeight) {
      var rectangleGrid = new RectanglePacker.RectangleGrid(EMPTY);
      if (rectangles.length == 0) {
        return {"rectangleGrid": rectangleGrid,
                "placements": {},
                "minDeltaHeight": 0};
      }
      rectangleGrid.setRectangle(0, boundaryHeight, -1, -1, BOUNDARY);
      var minDeltaHeight = null;
      var placements = {};
      for (var i = 0; i < rectangles.length; i++) {
        var rectangle = rectangles[i];
        var width = rectangle.width;
        var height = rectangle.height;
        rectangleGrid.traverse(function (x, y) {
          var valuesUnderRectangle = rectangleGrid.getRectangle(
            x, y, width, height, function (r) { return r.name; });
          var allEmpty = Object.keys(valuesUnderRectangle).length == 1 &&
              valuesUnderRectangle.hasOwnProperty(EMPTY.name);
          if (allEmpty) {
            rectangleGrid.setRectangle(x, y, width, height, rectangle);
            placements[rectangle.name] = {"x": x, "y": y};
            return true;  // End the traverse.
          } else {
            // Would we have placed this rectangle if it weren't for
            // the boundary?  That means we only overlapped
            // BOUNDARY and possibly also EMPTY, but nothing else.
            var noRectanglesOverlapped =
                Object.keys(valuesUnderRectangle).length <= 2 &&
                valuesUnderRectangle.hasOwnProperty(BOUNDARY.name) &&
                (Object.keys(valuesUnderRectangle).length == 1 ||
                 valuesUnderRectangle.hasOwnProperty(EMPTY.name));
            if (noRectanglesOverlapped) {
              // What increase in height would we have needed to make
              // this placement?
              var deltaHeight = y + height - boundaryHeight;
              if (minDeltaHeight === null || deltaHeight < minDeltaHeight) {
                minDeltaHeight = deltaHeight;
              }
            }
          }
        });
      }
      return {"rectangleGrid": rectangleGrid,
              "placements": placements,
              "minDeltaHeight": minDeltaHeight};
    }

    // Find the leftmost column in the provided rectangleGrid that
    // doesn't have any rectangles in it.  This is the leftmost
    // boundary.  Because we always try to insert as far left as
    // possible, the rightmost column is the only empty one.
    var findLeftmostEmptyColumn = function(rectangleGrid) {
      var result;
      rectangleGrid.reverseTraverse(function (x, y ,value) {
        result = x;
        return true; // End the reverse traverse.
      });
      return result;
    }

    var maxRectangleHeight = 0;
    var maxRectangleWidth = 0;
    for (var i = 0; i < rectangles.length; i++) {
      maxRectangleHeight = Math.max(maxRectangleHeight, rectangles[i].height);
      maxRectangleWidth = Math.max(maxRectangleWidth, rectangles[i].width);
    }
    var currentWidth = null;  // Still need to find it.
    var currentHeight = maxRectangleHeight;
    do {
      var insertResult = insertAllRectangles(rectangles, currentHeight);
      var rectangleGrid = insertResult.rectangleGrid;
      var placements = insertResult.placements;
      var minDeltaHeight = insertResult.minDeltaHeight;

      var leftmostEmptyColumn = findLeftmostEmptyColumn(rectangleGrid);
      insertResult.height = currentHeight;
      insertResult.width = leftmostEmptyColumn;

      /* Uncomment this to view the rectangle grid:
         rectangleGrid.setRectangle(leftmostEmptyColumn, 0, -1, -1, BOUNDARY);
         console.log(rectangleGrid.gridToString(
           leftmostEmptyColumn, currentHeight, " ",
           function(x) { return x.name; }));
         console.log("size is " + leftmostEmptyColumn + "," + currentHeight);
      */

      // We are trying to get a new width that is less than
      // currentWidth.  If there is no currentWidth, that is the start
      // condition so just assume that we succeeded in all placements.
      currentWidth = leftmostEmptyColumn;
      if (traverseFn(insertResult)) {
        return;  // Quit if traverse returns true.
      }
      currentHeight += minDeltaHeight;
    } while (currentWidth > maxRectangleWidth);
  },

  /* Packs rectangles as above but tries all combinations of rotating
   * or not rotating elements by 90 degrees, which might improve
   * packing. The result is the same as pack above but with an extra
   * member, rotation, alongside x and y in the placements.  */
  packWithRotation: function(rectangles, traverseFn) {
    // We could use an integer instead of the rotations array.
    var rotations = [];
    for (var i = 0; i < rectangles.length; i++) {
      rotations.push(0);
    }
    var permutations = {}
    var bestInsertResult = null;
    do {
      // Is this a new pemutation?
      var rotatedRectangles = []
      for (var j = 0; j < rectangles.length; j++) {
        var newRectangle = {
          name: rectangles[j].name,
        };
        if(rotations[j] == 0) {
          newRectangle['height'] = rectangles[j].height;
          newRectangle['width'] = rectangles[j].width;
        } else {  // Swap.
          newRectangle['height'] = rectangles[j].width;
          newRectangle['width'] = rectangles[j].height;
        }
        rotatedRectangles.push(newRectangle);
      }
      // Input to pack should be sorted tallest to shortest.
      rotatedRectangles.sort(function (a,b) {
        if (a.height != b.height) {
          return b.height - a.height;
        } else {
          return b.width - a.width;
        }
      });
      // Make a string representing the widths and heights of
      // rectangles.  If the string is not unique then it will
      // produce an already seen placement so no need to process
      // it.
      var permutationString = rotatedRectangles.map(function (r) {
        return r.height + "x" + r.width;
      }).join(",");
      if (!permutations.hasOwnProperty(permutationString)) {
        // This is a unique list of shapes.
        permutations[permutationString] = true;
        RectanglePacker.pack(
          rotatedRectangles,
          function (i) {
            // Attach the rotations to the placements.
            for (var j = 0; j < rotations.length; j++) {
              i.placements[rectangles[j].name].rotation =
                rotations[j] ? 90 : 0;
            }
            traverseFn(i);
          });
      }
      // Increment to next permutation.
      for (var i = 0; i < rectangles.length; i++) {
        if (rotations[i] >= 1) {
          rotations[i] = 0;
        } else {
          rotations[i]++;
          break;
        }
      }
    } while(i < rectangles.length);
  }
};

// browserify support
if ( typeof module === 'object' ) {
  module.exports = RectanglePacker;
}
