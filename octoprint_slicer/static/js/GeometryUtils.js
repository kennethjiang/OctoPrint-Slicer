/**
 * @author kennethjiang / https://github.com/kennethjiang
 *
 *
 * Description: A few utilities for process Geometries
 *
 */

VertexNode = function( posIndex ) {
    var self = this;
    self.neighbors = new Set();
    self.island = undefined;

    self.addNeighbor = function( vertexNode ) {
        if (vertexNode === self) {
            return ;
        }

        self.neighbors.add( vertexNode );
        vertexNode.neighbors.add( self );
    };
}

VertexGraph = function( positions ) {
    var self = this;
    self.positions = positions;
    self.verticesMap = new Map(); // map of { vertexKey -> vertexNode }

    self.vertexKeyForPosition = function(posIndex) {

        // 0 -> x; 1 -> y; 2 -> z
        [x, y, z] = [ self.positions[posIndex], self.positions[posIndex+1], self.positions[posIndex+2] ];

        var precisionPoints = 4; // number of decimal points, e.g. 4 for epsilon of 0.0001
        var precision = Math.pow( 10, precisionPoints );
        return Math.round( x * precision ) + '_' + Math.round( y * precision ) + '_' + Math.round( z * precision );

    };

    self.vertexForPosition = function(posIndex) {
        return self.verticesMap.get( self.vertexKeyForPosition(posIndex) );
    };

    for (var faceIndex = 0; faceIndex < positions.length; faceIndex += 9) { // a face is 9 positions - 3 vertex x 3 positions

        var verticesOfCurrentFace = [];
        for (var v = 0; v < 3; v++ ) {
            var key = self.vertexKeyForPosition( faceIndex + v*3 );

            if ( !self.verticesMap.has(key) ) {
                self.verticesMap.set(key, new VertexNode());
            }

            verticesOfCurrentFace.push( self.verticesMap.get(key) );
        }

        // Since these 3 vertices are on the same face, they are neighbors on the graph
        verticesOfCurrentFace[0].addNeighbor(verticesOfCurrentFace[1]);
        verticesOfCurrentFace[0].addNeighbor(verticesOfCurrentFace[2]);
    }

    self.islands = function() {
        var allIslands = [];

        self.verticesMap.forEach( function( vertexNode ) {

            if (vertexNode.island) {
                return ;
            }

            var newIsland = {};
            self.floodFill(vertexNode, newIsland)
            allIslands.push(newIsland);
        });

        return allIslands;
    };

    self.floodFill = function(start, island) {

        // Breadth-first traversal
        var queue = [];

        // Mark the source node as visited and enqueue it
        queue.unshift(start);
        start.island = island;

        while (queue.length > 0) {

            // Dequeue a vertex from queue and print it
            var v = queue.pop(0);

            // Get all adjacent vertices of the dequeued
            // vertex s. If a adjacent has not been visited,
            // then mark it visited and enqueue it
            v.neighbors.forEach( function( nextV ) {

                if (! nextV.island) {
                    queue.unshift(nextV);
                    nextV.island = island;
                }
            });
        }
    };

}


var GeometryUtils = {

	split: function ( geometry ) {

        var originalPositions = geometry.attributes.position.array;
        var originalNormals = geometry.attributes.normal !== undefined ? geometry.attributes.normal.array : undefined;

        var graph = new VertexGraph(originalPositions);
        var islands = graph.islands();
        var verticesMap = graph.verticesMap;

        islands.forEach( function( island ) {
            island.faceIndices = [];  // List of position indices the faces (the same as position index of 1st vertex of the face) on this island
        });

        for (var faceIndex = 0; faceIndex < originalPositions.length; faceIndex += 9) { // a face is 9 positions - 3 vertex x 3 positions
            var islandOfCurrentFace = graph.vertexForPosition(faceIndex).island;
            islandOfCurrentFace.faceIndices.push(faceIndex);
        }

        var geometries = islands.map( function( island ) {

            // Adopted from STLLoader.js
            var geometry = new THREE.BufferGeometry();

            var vertices = [];
            var normals = [];

            island.faceIndices.forEach( function( faceIndex ) {

                for (var i = 0; i < 9; i++) {
                    vertices.push( originalPositions[faceIndex + i] );
                    if (originalNormals) {
                        normals.push( originalNormals[faceIndex + i] );
                    }
                }

            });

            geometry.addAttribute( 'position', new THREE.BufferAttribute( new Float32Array( vertices ), 3 ) );
            if (originalNormals) {
                geometry.addAttribute( 'normal', new THREE.BufferAttribute( new Float32Array( normals ), 3 ) );
            }

            return geometry;
        });

        return geometries;
    },

};

// browserify support
if ( typeof module === 'object' ) {

	module.exports = GeometryUtils;

}
