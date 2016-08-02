/*
 * View model for OctoPrint-Slicer
 *
 * Author: Kenneth Jiang
 * License: AGPLv3
 */
$(function() {
    function SlicerViewModel(parameters) {
        var self = this;

        // assign the injected parameters, e.g.:
        // self.loginStateViewModel = parameters[0];
        // self.settingsViewModel = parameters[1];

        // TODO: Implement your plugin's view model here.
        $(document).on("click", ".btn-mini[title='Slice']", function(event) {
            event.preventDefault();
            event.stopImmediatePropagation();
            $('a[href="#tab_plugin_slicer"]').tab('show');
        });


        var container;

        var camera, cameraTarget, scene, renderer, orbitControl, transformControl,
        CANVAS_WIDTH = 588,
            CANVAS_HEIGHT = 588;

        init();
        render();

        function init() {
            container = document.getElementById( 'slicer-canvas' );

            camera = new THREE.PerspectiveCamera( 35, 1.0, 0.1, 100 );
            camera.position.set( 3, 0.15, 3 );
            scene = new THREE.Scene();
            scene.add( new THREE.GridHelper( 10, 0.2 ) );

            var loader = new THREE.STLLoader();
            loader.load(BASEURL + "downloads/files/" + "local" + "/" + "fish_fossilz.stl", function ( geometry ) {

                var material = new THREE.MeshPhongMaterial( { color: 0xff5533, specular: 0x111111, shininess: 200 } );
                var mesh = new THREE.Mesh( geometry, material );
                mesh.scale.set( 0.02, 0.02, 0.02 );

                selectModel( mesh );
                render();
            } );


            // Lights

            scene.add( new THREE.AmbientLight(0xffffff, 1.0) );

            // renderer

            renderer = new THREE.WebGLRenderer( { antialias: true } );
            renderer.setSize( CANVAS_WIDTH, CANVAS_HEIGHT );
            renderer.setPixelRatio( window.devicePixelRatio );

            renderer.gammaInput = true;
            renderer.gammaOutput = true;

            $("#slicer-viewport").empty().append(`
                    <div class="model">
                    <button class="translate disabled" title="Translate"><img src="` + PLUGIN_BASEURL + `slicer/static/img/translate.png"></button>
                    <button class="rotate" title="Rotate"><img src="` + PLUGIN_BASEURL + `slicer/static/img/rotate.png"></button>
                    <button class="scale" title="Scale"><img src="` + PLUGIN_BASEURL + `slicer/static/img/scale.png"></button>
                    </div>
                    <div class="values translate">
                    <div>
                    <p><span class="axis x">X</span><input type="number" step="any" name="x"><span></span></p>
                    <p><span class="axis y">Y</span><input type="number" step="any" name="y"><span></span></p>
                    <p><span class="axis z">Z</span><input type="number" step="any" name="z"><span></span></p>
                    <span></span>
                    </div>
                    </div>
                    `);

            $("#slicer-viewport").append(renderer.domElement);
            orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
            orbitControls.enableDamping = true;
            orbitControls.dampingFactor = 0.25;
            orbitControls.enablePan = false;
            orbitControls.addEventListener("change", render);

            transformControls = new THREE.TransformControls(camera, renderer.domElement);
            transformControls.space = "world";
            transformControls.setAllowedTranslation("XZ");
            transformControls.setRotationDisableE(true);
            transformControls.addEventListener("change", render);
            transformControls.addEventListener("mouseDown", startTransform);
            scene.add(transformControls);

            $("#slicer-viewport button.translate").click(function(event) {
                // Set selection mode to translate
                transformControls.setMode("translate");
            });
            // Start transform
        }
        function startTransform() {
            // Disable orbit controls
            orbitControls.enabled = false;
        }

        // Select model
        function selectModel(model) {
            var glowVertexShader = `
                uniform vec3 viewVector;
            uniform float c;
            uniform float p;
            varying float intensity;
            void main() {
                vec3 vNormal = normalize(normalMatrix * normal);
                vec3 vNormel = normalize(normalMatrix * viewVector);
                intensity = pow(c - dot(vNormal, vNormel), p);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
            `;
            var glowFragmentShader = `
                uniform vec3 color;
            varying float intensity;
            uniform float alpha;
            void main() {
                vec3 glow = color * intensity;
                gl_FragColor = vec4(glow, alpha);
            }
            `;

            // Set outline shader
            var outlineVertexShader = `
                uniform float offset;
            void main() {
                vec4 pos = modelViewMatrix * vec4(position + normal * offset, 1.0);
                gl_Position = projectionMatrix * pos;
            }
            `;

            var outlineFragmentShader = `
                uniform vec3 color;
            uniform float alpha;
            void main() {
                gl_FragColor = vec4(color, alpha);
            }
            `;

            // Create glow material
            var glowMaterial = new THREE.ShaderMaterial({
                uniforms: { 
                    c: {
                        type: 'f',
                        value: 1.0
                    },
                    p: {
                        type: 'f',
                        value: 1.4
                    },
                    color: {
                        type: 'c',
                        value: new THREE.Color(0xFFFF00)
                    },
                    viewVector: {
                        type: "v3",
                        value: camera.position
                    },
                    alpha: {
                        type: 'f',
                        value: 0.9
                    },
                },
                vertexShader: glowVertexShader,
                fragmentShader: glowFragmentShader,
                side: THREE.FrontSide,
                blending: THREE.AdditiveBlending,
                transparent: true,
                depthWrite: false
            });

            // Create outline material
            var outlineMaterial = new THREE.ShaderMaterial({
                uniforms: { 
                    alpha: {
                        type: 'f',
                        value: 0.3
                    },
                    color: {
                        type: 'c',
                        value: new THREE.Color(0xFFFF00)
                    }
                },
                vertexShader: outlineVertexShader,
                fragmentShader: outlineFragmentShader,
                side: THREE.FrontSide,
                blending: THREE.AdditiveBlending,
                transparent: true,
                depthWrite: false
            });

            // Select model
            transformControls.attach(model);

            // Set select material
            var selectMaterial = new THREE.MeshLambertMaterial({
                color: 0xEC9F3B,
                side: THREE.DoubleSide
            });

            // Set model's color
            model.material = selectMaterial;

            // Set adhesion's color
            if(model.adhesion != null) {
                model.adhesion.mesh.material = selectMaterial;
                if(models.adhesion.glow != null)
                    scene.remove(model.adhesion.glow);
            }

            // Remove existing glow
            if(model.glow != null)
                scene.remove(model.glow);

            // Create glow
            model.updateMatrix();
            model.glow = new THREE.Mesh(model.geometry, glowMaterial.clone());
            model.glow.applyMatrix(model.matrix);
            model.glow.renderOrder = 1;

            // Add glow to scene
            scene.add(model.glow);

            // Check if adhesion exists
            if(model.adhesion != null) {

                // Create adhesion glow
                model.adhesion.mesh.updateMatrix();
                model.adhesion.glow = new THREE.Mesh(model.adhesion.mesh.geometry, outlineMaterial.clone());
                model.adhesion.glow.applyMatrix(model.adhesion.mesh.matrix);
                model.adhesion.glow.renderOrder = 0;

                // Add glow to scene
                scene.add(model.adhesion.glow);
            }

        }
        function render() {
            orbitControls.update();
            transformControls.update();
            renderer.render( scene, camera );
        }

    }

    // view model class, parameters for constructor, container to bind to
    OCTOPRINT_VIEWMODELS.push([
            SlicerViewModel,

            // e.g. loginStateViewModel, settingsViewModel, ...
            [ /* "loginStateViewModel", "settingsViewModel" */ ],

            // e.g. #settings_plugin_slicer, #tab_plugin_slicer, ...
            [ /* ... */ ]
    ]);
});
