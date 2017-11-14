'use strict';

import * as THREE from 'three';
import { ConnectedSTL, TransformControls } from '3tk';

class Chop {

    constructor(stlViewPort) {
        this.stlViewPort = stlViewPort;
        let geometry = new THREE.PlaneBufferGeometry(30,30);
        let material = new THREE.MeshBasicMaterial(
            {color: 0xffff00, side: THREE.DoubleSide});
        let mesh = new THREE.Mesh(geometry, material);
        this.plane = new THREE.Object3D();
        this.plane.add(mesh);
        this.transformControls = new TransformControls(this.stlViewPort.camera, this.stlViewPort.renderer.domElement);
        this.transformControls.setHandles('translate', null);
        this.transformControls.setMode("translate");
        this.transformControls.axis = "Z";
        this.stlViewPort.scene.add(this.transformControls);
    }

    setAxis(axis) {
        this.plane.setRotationFromQuaternion(new THREE.Quaternion());
        if (axis=="X") {
            this.transformControls.axis = "X";
            this.plane.rotateY(Math.PI/2);
        } else if (axis=="Y") {
            this.transformControls.axis = "Y";
            this.plane.rotateX(Math.PI/2);
        } else {
            this.transformControls.axis = "Z";
        }
    }

    start(object) {
        this.stlViewPort.scene.add(this.plane);
        this.transformControls.attach(this.plane);
        this.stlViewPort.scene.add(this.transformControls);
    }

    stop() {
        this.stlViewPort.scene.remove(this.plane);
        this.transformControls.detach();
        this.stlViewPort.scene.remove(this.transformControls);
    }
}

export { Chop };
