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
        this.transformControls.addEventListener("objectChange", this.onObjectChange);
    }

    onObjectChange() {
        this.dispatchEvent();
    }

    setAxisOffset(axis, offset) {
        const frame = 10;
        this.axis = axis;
        this.offset = offset;
        let boundingBox = this.object.userData.box3FromObject();
        let size = boundingBox.getSize();
        this.plane.setRotationFromQuaternion(new THREE.Quaternion());
        if (axis=="X") {
            this.transformControls.axis = "X";
            this.plane.children[0].geometry.dispose();
            this.plane.children[0].geometry = new THREE.PlaneBufferGeometry(size.z + frame*2, size.y + frame*2);
            this.plane.rotateY(Math.PI/2);
        } else if (axis=="Y") {
            this.transformControls.axis = "Y";
            this.plane.children[0].geometry.dispose();
            this.plane.children[0].geometry = new THREE.PlaneBufferGeometry(size.x + frame*2, size.z + frame*2);
            this.plane.rotateX(-Math.PI/2);
        } else {
            this.transformControls.axis = "Z";
            this.plane.children[0].geometry.dispose();
            this.plane.children[0].geometry = new THREE.PlaneBufferGeometry(size.x + frame*2, size.y + frame*2);
        }
        this.plane.position.copy(this.object.position);
        this.plane.translateZ(offset);
    }

    start(object) {
        this.object = object;
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
