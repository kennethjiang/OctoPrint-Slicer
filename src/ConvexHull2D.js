'use strict';

import * as THREE from 'three';

// functions for creating and manipulating 2D convex hulls
export function ConvexHull2D() {
    var self = this;

    // Find closest point on line to vw to point p.  All arguments are
    // Vector2.
    self.projectPointToLine = function(p, v, w, segment = false) {
        var l2 = v.distanceToSquared(w);  // i.e. |w-v|^2 -  avoid a sqrt
        if (l2 == 0) return v;
        // Consider the line extending the segment, parameterized as v
        // + t (w - v).  We find projection of point p onto the line.
        // It falls where t = [(p-v) . (w-v)] / |w-v|^2
        var t = p.clone().sub(v).dot(w.clone().sub(v)) / l2;
        if (segment) {
            t = Math.min(1, Math.max(0, t));  // Clamp to line segment.
        }
        var projection = v.clone().add(w.clone().sub(v).multiplyScalar(t));
        return projection;
    };

    // Find closest point on line to vw to point p.  All arguments are
    // Vector2.
    self.projectPointToLineSegment = function (p, v, w) {
        return self.projectPointToLine(p, v, w, true);
    };

    // The shape is specified as a series of points that are connected
    // in a loop.  point is a Vector2.  shape is a list of Vector2.
    self.projectPointOnShape = function(point, shape) {
        var closestPoint;
        var closestDistanceSquared = Infinity;
        for (var i = 0; i < shape.length; i++) {
            var projection = self.projectPointToLineSegment(point, shape[i], shape[(i+1)%shape.length]);
            var distanceSquared = projection.distanceToSquared(point);
            if (distanceSquared < closestDistanceSquared) {
                closestPoint = projection;
                closestDistanceSquared = distanceSquared;
            }
        }
        return closestPoint;
    };

    // Returns a-b cross c-b
    let cross = function(a, b, c) {
        return (a.x - b.x) * (c.y - b.y) - (a.y - b.y) * (c.x - b.x);
    }

    // Given a Vector2 point and a list of Vector2 that describe a
    // closed shape, check if the point is inside the shape.  Assumes
    // that the shape is convex and counter-clockwise.
    self.pointInShape = function(point, shape) {
        if (shape.length == 0) {
            return false;
        }
        if (shape.length == 1) {
            return point.equals(shape[0]);
        }
        if (shape.length == 2) {
            return self.projectPointToLineSegment(point, shape[0], shape[1]).equals(point);
        }
        for (var i=0; i < shape.length; i++) {
            if (cross(shape[(i+1)%shape.length], shape[i], point) <= 0) {
                return false;
            }
        }
        return true;
    };

    // Find the point farthest from the line.  points must have at
    // least one point in it.
    var findFarthestPoint = function(points, a, b) {
        var farthestPoint;
        var farthestDistanceSquared = -Infinity;
        for (var point of points) {
            var projection = self.projectPointToLine(point, a, b);
            var distanceSquared = projection.distanceToSquared(point);
            if (distanceSquared > farthestDistanceSquared) {
                farthestPoint = point;
                farthestDistanceSquared = distanceSquared;
            }
        }
        return farthestPoint;
    };

    // Returns a list of points that are to the left of ray
    // from-to.  That is, the ray from_to needs a rotation of less
    // than 180 degrees to get the ray from_p for every p in
    // points.  0 and 180 degrees are excluded.
    var findLeftPoints = function(points, fromPoint, toPoint) {
        var pointsLeft = [];
        for (var point of points) {
            if (toPoint.equals(fromPoint) || point.equals(fromPoint)) {
                continue;
            }
            var normal = cross(toPoint, fromPoint, point);
            if (normal > 0) {
                pointsLeft.push(point);
            }
        }
        return pointsLeft;
    };

    // Returns the points that need to be added before toPoint so that
    // [returned_points, toPoint] make a convex hull that goes around
    // counter-clockwise and encloses all the points provided.  The
    // toPoint is included in the return, fromPoint is not.  points
    // are the points that you can reach if you rotate the ray
    // fromPoint,toPoint by less than 180 degrees.
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

    // Given a list of Vector2, find the convex hull of those points.
    // The convex hull is given as a list of points that are the
    // outline of the convex hull.  The points are given so that they
    // wrap the hull counterclockwise.  Use quickhull algorithm.
    self.convexHull = function(points) {
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

};

// browserify support
if ( typeof module === 'object' ) {
    module.exports = ConvexHull2D;
}


/*
// Test of tipping code.
var t = new ConvexHull2D();
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
