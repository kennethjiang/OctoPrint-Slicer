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
    // wrap the hull counterclockwise.
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

        if (points.length <= 2) {
            return points;
        }
        // Use quickhull algorithm.
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
        var pointsAbove = [];
        var pointsBelow = [];
        for (var point of points) {
            if (point == leftmostPoint || rightmostPoint == leftmostPoint) {
                continue;  // diffAngle isn't well-defined.
            }
            var diffAngle = self.angle3(rightmostPoint, leftmostPoint, point);
            if (diffAngle > 0 && diffAngle < Math.PI) {
                pointsAbove.push(point);
            } else if (diffAngle > Math.PI) {
                pointsBelow.push(point);
            }
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
            // Iterate on one side.
            var pointsLeft = findLeftPoints(points, farthestPoint, toPoint);
            var halfHull = findHull(pointsLeft, farthestPoint, toPoint);
            // Iterate on other side.
            pointsLeft = findLeftPoints(points, fromPoint, farthestPoint);
            var halfHull2 = findHull(pointsLeft, fromPoint, farthestPoint);
            return halfHull.concat(halfHull2);
        };
        return findHull(pointsAbove, leftmostPoint, rightmostPoint).concat(
            findHull(pointsBelow, rightmostPoint, leftmostPoint));
    };
};

// browserify support
if ( typeof module === 'object' ) {
    module.exports = Tipping;
}

var t = new Tipping();
var points = [
    new THREE.Vector2(0,0),
    new THREE.Vector2(10,0),
    new THREE.Vector2(0,5),
    new THREE.Vector2(0,-5)
];
while(1)
console.log(t.convexHull(points));
