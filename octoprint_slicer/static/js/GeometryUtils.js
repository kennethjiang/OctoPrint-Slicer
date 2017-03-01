/**
 * @author kennethjiang / https://github.com/kennethjiang
 *
 *
 * Description: A few utilities for process Geometries
 *
 */

VertexNode = function( posIndex ) {
    var self = this;
    self.positionIndices = [posIndex];
    self.neighbors = new Set();
    self.visited = false;

    self.addPositionIndex = function( posIndex ) {
        self.positionIndices.push( posIndex );
    };

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
    self.verticesMap = new Map(); // map of { vertexKey -> vertexNode }

    self.vertexKey = function(x, y, z) {
        var precisionPoints = 4; // number of decimal points, e.g. 4 for epsilon of 0.0001
        var precision = Math.pow( 10, precisionPoints );
        return Math.round( x * precision ) + '_' + Math.round( y * precision ) + '_' + Math.round( z * precision );
    };

    for (var faceIndex = 0; faceIndex < positions.length; faceIndex += 9) { // a face is 9 positions - 3 vertex x 3 positions

        var verticesOfCurrentFace = [];
        for (var v = 0; v < 3; v++ ) {

            var posIndex = faceIndex + v*3;
            var key = self.vertexKey(positions[posIndex], positions[posIndex + 1], positions[posIndex + 2]); // 0 -> x; 1 -> y; 2 -> z;

            if ( self.verticesMap.has(key) ) {
                self.verticesMap.get(key).addPositionIndex( posIndex );
            } else {
                self.verticesMap.set(key, new VertexNode( posIndex ));
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

            if (vertexNode.visited) {
                return ;
            }

            allIslands.push( self.floodFill(vertexNode) );
        });

        return allIslands;
    };

    self.floodFill = function(start) {

        var filledIsland = [];

        // Breadth-first traversal
        var queue = [];

        // Mark the source node as visited and enqueue it
        queue.unshift(start);
        start.visited = true;
        filledIsland.push(start);

        while (queue.length > 0) {

            // Dequeue a vertex from queue and print it
            var v = queue.pop(0);

            // Get all adjacent vertices of the dequeued
            // vertex s. If a adjacent has not been visited,
            // then mark it visited and enqueue it
            v.neighbors.forEach( function( nextV ) {

                if (! nextV.visited) {
                    queue.unshift(nextV);
                    nextV.visited = true;
                    filledIsland.push(nextV);
                }
            });
        }

        return filledIsland;
    };

}


var GeometryUtils = {

	split: function ( geometry ) {

        var attributes = geometry.attributes;
        var positions = attributes.position.array;

        var islands = new VertexGraph(positions).islands();
    },

};

// browserify support
if ( typeof module === 'object' ) {

	module.exports = GeometryUtils;

}
