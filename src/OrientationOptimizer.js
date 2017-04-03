'use strict';

import * as THREE from 'three';
import { BufferGeometryAnalyzer } from '3tk';
import { uniqBy } from 'lodash-es';

export function OrientationOptimizer(geometry) {


    // When normal of a surface is at less than critical angle, the surface is considered overhang or bottom,
    // depending on where it sits.
    // 0.785398 is 45 degree in radians
    var CRITICAL_ANGLE = 0.785398;

    // When normal of a surface is considered perpendicular (hence the surface itself is level).
    // 0.00174533 is 0.1 degree in radians
    var PERPENDICULAR = 0.00174533;

    // When a vertex is considered "touching the bottom"
    var TOUCH_BOTTOM_TOLERANCE = 0.15;

    var self = this;

    var normals = geometry.attributes.normal.array;
    var positions = geometry.attributes.position.array;

    // Cost function for the optimal level of orientation. Larger is worse.
    function costFunction( orientation ) {
        return orientation.overhangArea - 0.25*orientation.bottomArea;
    }

    function projectionToVector( vertexIndex, vector ) {
        return vector.dot( new THREE.Vector3(positions[vertexIndex], positions[vertexIndex+1], positions[vertexIndex+2]) );  // According to Linear Algebra
    }

    function largestProjectionToVector( vector ) {
        var highest = -1*Infinity;

        for ( var i = 0; i < positions.length; i+=3 ) {
                var projection = projectionToVector( i, vector );
                if ( projection > highest ) {
                    highest = projection;
                }
        }
        return highest;
    }

    function normalVectorOfSurface( surface ) {
        return new THREE.Vector3(
            normals[surface.faceIndices[0]],
            normals[surface.faceIndices[0]+1],
            normals[surface.faceIndices[0]+2]);
    }

    self.optimalOrientation = function() {

        var surfaces = BufferGeometryAnalyzer.sortedPlanesByArea( geometry );

        // Choose the surfaces that account for 75% of the area for testing, or up to 128 surfaces
        var totalArea = surfaces.reduce( function(sum, surface) { return sum+surface.area }, 0);
        var areaSumSoFar = 0;
        var orientationCountSoFar = 0;

        var potentialOrientations = surfaces
            .filter( function(surface) {
                areaSumSoFar += surface.area;
                orientationCountSoFar ++;
                return areaSumSoFar/totalArea <= 0.75 && orientationCountSoFar < 128;
            } )
            .map( function(surface) { return { vector: normalVectorOfSurface(surface) } } );

        // De-dup orientations
        var orientationsToTest = uniqBy(potentialOrientations, function(o) {
            var v = o.vector;
            return Math.round( v.x*10000 ) + '_' + Math.round( v.y*10000 ) + '_' + Math.round( v.z*10000 );
        });

        for ( var o of orientationsToTest ) {

            // Largest projection represents the "bottom" of geometry along the direction of o.vector
            // Any vertex that has the same projection is considered "sitting at the bottom"
            var largestProjection = largestProjectionToVector( o.vector );

            o.bottomArea = 0;
            o.overhangArea = 0;

            for ( var surface of surfaces ) {

                var surfaceNormal = normalVectorOfSurface(surface);

                var angle = surfaceNormal.angleTo(o.vector);
                //var cosAngle = surfaceNormal.dot(o.vector) / (surfaceNormal.length() * o.vector.length()) ; //Based on Linear Algebra
                if ( angle < CRITICAL_ANGLE ) {

                    // When
                    if ( angle < PERPENDICULAR && (largestProjection - projectionToVector( surface.faceIndices[0], o.vector) ) < TOUCH_BOTTOM_TOLERANCE ) {
                        o.bottomArea += surface.area;
                    } else {
                        o.overhangArea += surface.area;
                    }
                }
            }
        }

        var rankedOrientations = orientationsToTest.sort( function(a, b) { return costFunction(a) - costFunction(b); } );
        return rankedOrientations[0].vector;

    }

}
