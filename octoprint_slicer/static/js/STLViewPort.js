/**
 * @author kennethjiang / https://github.com/kennethjiang
 *
 *
 * Description: A THREE view port for STL models
 *
 * Usage:
 *  var loader = new THREE.STLLoader();
 *  loader.load( './models/stl/slotted_disk.stl', function ( geometry ) {
 *    scene.add( new THREE.Mesh( geometry ) );
 *  });
 *
 * For binary STLs geometry might contain colors for vertices. To use it:
 *  // use the same code to load STL as above
 *  if (geometry.hasColors) {
 *    material = new THREE.MeshPhongMaterial({ opacity: geometry.alpha, vertexColors: THREE.VertexColors });
 *  } else { .... }
 */

THREE.STLViewPort = function ( canvas, width, height, onChange ) {

    var self = this;

    self.canvas = canvas;
    self.canvasWidth = ( width !== undefined ) ? width : canvas.width;
    self.canvasHeight = ( height !== undefined ) ? height : canvas.height;
    self.onChange = onChange;

    self.models = [];

    self.scene = new THREE.Scene();
    self.renderer = new THREE.WebGLRenderer( { canvas: self.canvas, antialias: true } );

    self.camera = new THREE.PerspectiveCamera( 45, 1.0, 0.1, 5000 );
    self.orbitControls = new THREE.OrbitControls(self.camera, self.renderer.domElement);
    self.transformControls = new THREE.TransformControls(self.camera, self.renderer.domElement);

    self.effectController = {
        metalness: 0.5,
        roughness: 0.5,
        modelInactiveColor: new THREE.Color("#60715b"),
        modelActiveColor: new THREE.Color("#34bf0d"),
        ambientLightColor: new THREE.Color("#2b2b2b"),
        directionalLightColor: new THREE.Color("#ffffff"),
    };

    self.init = function() {
        self.camera.up.set( 0, 0, 1 );
        self.camera.position.set( -100, -200, 250 );

        // Lights
        var ambientLight = new THREE.AmbientLight( self.effectController.ambientLightColor );  // 0.2
        self.scene.add( ambientLight );
        var directionalLight = new THREE.DirectionalLight(self.effectController.directionalLightColor, 1.0);
        directionalLight.position.set( 100, 100, 500 );
        self.scene.add( directionalLight );
        var directionalLight2= new THREE.DirectionalLight(self.effectController.directionalLightColor, 1.0);
        directionalLight2.position.set( 100, 100, -500);
        self.scene.add( directionalLight2);

        self.renderer.setClearColor( 0xd8d8d8 );
        self.renderer.setSize( self.canvasWidth, self.canvasHeight );
        self.renderer.setPixelRatio( window.devicePixelRatio );

        self.renderer.gammaInput = true;
        self.renderer.gammaOutput = true;

        self.orbitControls.enableDamping = true;
        self.orbitControls.dampingFactor = 0.25;
        self.orbitControls.enablePan = false;
        self.orbitControls.addEventListener("change", self.render);

        self.transformControls.space = "world";
        //self.transformControls.setAllowedTranslation("XY");
        //self.transformControls.setRotationDisableE(true);
        self.transformControls.setRotationSnap( THREE.Math.degToRad( 15 ) )
        self.transformControls.addEventListener("change", self.render);
        self.transformControls.addEventListener("mouseDown", self.startTransform);
        self.transformControls.addEventListener("mouseUp", self.endTransform);
        self.transformControls.addEventListener("change", self.onChange);
        self.scene.add(self.transformControls);

        self.canvas.addEventListener("click", self.pickActiveModel);

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

        self.render();
    };

    self.render = function() {
        self.orbitControls.update();
        self.transformControls.update();
        self.renderer.render( self.scene, self.camera );
    };


    self.loadSTL = function ( url, onLoad ) {
        var loader = new THREE.STLLoader().load(url, function ( geometry ) {
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

            self.scene.add(model);
            self.render();

            self.models.push(model);
            onLoad(model);
        });
    };

    self.activeModel = function() {
        return self.transformControls.object;
    }

    self.pickActiveModel = function( event ) {
        var rect = self.canvas.getBoundingClientRect();
        var x = (event.clientX - rect.left) / rect.width;
        var y = (event.clientY - rect.top) / rect.height;

        var pointerVector = new THREE.Vector2();
        pointerVector.set((x*2) - 1, -(y*2) + 1);
        var ray = new THREE.Raycaster();
        ray.setFromCamera(pointerVector, self.camera);

        // Clicking should cycle through the stlFiles if there are multiple under the cursor.
        var foundActiveModel = false;
        var nextPointedModel = undefined;
        var firstPointedModel = undefined;
        for (var i = 0; i < self.models.length; i++) {
            var model = self.models[i];
            var intersections = ray.intersectObjects( model, true );
            if (!intersections[0]) {
                continue;
            }
            if (!firstPointedModel) {
                firstPointedModel = model;
            }
            if (foundActiveModel && !nextPointedModel) {
                nextPointedModel = model;
            }
            if (self.activeModel() == model) {
                foundActiveModel = true;
            }
        }
        if (nextPointedModel) {
            self.makeModelActive(nextPointedModel);
        } else if (firstPointedModel) {
            self.makeModelActive(firstPointedModel);
        }
    };

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

        for (var i = 0; i < self.models.length; i++) {
            var model = self.models[i];
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
            return undefined;
        } else {
            var model = self.activeModel();

            var index = self.models.indexOf(model);
            if (index > -1) {
                self.models.splice(index, 1);
            }

            self.makeModelActive(undefined);
            return model;
        }
    };

    self.startTransform = function () {
        // Disable orbit controls
        self.orbitControls.enabled = false;
    };

    self.endTransform = function () {
        // Enable orbit controls
        self.orbitControls.enabled = true;
    };

};
