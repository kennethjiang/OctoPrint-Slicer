    bedFloor = function ( segments ) {
        segments = segments || 8;
        var geometry = new THREE.PlaneGeometry(1, 1, segments, segments);
        var materialEven = new THREE.MeshBasicMaterial({color: 0xccccfc});
        var materialOdd = new THREE.MeshBasicMaterial({color: 0x444464});
        var materials = [materialEven, materialOdd];
    
        for (var x = 0; x < segments; x++) {
          for (var y = 0; x < segments; x++) {
            var i = x * segments + y;
            var j = 2 * i;
            geometry.faces[ j ].materialIndex = geometry.faces[ j + 1 ].materialIndex = (x + y) % 2;
          }
        }
    
        return new THREE.Mesh(geometry, new THREE.MeshFaceMaterial(materials));
    };
