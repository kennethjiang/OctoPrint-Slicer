'use strict';

import * as THREE from 'three';

export var Tipping = function () {
    var self = this;

    // Find closest point on line to vw to point p.  All arguments are
    // Vector2.
    self.projectPointToLine = function(p, v, w, segment = false) {
        var l2 = v.distanceToSquared(w);  // i.e. |w-v|^2 -  avoid a sqrt
        if (l2 == 0) return v;
        // Consider the line extending the segment, parameterized as v
        // + t (w - v).  We find projection of point p onto the line.
        // It falls where t = [(p-v) . (w-v)] / |w-v|^2
        if (segment) {
            t = Math.min(1, Math.max(0, t));  // Clamp to line segment.
        }
        var t = p.clone().sub(v).dot(w.clone().sub(v)) / l2;
        var projection = v.clone().add(w.clone().sub(v).multiplyScalar(t));
        return projection;
    }

    // Find closest point on line to vw to point p.  All arguments are
    // Vector2.
    self.projectPointToLineSegment = function(p, v, w) {
        return self.projectPointToLine(p, v, w, true);
    }

    // Given 3 points a, b, c, find the angle of abc.  The result is
    // the rotation to apply to the ray ba to get a ray from b through
    // c.  positive is counterclockwise.  result is between 0 and 2PI.
    self.angle3 = function(a, b, c) {
        var diffAngle = c.clone().sub(b).angle() - a.clone().sub(b).angle();
        // angle() returns between 0 and 2pi so diffAngle is between -2pi and 2pi.
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
        }

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
            var centroid = a.clone().add(b).add(c).divideScalar(4);
            totalVolume += volume;
            totalCentroid.add(centroid.multiplyScalar(volume));
        }
        return totalCentroid.divideScalar(totalVolume);
    };

    // Given a Vector2 point and a list of Vector2 that describe a
    // closed shape, check if the point is inside the shape.
    self.pointInShape = function(point, shape) {
        var totalAngle = 0;
        for (var i=0; i < shape.length; i++) {
            var diffAngle = self.angle3(shape[i], point, shape[(i+1)%shape.length]);
            // diffAngle is sure to be between 0 and 2PI.
            if (diffAngle > Math.PI) {
                diffAngle -= 2*Math.PI;
            }
            // Now diffAngle is between -PI and PI.
            totalAngle += diffAngle;
        }
        const EPSILON = 0.0001;
        return totalAngle > EPSILON;
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

    self.tipObject = function(object) {
        const EPSILON = 0.0001;
        var bottomPoints = [];
        object.updateMatrixWorld();
        var geometry = new THREE.Geometry().fromBufferGeometry(object.children[0].geometry);
        geometry.applyMatrix(object.children[0].matrixWorld);
        for (var vertex of geometry.vertices) {
            if (vertex.z < EPSILON) {
                bottomPoints.push(new THREE.Vector2(vertex.x, vertex.y));
            }
        }
        var baseHull = self.convexHull(bottomPoints);
        var centroid = self.centroid(geometry);
        var bottomCentroid = new THREE.Vector2(centroid.x, centroid.y);
        if (self.pointInShape(bottomCentroid, baseHull)) {
            return; // No tipping needed.
        }
        var bottomCentroid3 = new THREE.Vector3(centroid.x, centroid.y, 0);
        // The closest point on the base of the object to the
        // centroid's projection on the platform.
        var projectedCentroid2 = self.projectPointOnShape(bottomCentroid, baseHull);
        // The point on the platform about which there will be rotation.
        var projectedCentroid3 = new THREE.Vector3(projectedCentroid2.x,
                                             projectedCentroid2.y,
                                             0);
        const GRAVITY = new THREE.Vector3(0,0,-1); // Down.
        var rotationPlane = new THREE.Plane().setFromCoplanarPoints(
            centroid, bottomCentroid3, projectedCentroid3);
        // Find the minimum rotation so that a point that isn't on the
        // platform hits the platform.
        // debugger;
        var smallestRotationAngle = Infinity;
        var vertexToPlatform;
        for (var vertex of geometry.vertices) {
            if (vertex.z < EPSILON) {
                continue; // It's already on the bottom.
            }
            // How far is that vertex from being rotated to the platform?
            var rotationAngle = vertex.clone().sub(projectedCentroid3).projectOnPlane(rotationPlane.normal).angleTo(bottomCentroid3.clone().sub(projectedCentroid3))
            if (rotationAngle < smallestRotationAngle) {
                smallestRotationAngle = rotationAngle;
                vertexToPlatform = vertex;
            }
        }
        if (smallestRotationAngle > Math.PI/180) {
            smallestRotationAngle = Math.PI/180; // limiting tipping to 1 degree
        }
        return new THREE.Quaternion().setFromAxisAngle(rotationPlane.normal.clone().normalize(), smallestRotationAngle);
    }
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
