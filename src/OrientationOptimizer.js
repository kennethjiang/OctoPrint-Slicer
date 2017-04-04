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

    var surfaces = BufferGeometryAnalyzer.sortedSurfacesByArea( geometry );

    // Cost function for the optimal level of orientation. Larger is worse.
    function costFunction( orientation ) {
        return orientation.overhangArea - 4.0*orientation.bottomArea;
    }

    self.calculatedOrientationFromVector = function( orientationVector ) {

        // Largest projection represents the "bottom" of geometry along the direction of o.vector
        // Any vertex that has the same projection is considered "sitting at the bottom"
        var largestProjection = largestProjectionToVector( orientationVector );

        var bottomArea = 0;
        var overhangArea = 0;
        var bottom = [];
        var overhang = [];

        for ( var surface of surfaces ) {

            var surfaceNormal = normalVectorOfSurface(surface);
            var angle = surfaceNormal.angleTo(orientationVector);

            if ( angle < CRITICAL_ANGLE ) {

                if ( angle < PERPENDICULAR && (largestProjection - projectionToVector( surface.faceIndices[0], orientationVector) ) < TOUCH_BOTTOM_TOLERANCE ) {
                    bottomArea += surface.area;
                    bottom.push(surface);
                } else {
                    overhangArea += surface.area;
                    overhang.push(surface);
                }
            }
        }
        return { vector: orientationVector, bottomArea, overhangArea, bottom, overhang };

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

    self.optimalOrientation = function( originalVector, maxPivot ) {

        // Choose the surfaces that account for 90% of the area for testing
        // De-dup orientations; make sure the angle change doesn't exceed maxPivot; and take up to 128 orientations
        var totalArea = surfaces.reduce( function(sum, surface) { return sum+surface.area }, 0);
        var areaSumSoFar = 0;
        var vectorCandidates = surfaces
            .filter( function(surface) {
                areaSumSoFar += surface.area;
                return areaSumSoFar/totalArea <= 0.9;
            } )
            .map( normalVectorOfSurface )

        var vectorsToTest = uniqBy(vectorCandidates, function(v) {
                return Math.round( v.x*10000 ) + '_' + Math.round( v.y*10000 ) + '_' + Math.round( v.z*10000 );
            })
            .filter( function(v) { return v.angleTo(originalVector) <= maxPivot; } )
            .slice(0, 127);

        var rankedOrientations = vectorsToTest.map( self.calculatedOrientationFromVector )
            .sort( function(a, b) { return costFunction(a) - costFunction(b); } );
        return rankedOrientations.length > 0 ? rankedOrientations[0].vector : originalVector;

    }

}
