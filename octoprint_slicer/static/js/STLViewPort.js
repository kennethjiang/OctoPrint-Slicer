/**
 * @author kennethjiang / https://github.com/kennethjiang
 *
 *
 * Description: A THREE view port for STL models
 *
 * Usage:
 *  var loader = new THREE.STLLoader();
 *  loader.load( './models/stl/slotted_disk.stl', function ( geometry ) {
 *    scene.add( new THREE.Mesh( geometry ) );
 *  });
 *
 * For binary STLs geometry might contain colors for vertices. To use it:
 *  // use the same code to load STL as above
 *  if (geometry.hasColors) {
 *    material = new THREE.MeshPhongMaterial({ opacity: geometry.alpha, vertexColors: THREE.VertexColors });
 *  } else { .... }
 */

THREE.STLViewPort = function ( canvas, width, height ) {

    var self = this;

    self.canvas = canvas;
    self.width = ( width !== undefined ) ? width : canvas.width;
    self.height = ( height !== undefined ) ? height : canvas.height;

	self.loadSTL = function ( url, onLoad, onProgress, onError ) {
    }
};
