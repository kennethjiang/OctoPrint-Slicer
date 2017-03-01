/**
 * @author kennethjiang / https://github.com/kennethjiang
 *
 *
 * Description: A few utilities for STL model manipulations
 *
 */

var STLUtils = {

	split: function ( geometry ) {

        if (geometry.type == 'BufferGeometry') {
            geometry = new THREE.Geometry().fromBufferGeometry();
        }

        // This is needed because STLLoader doesn't merge the dups of vertices
        geometry.mergeVertices();

        var islands = []; // Each island is an array that contains indeices of all vertices connected to this island
        var vertices = geometry.vertices;

        for (var i = 0; i < geometry.faces.length; i++) {

            var face = geometry.faces[i];
            var faceIslands = [];
            ['a', 'b', 'c'].forEach( function(faceVertex) {

                var vertexIndex = face[faceVertex];
                if (vertices[vertexIndex].island == undefined) {
                    vertices[vertexIndex].island = [vertexIndex];
                    islands.push(vertices[vertexIndex].island);
                }

                faceIslands.push(vertices[vertexIndex].island);
            });

            // if there are different islands for this face, merge them
            var uniqueIslands = Array.from(new Set(faceIslands));
            var currentIsland = uniqueIslands[0];
            for (var j = 1; j < uniqueIslands.length; j++) {

                var islandToMerge = uniqueIslands[j];
                Array.prototype.push.apply(currentIsland, islandToMerge);
                islandToMerge.forEach( function(vertexIndex) {
                    vertices[vertexIndex].island = currentIsland;
                });

                // Remove merged island from global island list
                islands.splice(islands.indexOf(islandToMerge), 1);
            }
        }

    },

};

// browserify support
if ( typeof module === 'object' ) {

	module.exports = STLUtils;

}
