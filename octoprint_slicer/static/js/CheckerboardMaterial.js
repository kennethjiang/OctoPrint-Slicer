
'use strict';

var CheckerboardMaterial = function ( repeatX, repeatY, parameters, onTextureLoaded ) {

    THREE.MeshBasicMaterial.call( this );

    this.createTexture = function ( repeatX, repeatY ) {
        var texture = new THREE.TextureLoader().load( PLUGIN_BASEURL + "slicer/static/img/checkerboard.png", function( texture ) {
            texture.minFilter = texture.magFilter = THREE.LinearFilter;
            texture.repeat.set( repeatX, repeatY );
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            if (onTextureLoaded) onTextureLoaded(texture);
        });
        return texture;
    }

    this.depthTest = false;
    this.depthWrite = false;
    this.side = THREE.DoubleSide;
    this.transparent = true;
    this.opacity = 0.5;
    this.map = this.createTexture( repeatX, repeatY );

    this.setValues( parameters );
};

CheckerboardMaterial.prototype = Object.create( THREE.MeshBasicMaterial.prototype );
CheckerboardMaterial.prototype.constructor = CheckerboardMaterial;

// browserify support
if ( typeof module === 'object' ) {
    module.exports = CheckerboardMaterial;
}
