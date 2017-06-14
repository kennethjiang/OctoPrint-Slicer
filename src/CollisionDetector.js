'use strict';

import * as THREE from 'three';
import { isUndefined } from 'lodash-es';
import { Box3FromObject } from './Box3FromObject';
import { ConvexHull2D } from './ConvexHull2D';

// intersecting is a list of true/false results of collisions.  Yet
// unknown results are undefined

export var CollisionDetector = function () {
    var self = this;

    // Check that points.a and points.b and points.c are outside triangle
    // and all on the same side of one side of the triangle.  Returns true
    // if all points are outside on the same side of triangle.
    var pointsOutsideTriangle = function(points, triangle) {
        var pa = points.a;
        var pb = points.b;
        var pc = points.c;
        var p0 = triangle.a;
        var p1 = triangle.b;
        var p2 = triangle.c;
        var dXa = pa.x - p2.x;
        var dYa = pa.y - p2.y;
        var dXb = pb.x - p2.x;
        var dYb = pb.y - p2.y;
        var dXc = pc.x - p2.x;
        var dYc = pc.y - p2.y;
        var dX21 = p2.x - p1.x;
        var dY12 = p1.y - p2.y;
        var D = dY12 * (p0.x - p2.x) + dX21 * (p0.y - p2.y);
        var sa = dY12 * dXa + dX21 * dYa;
        var sb = dY12 * dXb + dX21 * dYb;
        var sc = dY12 * dXc + dX21 * dYc;
        var ta = (p2.y - p0.y) * dXa + (p0.x - p2.x) * dYa;
        var tb = (p2.y - p0.y) * dXb + (p0.x - p2.x) * dYb;
        var tc = (p2.y - p0.y) * dXc + (p0.x - p2.x) * dYc;
        if (D < 0) return ((sa >= 0 && sb >= 0 && sc >= 0) ||
                           (ta >= 0 && tb >= 0 && tc >= 0) ||
                           (sa+ta <= D && sb+tb <= D && sc+tc <= D));
        return ((sa <= 0 && sb <= 0 && sc <= 0) ||
                (ta <= 0 && tb <= 0 && tc <= 0) ||
                (sa+ta >= D && sb+tb >= D && sc+tc >= D));
    };

    var trianglesIntersect = function(t0, t1) {
        return !(pointsOutsideTriangle(t0,t1) ||
                 pointsOutsideTriangle(t1,t0));
    };
    // returns true if for all p in points, angle pbc has the same
    // normal as normal.  If bc is a line that is part of a convex
    // polygon and normal is the normal of that polygon, this function
    // returns true if all points are outside the polygon on that
    // side.
    let crossAll = function(points, b, c, normal) {
        let bx = b.x;
        let by = b.y;
        let cyby = c.y - by;
        let cxbx = c.x - bx;
        for (let p of points) {
            if (((p.x - bx) * cyby - (p.y - by) * cxbx) * normal < 0) {
                return false;
            };
        }
        return true;
    }

    // Returns true if the convex hulls intersect.  Each hull must be
    // convex and is specified as a list of points.  Each hull's
    // normal is specified.  Only the sign matters.  If the points are
    // counterclockwise, the normal is positive.
    var hullsIntersect = function(hull0, normal0, hull1, normal1) {
        for (var i = 0; i < hull0.length; i++) {
            if (crossAll(hull1, hull0[i], hull0[(i+1)%hull0.length], normal0)) {
                return false;
            }
        }
        for (var i = 0; i < hull1.length; i++) {
            if (crossAll(hull0, hull1[i], hull1[(i+1)%hull1.length], normal1)) {
                return false;
            }
        }
        return true;
    }

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
        var normalAttr = obj.children[0].geometry.getAttribute('normal');
        var count = posAttr.count;
        for (var v=0; v < count; v += 3) {
            let normal = normalAttr.getZ(v);  // v or v+1 or v+2, doesn't matter.
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
                                  boundingBox: new THREE.Box2().setFromPoints([a,b,c]),
                                  normal: normal};
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

    let generateIntersectingTriangles = function*(bottomTriangles, intersectionBox, otherHull) {
        for (var triangle of bottomTriangles) {
            if (!triangle.boundingBox.intersectsBox(intersectionBox)) {
                continue;  // If the bounding boxes don't intersect, definitely skip.
            }
            if (hullsIntersect([triangle.a, triangle.b, triangle.c], triangle.normal, otherHull, 1)) {
                // If the triangle intersects the other
                // shape's hull, maybe there will be an
                // intersection, so we need to keep this
                // triangle.
                yield triangle;
            } else {
                yield;
            }
        }
    };
    let interleaveWithIndex = function*(itr1, itr2) {
        let done1 = false;
        let done2 = false;
        while(!done1 || !done2) {
            let value = null;
            while (!done1 && !value) {
                ({done: done1, value} = itr1.next());
                if (!done1) {
                    yield {index:0, value:value};
                }
            }
            value = null;
            while (!done2 && !value) {
                ({done: done2, value} = itr2.next());
                if (!done2) {
                    yield {index:1, value:value};
                }
            }
        }
    }

    let convexHull2D = new ConvexHull2D();
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

                // We need the convex hulls of each bottom.
                var bottomPoints1 = [];
                for (var triangle of bottomTriangles[geometry]) {
                    bottomPoints1.push(triangle.a);
                    bottomPoints1.push(triangle.b);
                    bottomPoints1.push(triangle.c);
                }
                var hull1 = convexHull2D.convexHull(bottomPoints1);
                var bottomPoints2 = [];
                for (var triangle of bottomTriangles[otherGeometry]) {
                    bottomPoints2.push(triangle.a);
                    bottomPoints2.push(triangle.b);
                    bottomPoints2.push(triangle.c);
                }
                var hull2 = convexHull2D.convexHull(bottomPoints2);
                if (!hullsIntersect(hull1, 1, hull2, 1)) {
                    continue; // No chance of intersection.
                }
                var geo1 = [];
                var geo2 = [];
                triangleLoop:
                for (var indexTriangle of interleaveWithIndex(
                    generateIntersectingTriangles(bottomTriangles[geometry], intersectionBox, hull2),
                    generateIntersectingTriangles(bottomTriangles[otherGeometry], intersectionBox, hull1))) {
                    if (Date.now() > endTime) {
                        endTime = (yield intersecting);
                    }
                    if (indexTriangle.value) {
                        let triangle = indexTriangle.value;
                        if (indexTriangle.index == 0) {
                            geo1.push(triangle);
                            for (var g2 = 0; g2 < geo2.length; g2++) {
                                if (triangle.boundingBox.intersectsBox(geo2[g2].boundingBox) &&
                                    trianglesIntersect(triangle, geo2[g2])) {
                                    intersecting[geometry] = true;
                                    intersecting[otherGeometry] = true;
                                    break triangleLoop;
                                }
                            }
                        } else if (indexTriangle.index == 1) {
                            geo2.push(triangle);
                            for (var g1 = 0; g1 < geo1.length; g1++) {
                                if (geo1[g1].boundingBox.intersectsBox(triangle.boundingBox) &&
                                    trianglesIntersect(geo1[g1], triangle)) {
                                    intersecting[geometry] = true;
                                    intersecting[otherGeometry] = true;
                                    break triangleLoop;
                                }
                            }
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
