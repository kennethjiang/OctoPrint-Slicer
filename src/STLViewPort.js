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
 *     viewPort.selectModel(model);
 *     //things to do when model is loaded
 *  });
 *  var scene = viewPort.scene; // direct access to the scene for to add THREE.Object
 *
 */


'use strict';

import { forEach, map } from 'lodash-es';
import * as THREE from 'three';
import { BufferGeometryAnalyzer, OrbitControls, TransformControls, STLLoader, PointerInteractions } from '3tk';
import { OrientationOptimizer } from './OrientationOptimizer';

export function STLViewPort( canvas, width, height ) {

    var self = this;

    self.canvas = canvas;
    self.canvasWidth = width;
    self.canvasHeight = height;

    self.effectController = {
        metalness: 0.5,
        roughness: 0.5,
        modelInactiveColor: new THREE.Color("#60715b"),
        modelActiveColor: new THREE.Color("#34bf0d"),
        modelHoverColor: new THREE.Color("#84f25c"),
        ambientLightColor: new THREE.Color("#2b2b2b"),
        directionalLightColor: new THREE.Color("#ffffff"),
    };

    var eventType = { change: "change", add: "add", delete: "delete" };

    self.init = function() {

        self.camera = new THREE.PerspectiveCamera( 45, 1.0, 0.1, 5000 );

        self.camera.up.set( 0, 0, 1 );
        self.camera.position.set( -100, -200, 250 );

        self.scene = new THREE.Scene();

        // Lights
        var ambientLight = new THREE.AmbientLight( self.effectController.ambientLightColor );  // 0.2
        self.scene.add( ambientLight );
        var directionalLight = new THREE.DirectionalLight(self.effectController.directionalLightColor, 1.0);
        directionalLight.position.set( -100, -100, 500 );
        self.scene.add( directionalLight );
        var directionalLight2= new THREE.DirectionalLight(self.effectController.directionalLightColor, 1.0);
        directionalLight2.position.set( 100, 100, -500);
        self.scene.add( directionalLight2);
        var directionalLight3= new THREE.DirectionalLight(self.effectController.directionalLightColor, 0.2);
        directionalLight3.position.set( -300, 300, 500);
        self.scene.add( directionalLight3);

        self.renderer = new THREE.WebGLRenderer( { canvas: self.canvas, antialias: true } );

        self.renderer.setClearColor( 0xd8d8d8 );
        self.renderer.setSize( self.canvasWidth, self.canvasHeight );
        self.renderer.setPixelRatio( window.devicePixelRatio );

        self.renderer.gammaInput = true;
        self.renderer.gammaOutput = true;

        self.pointerInteractions = new PointerInteractions( self.renderer.domElement, self.camera, true ); // Need to use "recursive" as the intersection will be with the mesh, not the top level objects that are nothing but holder
        self.pointerInteractions.addEventListener("click", self.selectionChanged);
        self.pointerInteractions.addEventListener("hover", self.hoverChanged);

        self.orbitControls = new OrbitControls(self.camera, self.renderer.domElement);

        self.orbitControls.enableDamping = true;
        self.orbitControls.dampingFactor = 0.25;
        self.orbitControls.enablePan = false;
        self.orbitControls.addEventListener("change", self.render);

        // Must bind these before TransformControls because we want to attach it ourselves.
        // This will only work if events are run in the order that they are added, which is
        // true for modern browsers.
        self.renderer.domElement.addEventListener( "mousedown", self.onPointerDown, false );
        self.renderer.domElement.addEventListener( "touchstart", self.onPointerDown, false );

        self.transformControls = new TransformControls(self.camera, self.renderer.domElement);

        self.transformControls.setRotationSnap( THREE.Math.degToRad( 15 ) )
        self.transformControls.addEventListener("change", self.render);
        self.transformControls.addEventListener("transformStart", self.startTransform);
        self.transformControls.addEventListener("transformEnd", self.endTransform);
        self.transformControls.addEventListener("objectChange", self.onChange);
        self.transformControls.space = "world";
        self.transformControls.setHandles( 'translate', null );
        self.transformControls.setMode("translate");
        self.transformControls.axis = "XY";
        self.transformControls.setHandles( 'scale', null );
        self.scene.add(self.transformControls);

        window.addEventListener( 'keydown', self.onKeydown );
        window.addEventListener( 'keyup', self.onKeyup );

        self.animate();
    };

    self.dispose = function() {

        self.orbitControls.removeEventListener("change", self.render);
        self.transformControls.removeEventListener("change", self.render);
        self.transformControls.removeEventListener("transformStart", self.startTransform);
        self.transformControls.removeEventListener("transformEnd", self.endTransform);
        self.transformControls.removeEventListener("objectChange", self.onChange);
        self.renderer.domElement.removeEventListener( "mousedown", self.onPointerDown, false );
        self.renderer.domElement.removeEventListener( "touchstart", self.onPointerDown, false );
        window.removeEventListener( 'keydown', self.onKeydown );
        window.removeEventListener( 'keyup', self.onKeyup );

    }

    self.animate = function() {
        requestAnimationFrame( self.animate );

        self.update();
        self.transformControls.update();
        self.orbitControls.update();
        if (self.stats) self.stats.update();

        self.render();
    };

    self.update = function() {

        forEach( self.pointerInteractions.objects, function( model ) {
            if (model == self.selectedModel()) {
                model.children[0].material.color.copy(self.effectController.modelActiveColor);
            } else if ( self.pointerInteractions.hoveredObject && model == self.pointerInteractions.hoveredObject.parent ) {
                if ( self.transformControls.getMode() == "translate" ) {
                    model.children[0].material.color.copy(self.effectController.modelHoverColor);
                }
            } else {
                model.children[0].material.color.copy(self.effectController.modelInactiveColor);
            }
        });

    };

    self.render = function() {
        self.renderer.render( self.scene, self.camera );
    };

    self.loadSTL = function ( url, onLoad ) {
        new STLLoader().load(url, function ( geometry ) {
            onLoad(self.addModelOfGeometry(geometry));
        });
    };

    self.addModelOfGeometry = function( geometry, modelToCopyTransformFrom ) {

        var material = new THREE.MeshStandardMaterial({
            color: self.effectController.modelInactiveColor,  // We'll mark it active below.
            shading: THREE.SmoothShading,
            side: THREE.DoubleSide,
            metalness: self.effectController.metalness,
            roughness: self.effectController.roughness,
            vertexColors: THREE.VertexColors });

        var stlModel = new THREE.Mesh( geometry, material );

        // center model's origin
        var center = new THREE.Box3().setFromObject(stlModel).getCenter();
        var model = new THREE.Object3D();
        model.add(stlModel);
        stlModel.position.copy(center.negate());
        if (modelToCopyTransformFrom) {
            model.rotation.copy(modelToCopyTransformFrom.rotation);
            model.scale.copy(modelToCopyTransformFrom.scale);
        }

        model.orientationOptimizer = new OrientationOptimizer(geometry);
        self.recalculateOverhang(model);

        self.pointerInteractions.objects.push(model);
        self.pointerInteractions.update();

        self.scene.add(model);
        self.selectModel(model);

        self.dispatchEvent( { type: eventType.add, models: [ model ] } );
        return model;

    };

    // self.pointerInteractions is used to keep the source of truth for all models
    self.models = function() {
        return self.pointerInteractions.objects;
    }

    // self.transformControls is used to keep the source of truth for what model is currently selected
    self.selectedModel = function() {
        return self.transformControls.object;
    }

    /////////////////
    // EVENTS   /////
    // /////////////
    self.selectionChanged = function( event ) {
        if (event.current) {
            self.selectModel( event.current.parent );
        }
    };

    self.hoverChanged = function( event ) {

        if (self.transformControls.getMode() == "translate" && event.current ) {
            $("#slicer-viewport").css("cursor", "move");
        } else {
            $("#slicer-viewport").css("cursor", "auto");
        }

    };

    self.onPointerDown = function( event ) {
        if ( self.pointerInteractions.hoveredObject && self.transformControls.getMode() == 'translate' ) {
            event.preventDefault();
            event.stopPropagation();
            self.transformControls.attach( self.pointerInteractions.hoveredObject.parent, event );
        }

    };

    self.onKeydown= function( event ) {
        switch ( event.keyCode ) {
            case 17: // Ctrl
                self.transformControls.setRotationSnap(null);
                break;
            case 46: // DEL key
            case 8: // backsapce key
                //       self.removeSelectedModel();
                break;
        }
    };

    self.onKeyup = function( event ) {
        switch ( event.keyCode ) {
            case 17: // Ctrl
                self.transformControls.setRotationSnap( THREE.Math.degToRad( 15 ) );
                break;
        }
    };

    self.onChange = function() {
        self.dispatchEvent( { type: eventType.change } );
    };

    var recentSelections = [];
    /**
     * params:
     *    m: model to make active. If m is undefined or not found, select from MRU.
     */
    self.selectModel = function(m) {
        if (self.pointerInteractions.objects.indexOf(m) > -1) {
            recentSelections.push(m);
            self.transformControls.attach(m);
        } else {
            // Requested model null or not found.  Look for a model to set active.
            while (recentSelections.length > 0) {
                var maybe = recentSelections.pop();
                if (self.pointerInteractions.objects.indexOf(maybe) > -1) {
                    recentSelections.push(maybe);
                    self.transformControls.attach(maybe);
                    break;
                }
            }
            if (recentSelections.length == 0) self.transformControls.detach();
        }

        self.onChange();
    };

    self.removeModel = function( model ) {
        if ( ! model )  return;

        var index = self.pointerInteractions.objects.indexOf(model);
        if (index > -1) {
            self.pointerInteractions.objects.splice(index, 1);
        }
        self.pointerInteractions.update();

        self.scene.remove(model);
        if ( model === self.selectedModel()) {
            self.selectModel(null);
        }
    };

    self.removeSelectedModel = function() {
        var model = self.selectedModel();
        self.removeModel( model );
        self.dispatchEvent( { type: eventType.delete, models: [model] } );
    };

    self.removeAllModels = function() {
        var arrayCopy = self.pointerInteractions.objects.slice(); // Removing element while iterating the array will cause trouble in JS
        forEach( arrayCopy, function( model ) {
            self.removeModel( model );
        });
        self.dispatchEvent( { type: eventType.delete, models: arrayCopy} );
    };

    self.laySelectedModelFlat = function(restricted) {

        var model = self.selectedModel();
        if (! model) return;

        var newOrientation;
        if (restricted) {
            newOrientation = model.orientationOptimizer.optimalOrientation( model.rotation, 0.7857); // Limit to 45 degree pivot
        } else {
            newOrientation = model.orientationOptimizer.optimalOrientation( model.rotation );
        }

        model.rotation.copy( newOrientation );
        self.recalculateOverhang(model);
        self.dispatchEvent( { type: eventType.change } );

    };

    self.duplicateSelectedModel = function( copies ) {
        var models = [];
        var originalModel = self.selectedModel();
        for (var i = 0; i < copies; i++) {
            models.push(self.addModelOfGeometry( originalModel.children[0].geometry.clone(), originalModel));
        }
        return models;
    };

    self.splitSelectedModel = function() {
        if (!self.selectedModel()) {
            return;
        }

        var originalModel = self.selectedModel()
        var geometry = originalModel.children[0].geometry;
        var newGeometries = BufferGeometryAnalyzer.isolatedGeometries(geometry);

        var newModels =  map(newGeometries, function(geometry) {
            return self.addModelOfGeometry( geometry, originalModel );
        });

        self.removeModel( originalModel );
        self.dispatchEvent( { type: eventType.delete, models: [originalModel] } );
        return newModels;
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

        self.recalculateOverhang( self.selectedModel() );
    };

    self.recalculateOverhang = function(model) {
        if (!model || !model.orientationOptimizer) return;
        if ( model.userData.previousRotation && model.rotation.equals(model.userData.previousRotation ) ) {
            model.userData.previousRotation = model.rotation.clone();
            return;
        }

        var orientation = model.orientationOptimizer.printabilityOfOrientationByRotation( model.rotation );
        self.tintSurfaces(model, null, 255, 255, 255); // Clear tints off the whole model
        self.tintSurfaces(model, orientation.overhang, 128, 16, 16);
        model.userData.previousRotation = model.rotation.clone();
    };

    self.tintSurfaces = function(model, surfaces, r, g, b) {

        var geometry = model.children[0].geometry;
        var colors = geometry.attributes.color !== undefined ? geometry.attributes.color.array : [];

        if (surfaces) {

            for ( var i = 0; i < surfaces.length; i++) {
                for ( var index of surfaces[i].faceIndices ) {
                    colors[index] = r/255;
                    colors[index+1] = g/255;
                    colors[index+2] = b/255;
                    colors[index+3] = r/255;
                    colors[index+4] = g/255;
                    colors[index+5] = b/255;
                    colors[index+6] = r/255;
                    colors[index+7] = g/255;
                    colors[index+8] = b/255;
                }
            }

        } else {

            for ( var i = 0; i < geometry.attributes.position.array.length; i++ ) colors[i] = 1;

        }
        setGeometryColors(geometry, colors);
    };

    function setGeometryColors(geometry, colors) {
        geometry.removeAttribute( 'color' );
        geometry.addAttribute( 'color', new THREE.BufferAttribute( new Float32Array( colors ), 3 ) );
    }

}
STLViewPort.prototype = Object.create( THREE.EventDispatcher.prototype );
STLViewPort.prototype.constructor = STLViewPort;
