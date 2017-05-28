'use strict';

import * as THREE from 'three';
import { isUndefined } from 'lodash-es';
import { Box3FromObject } from './Box3FromObject';

// intersecting is a list of true/false results of collisions.  Yet
// unknown results are undefined

export var CollisionDetector = function () {
    var self = this;

    // Given a Vector2 point and a triangle of Vector2 that describes
    // a closed shape, check if the point is inside the shape.  Taken
    // from https://jsperf.com/point-in-triangle .
    let pointInTriangle = function(point, triangle) {
        var a = triangle.a;
        var b = triangle.b;
        var c = triangle.c;

        var ax = a.x;
        var ay = a.y;

        // Compute vectors
        var v0x = c.x - ax;
        var v0y = c.y - ay;
        var v1x = b.x - ax;
        var v1y = b.y - ay;
        var v2x = point.x - ax;
        var v2y = point.y - ay;

        var dot00 = v0x * v0x + v0y * v0y;
        var dot01 = v0x * v1x + v0y * v1y;
        var dot02 = v0x * v2x + v0y * v2y;
        var dot11 = v1x * v1x + v1y * v1y;
        var dot12 = v1x * v2x + v1y * v2y;

        var denom = dot00 * dot11 - dot01 * dot01;
        var u = (dot11 * dot02 - dot01 * dot12) / denom;
        var v = (dot00 * dot12 - dot01 * dot02) /denom;

        // Check if point is in triangle
        return (u >= 0) && (v >= 0) && (u + v < 1);
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
        var b = a3.x*a4.y - a3.y*a4.x;
        var x = (a * x34 - b * x12) / c;
        var y = (a * y34 - b * y12) / c;
        return ((Math.min(a1.x, a2.x) < x && x < Math.max(a1.x, a2.x) &&
                 Math.min(a3.x, a4.x) < x && x < Math.max(a3.x, a4.x)) ||
                (Math.min(a1.y, a2.y) < y && y < Math.max(a1.y, a2.y) &&
                 Math.min(a3.y, a4.y) < y && y < Math.max(a3.y, a4.y)));
    }

    var trianglesIntersect = function(t0,t1) {
        return linesIntersect(t0.a, t0.b, t1.a, t1.b) ||
            linesIntersect(t0.a, t0.b, t1.b, t1.c) ||
            linesIntersect(t0.a, t0.b, t1.c, t1.a) ||
            linesIntersect(t0.b, t0.c, t1.a, t1.b) ||
            linesIntersect(t0.b, t0.c, t1.b, t1.c) ||
            linesIntersect(t0.b, t0.c, t1.c, t1.a) ||
            linesIntersect(t0.c, t0.a, t1.a, t1.b) ||
            linesIntersect(t0.c, t0.a, t1.b, t1.c) ||
            pointInTriangle(t0.a, t1) ||
            pointInTriangle(t1.a, t0);
    };

    // Alternate algorithm.
    var trianglesIntersect2 = function(t0,t1) {
        return linesIntersect(t0.a, t0.b, t1.a, t1.b) ||
            linesIntersect(t0.a, t0.b, t1.b, t1.c) ||
            linesIntersect(t0.a, t0.b, t1.c, t1.a) ||
            linesIntersect(t0.b, t0.c, t1.a, t1.b) ||
            linesIntersect(t0.b, t0.c, t1.b, t1.c) ||
            linesIntersect(t0.b, t0.c, t1.c, t1.a) ||
            pointInTriangle(t0.a, t1) ||
            pointInTriangle(t1.a, t0) ||
            pointInTriangle(t1.b, t0) ||
            pointInTriangle(t1.c, t0);
    };

    // Only trust the true output.  False means maybe.
    var triangleOutsideBox = function(t, b) {
        return (Math.max(t.a.x, t.b.x, t.c.x) < b.min.x ||
                Math.min(t.a.x, t.b.x, t.c.x) > b.max.x ||
                Math.max(t.a.y, t.b.y, t.c.y) < b.min.y ||
                Math.min(t.a.y, t.b.y, t.c.y) > b.max.y);
    };

    // Gets all triangles that might intersect the provided box.  box is
    // assumed to be Box2 but we pass in Box3 below.  That's okay, we'll
    // ignore the z axis.
    var getTrianglesFromGeometry = function(geo, box) {
        var triangles = [];
        for (var f=0; f < geo.faces.length; f++) {
            var face = geo.faces[f];
            var tri = {a: new THREE.Vector2().copy(geo.vertices[face.a]),
                       b: new THREE.Vector2().copy(geo.vertices[face.b]),
                       c: new THREE.Vector2().copy(geo.vertices[face.c])};
            tri.boundingBox = new THREE.Box2().setFromPoints(
                [tri.a,
                 tri.b,
                 tri.c]);
            if (triangleOutsideBox(tri, box)) {
                continue; // Skip this face, it doesn't intersection the other.
            }
            triangles.push(tri);  // Maybe intersects, keep it for further checking.
        }
        return triangles;
    };

    let getBottomTriangles = function*(obj) {
        let endTime = Infinity;
        endTime = (yield intersecting);
        obj.updateMatrixWorld();
        var currentMatrixWorld = obj.children[0].matrixWorld;
        var previousMatrixWorld =
            obj.children[0].userData.collisionDetectorMatrixWorld;
        if (previousMatrixWorld &&
            previousMatrixWorld.equals(currentMatrixWorld)) {
            return obj.children[0].userData.collisionDetectorBottomTriangles;
        }
        var triangles = [];
        var posAttr = obj.children[0].geometry.getAttribute('position');
        var count = posAttr.count;
        for (var v=0; v < count; v += 3) {
            let a = new THREE.Vector2().copy(
                new THREE.Vector3().fromBufferAttribute(posAttr, v    )
                    .applyMatrix4(obj.children[0].matrixWorld));
            let b = new THREE.Vector2().copy(
                new THREE.Vector3().fromBufferAttribute(posAttr, v + 1)
                    .applyMatrix4(obj.children[0].matrixWorld));
            let c = new THREE.Vector2().copy(
                new THREE.Vector3().fromBufferAttribute(posAttr, v + 2)
                    .applyMatrix4(obj.children[0].matrixWorld));
            let bottomTriangle = {a:a, b:b, c:c,
                                  boundingBox: new THREE.Box2().setFromPoints([a,b,c])};
            triangles.push(bottomTriangle);
            if (Date.now() > endTime) {
                endTime = (yield intersecting);
            }
        }
        obj.children[0].userData.collisionDetectorMatrixWorld = currentMatrixWorld.clone();
        obj.children[0].userData.collisionDetectorBottomTriangles = triangles;
        return triangles;
    };

    let intersectBox2D = function (box1, box2) {
        // Convert boxes to 2D before checking intersection.
        var b1 = new THREE.Box2().copy(box1);
        var b2 = new THREE.Box2().copy(box2);
        return b1.intersect(b2);
    };

    var intersecting = [];
    // Report all models that collide with any other model or stick out
    // of the provided boundingBox.
    self.findCollisions = function*(objects, volume) {
        let endTime = Infinity;
        endTime = (yield intersecting);
        let bottomTriangles = [];
        // First mark all boxes that are out of bounds.
        for (var geometry=0; geometry < objects.length; geometry++) {
            if (!objects[geometry].children[0].userData.box3FromObject) {
                objects[geometry].children[0].userData.box3FromObject = Box3FromObject(objects[geometry].children[0]);
            }
            if (!volume.containsBox(objects[geometry].children[0].userData.box3FromObject())) {
                intersecting[geometry] = true;
            }
        }
        // Now look for colliding objects.
        for (var geometry=0; geometry < objects.length; geometry++) {
            for (var otherGeometry=geometry + 1; otherGeometry < objects.length; otherGeometry++) {
                if (!isUndefined(intersecting[geometry]) && !isUndefined(intersecting[otherGeometry])) {
                    // Already marked can ignore.
                    continue;
                }
                var box1 = objects[geometry].children[0].userData.box3FromObject();
                var box2 = objects[otherGeometry].children[0].userData.box3FromObject();
                var intersectionBox = intersectBox2D(box1, box2);
                if (intersectionBox.isEmpty()) {
                    // Can skip this pair because there is no intersection.
                    continue;
                }
                // We need all the bottom triangles of each object.
                if (!bottomTriangles[geometry]) {
                    let bottomTrianglesIterator = getBottomTriangles(objects[geometry]);
                    let result = bottomTrianglesIterator.next(endTime);
                    while (!result.done) {
                        endTime = (yield result.value);
                        result = bottomTrianglesIterator.next(endTime)
                    }
                    bottomTriangles[geometry] = result.value;
                }
                if (!bottomTriangles[otherGeometry]) {
                    let bottomTrianglesIterator = getBottomTriangles(objects[otherGeometry]);
                    let result = bottomTrianglesIterator.next(endTime);
                    while (!result.done) {
                        endTime = (yield result.value);
                        result = bottomTrianglesIterator.next(endTime)
                    }
                    bottomTriangles[otherGeometry] = result.value;
                }
                var geo1 = bottomTriangles[geometry].filter(function (triangle) {
                    return triangle.boundingBox.intersectsBox(intersectionBox);
                });
                var geo2 = bottomTriangles[otherGeometry].filter(function (triangle) {
                    return triangle.boundingBox.intersectsBox(intersectionBox);
                });
                for (var g1 = 0; g1 < geo1.length; g1++) {
                    for (var g2 = 0; g2 < geo2.length; g2++) {
                        if (Date.now() > endTime) {
                            endTime = (yield intersecting);
                        }
                        if (geo1[g1].boundingBox.intersectsBox(geo2[g2].boundingBox) &&
                            trianglesIntersect(geo1[g1], geo2[g2])) {
                            intersecting[geometry] = true;
                            intersecting[otherGeometry] = true;
                            g1 = geo1.length; // To force a break.
                            break;
                        }
                    }
                }
            }
            if (isUndefined(intersecting[geometry])) {
                // No collision yet and there won't be one so mark this one
                // as known.
                intersecting[geometry] = false;
            }
        }
        yield intersecting;
    };

    var timeout = null;
    var iterator = null;

    // Stops a running collision detector if there is one running.
    self.stop = function () {
        if (timeout) {
            clearTimeout(timeout);
            timeout = null;
        }
    };

    // Make a new collision iterator on the objects and volume given.
    // If one is already running it is stopped and removed.
    self.makeIterator = function (objects, volume) {
        self.stop();
        intersecting = [];
        // iterator is a ES6 javascript generator.
        iterator = self.findCollisions(objects, volume);
    };

    // Remove the current iterator, resetting the collision detection.
    self.clearIterator = function () {
        self.stop();
        iterator = null;
    }

    self.hasIterator = function() {
        return !!iterator;
    }

    // starts the collisionIterator in the background.  task_switch_ms
    // is how often to relinquish control so that the browser can do
    // other events.  The default is to run 50ms at a time, which
    // leaves the browser with good responsiveness.  callbackFn is
    // called with the intersection results which is a list of
    // true/false/undefined.  true means intersecting, false means not
    // intersecting, undefined means not yet known.  If it's already
    // running, it's stopped before being started at the new
    // task_switch_ms.  It is an error to call this without first
    // making a collision iterator.
    self.startBackground = function (callbackFn, task_switch_ms = 50) {
        self.stop();
        var collisionLoop = function () {
            timeout = setTimeout(function() {
                var result = iterator.next(Date.now() + task_switch_ms);
                if (!result.done) {
                    callbackFn(result.value);
                    collisionLoop();
                } else {
                    timeout = null;  // All done.
                }
            }, 0);
        };
        collisionLoop();
    };

    // starts the collisionIterator in the foreground.  endTime is
    // when to stop running and return the current result.  The
    // default is to run to completion.  The result is from an
    // iterator with member done set to true if the iterator ran
    // finished and false if not.  The value member has the
    // intersection results which is a list of true/false/undefined.
    // true means intersecting, false means not intersecting,
    // undefined means not yet known.  If it's already running, it's
    // stopped before starting in the foreground.  It is an error to
    // call this without first making a collision iterator.
    self.start = function (endTime = Infinity) {
        self.stop();
        while (!iterator.next(endTime).done) {
            // Just iterate.
        }
        return intersecting;
    }
};

// browserify support
if ( typeof module === 'object' ) {
    module.exports = CollisionDetector;
}
