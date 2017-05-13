'use strict';

import * as THREE from 'three';
import { hullPointsFromGeometry } from './Box3FromObject';
import { ConvexHull2D } from './ConvexHull2D';

export var Tipping = function (object_) {
    var self = this;
    var object = object_;

    // Stores the centroid of the geometry without matrixWorld
    // applied.
    self.centroid = (function(geometry) {
        // Finds the center of mass of a geometry.
        // Volume = magnitude(a dot (b cross c))/6
        var totalVolume = 0;
        var totalCentroid = new THREE.Vector3();
        var positions = geometry.getAttribute("position").array;
        for (var i = 0; i < positions.length; i += 9) {
            let a = new THREE.Vector3(positions[i], positions[i+1], positions[i+2]);
            let b = new THREE.Vector3(positions[i+3], positions[i+4], positions[i+5]);
            let c = new THREE.Vector3(positions[i+6], positions[i+7], positions[i+8]);
            var volume = b.clone().cross(c).dot(a)/6;
            var centroid = a.clone().add(b).add(c).divideScalar(4);
            totalVolume += volume;
            totalCentroid.add(centroid.multiplyScalar(volume));
        }
        return totalCentroid.divideScalar(totalVolume);
    })(object.children[0].geometry);

    self.tipObject = function*(endTime) {
        object.updateMatrixWorld();
        // Manually convert BufferGeometry to Geometry
        var faces = [];
        var positions = object.children[0].geometry.getAttribute("position").array;
        var bottomPoints = [];
        const EPSILON = 0.0001;
        if (!object.children[0].userData.hullPoints) {
            object.children[0].userData.hullPoints = hullPointsFromGeometry(object.children[0].geometry);
        }
        // Includes only points on hull of geometry that aren't on the bottom.
        var notBottomHullPoints = [];
        for (var hullPoint of object.children[0].userData.hullPoints) {
            let worldHullPoint = hullPoint.clone()
                .applyMatrix4(object.children[0].matrixWorld);
            if (worldHullPoint.z < EPSILON) {
                bottomPoints.push(new THREE.Vector2(worldHullPoint.x, worldHullPoint.y));
            } else {
                notBottomHullPoints.push(worldHullPoint);
            }
            if (Date.now() > endTime) {
                endTime = yield;
            }
        }
        var baseHull = new ConvexHull2D().convexHull(bottomPoints);
        var centroid = self.centroid.clone().applyMatrix4(object.children[0].matrixWorld);
        var bottomCentroid = new THREE.Vector2(centroid.x, centroid.y);
        if (new ConvexHull2D().pointInShape(bottomCentroid, baseHull)) {
            return; // No tipping needed.
        }
        var bottomCentroid3 = new THREE.Vector3(centroid.x, centroid.y, 0);
        // The closest point on the base of the object to the
        // centroid's projection on the platform.
        var projectedCentroid2 = new ConvexHull2D().projectPointOnShape(bottomCentroid, baseHull);
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
        for (var vertex of notBottomHullPoints) {
            // How far is that vertex from being rotated to the platform?
            var rotationAngle = vertex.clone().sub(projectedCentroid3).projectOnPlane(rotationPlane.normal).angleTo(bottomCentroid3.clone().sub(projectedCentroid3))
            if (rotationAngle < smallestRotationAngle && rotationAngle > 0) {
                smallestRotationAngle = rotationAngle;
            }
            if (Date.now() > endTime) {
                endTime = yield;
            }
        }
        yield new THREE.Quaternion().setFromAxisAngle(rotationPlane.normal.clone().normalize(), smallestRotationAngle);
    }
};

// browserify support
if ( typeof module === 'object' ) {
    module.exports = Tipping;
}
