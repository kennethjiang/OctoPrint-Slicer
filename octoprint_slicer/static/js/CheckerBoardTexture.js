// from : https://github.com/bunnybones1/threejs-texture-checkerboard/blob/master/index.js

// The MIT License (MIT) Copyright (c) 2014 Tomasz Dysinski
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, // // and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER // LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

function CheckerBoardTexture(color1, color2, rows, cols) {
    color1 = color1 || new THREE.Color(0xafafaf);
    color2 = color2 || new THREE.Color(0x3f3f3f);

    if(!(color1 instanceof THREE.Color)) color1 = new THREE.Color(color1);
    if(!(color2 instanceof THREE.Color)) color2 = new THREE.Color(color2);

    rows = rows || 4;
    cols = cols || 4;

    cols = Math.max(cols, 1);
    rows = Math.max(rows, 1);
    var size = 16;
    var pixelData = new Uint8Array( 3 * size );
    for (var i = 0, len = size; i < len; i++) {
        var i3 = i * 3;
        var color = (~~(i/2) % 2 == 0) ? color1 : color2;
        if(i >= 8) color = (color === color1) ? color2 : color1;
        pixelData[i3] = ~~(255 * color.r);
        pixelData[i3+1] = ~~(255 * color.g);
        pixelData[i3+2] = ~~(255 * color.b);
    };
    var width = 4,
        height = 4,
        format = THREE.RGBFormat,
        type = THREE.UnsignedByteType,
        mapping = undefined,
        wrapS = THREE.RepeatWrapping,
        wrapT = THREE.RepeatWrapping,
        magFilter = THREE.NearestFilter,
        minFilter = THREE.NearestFilter;

    THREE.DataTexture.call(this, pixelData, width, height, format, type, mapping, wrapS, wrapT, magFilter, minFilter);
    this.repeat.set(rows * .5, cols * .5);
    this.needsUpdate = true;
}

CheckerBoardTexture.prototype = Object.create(THREE.DataTexture.prototype);

// browserify support
if ( typeof module === 'object' ) {
  module.exports = CheckerBoardTexture;
}
