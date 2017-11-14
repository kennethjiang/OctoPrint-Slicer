'use strict';

import * as THREE from 'three';
import { ConnectedSTL, TransformControls } from '3tk';

class Chop {

    constructor(stlViewPort) {
        this.stlViewPort = stlViewPort;
    }
    start() {
        let geometry = new THREE.PlaneBufferGeometry(30,30);
        let material = new THREE.MeshBasicMaterial(
            {color: 0xffff00, side: THREE.DoubleSide});
        let mesh = new THREE.Mesh(geometry, material);
        let plane = new THREE.Object3D();
        plane.rotateY(Math.PI/2);
        plane.add(mesh);
        this.stlViewPort.scene.add(plane);
        this.transformControls = new TransformControls(this.stlViewPort.camera, this.stlViewPort.renderer.domElement);
        this.transformControls.setHandles('translate', null);
        this.transformControls.setMode("translate");
        this.transformControls.axis = "X";
        this.transformControls.attach(plane);
        this.stlViewPort.scene.add(this.transformControls);
    }
}

export { Chop };
