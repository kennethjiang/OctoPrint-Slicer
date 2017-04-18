'use strict';

import * as THREE from 'three';

// callbackFn is called with a list of true/false results of collisions.
// Yet unknown results are undefined

export var CollisionDetector = function (callbackFn) {
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
        var b = a3.x*a4.y - a3.y*a4.x;
        var x = (a * x34 - b * x12) / c;
        var y = (a * y34 - b * y12) / c;
        return ((Math.min(a1.x, a2.x) < x && x < Math.max(a1.x, a2.x) &&
                 Math.min(a3.x, a4.x) < x && x < Math.max(a3.x, a4.x)) ||
                (Math.min(a1.y, a2.y) < y && y < Math.max(a1.y, a2.y) &&
                 Math.min(a3.y, a4.y) < y && y < Math.max(a3.y, a4.y)));
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

    // Gets all triangles that might intersect the provided box.  box is
    // assumed to be Box2 but we pass in Box3 below.  That's okay, we'll
    // ignore the z axis.
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
            triangles.push(tri);  // Maybe intersects, keep it for further checking.
        }
        return triangles;
    };

    console.log("getting ready at " + performance.now());
    // Report all models that collide with any other model or stick out
    // of the provided boundingBox.
    var intersecting = [];
    self.findCollisions = function*(timeoutMilliseconds) {
        var endTime = undefined;
        if (timeoutMilliseconds) {
            endTime = performance.now() + timeoutMilliseconds;
        }

        var geometries = [];
        var geometryBoxes = [];
        for (var o = 0; o < self.objects.length; o++) {
            var obj = self.objects[o];
            var newGeo = new THREE.Geometry();
            for (var f=0; f < obj.children[0].geometry.collisionGeometry.faces.length; f++) {
                newGeo.faces.push(obj.children[0].geometry.collisionGeometry.faces[f].clone());
                if (endTime && performance.now() > endTime) {
                    timeoutMilliseconds = (yield intersecting);
                    if (timeoutMilliseconds) {
                        endTime = performance.now() + timeoutMilliseconds;
                    } else {
                        endTime = undefined;
                    }
                }
            }
            var newGeoBox = new THREE.Box3();
            for (var v=0; v < obj.children[0].geometry.collisionGeometry.vertices.length; v++) {
                newGeo.vertices.push(obj.children[0].geometry.collisionGeometry.vertices[v].clone());
                obj.updateMatrixWorld();
                newGeo.vertices[v].applyMatrix4(obj.children[0].matrixWorld);
                newGeoBox.expandByPoint(newGeo.vertices[v]);
                if (endTime && performance.now() > endTime) {
                    timeoutMilliseconds = (yield intersecting);
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

        var intersectsBox2D = function (box1, box2) {
            // Convert boxes to 2D before checking intersection.
            var b1 = new THREE.Box2().copy(box1);
            var b2 = new THREE.Box2().copy(box2);
            return b1.intersectsBox(b2);
        }

        //debugger;
        for (var geometry=0; geometry < geometries.length; geometry++) {
            if (!self.volume.containsBox(geometryBoxes[geometry])) {
                intersecting[geometry] = true;
            }
            for (var otherGeometry=geometry + 1; otherGeometry < geometries.length; otherGeometry++) {
                if (intersectsBox2D(geometryBoxes[geometry], geometryBoxes[otherGeometry])) {
                    var geo1 = geometries[geometry];
                    var geo2 = geometries[otherGeometry];
                    var box1 = geometryBoxes[geometry];
                    var box2 = geometryBoxes[otherGeometry];
                    var intersectionBox = box1.clone().intersect(box2);
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
                                timeoutMilliseconds = (yield intersecting);
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
            if (intersecting[geometry] === undefined) {
                // No collision yet and there won't be one so mark this one
                // as known.
                intersecting[geometry] = false;
            }
        }
        return intersecting;
    };

    self.collisionLoopRunner = null;

    // This starts collision detection in a loop on the provided objects
    // and print volume.  If start is called while it's already running,
    // it will cancel and restart.  The callback will be called every
    // timeoutMilliseconds.  If the result has only true and false
    // values and is as long as the original input, that means that the
    // collision detection is done.  undefined in the result array means
    // that the collision status is yet unknown.  timeoutMilliseconds is
    // how often to pause to do other events on the webpage, for
    // cooperative multitasking.
    self.start = function (objects, volume, timeoutMilliseconds) {
        if (self.collisionLoopRunner) {
            clearTimeout(self.collisionLoopRunner);
        }
        self.objects = [];
        for (var i = 0; i < objects.length; i++) {
            if (!objects[i].children[0].geometry.collisionGeometry) {
                objects[i].children[0].geometry.collisionGeometry =
                    new THREE.Geometry().fromBufferGeometry(objects[i].children[0].geometry);
            }
        }
        self.objects = objects;
        self.volume = volume;
        intersecting = [];
        // collisionDetector is a ES6 javascript generator.
        var collisionDetector = self.findCollisions(timeoutMilliseconds);
        var collisionLoop = function () {
            self.collisionLoopRunner = setTimeout(function() {
                var result = collisionDetector.next(timeoutMilliseconds);
                callbackFn(result.value);
                if (!result.done) {
                    collisionLoop();
                }
            }, 0);
        };
        collisionLoop();
    };
};

// browserify support
if ( typeof module === 'object' ) {
    module.exports = CollisionDetector;
}
