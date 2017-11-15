'use strict';

import * as THREE from 'three';
import { ConnectedSTL, TransformControls, PointerInteractions } from '3tk';

class Chop extends THREE.EventDispatcher {

    constructor(stlViewPort) {
        super();
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
        this.transformControls.space = "world";
        this.transformControls.axis = "Z";

        // Need to use "recursive" as the intersection will be with
        // the mesh, not the top level objects that are nothing but
        // holder
        this.pointerInteractions = new PointerInteractions(
            this.stlViewPort.renderer.domElement, this.stlViewPort.camera, true);
        this.pointerInteractions.objects.push(this.plane);
        this.pointerInteractions.update();
        this.boundOnHoverChanged = (e) => this.onHoverChanged(e);
        this.pointerInteractions.addEventListener("hover", this.boundOnHoverChanged);

        this.stlViewPort.scene.add(this.transformControls);
        this.boundOnObjectChange = (e) => this.onObjectChange(e);
        this.transformControls.addEventListener("objectChange", this.boundOnObjectChange);
    }

    getDimension() {
        return this.objectSize[this.axis]
    }

    getOffsetMm() {
        return this.plane.position[this.axis] - this.object.position[this.axis];
    }

    getOffsetPercent() {
        return this.getOffsetMm()/this.getDimension()*100+50;
    }

    onHoverChanged() {
        if (this.pointerInteractions.hoveredObject) {
            $("#slicer-viewport").css("cursor", "move");
        } else {
            $("#slicer-viewport").css("cursor", "auto");
        }
    }

    onObjectChange() {
        let offsetPercent = this.getOffsetPercent();
        let newOffsetPercent = Math.min(100, Math.max(0, offsetPercent));
        if (offsetPercent != newOffsetPercent) {
            // This will already dispatchEvent for offsetMm.
            this.setOffsetPercent(newOffsetPercent);
            this.dispatchEvent({type: "offsetChange",
                                offsetPercent: newOffsetPercent
                               });
        } else {
            this.dispatchEvent({type: "offsetChange",
                                offsetMm: this.getOffsetMm(),
                                offsetPercent: offsetPercent
                               });
        }
    }

    // axis is one of x,y,z (case ignored).  Offset is reset to 0.
    setAxis(axis) {
        const frame = 10;
        this.axis = axis.toLowerCase();
        this.plane.setRotationFromQuaternion(new THREE.Quaternion());
        this.plane.children[0].geometry.dispose();
        if (this.axis=="x") {
            this.transformControls.axis = "X";
            this.plane.children[0].geometry = new THREE.PlaneBufferGeometry(this.objectSize.z + frame*2, this.objectSize.y + frame*2);
            this.plane.rotateY(Math.PI/2);
        } else if (this.axis=="y") {
            this.transformControls.axis = "Y";
            this.plane.children[0].geometry = new THREE.PlaneBufferGeometry(this.objectSize.x + frame*2, this.objectSize.z + frame*2);
            this.plane.rotateX(-Math.PI/2);
        } else {
            this.transformControls.axis = "Z";
            this.plane.children[0].geometry = new THREE.PlaneBufferGeometry(this.objectSize.x + frame*2, this.objectSize.y + frame*2);
        }
        this.plane.position.copy(this.object.position);
        this.dispatchEvent({type: "offsetChange",
                            offsetMm: this.getOffsetMm(),
                            offsetPercent: this.getOffsetPercent(),
                            offsetMmMax: this.getDimension()/2,
                            offsetMmMin: -this.getDimension()/2,
                           });
    }

    setOffsetMm(offsetMm) {
        this.plane.position.copy(this.object.position);
        this.plane.position[this.axis] += offsetMm;
        this.dispatchEvent({type: "offsetChange",
                            offsetPercent: this.getOffsetPercent()
                           });
    }

    setOffsetPercent(offsetPercent) {
        this.plane.position.copy(this.object.position);
        this.plane.position[this.axis] += (offsetPercent-50)/100*this.getDimension();
        this.dispatchEvent({type: "offsetChange",
                            offsetMm: this.getOffsetMm()
                           });
    }

    start(object) {
        this.object = object;
        let boundingBox = this.object.userData.box3FromObject();
        this.objectSize = boundingBox.getSize();
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
