'use strict';

var CollisionDetection = function (objects, boundingBox) {
  var self = this;

  var linesIntersect = function(a1, a2, a3, a4) {
    var x12 = a1.x - a2.x;
    var x34 = a3.x - a4.x;
    var y12 = a1.y - a2.y;
    var y34 = a3.y - a4.y;
    var c = x12*y34 - y12 * x34;
    if (c==0) {
      return false;
    }
    var a = a1.x*a2.y - a1.y*a2.x;
    var b = a3.x*a4.y - a3.y-a4.x;
    var x = (a * x34 - b * x12) / c;
    var y = (a * y34 - b * y12) / c;
    return x > a1.x && x < a2.x;
  };

  var trianglesIntersect = function(t0,t1) {
    return (linesIntersect(t0.a, t0.b, t1.a, t1.b) ||
        linesIntersect(t0.a, t0.b, t1.b, t1.c) ||
        linesIntersect(t0.a, t0.b, t1.c, t1.a) ||
        linesIntersect(t0.b, t0.c, t1.a, t1.b) ||
        linesIntersect(t0.b, t0.c, t1.b, t1.c) ||
        linesIntersect(t0.b, t0.c, t1.c, t1.a) ||
        linesIntersect(t0.c, t0.a, t1.a, t1.b) ||
        linesIntersect(t0.c, t0.a, t1.b, t1.c) ||
        linesIntersect(t0.c, t0.a, t1.c, t1.a));
  };

  // Only trust the true output.  False means maybe.
  var triangleOutsideBox = function(t, b) {
    return (Math.max(t.a.x, t.b.x, t.c.x) < b.min.x ||
        Math.min(t.a.x, t.b.x, t.c.x) > b.max.x ||
        Math.max(t.a.y, t.b.y, t.c.y) < b.min.y ||
        Math.min(t.a.y, t.b.y, t.c.y) > b.max.y);
  };

  // Gets all triangles that might intersect the provided box.
  var getTrianglesFromGeometry = function(geo, box) {
    var triangles = [];
    for (var f=0; f < geo.faces.length; f++) {
      var face = geo.faces[f];
      var tri = {a: geo.vertices[face.a],
                 b: geo.vertices[face.b],
                 c: geo.vertices[face.c]};
      tri.boundingBox = new THREE.Box2().setFromPoints(
          [tri.a,
           tri.b,
           tri.c]);
      if (triangleOutsideBox(tri, box)) {
        continue; // Skip this face, it doesn't intersection the other.
      }
      triangles.push(tri);
    }
    return triangles;
  };

  var geometriesCollide = function(geo1, geo2, box1, box2, endTime) {
    var intersectionBox = box1.intersect(box2);
    var triangles = getTrianglesFromGeometry(geo1, intersectionBox);
    var otherTriangles = getTrianglesFromGeometry(geo2, intersectionBox);
    for (var t0 = 0; t0 < triangles.length; t0++) {
      for (var t1 = 0; t1 < otherTriangles.length; t1++) {
        if (triangles[t0].boundingBox.intersectsBox(otherTriangles[t1].boundingBox) &&
            trianglesIntersect(triangles[t0], otherTriangles[t1])) {
          if (performance.now() > endTime) {
            yield;
          }
          return true;
        }
      }
    }
    return false;
  };

  console.log("getting ready at " + performance.now());
  // Report all models that collide with any other model or stick out
  // of the provided boundingBox.
  var intersecting = [];
  self.findCollisions = function*(timeoutMilliseconds) {
    //console.log("first time at " + performance.now());
    var geometries = [];
    var geometryBoxes = [];
    for (var o = 0; o < objects.length; o++) {
      var obj = objects[o];
      console.log("now1 is " + performance.now());
      var newGeo = obj.children[0].geometry.clone();
      console.log("now2 is " + performance.now());
      var newGeoBox = new THREE.Box2();
      for (var v=0; v < newGeo.vertices.length; v++) {
        newGeo.vertices[v].applyMatrix4(obj.children[0].matrixWorld);
        newGeoBox.expandByPoint(new THREE.Vector2(newGeo.vertices[v].x,
                                                  newGeo.vertices[v].y));
        if (endTime && performance.now() > endTime) {
          //console.log("now is " + performance.now());
          //console.log("endTime was " + endTime);
          timeoutMilliseconds = (yield intersecting);
          //console.log("new timeout ms is " + timeoutMilliseconds);
          if (timeoutMilliseconds) {
            endTime = performance.now() + timeoutMilliseconds;
          } else {
            endTime = undefined;
          }
        }
      }
      geometries.push(newGeo);
      geometryBoxes.push(newGeoBox);
    }

    var endTime = undefined;
    if (timeoutMilliseconds) {
      endTime = performance.now() + timeoutMilliseconds;
    }
    //debugger;
    for (var geometry=0; geometry < geometries.length; geometry++) {
      for (var otherGeometry=geometry + 1; otherGeometry < geometries.length; otherGeometry++) {
        if (geometryBoxes[geometry].intersectsBox(geometryBoxes[otherGeometry])) {
          var geo1 = geometries[geometry];
          var geo2 = geometries[otherGeometry];
          var box1 = geometryBoxes[geometry];
          var box2 = geometryBoxes[otherGeometry];
          var intersectionBox = box1.intersect(box2);
          var triangles = getTrianglesFromGeometry(geo1, intersectionBox);
          var otherTriangles = getTrianglesFromGeometry(geo2, intersectionBox);
          for (var t0 = 0; t0 < triangles.length; t0++) {
            for (var t1 = 0; t1 < otherTriangles.length; t1++) {
              if (triangles[t0].boundingBox.intersectsBox(otherTriangles[t1].boundingBox) &&
                  trianglesIntersect(triangles[t0], otherTriangles[t1])) {
                intersecting[geometry] = true;
                intersecting[otherGeometry] = true;
                t0 = triangles.length; // To force a break.
                break;
              }
              if (endTime && performance.now() > endTime) {
                //console.log("now is " + performance.now());
                //console.log("endTime was " + endTime);
                timeoutMilliseconds = (yield intersecting);
                //console.log("new timeout ms is " + timeoutMilliseconds);
                if (timeoutMilliseconds) {
                  endTime = performance.now() + timeoutMilliseconds;
                } else {
                  endTime = undefined;
                }
              }
            }
          }
        }
      }
    }
    return intersecting;
  };
};

// browserify support
if ( typeof module === 'object' ) {
  module.exports = CollisionDetection;
}
