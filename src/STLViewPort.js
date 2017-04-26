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

import { forEach, isUndefined } from 'lodash-es';
import * as THREE from 'three';
import { BufferGeometryAnalyzer, OrbitControls, TransformControls, STLLoader, PointerInteractions } from '3tk';
import { OrientationOptimizer } from './OrientationOptimizer';
import { CollisionDetector } from './CollisionDetector';
import { Tipping } from './Tipping';

export function STLViewPort( canvas, width, depth, height ) {

    var self = this;

    self.canvas = canvas;
    self.canvasWidth = width;
    self.canvasDepth = depth;
    self.canvasHeight = height;

    self.effectController = {
        metalness: 0.5,
        roughness: 0.5,
        modelNonCollidingColors: {
            inactive: new THREE.Color("hsl(106, 20%, 40%)"),
            active: new THREE.Color("hsl(106, 87%, 40%)"),
            hover: new THREE.Color("hsl(106, 87%, 65%)"),
        },
        modelCollidingColors: {
            inactive: new THREE.Color("hsl(0, 20%, 40%)"),
            active: new THREE.Color("hsl(0, 87%, 40%)"),
            hover: new THREE.Color("hsl(0, 87%, 65%)"),
        },
        ambientLightColor: new THREE.Color("#2b2b2b"),
        directionalLightColor: new THREE.Color("#ffffff"),
    };

    var eventType = { change: "change", add: "add", delete: "delete", split: "split" };

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
        self.renderer.setSize( self.canvasWidth, self.canvasDepth );
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
        for( var index = 0;
             index < self.pointerInteractions.objects.length;
             index++ ) {
            var model = self.pointerInteractions.objects[index];
            var effectController =
                self.currentCollisions[index] ?
                self.effectController.modelCollidingColors :
                self.effectController.modelNonCollidingColors;

            if (model == self.selectedModel()) {
                model.children[0].material.color.copy(effectController.active);
            } else if ( self.pointerInteractions.hoveredObject && model == self.pointerInteractions.hoveredObject.parent ) {
                if ( self.transformControls.getMode() == "translate" ) {
                    model.children[0].material.color.copy(effectController.hover);
                }
            } else {
                model.children[0].material.color.copy(effectController.inactive);
            }
        }
    };

    self.render = function() {
        self.renderer.render( self.scene, self.camera );
    };

    self.loadSTL = function ( url, afterLoad ) {
        new STLLoader().load(url, function ( geometry ) {
            var newModel = self.addModelOfGeometry(geometry);
            self.dispatchEvent( { type: eventType.add, models: [ newModel ] } );
            // Detect collisions after the event in case the users wants to arrange, for example.
            self.dispatchEvent( { type: eventType.change } );
            resetCollisionDetector();
            afterLoad();
        });
    };

    self.addModelOfGeometry = function( geometry, modelToCopyTransformFrom ) {

        var material = new THREE.MeshStandardMaterial({
            color: self.effectController.modelNonCollidingColors.inactive,  // We'll mark it active below.
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

        self.scene.add(model);

        self.pointerInteractions.objects.push(model);
        self.pointerInteractions.update();
        self.selectModel(model);

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
        } else {
            self.selectModel( null );
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

    // collisions is an array of true/false/undefined.  true means
    // colliding, false means no, undefined means that we haven't
    // figured it out yet.
    self.currentCollisions = [];
    self.markCollidingModels = function (collisions) {
        var updateNeeded = false;
        for (var i = 0; i < collisions.length; i++) {
            if (!isUndefined(collisions[i]) && collisions[i] !== self.currentCollisions[i]) {
                self.currentCollisions[i] = collisions[i];
                updateNeeded = true;
            }
        }
        if (updateNeeded) {
            self.animate();
        }
    };

    // true to do live collision detection.  Collision Detection is
    // always run to completion right before slicing, regardless this
    // value.
    const LIVE_COLLISION_DETECTOR = false;
    var collisionDetector = new CollisionDetector();
    var setCollisionDetector = function() {
        var EPSILON_Z = 0.0001;  // To deal with rounding error after fixZ.
        var printVolume = new THREE.Box3(
            new THREE.Vector3(-self.canvasWidth/2, -self.canvasDepth/2, -EPSILON_Z),
            new THREE.Vector3(self.canvasWidth/2, self.canvasDepth/2, self.canvasHeight));
        collisionDetector.makeIterator(self.models(), printVolume);
    }

    // Run whenever the collision detection inputs may have changed.
    var resetCollisionDetector = function () {
        collisionDetector.clearIterator();
        if (LIVE_COLLISION_DETECTOR) {
            setCollisionDetector();
            var TASK_SWITCH_MS = 50;
            collisionDetector.startBackground(self.markCollidingModels, TASK_SWITCH_MS);
        }
    };

    // If the collision detector is not already running, make the
    // iterator and start it to run until it's done.  Otherwise,
    // complete the current collision detector.
    self.hasCollisions = function () {
        if (!collisionDetector.hasIterator()) {
            setCollisionDetector();
        }
        var collisions = collisionDetector.start(Infinity);
        self.markCollidingModels(collisions);
        return collisions.findIndex(function (collides) { return collides; }) > -1;
    }

    self.onChange = function() {
        self.dispatchEvent( { type: eventType.change } );
        // Detect collisions after the event in case the users wants to fix Z, for example.
        resetCollisionDetector();
    };

    self.MruModel = [];
    /**
     * params:
     *    m: model to make active. If m is undefined or not found, select from MRU.
     */
    self.selectModel = function(m) {
        if (self.pointerInteractions.objects.indexOf(m) > -1) {
            // Update the MRU list so that the most recent is at the end.
            var index = self.MruModel.indexOf(m);
            if (index > -1) {
                self.MruModel.splice(index, 1);
            }
            self.MruModel.push(m);
            // Sets the requested model active.
            self.transformControls.attach(m);
        } else {
            // Requested model null or not found.  Look for a model to set active.
            while (self.MruModel.length > 0) {
                var mru = self.MruModel.pop();
                if (self.pointerInteractions.objects.indexOf(mru) > -1) {
                    // Found, set this one active.
                    self.selectModel(mru);
                    break;
                }
            }
            if (self.MruModel.length == 0) {
                self.transformControls.detach();
            }
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

    var tipping = new Tipping();
    self.laySelectedModelFlat = function(doneFn) {
        var model = self.selectedModel();
        if (! model) return;

        const TASK_SWITCH_MS = 250;
        var tipIterator = tipping.tipObject(model, performance.now() + TASK_SWITCH_MS);
        var tipLoop = function() {
            setTimeout(function() {
                var tipResult = tipIterator.next(performance.now() + TASK_SWITCH_MS);
                var tipDone = tipResult.done;
                var tippingQuaternion = tipResult.value; // Might be undefined.
                if (tippingQuaternion) {
                    model.quaternion.premultiply(tippingQuaternion);
                    self.dispatchEvent( { type: eventType.change } );  // We need this for the fixZ.
                    // There might be more to do, make a new iterator.
                    tipIterator = tipping.tipObject(model, performance.now() + TASK_SWITCH_MS);
                    tipLoop();
                } else if (!tipDone) {
                    // No quaternion yet but still not done, keep going.
                    tipLoop();
                } else {
                    self.recalculateOverhang(model);
                    doneFn();
                }
            }, 0);
        };
        tipLoop();
    };

    self.splitSelectedModel = function() {
        if (!self.selectedModel()) {
            return;
        }

        var originalModel = self.selectedModel()
        var geometry = originalModel.children[0].geometry;
        var newGeometries = BufferGeometryAnalyzer.isolatedGeometries(geometry);
        var newModels = newGeometries.map( function(geometry) {
                return self.addModelOfGeometry( geometry, originalModel );
            });
        self.removeModel( originalModel );
        self.dispatchEvent( { type: eventType.split, from: originalModel, to: newModels } );
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

        var orientation = model.orientationOptimizer.printabilityOfOrientationByRotation( model.rotation );
        self.tintSurfaces(model, null, 255, 255, 255); // Clear tints off the whole model
        self.tintSurfaces(model, orientation.overhang, 128, 16, 16);
        self.tintSurfaces(model, orientation.bottom, 16, 16, 128);
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
