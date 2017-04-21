'use strict';

//import * as THREE from 'three';

const THREE = require("three");

var Tipping = function () {
    var self = this;

    // Find closest point on line to vw to point p.  All arguments are
    // Vector2.
    self.projectPointToLine = function(p, v, w) {
        var l2 = v.distanceToSquared(w);  // i.e. |w-v|^2 -  avoid a sqrt
        if (l2 == 0) return distance(p, v);   // v == w case
        // Consider the line extending the segment, parameterized as v
        // + t (w - v).  We find projection of point p onto the line.
        // It falls where t = [(p-v) . (w-v)] / |w-v|^2
        var t = p.clone().sub(v).dot(w.clone().sub(v)) / l2;
        var projection = v.clone().add(w.clone().sub(v).multiplyScalar(t));
        return projection;
    }

    // Given 3 points a, b, c, find the angle of abc.  The result is
    // the rotation to apply to the ray ba to get a ray from b through
    // c.  positive is counterclockwise.
    self.angle3 = function(a, b, c) {
        var diffAngle = c.clone().sub(b).angle() - a.clone().sub(b).angle();
        if (diffAngle < 0) diffAngle += 2 * Math.PI;
        return diffAngle;
    }

    // Given a list of Vector2, find the convex hull of those points.
    // The convex hull is given as a list of points that are the
    // outline of the convex hull.  The points are given so that they
    // wrap the hull counterclockwise.  Use quickhull algorithm.
    self.convexHull = function(points) {
        // Find the point farthest from the line.  points must have at
        // least one point in it.
        var findFarthestPoint = function(points, a, b) {
            var farthestPoint = points[0];
            var projection = self.projectPointToLine(points[0], a, b);
            var farthestDistanceSquared = projection.distanceToSquared(points[0]);
            for (var point of points) {
                var projection = self.projectPointToLine(point, a, b);
                var distanceSquared = projection.distanceToSquared(point);
                if (distanceSquared > farthestDistanceSquared) {
                    farthestPoint = point;
                    farthestDistanceSquared = distanceSquared;
                }
            }
            return farthestPoint;
        }

        // Returns a list of points that are to the left of ray
        // from-to.  That is, the ray from_to needs a rotation of less
        // than 180 degrees to get the ray from_p for every p in
        // points.  0 and 180 degrees are excluded.
        var findLeftPoints = function(points, fromPoint, toPoint) {
            var pointsLeft = [];
            for (var point of points) {
                if (toPoint == fromPoint || point == fromPoint) {
                    continue;
                }
                var diffAngle = self.angle3(toPoint, fromPoint, point);
                if (diffAngle > 0 && diffAngle < Math.PI) {
                    pointsLeft.push(point);
                }
            }
            return pointsLeft;
        }

        // Returns the points that need to be added before toPoint so
        // that [returned_points, toPoint] make a convex hull that
        // goes around counter-clockwise and encloses all the points
        // provided.  The toPoint is included in the return, fromPoint
        // is not.  points are the points that you can reach if you
        // rotate the ray fromPoint,toPoint by less than 180 degrees.
        var findHull = function(points, fromPoint, toPoint) {
            if (points.length == 0) {
                return [toPoint];
            }
            // Found the farthest point.
            var farthestPoint = findFarthestPoint(points, fromPoint, toPoint);
            return findHull3(points, fromPoint, farthestPoint, toPoint);
        };

        var findHull3 = function(points, fromPoint, farthestPoint, toPoint) {
            // Iterate on one side.
            var pointsLeft = findLeftPoints(points, farthestPoint, toPoint);
            var halfHull = findHull(pointsLeft, farthestPoint, toPoint);
            // Iterate on other side.
            pointsLeft = findLeftPoints(points, fromPoint, farthestPoint);
            var halfHull2 = findHull(pointsLeft, fromPoint, farthestPoint);
            return halfHull.concat(halfHull2);
        }

        if (points.length < 2) {
            return points;
        }

        var leftmostPoint = points[0];
        var rightmostPoint = points[0]
        for (var point of points) {
            if (point.x < leftmostPoint.x ||
                (point.x == leftmostPoint.x && point.y < leftmostPoint.y)) {
                leftmostPoint = point;
            }
            if (point.x > rightmostPoint.x ||
                (point.x == rightmostPoint.x && point.y > rightmostPoint.y)) {
                rightmostPoint = point;
            }
        }
        if (leftmostPoint.equals(rightmostPoint)) {
            return [leftmostPoint]; // Degenerate, only 1 point.
        }

        return findHull3(points, rightmostPoint, leftmostPoint, rightmostPoint);
    };

    // Finds the center of mass of a geometry.
    self.centroid = function(geometry) {
        // Volume = magnitude(a*(b cross c))/6
        var totalVolume = 0;
        var totalCentroid = new THREE.Vector3();
        for (var face of geometry.faces) {
            var a = geometry.vertices[face.a];
            var b = geometry.vertices[face.b];
            var c = geometry.vertices[face.c];
            var volume = b.clone().cross(c).dot(a)/6;
            var centroid = a.clone().add(b).add(c).divide(4);
            totalVolume += volume;
            totalCentroid.add(centroid.multiplyScalar(volume));
        }
        return totalCentroid.divideScalar(totalVolume);
    };
};

// browserify support
if ( typeof module === 'object' ) {
    module.exports = Tipping;
}


// Test of tipping code.
/*
var t = new Tipping();
var points = [];
var SIZE = 10;
for (var i = 0; i < 10; i++) {
    points.push(new THREE.Vector2(Math.floor(Math.random()*SIZE),
                                  Math.floor(Math.random()*SIZE)));
}

var result = t.convexHull(points);
var resultString = "";
for (var i = 0; i < SIZE; i++) {
    for (var j = 0; j < SIZE; j++) {
        var testPoint = new THREE.Vector2(i,j);
        var found = false;
        if(!found) for (var p=0; p < result.length; p++) {
            if (testPoint.equals(result[p])) {
                found = true;
                resultString += ("" + p);
                break;
            }
        }
        if(!found) for (var p of points) {
            if (testPoint.equals(p)) {
                found = true;
                resultString += "o";
                break;
            }
        }
        if(!found) resultString += ".";
    }
    resultString += "\n";
}
console.log(resultString);
*/


var a = new THREE.Vector3(0,0,10);
var b = new THREE.Vector3(10,0,10);
var c = new THREE.Vector3(0,10,10);
var m = new THREE.Matrix3().set(3,3,10,
                                4,9,8,
                                10,0,10);
console.log(b.clone().cross(a));
console.log(b.clone().cross(c).dot(a)/6);
console.log(m.determinant()/6);

/*
a0 a1 a2
b0 b1 b2
c0 c1 c2

a0c1b2-a0c2b1, a1c2b0-a1c0b2, a2c0b1-a2c1b0

*/
