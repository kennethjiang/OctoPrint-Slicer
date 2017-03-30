
'use strict';

import { DoubleSide, MeshBasicMaterial, RepeatWrapping, TextureLoader, LinearFilter } from 'three';

export function CheckerboardMaterial( repeatX, repeatY, parameters, onTextureLoaded ) {

    MeshBasicMaterial.call( this );

    this.createTexture = function ( repeatX, repeatY ) {
        var texture = new TextureLoader().load( PLUGIN_BASEURL + "slicer/static/img/checkerboard.gif", function( texture ) {
            texture.minFilter = texture.magFilter = LinearFilter;
            texture.repeat.set( repeatX, repeatY );
            texture.wrapS = RepeatWrapping;
            texture.wrapT = RepeatWrapping;
            if (onTextureLoaded) onTextureLoaded(texture);
        });
        return texture;
    }

    this.depthTest = true;
    this.side = DoubleSide;
    this.transparent = true;
    this.opacity = 0.2;
    this.map = this.createTexture( repeatX, repeatY );

    this.setValues( parameters );
};

CheckerboardMaterial.prototype = Object.create( MeshBasicMaterial.prototype );
CheckerboardMaterial.prototype.constructor = CheckerboardMaterial;

