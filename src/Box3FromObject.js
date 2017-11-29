'use strict';

/* Finds the Box3 that encloses an object in an ES6 generator that
 * yields ocassionally, so that this can be done with cooperative
 * multitasking and not degrade performance. */

import * as THREE from 'three';
import { ConvexGeometry } from '3tk';

// Computes the world-axis-aligned bounding box of an object
// (including its children), accounting for both the object's, and
// children's, world transforms

// Initialize with a object.  It will run on that object
export function Box3FromObject(object) {

    // Gets the points that make up the hull of the geometry, with no
    // transfomrations.
    let hullPointsFromGeometry = function(geometry) {
        // Traverses the ponts in a geometry.
        let traversePoints = function(traverseFn) {
            // Taken from Box3.expandByObject
            let v1 = new THREE.Vector3();
            if ( geometry.isGeometry ) {
                let vertices = geometry.vertices;
                for ( i = 0, l = vertices.length; i < l; i ++ ) {
                    v1.copy(vertices[ i ] );
                    traverseFn(v1);
                }
            } else if ( geometry.isBufferGeometry ) {
                let attribute = geometry.attributes.position;
                if ( attribute !== undefined ) {
                    for ( let i = 0, l = attribute.count; i < l; i ++ ) {
                        v1.fromBufferAttribute( attribute, i );
                        traverseFn(v1);
                    }
                }
            }
        };

        let allPoints = [];
        traversePoints(function (point) { allPoints.push(point.clone()); });
        // allPoint has all points from the geometry
        let hullPoints = [];
        try {
            let convexHull = new ConvexGeometry(allPoints);
            let hullMap = {};
            for (let face of convexHull.faces) {
                for (let vertexIndex of [face.a, face.b, face.c]) {
                    let hullPoint = convexHull.vertices[vertexIndex];
                    if (!hullMap[hullPoint.x]) {
                        hullMap[hullPoint.x] = {};
                    }
                    if (!hullMap[hullPoint.x][hullPoint.y]) {
                        hullMap[hullPoint.x][hullPoint.y] = {};
                    }
                    if (!hullMap[hullPoint.x][hullPoint.y][hullPoint.z]) {
                        hullMap[hullPoint.x][hullPoint.y][hullPoint.z] = {};
                    }
                }
            }
            for (const x in hullMap) {
                for (const y in hullMap[x]) {
                    for (const z in hullMap[x][y]) {
                        hullPoints.push(new THREE.Vector3(x,y,z));
                    }
                }
            }
        } catch (e) {
            // Maybe the shape isn't legal.  In that case, we'll just
            // use all the original points.
            hullPoints = allPoints;
        }
        return hullPoints;
    };

    let previousMatrixWorld = null;
    let previousBox3 = null;
/*    object.traverse(function (node) {
        if (node.geometry && !node.userData.hullPoints) {
            node.userData.hullPoints = hullPointsFromGeometry(node.geometry);
        }
        if (!node.userData.box3FromObject) {
            node.userData.box3FromObject = Box3FromObject(node);
        }
    });*/
    return function() {
        object.updateMatrixWorld();
        let box3 = new THREE.Box3();
        let done = false;
        let previousRotation = new THREE.Matrix4();
        if (previousMatrixWorld) {
            previousRotation.extractRotation(previousMatrixWorld);
            let currentRotation = new THREE.Matrix4();
            currentRotation.extractRotation(object.matrixWorld);
            if (previousRotation.equals(currentRotation)) {
                // Previous rotation same as current rotation so no
                // need to recalculate the box.
                done = true;
            }
        }
        if (!done) {
            // No previous of the rotation is different so we must
            // start over.
            if (!object.geometry) {
                object.userData.hullPoints = [];
            } else if (!object.userData.hullPoints) {
                object.userData.hullPoints = hullPointsFromGeometry(object.geometry);
            }
            previousMatrixWorld = object.matrixWorld.clone();
            previousRotation.extractRotation(previousMatrixWorld);
            previousBox3 = new THREE.Box3();
            for (let point of object.userData.hullPoints) {
                previousBox3.expandByPoint(point.clone().applyMatrix4(previousMatrixWorld));
            }
        }
        // By this point, the rotation in previousMatrixWorld matches
        // the rotation in matrixWorld.  So we can just apply the
        // matrixces to the points to get the correct locations.
        if (!previousBox3.isEmpty()) {
            let previousToCurrentMatrixWorld = new THREE.Matrix4()
                .getInverse(previousMatrixWorld)
                .premultiply(object.matrixWorld);
            box3.expandByPoint(previousBox3.min.clone()
                               .applyMatrix4(previousToCurrentMatrixWorld));
            box3.expandByPoint(previousBox3.max.clone()
                               .applyMatrix4(previousToCurrentMatrixWorld));
        }
        for (let child of object.children) {
            if (!child.userData.box3FromObject) {
                child.userData.box3FromObject = Box3FromObject(child);
            }
            let childBox3 = child.userData.box3FromObject();
            box3.expandByPoint(childBox3.min);
            box3.expandByPoint(childBox3.max);
        }
        const DEBUGGING = false; // For debugging but makes performance very slow.
        if (DEBUGGING) {
            let oldBox3 = new THREE.Box3().setFromObject(object);
            let maxDiff = box3.max.clone().sub(oldBox3.max);
            let minDiff = box3.min.clone().sub(oldBox3.min);
            const EPSILON = 0.0001; // Set this to 0 to see even microscopic differences.
            if (maxDiff.x > EPSILON || maxDiff.y > EPSILON || maxDiff.z > EPSILON ||
                minDiff.x > EPSILON || minDiff.y > EPSILON || minDiff.z > EPSILON) {
                console.log("new - old: " +
                            JSON.stringify(box3.max.clone().sub(oldBox3.max)) + "," +
                            JSON.stringify(box3.min.clone().sub(oldBox3.min)));
                console.log("new, old: " + JSON.stringify(box3) + "," + JSON.stringify(oldBox3));
            }
        }
        return box3;
    };
};
