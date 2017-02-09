'use strict';

var CollisionDetection = {
  // Report all models that collide with any other model or stick out
  // of the provided boundingBox.
  findCollisions: function(objects, boundingBox) {
    // From: http://blackpawn.com/texts/pointinpoly/default.html
    var sameSide = function(p1, p2, a, b) {
      var ab = {x: b.x-a.x, y: b.y-a.y};
      var ap1 = {x: p1.x-a.x, y: p1.y-a.y};
      var ap2 = {x: p2.x-a.x, y: p2.y-a.y};
      var cp1 = (ab.x * ap1.y -
                 ab.y * ap1.x);
      var cp2 = (ab.x * ap2.y -
                 ab.y * ap2.x);
      var dp = cp1 * cp2;
      return dp > 0;
    }

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
    }

    var pointInTriangle = function(p, t) {
      return (sameSide(p,t.a,t.b,t.c) &&
              sameSide(p,t.b,t.a,t.c) &&
              sameSide(p,t.c,t.a,t.b));
    }

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
    }

    var triangleIntersectsBox = function(t, b) {
      return (linesIntersect(t.a, t.b, {x:b.min.x, y:b.minb.min.y) ||
              linesIntersect(t.a, t.b, b.min.x, b.min.y) ||
              linesIntersect(t.a, t.b, b.min.x, b.max.y) ||
              linesIntersect(t.a, t.b, b.min.x, b.max.y) ||
              linesIntersect(t.a, t.b, b.max.x, b.min.y) ||
              linesIntersect(t.a, t.b, b.max.x, b.min.y) ||
              linesIntersect(t.a, t.b, b.max.x, b.max.y) ||
              linesIntersect(t.a, t.b, b.max.x, b.max.y));
    }

    var geometries = _.map(
      objects,
      function (o) {
        var newGeo = o.children[0].geometry.clone();
        newGeo.applyMatrix(o.children[0].matrixWorld);
        return newGeo;
      });

    var geometryBoxes = _.map(
      geometries,
      function (g) {
        var b3 = new THREE.Box3().setFromPoints(g.vertices);
        return new THREE.Box2(new THREE.Vector2(b3.min.x, b3.min.y),
                              new THREE.Vector2(b3.max.x, b3.max.y));
      });
    var intersecting = [];
    for (var geometry=0; geometry < geometries.length; geometries++) {
      if (intersecting[geometry]) {
        continue; // It's already insecting, no need to check.
      }
      // Find geometries that have an intersecting bounding box.
      for (var otherGeometry=geometry+1;
           otherGeometry < geometries.length; otherGeometry++) {
        if (!geometryBoxes[geometry]
            .intersectsBox(
              geometryBoxes[otherGeometry])) {
          continue; // Skip checking against this model.
        }
        var intersectionBox = geometryBoxes[geometry]
            .intersect(geometryBoxes[otherGeometry]);
        var triangles = [];
        for (var f=0; f < geometries[geometry].faces.length; f++) {
          var geo = geometries[geometry];
          var face = geo.faces[f];
          var tri = {a: geo.vertices[face.a],
                     b: geo.vertices[face.a],
                     c: geo.vertices[face.a]};
          if (!triangleIntersectsBox(tri,
                                     intersectionBox)) {
            continue; // Skip this face, it doesn't intersection the other.
          }
          otherTriangles.push({a: geo.vertices[face.a],
                               b: geo.vertices[face.a],
                               c: geo.vertices[face.a]});
        }
        var otherTriangles = [];
        for (var f=0; f < geometries[otherGeometry].faces.length;
             f++) {
          var geo = geometries[otherGeometry];
          var face = geo.faces[f];
          var tri = {a: geo.vertices[face.a],
                     b: geo.vertices[face.a],
                     c: geo.vertices[face.a]};
          if (!triangleIntersectsBox(tri,
                                     intersectionBox)) {
            continue; // Skip this face, it doesn't intersection the other.
          }
          otherTriangles.push({a: geo.vertices[face.a],
                               b: geo.vertices[face.a],
                               c: geo.vertices[face.a]});
        }
        for (var t0 = 0; t0 < triangles.length; t0++) {
          for (var t1 = 0; t1 < otherTriangles.length; t1++) {
            if (trianglesIntersect(triangles[t0], otherTriangles[t1])) {
              intersecting[geometry] = true;
              intersecting[otherGeometry] = true;
              t0 = triangles.length; // To force a break.
              otherGeometry = geometries.length; // To force a break.
              break;
            }
          }
        }
      }
    }
    return intersecting;
  },
};

// browserify support
if ( typeof module === 'object' ) {
  module.exports = CollisionDetection;
}
