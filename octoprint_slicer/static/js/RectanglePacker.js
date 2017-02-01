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
    // column to the right.  fn should be a function of up to 3
    // variables, x and y and value, the coordinates of the top-left
    // corner of the cell and the value there.  If fn returns
    // something other than undefined end the traverse.  The return
    // value is the return value from the input function.  If the
    // traverse ends without a defined result, the return value is
    // also undefined.
    self.traverse = function(fn) {
      for (var xIndex = 0; xIndex < verticalCuts.length; xIndex++) {
        for (var yIndex = 0; yIndex < horizontalCuts.length; yIndex++) {
          var result = fn(verticalCuts[xIndex],
                          horizontalCuts[yIndex],
                          contents[xIndex][yIndex]);
          if (result !== undefined) {
            return result;
          }
        }
      }
    }

    // Like traverse but visits in reverse order.
    self.reverseTraverse = function(fn) {
      for (var xIndex = verticalCuts.length-1; xIndex >= 0; xIndex--) {
        for (var yIndex = horizontalCuts.length-1; yIndex >= 0; yIndex--) {
          var result = fn(verticalCuts[xIndex],
                          horizontalCuts[yIndex],
                          contents[xIndex][yIndex]);
          if (result != undefined) {
            return result;
          }
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
                           maxHeight = -1,
                           maxWidth = -1
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
    var minDeltaHeight = undefined;
    var totalWidth = 0;
    var totalHeight = 0
    var placements = {};
    for (var i = 0; i < rectangles.length; i++) {
      var rectangle = rectangles[i];
      var width = rectangle.width;
      var height = rectangle.height;
      var placementSuccess =
          rectangleGrid.traverse(function (x, y) {
            if (maxWidth >= 0 && x + width >= maxWidth) {
              // Give up because all attempts will only be at this x
              // or greater.
              return false;
            }
            // If positive, crosses the boundary.
            var allEmpty = rectangleGrid.isRectangle(
                x, y, width, height, EMPTY);
            if (allEmpty) {
              var deltaHeight = y + height - maxHeight;
              if (maxHeight < 0 || deltaHeight <= 0) {
                // Can place.
                rectangleGrid.setRectangle(x, y, width, height, rectangle);
                placements[rectangle.name] = {"x": x, "y": y};
                totalWidth = Math.max(totalWidth, x + width);
                totalHeight = Math.max(totalHeight, y + height);
                return true;  // End the traverse with success.
              }
              // Could have placed if the maxHeight were bigger.
              if (minDeltaHeight === undefined || deltaHeight < minDeltaHeight) {
                minDeltaHeight = deltaHeight;
              }
            }
          });
      if (!placementSuccess) {
        // Didn't succeed in any of the placements, don't keep trying.
        // Caller can read placements to see how many worked.
        break;
      }
    }
    return {"rectangleGrid": rectangleGrid,
            "placements": placements,
            "minDeltaHeight": minDeltaHeight,
            "width": totalWidth,
            "height": totalHeight,
            "placementsCount": i
           };
  },

  // Runs traverse on each ordering of the inputs.  traverseFn must
  // not modify the inputs.  If any of traverseFn return something
  // other than undefiend, stop the traversal.  If compareFn is
  // defined, it is used to compare inputs to remove duplicate
  // permutations.  compareFn should return 0 if elements are the
  // same, like the compare that sort uses.
  //
  // Returns an object with the result and with a continuation number.
  // That number is the number of permutations that have already run.
  // It includes the count of duplicates even though those duplicates
  // didn't occur so that compareFn can be changed when rerunning
  // permute.
  permute: function(inputs, traverseFn, start = 0, compareFn) {
    var inputsCopy = inputs.slice(0);
    var position = 0;
    var swap = function(a,b) {
      var temp = inputsCopy[a];
      inputsCopy[a] = inputsCopy[b];
      inputsCopy[b] = temp;
    };

    var factorial = function (x) {
      var result = 1;
      while (x > 1) {
        result *= x;
        x--;
      }
      return result;
    }
    var p = function(index = 0) {
      if (index >= inputsCopy.length) {
        position++;
        return traverseFn(inputsCopy);
      }
      var toDo = factorial(inputsCopy.length - (index+1));
      if (position + toDo > start) {
        p(index+1);
      } else {
        position += toDo; // Skip these.
      }
      for (var i=index+1; i < inputsCopy.length; i++) {
        if (position + toDo > start) {
          if (!compareFn || compareFn(inputsCopy[index], inputsCopy[i]) != 0) {
            swap(index, i);
            var result = p(index+1, start);
            if (result !== undefined) {
              return result;
            }
            swap(index, i);
          } else {
            position += toDo; // Still need to count them.
          }
        } else {
          position += toDo;
        }
      }
    };

    return {result: p(), position: position};
  },

  // Provide a function to memoize fn.  Optionally provide a function
  // that will convert arguments to fn to strings.  Returns a function
  // that can be run and will have answers memoized.
  memoize: function(fn,
                    toStringFn = function() {
                      return JSON.stringify(
                        Array.prototype.slice.call(arguments));
                    }) {
    var results = {};

    return function() {
      var inputString = toStringFn.apply(null, arguments);
      if (results.hasOwnProperty(inputString)) {
        return results[inputString];
      } else {
        console.log("packing: " + inputString);
        var start = performance.now();
        results[inputString] = fn.apply(null, arguments);
        console.log("done packing: " + (performance.now()-start));
        return results[inputString];
      }
    };
  },

  // Given a list of lists, runs traverseFn on a list of elements, one
  // picked from each list in the input list.  traverseFn must not
  // modify its input.
  combinations: function(inputs, traverseFn) {
    var combination = [];
    var c = function(index = 0) {
      if (index >= inputs.length) {
        return traverseFn(combination);
      }
      for (var i=0; i < inputs[index].length; i++) {
        combination.push(inputs[index][i]);
        var result = c(index+1);
        if (result !== undefined) {
          return result;
        }
        combination.pop();
      }
    }

    return c();
  },

  // Packs rectangles without rotating them.  Attempts all interesting
  // sizes of output rectangle given the input rectangle.  Runs
  // traverseFn on the result of each packing.  If traverseFn returns
  // anything other than undefined, stop and return that.  The
  // rectangles are inserted in the order that they are provided.
  // Sorting them from tallest to shortest yields good results.
  //
  // skipFn takes as input the current width and height and returns
  // them possibly modified.
  packWithoutRotation: function(
    rectangles, traverseFn,
    skipFn = function(w,h) {
      return {"width": w, "height": h};}) {
    var tallest = 0;
    var widest = 0;
    for (var i = 0; i < rectangles.length; i++) {
      var tallest = Math.max(tallest, rectangles[i].height);
      var widest = Math.max(widest, rectangles[i].width);
    }

    var currentHeight = tallest;
    var currentWidth = -1;
    do {
      var newWH = skipFn(currentWidth, currentHeight);
      currentHeight = newWH.height;
      currentWidth = newWH.width;
      var packResult =
          RectanglePacker.packRectangles(rectangles, currentHeight, currentWidth);
      var traverseResult = traverseFn(packResult);
      if (traverseResult !== undefined) {
        return traverseResult;
      }
      currentHeight = currentHeight + packResult.minDeltaHeight;
      if (packResult.placementsCount == rectangles.length) {
        // If we succeeded, set a new target width.
        currentWidth = packResult.width;
      }
    } while (currentWidth >= widest && packResult.minDeltaHeight > 0);
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

  /* Packs rectangles as above but tries all combinations of rotating
   * or not rotating elements by 90 degrees, which might improve
   * packing. The result is the same as pack above but with an extra
   * member, rotation, alongside x and y in the placements.  */
  packWithRotation: function(rectangles, traverseFn, skipFn) {
    var rotatedRectangles = [];
    for (var i = 0; i < rectangles.length; i++) {
      rectangles[i].rotation = 0;
      var forms = [rectangles[i]];
      if (rectangles[i].width != rectangles[i].height) {
        var rotatedRectangle = rectangles[i].constructor();
        for (var attr in rectangles[i]) {
          if (rectangles[i].hasOwnProperty(attr)) {
            rotatedRectangle[attr] = rectangles[i][attr];
          }
        }
        var temp = rotatedRectangle.width
        rotatedRectangle.width = rotatedRectangle.height;
        rotatedRectangle.height = temp;
        rotatedRectangle.rotation = 90;
        forms.push(rotatedRectangle);
      }
      rotatedRectangles.push(forms);
    }
    // Because the traverse is a side effect, memoizing essentially
    // means that we don't run the original traverse at all.
    var memoizedPacker = RectanglePacker.memoize(
      RectanglePacker.packWithoutRotation,
      function (rectangles) {
        // Convert rectangles to a string that indicates uniqueness.
        return rectangles.map(function (r) {
          return r.width + "x" + r.height;
        }).join(",");
      });
    return RectanglePacker.combinations(
      rotatedRectangles,
      function (combination) {
        RectanglePacker.permute(
          RectanglePacker.sortRectangles(combination.slice()),
          function (permutation) {
            return memoizedPacker(
              permutation,
              function (x) {
                // Put the rotations into the placements and call
                // traverseFn.
                for (var i=0; i < permutation.length; i++) {
                  if (x.placements.hasOwnProperty(permutation[i].name)) {
                    x.placements[permutation[i].name].rotation =
                      permutation[i].rotation;
                  }
                }
                return traverseFn(x);
              },
              skipFn);
          },
          0,
          function (a,b) { // compareFn
            return (a.height == b.height && a.width == b.width) ? 0 : 1;
          });
      });
  },

  pack: function(rectangles, traverseFn) {
    var bestHW = {}
    return RectanglePacker.packWithRotation(
        rectangles, function(packResult) {
          if (packResult.placementsCount == rectangles.length) {
            if (!bestHW.hasOwnProperty(packResult.height) ||
                bestHW[packResult.height] > packResult.width) {
              bestHW[packResult.height] = packResult.width;
            }
            var traverseResult = traverseFn(packResult);
            if (traverseResult !== undefined) {
              return traverseResult;
            }
          }
        },
        function (w,h) {
          var newWidth = w;
          for (bestHeight in bestHW) {
            if (bestHeight <= h &&
                bestHW[bestHeight] < newWidth) {
              newWidth = bestHW[bestHeight];
            }
          }
          // skipFn
          return {"height": h,
                  "width": newWidth};
        });
  }

};

// browserify support
if ( typeof module === 'object' ) {
  module.exports = RectanglePacker;
}
console.log(RectanglePacker.permute([1,1,2], function(x) {console.log(x);},5,function(a,b) {return a-b;}));
