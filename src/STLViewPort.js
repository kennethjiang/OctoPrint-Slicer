/**
 * @author kennethjiang / https://github.com/kennethjiang
 *
 *
 * Description: A THREE view port for STL models
 *
 * Usage:
 *  var viewPort = new THREE.STLViewPort(canvas, width, height, function() {
 *     //things to do when any model in the view port changes
 *  });
 *  viewPort.init();
 *  viewPort.loadSTL(url, fucntion(model) {
 *     viewPort.makeModelActive(model);
 *     //things to do when model is loaded
 *  });
 *  var scene = viewPort.scene; // direct access to the scene for to add THREE.Object
 *
 */


'use strict';

import { OrbitControls, TransformControls, STLLoader, PointerInteractions } from '3tk';
import * as THREE from 'three';

export function STLViewPort( canvas, width, height, onChange, onNewModel ) {

    var self = this;

    self.canvas = canvas;
    self.canvasWidth = width;
    self.canvasHeight = height;
    self.onChange = onChange;
    self.onNewModel = onNewModel;

    self.effectController = {
        metalness: 0.5,
        roughness: 0.5,
        modelInactiveColor: new THREE.Color("#60715b"),
        modelActiveColor: new THREE.Color("#34bf0d"),
        ambientLightColor: new THREE.Color("#2b2b2b"),
        directionalLightColor: new THREE.Color("#ffffff"),
    };

    self.init = function() {

        self.camera = new THREE.PerspectiveCamera( 45, 1.0, 0.1, 5000 );

        self.camera.up.set( 0, 0, 1 );
        self.camera.position.set( -100, -200, 250 );

        self.scene = new THREE.Scene();

        // Lights
        var ambientLight = new THREE.AmbientLight( self.effectController.ambientLightColor );  // 0.2
        self.scene.add( ambientLight );
        var directionalLight = new THREE.DirectionalLight(self.effectController.directionalLightColor, 1.0);
        directionalLight.position.set( 100, 100, 500 );
        self.scene.add( directionalLight );
        var directionalLight2= new THREE.DirectionalLight(self.effectController.directionalLightColor, 1.0);
        directionalLight2.position.set( 100, 100, -500);
        self.scene.add( directionalLight2);

        self.renderer = new THREE.WebGLRenderer( { canvas: self.canvas, antialias: true } );

        self.renderer.setClearColor( 0xd8d8d8 );
        self.renderer.setSize( self.canvasWidth, self.canvasHeight );
        self.renderer.setPixelRatio( window.devicePixelRatio );

        self.renderer.gammaInput = true;
        self.renderer.gammaOutput = true;

        self.stats = new Stats();
        self.stats.showPanel( 1 );

        self.pointerInteractions = new PointerInteractions( self.renderer.domElement, self.camera, true ); // Need to use "recursive" as the intersection will be with the mesh, not the top level objects that are nothing but holder
        self.pointerInteractions.addEventListener("click", self.selectionChanged);
        self.pointerInteractions.addEventListener("hover", self.hoverChanged);

        self.orbitControls = new OrbitControls(self.camera, self.renderer.domElement);

        self.orbitControls.enableDamping = true;
        self.orbitControls.dampingFactor = 0.25;
        self.orbitControls.enablePan = false;
        self.orbitControls.addEventListener("change", self.render);

        self.transformControls = new TransformControls(self.camera, self.renderer.domElement);

        self.transformControls.setRotationSnap( THREE.Math.degToRad( 15 ) )
        self.transformControls.addEventListener("change", self.render);
        self.transformControls.addEventListener("mouseDown", self.startTransform);
        self.transformControls.addEventListener("mouseUp", self.endTransform);
        self.transformControls.addEventListener("objectChange", self.onChange);
        self.transformControls.setHandles( 'translate', null );
        self.transformControls.setMode("translate");
        self.transformControls.space = "world";
        self.transformControls.axis = "XY";
        self.scene.add(self.transformControls);

        window.addEventListener( 'keydown', function ( event ) {
            switch ( event.keyCode ) {
                case 17: // Ctrl
                    self.transformControls.setRotationSnap(null);
                    break;
            }
        });

        window.addEventListener( 'keyup', function ( event ) {
            switch ( event.keyCode ) {
                case 17: // Ctrl
                    self.transformControls.setRotationSnap( THREE.Math.degToRad( 15 ) );
                    break;
            }
        });

        self.animate();
    };

    self.animate = function() {
        requestAnimationFrame( self.animate );

        self.transformControls.update();
        self.orbitControls.update();
        self.stats.update();

        self.render();
    };

    self.render = function() {
        self.renderer.render( self.scene, self.camera );
    };

    self.loadSTL = function ( url, onLoad ) {
        new STLLoader().load(url, function ( geometry ) {
            var newModel = self.addModelOfGeometry(geometry);
            self.makeModelActive( newModel );
            self.onNewModel([ newModel ]);
        });
    };

    self.addModelOfGeometry = function( geometry, modelToCopyTransformFrom ) {
        var material = new THREE.MeshStandardMaterial({
            color: self.effectController.modelInactiveColor,  // We'll mark it active below.
            shading: THREE.SmoothShading,
            side: THREE.DoubleSide,
            metalness: self.effectController.metalness,
            roughness: self.effectController.roughness });

        var stlModel = new THREE.Mesh( geometry, material );

        // center model's origin
        var center = new THREE.Box3().setFromObject(stlModel).center();
        var model = new THREE.Object3D();
        model.add(stlModel);
        stlModel.position.copy(center.negate());
        if (modelToCopyTransformFrom) {
            model.rotation.copy(modelToCopyTransformFrom.rotation);
            model.scale.copy(modelToCopyTransformFrom.scale);
        }

        self.scene.add(model);
        self.render();

        self.pointerInteractions.objects.push(model);
        self.pointerInteractions.update();
        return model;
    };

    self.models = function() {
        return self.pointerInteractions.objects;
    }

    self.activeModel = function() {
        return self.transformControls.object;
    }

    self.selectionChanged = function( event ) {
        if (event.current) {
            self.makeModelActive( event.current.parent );
        } else {
            self.makeModelActive( null );
        }
    };

    self.hoverChanged = function( event ) {
    }

    /**
     * params:
     *    m: model to make active. Clear active model if m is undefined
     *
     */
    self.makeModelActive = function(m) {
        // Sets one file active and inactivates all the others.
        if (m) {
            self.transformControls.attach(m);
        } else {
            self.transformControls.detach();
        }

        for (var i = 0; i < self.pointerInteractions.objects.length; i++) {
            var model = self.pointerInteractions.objects[i];
            if (model == self.activeModel()) {
                model.children[0].material.color.copy(self.effectController.modelActiveColor);
            } else {
                model.children[0].material.color.copy(self.effectController.modelInactiveColor);
            }
        }

        self.render();
        self.onChange();
    };

    self.removeActiveModel = function() {
        if (!self.activeModel()) {
            return null;
        } else {
            var model = self.activeModel();

            var index = self.pointerInteractions.objects.indexOf(model);
            if (index > -1) {
                self.pointerInteractions.objects.splice(index, 1);
            }
            self.pointerInteractions.update();

            self.scene.remove(model);
            self.makeModelActive(undefined);
            return model;
        }
    };

    self.removeAllModels = function() {
        for (var i = 0; i < self.pointerInteractions.objects.length; i++) {
            self.scene.remove(self.pointerInteractions.objects[i]);
        }
        self.pointerInteractions.objects = [];
        self.pointerInteractions.update();
    }

    self.splitActiveModel = function() {
        if (!self.activeModel()) {
            return;
        } else {
            var originalModel = self.removeActiveModel()
            var geometry = originalModel.children[0].geometry;
            var newGeometries = GeometryUtils.split(geometry);
            self.onNewModel(
                newGeometries.map( function(geometry) {
                    return self.addModelOfGeometry( geometry, originalModel );
                })
            );
        }
    };

    self.onlyOneOriginalModel = function() {
        var models = self.pointerInteractions.objects;
        return models.length == 1  &&
            models[0].position.x == 0.0 &&
            models[0].position.y == 0.0 &&
            models[0].rotation.x == 0.0 &&
            models[0].rotation.y == 0.0 &&
            models[0].rotation.z == 0.0 &&
            models[0].scale.x == 1.0 &&
            models[0].scale.y == 1.0 &&
            models[0].scale.z == 1.0
    };

    self.startTransform = function () {
        // Disable orbit controls
        self.orbitControls.enabled = false;
    };

    self.endTransform = function () {
        // Enable orbit controls
        self.orbitControls.enabled = true;
    };

}
