'use strict';

//import * as THREE from 'three';
const THREE = require("three");

var Tipping = function () {
    var self = this;

    // Shorts distance between point and line that passes through v
    // and w.  All arguments are Vector2.
    self.pointToLineDistanceSquared = function(p, v, w) {
        var l2 = v.distanceToSquared(w);  // i.e. |w-v|^2 -  avoid a sqrt
        if (l2 == 0) return distance(p, v);   // v == w case
        // Consider the line extending the segment, parameterized as v
        // + t (w - v).  We find projection of point p onto the line.
        // It falls where t = [(p-v) . (w-v)] / |w-v|^2
        var t = p.clone().sub(v).dot(w.clone().sub(v)) / l2;
        
  const vec2 projection = v + t * (w - v);  // Projection falls on the segment
  return distance(p, projection);
}
    // Given a list of Vector2, find the convex hull of those points.
    // The convex hull is given as a list of points that are the
    // outline of the convex hull.  The points are given so that they
    // wrap the hull counterclockwise.
    self.convexHull = function(points) {
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
            if (point == leftmostPoint)
                continue;  // The angle of a point with itself could
                           // be anything.
            var diffAngle = point.clone().sub(leftmostPoint).angle() -
                rightmostPoint.clone().sub(leftmostPoint).angle();
            if (diffAngle < 0) diffAngle += 2 * Math.PI;
            if (diffAngle > 0 && diffAngle < Math.PI) {
                pointsAbove.push(point);
            } else if (diffAngle > Math.PI) {
                pointsBelow.push(point);
            }
        }
    }
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
t.convexHull(points);
