viewport = {

	// Data members
	scene: [],
	camera: null,
	renderer: null,
	orbitControls: null,
	transformControls: null,
	models: [],
	modelLoaded: false,
	sceneExported: false,
	boundaries: [],
	showBoundaries: false,
	measurements: [],
	showMeasurements: false,
	removeSelectionTimeout: null,
	savedMatrix: null,
	cutShape: null,
	cutShapeOutline: null,
	platformAdhesion: null,
	adhesionSize: null,
	scaleLock: [],
	printerModel: null,
	
	// Initialize
	init: function(url) {
	
				// Set width, depth, and height
				width = 200;
				depth = 200;
				height = 200;
			
			// Set bed dimensions
			bedLowMaxX = width;
			bedLowMinX = 0.0;
			bedLowMaxY = depth;
			bedLowMinY = 0.0;
			bedLowMaxZ = height;
			bedLowMinZ = 0.0;
			bedMediumMaxX = width;
			bedMediumMinX = 0.0;
			bedMediumMaxY = depth;
			bedMediumMinY = 0.0;
			bedMediumMaxZ = height;
			bedMediumMinZ = bedLowMaxZ;
			bedHighMaxX = width;
			bedHighMinX = 0.0;
			bedHighMaxY = depth;
			bedHighMinY = 0.0;
			bedHighMaxZ = height;
			bedHighMinZ = bedMediumMaxZ;
			
			// Set print bed size
			printBedWidth = width;
			printBedDepth = depth;
			
			// Set external bed height
			externalBedHeight = 0.0;
			
			//Set extruder center
			extruderCenterX = width / 2;
			extruderCenterY = depth / 2;
			
			// Set print bed offset
			printBedOffsetX = 0.0;
			printBedOffsetY = 0.0;
		
		// Set scale lock
		for(var i = 0; i < 3; i++)
			this.scaleLock[i] = false;

		// Create scene
		for(var i = 0; i < 2; i++)
			this.scene[i] = new THREE.Scene();

		// Create camera
		var SCREEN_WIDTH = 588, SCREEN_HEIGHT = 588;
		var VIEW_ANGLE = 45, ASPECT = SCREEN_WIDTH / SCREEN_HEIGHT, NEAR = 0.1, FAR = 20000;
		this.camera = new THREE.PerspectiveCamera(VIEW_ANGLE, ASPECT, NEAR, FAR);
		this.scene[0].add(this.camera);
		this.camera.position.set(0, 50, -380);
		this.camera.lookAt(new THREE.Vector3(0, 0, 0));

		// Create renderer
		this.renderer = new THREE.WebGLRenderer({
			antialias: true
		});
		this.renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
		this.renderer.autoClear = false;

		// Create controls
		this.orbitControls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
		this.orbitControls.target.set(0, bedHighMaxZ / 2 + externalBedHeight, 0);
		this.orbitControls.minDistance = 160;
		this.orbitControls.maxDistance = 600;
		this.orbitControls.minPolarAngle = 0;
		this.orbitControls.maxPolarAngle = THREE.Math.degToRad(100);
		this.orbitControls.enablePan = false;

		this.transformControls = new THREE.TransformControls(this.camera, this.renderer.domElement);
		this.transformControls.space = "world";
		this.transformControls.setAllowedTranslation("XZ");
		this.transformControls.setRotationDisableE(true);
		this.scene[0].add(this.transformControls);

		// Create lights
		this.scene[0].add(new THREE.AmbientLight(0x444444));
		this.scene[1].add(new THREE.AmbientLight(0x444444));
		var dirLight = new THREE.DirectionalLight(0xFFFFFF);
		dirLight.position.set(200, 200, 1000).normalize();
		this.camera.add(dirLight);
		this.camera.add(dirLight.target);

		// Create sky box
		var skyBoxGeometry = new THREE.CubeGeometry(10000, 10000, 10000);
		var skyBoxMaterial = new THREE.MeshBasicMaterial({
			color: 0xFCFCFC,
			side: THREE.BackSide
		});
		var skyBox = new THREE.Mesh(skyBoxGeometry, skyBoxMaterial);
		this.scene[0].add(skyBox);
		
		// Create print bed
		var mesh = new THREE.Mesh(new THREE.CubeGeometry(printBedWidth, printBedDepth, bedLowMinZ), new THREE.MeshBasicMaterial({
			color: 0x000000,
			side: THREE.DoubleSide
		}));
		mesh.position.set(0 + printBedOffsetX, -0.25 + bedLowMinZ / 2, (bedLowMinY + printBedOffsetY) / 2);
		mesh.rotation.set(Math.PI / 2, 0, 0);
		mesh.renderOrder = 4;
	
		// Add print bed to scene
		this.scene[0].add(mesh);
		
			// Append empty model to list
			this.models.push({
				mesh: null,
				type: null,
				glow: null,
				adhesion: null
			});
		
			// Import model
			this.importModel(url);

		// Create measurement material
		var measurementMaterial = new THREE.LineBasicMaterial({
			color: 0x0000FF,
			side: THREE.FrontSide
		});

		// Create measurement geometry
		var measurementGeometry = new THREE.Geometry();
		measurementGeometry.vertices.push(new THREE.Vector3(0, 0, 0));
		measurementGeometry.vertices.push(new THREE.Vector3(0, 0, 0));

		// Create measurements
		for(var i = 0; i < 3; i++)
			this.measurements[i] = [];

		// Width measurement
		this.measurements[0][0] = new THREE.Line(measurementGeometry.clone(), measurementMaterial);
		this.measurements[0][1] = new THREE.Vector3();

		// Depth measurement
		this.measurements[1][0] = new THREE.Line(measurementGeometry.clone(), measurementMaterial);
		this.measurements[1][1] = new THREE.Vector3();

		// Height measurement
		this.measurements[2][0] = new THREE.Line(measurementGeometry.clone(), measurementMaterial);
		this.measurements[2][1] = new THREE.Vector3();

		// Go through all measurements
		for(var i = 0; i < this.measurements.length; i++) {

			// Add measurements to scene
			this.measurements[i][0].visible = false;
			this.scene[1].add(this.measurements[i][0]);
		}
		
		// Create boundary material
		var boundaryMaterial = new THREE.MeshLambertMaterial({
			color: 0x00FF00,
			transparent: true,
			opacity: 0.2,
			side: THREE.DoubleSide,
			depthWrite: false
		});

		// Low bottom boundary
		this.boundaries[0] = new THREE.Mesh(new THREE.PlaneGeometry(0, 0), boundaryMaterial.clone());
		this.boundaries[0].geometry.vertices[0].set(-bedLowMinX, bedLowMinZ - 0.25, bedLowMinY);
		this.boundaries[0].geometry.vertices[1].set(-bedLowMaxX, bedLowMinZ - 0.25, bedLowMinY);
		this.boundaries[0].geometry.vertices[2].set(-bedLowMinX, bedLowMinZ - 0.25, bedLowMaxY);
		this.boundaries[0].geometry.vertices[3].set(-bedLowMaxX, bedLowMinZ - 0.25, bedLowMaxY);

		// Low front boundary
		this.boundaries[1] = new THREE.Mesh(new THREE.PlaneGeometry(0, 0), boundaryMaterial.clone());
		this.boundaries[1].geometry.vertices[0].set(-bedLowMinX, bedLowMinZ - 0.25, bedLowMinY);
		this.boundaries[1].geometry.vertices[1].set(-bedLowMaxX, bedLowMinZ - 0.25, bedLowMinY);
		this.boundaries[1].geometry.vertices[2].set(-bedLowMinX, bedLowMaxZ, bedLowMinY);
		this.boundaries[1].geometry.vertices[3].set(-bedLowMaxX, bedLowMaxZ, bedLowMinY);

		// Low back boundary
		this.boundaries[2] = new THREE.Mesh(new THREE.PlaneGeometry(0, 0), boundaryMaterial.clone());
		this.boundaries[2].geometry.vertices[0].set(-bedLowMinX, bedLowMinZ - 0.25, bedLowMaxY);
		this.boundaries[2].geometry.vertices[1].set(-bedLowMaxX, bedLowMinZ - 0.25, bedLowMaxY);
		this.boundaries[2].geometry.vertices[2].set(-bedLowMinX, bedLowMaxZ, bedLowMaxY);
		this.boundaries[2].geometry.vertices[3].set(-bedLowMaxX, bedLowMaxZ, bedLowMaxY);

		// Low right boundary
		this.boundaries[3] = new THREE.Mesh(new THREE.PlaneGeometry(0, 0), boundaryMaterial.clone());
		this.boundaries[3].geometry.vertices[0].set(-bedLowMaxX, bedLowMinZ - 0.25, bedLowMinY);
		this.boundaries[3].geometry.vertices[1].set(-bedLowMaxX, bedLowMinZ - 0.25, bedLowMaxY);
		this.boundaries[3].geometry.vertices[2].set(-bedLowMaxX, bedLowMaxZ, bedLowMinY);
		this.boundaries[3].geometry.vertices[3].set(-bedLowMaxX, bedLowMaxZ, bedLowMaxY);

		// Low left boundary
		this.boundaries[4] = new THREE.Mesh(new THREE.PlaneGeometry(0, 0), boundaryMaterial.clone());
		this.boundaries[4].geometry.vertices[0].set(-bedLowMinX, bedLowMinZ - 0.25, bedLowMinY);
		this.boundaries[4].geometry.vertices[1].set(-bedLowMinX, bedLowMinZ - 0.25, bedLowMaxY);
		this.boundaries[4].geometry.vertices[2].set(-bedLowMinX, bedLowMaxZ, bedLowMinY);
		this.boundaries[4].geometry.vertices[3].set(-bedLowMinX, bedLowMaxZ, bedLowMaxY);

		// Medium front boundary
		this.boundaries[5] = new THREE.Mesh(new THREE.PlaneGeometry(0, 0), boundaryMaterial.clone());
		this.boundaries[5].geometry.vertices[0].set(-bedMediumMinX, bedMediumMinZ, bedMediumMinY);
		this.boundaries[5].geometry.vertices[1].set(-bedMediumMaxX, bedMediumMinZ, bedMediumMinY);
		this.boundaries[5].geometry.vertices[2].set(-bedMediumMinX, bedMediumMaxZ, bedMediumMinY);
		this.boundaries[5].geometry.vertices[3].set(-bedMediumMaxX, bedMediumMaxZ, bedMediumMinY);

		// Medium back boundary
		this.boundaries[6] = new THREE.Mesh(new THREE.PlaneGeometry(0, 0), boundaryMaterial.clone());
		this.boundaries[6].geometry.vertices[0].set(-bedMediumMinX, bedMediumMinZ, bedMediumMaxY);
		this.boundaries[6].geometry.vertices[1].set(-bedMediumMaxX, bedMediumMinZ, bedMediumMaxY);
		this.boundaries[6].geometry.vertices[2].set(-bedMediumMinX, bedMediumMaxZ, bedMediumMaxY);
		this.boundaries[6].geometry.vertices[3].set(-bedMediumMaxX, bedMediumMaxZ, bedMediumMaxY);

		// Medium right boundary
		this.boundaries[7] = new THREE.Mesh(new THREE.PlaneGeometry(0, 0), boundaryMaterial.clone());
		this.boundaries[7].geometry.vertices[0].set(-bedMediumMaxX, bedMediumMinZ, bedMediumMinY);
		this.boundaries[7].geometry.vertices[1].set(-bedMediumMaxX, bedMediumMinZ, bedMediumMaxY);
		this.boundaries[7].geometry.vertices[2].set(-bedMediumMaxX, bedMediumMaxZ, bedMediumMinY);
		this.boundaries[7].geometry.vertices[3].set(-bedMediumMaxX, bedMediumMaxZ, bedMediumMaxY);

		// Medium left boundary
		this.boundaries[8] = new THREE.Mesh(new THREE.PlaneGeometry(0, 0), boundaryMaterial.clone());
		this.boundaries[8].geometry.vertices[0].set(-bedMediumMinX, bedMediumMinZ, bedMediumMinY);
		this.boundaries[8].geometry.vertices[1].set(-bedMediumMinX, bedMediumMinZ, bedMediumMaxY);
		this.boundaries[8].geometry.vertices[2].set(-bedMediumMinX, bedMediumMaxZ, bedMediumMinY);
		this.boundaries[8].geometry.vertices[3].set(-bedMediumMinX, bedMediumMaxZ, bedMediumMaxY);

		// High front boundary
		this.boundaries[9] = new THREE.Mesh(new THREE.PlaneGeometry(0, 0), boundaryMaterial.clone());
		this.boundaries[9].geometry.vertices[0].set(-bedHighMinX, bedHighMinZ, bedHighMinY);
		this.boundaries[9].geometry.vertices[1].set(-bedHighMaxX, bedHighMinZ, bedHighMinY);
		this.boundaries[9].geometry.vertices[2].set(-bedHighMinX, bedHighMaxZ, bedHighMinY);
		this.boundaries[9].geometry.vertices[3].set(-bedHighMaxX, bedHighMaxZ, bedHighMinY);

		// High back boundary
		this.boundaries[10] = new THREE.Mesh(new THREE.PlaneGeometry(0, 0), boundaryMaterial.clone());
		this.boundaries[10].geometry.vertices[0].set(-bedHighMinX, bedHighMinZ, bedHighMaxY);
		this.boundaries[10].geometry.vertices[1].set(-bedHighMaxX, bedHighMinZ, bedHighMaxY);
		this.boundaries[10].geometry.vertices[2].set(-bedHighMinX, bedHighMaxZ, bedHighMaxY);
		this.boundaries[10].geometry.vertices[3].set(-bedHighMaxX, bedHighMaxZ, bedHighMaxY);

		// High right boundary
		this.boundaries[11] = new THREE.Mesh(new THREE.PlaneGeometry(0, 0), boundaryMaterial.clone());
		this.boundaries[11].geometry.vertices[0].set(-bedHighMaxX, bedHighMinZ, bedHighMinY);
		this.boundaries[11].geometry.vertices[1].set(-bedHighMaxX, bedHighMinZ, bedHighMaxY);
		this.boundaries[11].geometry.vertices[2].set(-bedHighMaxX, bedHighMaxZ, bedHighMinY);
		this.boundaries[11].geometry.vertices[3].set(-bedHighMaxX, bedHighMaxZ, bedHighMaxY);

		// High left boundary
		this.boundaries[12] = new THREE.Mesh(new THREE.PlaneGeometry(0, 0), boundaryMaterial.clone());
		this.boundaries[12].geometry.vertices[0].set(-bedHighMinX, bedHighMinZ, bedHighMinY);
		this.boundaries[12].geometry.vertices[1].set(-bedHighMinX, bedHighMinZ, bedHighMaxY);
		this.boundaries[12].geometry.vertices[2].set(-bedHighMinX, bedHighMaxZ, bedHighMinY);
		this.boundaries[12].geometry.vertices[3].set(-bedHighMinX, bedHighMaxZ, bedHighMaxY);

		// High top boundary
		this.boundaries[13] = new THREE.Mesh(new THREE.PlaneGeometry(0, 0), boundaryMaterial.clone());
		this.boundaries[13].geometry.vertices[0].set(-bedHighMinX, bedHighMaxZ, bedHighMinY);
		this.boundaries[13].geometry.vertices[1].set(-bedHighMaxX, bedHighMaxZ, bedHighMinY);
		this.boundaries[13].geometry.vertices[2].set(-bedHighMinX, bedHighMaxZ, bedHighMaxY);
		this.boundaries[13].geometry.vertices[3].set(-bedHighMaxX, bedHighMaxZ, bedHighMaxY);

		// Low front to medium front connector boundary
		this.boundaries[14] = new THREE.Mesh(new THREE.PlaneGeometry(0, 0), boundaryMaterial.clone());
		this.boundaries[14].geometry.vertices[0].set(-bedLowMinX, bedLowMaxZ, bedLowMinY);
		this.boundaries[14].geometry.vertices[1].set(-bedLowMaxX, bedLowMaxZ, bedLowMinY);
		this.boundaries[14].geometry.vertices[2].set(-bedMediumMinX, bedMediumMinZ, bedMediumMinY);
		this.boundaries[14].geometry.vertices[3].set(-bedMediumMaxX, bedMediumMinZ, bedMediumMinY);

		// Low back to medium back connector boundary
		this.boundaries[15] = new THREE.Mesh(new THREE.PlaneGeometry(0, 0), boundaryMaterial.clone());
		this.boundaries[15].geometry.vertices[0].set(-bedLowMinX, bedLowMaxZ, bedLowMaxY);
		this.boundaries[15].geometry.vertices[1].set(-bedLowMaxX, bedLowMaxZ, bedLowMaxY);
		this.boundaries[15].geometry.vertices[2].set(-bedMediumMinX, bedMediumMinZ, bedMediumMaxY);
		this.boundaries[15].geometry.vertices[3].set(-bedMediumMaxX, bedMediumMinZ, bedMediumMaxY);

		// Low right to medium right connector boundary
		this.boundaries[16] = new THREE.Mesh(new THREE.PlaneGeometry(0, 0), boundaryMaterial.clone());
		this.boundaries[16].geometry.vertices[0].set(-bedLowMaxX, bedLowMaxZ, bedLowMinY);
		this.boundaries[16].geometry.vertices[1].set(-bedLowMaxX, bedLowMaxZ, bedLowMaxY);
		this.boundaries[16].geometry.vertices[2].set(-bedMediumMaxX, bedMediumMinZ, bedMediumMinY);
		this.boundaries[16].geometry.vertices[3].set(-bedMediumMaxX, bedMediumMinZ, bedMediumMaxY);

		// Low left to medium left connector boundary
		this.boundaries[17] = new THREE.Mesh(new THREE.PlaneGeometry(0, 0), boundaryMaterial.clone());
		this.boundaries[17].geometry.vertices[0].set(-bedLowMinX, bedLowMaxZ, bedLowMinY);
		this.boundaries[17].geometry.vertices[1].set(-bedLowMinX, bedLowMaxZ, bedLowMaxY);
		this.boundaries[17].geometry.vertices[2].set(-bedMediumMinX, bedMediumMinZ, bedMediumMinY);
		this.boundaries[17].geometry.vertices[3].set(-bedMediumMinX, bedMediumMinZ, bedMediumMaxY);

		// Medium front to high front connector boundary
		this.boundaries[18] = new THREE.Mesh(new THREE.PlaneGeometry(0, 0), boundaryMaterial.clone());
		this.boundaries[18].geometry.vertices[0].set(-bedMediumMinX, bedMediumMaxZ, bedMediumMinY);
		this.boundaries[18].geometry.vertices[1].set(-bedMediumMaxX, bedMediumMaxZ, bedMediumMinY);
		this.boundaries[18].geometry.vertices[2].set(-bedHighMinX, bedHighMinZ, bedHighMinY);
		this.boundaries[18].geometry.vertices[3].set(-bedHighMaxX, bedHighMinZ, bedHighMinY);

		// Medium back to high back connector boundary
		this.boundaries[19] = new THREE.Mesh(new THREE.PlaneGeometry(0, 0), boundaryMaterial.clone());
		this.boundaries[19].geometry.vertices[0].set(-bedMediumMinX, bedMediumMaxZ, bedMediumMaxY);
		this.boundaries[19].geometry.vertices[1].set(-bedMediumMaxX, bedMediumMaxZ, bedMediumMaxY);
		this.boundaries[19].geometry.vertices[2].set(-bedHighMinX, bedHighMinZ, bedHighMaxY);
		this.boundaries[19].geometry.vertices[3].set(-bedHighMaxX, bedHighMinZ, bedHighMaxY);

		// Medium right to high right connector boundary
		this.boundaries[20] = new THREE.Mesh(new THREE.PlaneGeometry(0, 0), boundaryMaterial.clone());
		this.boundaries[20].geometry.vertices[0].set(-bedMediumMaxX, bedMediumMaxZ, bedMediumMinY);
		this.boundaries[20].geometry.vertices[1].set(-bedMediumMaxX, bedMediumMaxZ, bedMediumMaxY);
		this.boundaries[20].geometry.vertices[2].set(-bedHighMaxX, bedHighMinZ, bedHighMinY);
		this.boundaries[20].geometry.vertices[3].set(-bedHighMaxX, bedHighMinZ, bedHighMaxY);

		// Medium left to high left connector boundary
		this.boundaries[21] = new THREE.Mesh(new THREE.PlaneGeometry(0, 0), boundaryMaterial.clone());
		this.boundaries[21].geometry.vertices[0].set(-bedMediumMinX, bedMediumMaxZ, bedMediumMinY);
		this.boundaries[21].geometry.vertices[1].set(-bedMediumMinX, bedMediumMaxZ, bedMediumMaxY);
		this.boundaries[21].geometry.vertices[2].set(-bedHighMinX, bedHighMinZ, bedHighMinY);
		this.boundaries[21].geometry.vertices[3].set(-bedHighMinX, bedHighMinZ, bedHighMaxY);

		// Go through all boundaries
		for(var i = 0; i < this.boundaries.length; i++) {

			// Add boundaries to scene
			this.boundaries[i].geometry.computeFaceNormals();
			this.boundaries[i].geometry.computeVertexNormals();
			this.boundaries[i].position.x += extruderCenterX;
			this.boundaries[i].position.z -= extruderCenterY;
			this.boundaries[i].visible = false;
			
			// Don't add bottom boundary to scene
			if(i)
				this.scene[0].add(this.boundaries[i]);
		}

		// Render
		viewport.render();

		// Enable events
		this.transformControls.addEventListener("mouseDown", this.startTransform);
		this.transformControls.addEventListener("mouseUp", this.endTransform);
		this.transformControls.addEventListener("mouseUp", this.fixModelY);
		this.transformControls.addEventListener("change", this.updateModelChanges);
		this.transformControls.addEventListener("change", this.render);
		this.orbitControls.addEventListener("change", this.render);
		$(document).on("mousedown.viewport", this.mouseDownEvent);
		$(window).on("resize.viewport", this.resizeEvent);
		$(window).on("keydown.viewport", this.keyDownEvent);
		$(window).on("keyup.viewport", this.keyUpEvent);

        return this.renderer;
	},

	// Start transform
	startTransform: function() {

		// Save matrix
		viewport.savedMatrix = viewport.transformControls.object.matrix.clone();

		// Blur input
		$("#slicing_configuration_dialog .modal-extra div.values input").blur();

		// Disable orbit controls
		viewport.orbitControls.enabled = false;
	},

	// End transform
	endTransform: function() {

		// Clear saved matrix
		viewport.savedMatrix = null;

		// Enable orbit controls
		viewport.orbitControls.enabled = true;
	},

	// Import model
	importModel: function(file, type) {

		// Clear model loaded
		viewport.modelLoaded = false;

		// Set loader
		if(type == "stl")
			var loader = new THREE.STLLoader();
		else if(type == "obj")
			var loader = new THREE.OBJLoader();
		else if(type == "m3d")
			var loader = new THREE.M3DLoader();
		else if(type == "amf")
			var loader = new THREE.AMFLoader();
		else if(type == "wrl")
			var loader = new THREE.VRMLLoader();
		else if(type == "dae")
			var loader = new THREE.ColladaLoader();
		else if(type == "3mf")
			var loader = new THREE.ThreeMFLoader();
		else {
			viewport.modelLoaded = true;
			return;
		}

		// Load model
		loader.load(file, function(geometry) {

			// Center model
			geometry.center();

			// Create model's mesh
			var mesh = new THREE.Mesh(geometry, filamentMaterials[viewportFilamentColor]);

			// Set model's orientation
			if(type == "stl")
				mesh.rotation.set(3 * Math.PI / 2, 0, Math.PI);
			else if(type == "obj")
				mesh.rotation.set(0, 0, 0);
			else if(type == "m3d")
				mesh.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
			else if(type == "amf")
				mesh.rotation.set(0, 0, 0);
			else if(type == "wrl")
				mesh.rotation.set(0, 0, 0);
			else if(type == "dae")
				mesh.rotation.set(0, 0, 0);
			else if(type == "3mf")
				mesh.rotation.set(-Math.PI / 2, 0, Math.PI);
			mesh.updateMatrix();
			mesh.geometry.applyMatrix(mesh.matrix);
			mesh.position.set(0, 0, 0);
			mesh.rotation.set(0, 0, 0);
			mesh.scale.set(1, 1, 1);
			mesh.renderOrder = 0;

			// Add model to scene
			viewport.scene[0].add(mesh);

			// Append model to list
			viewport.models.push({
				mesh: mesh,
				type: null,
				glow: null,
				adhesion: viewport.createPlatformAdhesion(mesh)
			});
		
			// Select model
			viewport.removeSelection();
			viewport.selectModel(mesh);

			// Fix model's Y
			viewport.fixModelY();

			// Set model loaded
			viewport.modelLoaded = true;
		});
	},
	
	// Create platform adhesion
	createPlatformAdhesion: function(mesh) {
	
		// Check if using platform adhesion
		if(viewport.platformAdhesion != "None") {
		
			// Create adhesion mesh
			var adhesionMesh = new THREE.Mesh(mesh.geometry.clone(), filamentMaterials[viewportFilamentColor]);

			// Add adhesion to scene
			viewport.scene[0].add(adhesionMesh);
			
			// Return adhesion mesh
			return {mesh: adhesionMesh, glow: null, geometry: adhesionMesh.geometry.clone()};
		}
		
		// Return null
		return null;
	},

	// Key down event
	keyDownEvent: function(event) {

		// Check if an input is not focused
		if(!$("input:focus").length) {

			// Check what key was pressed
			switch(event.keyCode) {
		
				// Check if A is pressed
				case 65 :
	
					// Check if ctrl is pressed
					if(event.ctrlKey) {
			
						// Prevent default action
						event.preventDefault();
				
						// Get currently selected model
						var current = viewport.transformControls.object;
				
						// Go through all models
						for(var i = 1; i < viewport.models.length; i++)
				
							// Check if not currently selected model
							if(viewport.models[i].mesh !== current)
				
								// Select first model
								viewport.selectModel(viewport.models[i].mesh);
				
						// Select currently selected model
						if(current)
							viewport.selectModel(current);
				
						// Render
						viewport.render();
					}
				break;

				// Check if tab was pressed
				case 9 :

					// Prevent default action
					event.preventDefault();
					
					// Check if not cutting models
					if(viewport.cutShape === null) {

						// Check if an object is selected
						if(viewport.transformControls.object) {

							// Go through all models
							for(var i = 1; i < viewport.models.length; i++)

								// Check if model is currently selected
								if(viewport.models[i].mesh == viewport.transformControls.object) {
					
									// Check if shift isn't pressed
									if(!event.shiftKey)
						
										// Remove selection
										viewport.removeSelection();
					
									// Check if model isn't the last one
									if(i != viewport.models.length - 1)
						
										// Select next model
										viewport.selectModel(viewport.models[i + 1].mesh);
						
									// Otherwise
									else
						
										// Select first model
										viewport.selectModel(viewport.models[1].mesh);
		
									// Break
									break;
								}
						}
	
						// Otherwise check if a model exists
						else if(viewport.models.length > 1)

							// Select first model
							viewport.selectModel(viewport.models[1].mesh);
						
						// Render
						viewport.render();
					}
					
					// Otherwise
					else {
					
						// Check if cut chape is a cube
						if(viewport.cutShape.geometry.type == "BoxGeometry")
						
							// Change cut shape to a sphere
							viewport.setCutShape("sphere");
						
						// Otherwise check if cut shape is a sphere
						else if(viewport.cutShape.geometry.type == "SphereGeometry")
						
							// Change cut shape to a sube
							viewport.setCutShape("cube");
					}
				break;

				// Check if delete was pressed
				case 46 :

					// Check if an object is selected
					if(viewport.transformControls.object)

						// Delete model
						viewport.deleteModel();
				break;


				// Check if shift was pressed
				case 16 :

					// Enable grid and rotation snap
					viewport.enableSnap();
				break;

				// Check if W was pressed
				case 87 :

					// Set selection mode to translate
					viewport.setMode("translate");
				break;

				// Check if E was pressed
				case 69 :

					// Set selection mode to rotate
					viewport.setMode("rotate");
				break;

				// Check if R was pressed
				case 82 :

					// Set selection mode to scale
					viewport.setMode("scale");
				break;
			
				// Check if enter was pressed
				case 13 :
			
					// Check if cutting models
					if(viewport.cutShape !== null)
				
						// Apply cut
						viewport.applyCut();
				break;
			}
		}
	},

	// Key up event
	keyUpEvent: function(event) {

		// Check what key was pressed
		switch(event.keyCode) {

			// Check if shift was released
			case 16 :

				// Disable grid and rotation snap
				viewport.disableSnap();
			break;
		}
	},

	// Mouse down event
	mouseDownEvent: function(event) {

		// Check if not in cutting models, clicking inside the model editor, and not clicking on a button or input
		if(viewport.cutShape === null && $(event.target).closest(".modal-extra").length && !$(event.target).is("button, img, input")) {

			// Initialize variables
			var raycaster = new THREE.Raycaster();
			var mouse = new THREE.Vector2();
			var offset = $(viewport.renderer.domElement).offset();

			// Set mouse coordinates
			mouse.x = ((event.clientX - offset.left) / viewport.renderer.domElement.clientWidth) * 2 - 1;
			mouse.y = - ((event.clientY - offset.top) / viewport.renderer.domElement.clientHeight) * 2 + 1;

			// Set ray caster's perspective
			raycaster.setFromCamera(mouse, viewport.camera);

			// Get models' meshes
			var modelMeshes = []
			for(var i = 0; i < viewport.models.length; i++) {
				if(viewport.models[i].mesh !== null)
					modelMeshes.push(viewport.models[i].mesh);
				if(viewport.models[i].adhesion !== null)
					modelMeshes.push(viewport.models[i].adhesion.mesh);
			}

			// Get objects that intersect ray caster
			var intersects = raycaster.intersectObjects(modelMeshes); 

			// Check if an object intersects and it's not the printer
			if(intersects.length > 0 && intersects[0].object != viewport.models[0].mesh) {
	
				// Check if ctrl is pressed
				if(event.ctrlKey) {
		
					// Go through all models
					for(var i = 0; i < viewport.models.length; i++)
			
						// Check if model was selected
						if(viewport.models[i].mesh == intersects[0].object || (viewport.models[i].adhesion !== null && viewport.models[i].adhesion.mesh == intersects[0].object)) {
				
							// Set model's color
							viewport.models[i].mesh.material = filamentMaterials[viewportFilamentColor];
							
							// Set adhesion's color
							if(viewport.models[i].adhesion !== null) {
								viewport.models[i].adhesion.mesh.material = filamentMaterials[viewportFilamentColor];
								viewport.scene[1].remove(viewport.models[i].adhesion.glow);
								viewport.models[i].adhesion.glow = null;
							}

							// Remove glow
							viewport.scene[1].remove(viewport.models[i].glow);
							viewport.models[i].glow = null;

							// Remove selection and select new model
							if(viewport.models[i].mesh == viewport.transformControls.object) {
								viewport.transformControls.detach();
								for(var j = 0; j < viewport.models.length; j++)
									if(viewport.models[j].glow && j != i)
										viewport.selectModel(viewport.models[j].mesh)
							}
					
							// Update model changes
							viewport.updateModelChanges();
					
							// Break;
							break;
						}
				}
		
				// Otherwise
				else {
	
					// Check if shift isn't pressed
					if(!event.shiftKey)
	
						// Remove selection
						viewport.removeSelection();
					
					// Go through all models
					for(var i = 0; i < viewport.models.length; i++)
			
						// Check if model was selected
						if(viewport.models[i].mesh == intersects[0].object || (viewport.models[i].adhesion !== null && viewport.models[i].adhesion.mesh == intersects[0].object))
	
							// Select object
							viewport.selectModel(viewport.models[i].mesh);
				}
			}

			// Otherwise
			else {

				// Set remove selection interval
				viewport.removeSelectionTimeout = setTimeout(function() {
	
					// Remove selection
					viewport.removeSelection();
		
					// Render
					viewport.render();
				}, 125);
	
				$(document).on("mousemove.viewport", viewport.stopRemoveSelectionTimeout);
			}

			// Render
			viewport.render();
		}
	},

	// Stop remove selection timeout
	stopRemoveSelectionTimeout: function() {

		// Clear remove selection timeout
		clearTimeout(viewport.removeSelectionTimeout);
	},

	// Enable snap
	enableSnap: function() {

		// Enable grid and rotation snap
		viewport.transformControls.setTranslationSnap(5);
		viewport.transformControls.setScaleSnap(0.05);
		viewport.transformControls.setRotationSnap(THREE.Math.degToRad(15));
		$("#slicing_configuration_dialog .modal-extra button.snap").addClass("disabled");
	},

	// Disable snap
	disableSnap: function() {

		// Disable grid and rotation snap
		viewport.transformControls.setTranslationSnap(null);
		viewport.transformControls.setScaleSnap(null);
		viewport.transformControls.setRotationSnap(null);
		$("#slicing_configuration_dialog .modal-extra button.snap").removeClass("disabled");
	},

	// Set mode
	setMode: function(mode) {

		switch(mode) {

			// Check if translate mode
			case "translate" :

				// Set selection mode to translate
				viewport.transformControls.setMode("translate");
				viewport.transformControls.space = "world";
			break;

			// Check if rotate mode
			case "rotate" :

				// Set selection mode to rotate
				viewport.transformControls.setMode("rotate");
				viewport.transformControls.space = "local";
			break;

			// Check if scale mode
			case "scale" :

				// Set selection mode to scale
				viewport.transformControls.setMode("scale");
				viewport.transformControls.space = "local";
			break;
		}

		// Render
		viewport.render();
	},

	// Resize event
	resizeEvent: function() {

		// Update camera
		viewport.camera.aspect = $("#slicing_configuration_dialog").width() / ($("#slicing_configuration_dialog").height() - 123);
		viewport.camera.updateProjectionMatrix();
		viewport.renderer.setSize($("#slicing_configuration_dialog").width(), $("#slicing_configuration_dialog").height() - 123);

		// Render
		viewport.render();
	},

	// Export scene
	exportScene: function() {

		// Clear scene exported
		viewport.sceneExported = false;

		// Initialize variables
		var centerX = -(extruderCenterX - (bedLowMaxX + bedLowMinX) / 2) + bedLowMinX;
		var centerZ = extruderCenterY - (bedLowMaxY + bedLowMinY) / 2 + bedLowMinY;
		var mergedGeometry = new THREE.Geometry();
	
		// Go through all models
		for(var i = 1; i < viewport.models.length; i++) {

			// Get current model
			var model = viewport.models[i];

			// Sum model's center together
			centerX -= model.mesh.position.x;
			centerZ += model.mesh.position.z;

			// Save model's current matrix and geometry
			model.mesh.updateMatrix();
			var matrix = model.mesh.matrix.clone();
			var geometry = model.mesh.geometry.clone();
		
			// Set model's orientation
			geometry.applyMatrix(matrix);
			model.mesh.position.set(0, 0, 0);
			if(model.type == "stl")
				model.mesh.rotation.set(3 * Math.PI / 2, 0, Math.PI);
			else if(model.type == "obj")
				model.mesh.rotation.set(Math.PI / 2, Math.PI, 0);
			else if(model.type == "m3d")
				model.mesh.rotation.set(Math.PI / 2, Math.PI, 0);
			else if(model.type == "amf")
				model.mesh.rotation.set(-Math.PI / 2, 0, Math.PI);
			else if(model.type == "wrl")
				model.mesh.rotation.set(-Math.PI / 2, 0, Math.PI);
			else if(model.type == "dae")
				model.mesh.rotation.set(-Math.PI / 2, 0, Math.PI);
			else if(model.type == "3mf")
				model.mesh.rotation.set(-Math.PI / 2, 0, Math.PI);
			model.mesh.scale.set(1, 1, 1);
			model.mesh.updateMatrix();

			// Merge model's geometry together
			mergedGeometry.merge(geometry, model.mesh.matrix);

			// Apply model's previous matrix
			model.mesh.rotation.set(0, 0, 0);
			model.mesh.updateMatrix();
			model.mesh.applyMatrix(matrix);
		}

		// Get average center for models
		centerX /= (viewport.models.length - 1);
		centerZ /= (viewport.models.length - 1);

		// Save model's center
		modelCenter = [centerX, centerZ];

		// Create merged mesh from merged geometry
		var mergedMesh = new THREE.Mesh(mergedGeometry);

		// Get merged mesh as an STL
		var exporter = new THREE.STLBinaryExporter();
		var stl = new Blob([exporter.parse(mergedMesh)], {type: "text/plain"});
	
		// Set scene exported
		viewport.sceneExported = true;
	
		// Return STL
		return stl;
	},

	// Destroy
	destroy: function() {

		// Disable events
		$(document).off("mousedown.viewport mousemove.viewport");
		$(window).off("resize.viewport keydown.viewport keyup.viewport");

		// Clear viewport
		viewport = null;
	},

	// Fix model Y
	fixModelY: function() {

		// Go through all models
		for(var i = 1; i < viewport.models.length; i++)

			// Check if model is selected
			if(viewport.models[i].glow !== null) {

				// Get model's boundary box
				var boundaryBox = new THREE.Box3().setFromObject(viewport.models[i].mesh);
				boundaryBox.min.sub(viewport.models[i].mesh.position);
				boundaryBox.max.sub(viewport.models[i].mesh.position);

				// Set model's lowest Y value to be on the bed
				viewport.models[i].mesh.position.y -= viewport.models[i].mesh.position.y + boundaryBox.min.y - bedLowMinZ;
			}
	
		// Check if cutting models
		if(viewport.cutShape !== null) {

			// Select cut shape
			viewport.removeSelection();
			viewport.transformControls.attach(viewport.cutShape);
		}

		// Update boundaries
		viewport.updateBoundaries();

		// Upate measurements
		viewport.updateModelChanges();

		// Render
		viewport.render();
	},

	// Clone model
	cloneModel: function() {

		// Clear model loaded
		viewport.modelLoaded = false;

		// Initialize clones models
		var clonedModels = [];

		// Go through all models
		for(var i = 1; i < viewport.models.length; i++)

			// Check if model is selected
			if(viewport.models[i].glow !== null) {

				// Clone model
				var clonedModel = new THREE.Mesh(viewport.models[i].mesh.geometry.clone(), viewport.models[i].mesh.material.clone());

				// Copy original orientation
				clonedModel.applyMatrix(viewport.models[i].mesh.matrix);

				// Add cloned model to scene
				viewport.scene[0].add(clonedModel);

				// Append model to list
				viewport.models.push({
					mesh: clonedModel,
					type: viewport.models[i].type,
					glow: null,
					adhesion: viewport.createPlatformAdhesion(clonedModel)
				});
		
				// Append cloned model to list
				if(viewport.models[i].mesh == viewport.transformControls.object)
					clonedModels.unshift(clonedModel);
				else
					clonedModels.push(clonedModel);
			}

		// Go through all cloned models
		for(var i = clonedModels.length - 1; i >= 0; i--)

			// Select model
			viewport.selectModel(clonedModels[i]);

		// Fix model's Y
		viewport.fixModelY();
	
		// Remove current selection
		viewport.removeSelection();
	
		// Render
		viewport.render();
	
		setTimeout(function() {
	
			// Go through all cloned models
			for(var i = clonedModels.length - 1; i >= 0; i--)

				// Select model
				viewport.selectModel(clonedModels[i]);

			// Render
			viewport.render();

			// Set model loaded
			viewport.modelLoaded = true;
		}, 200);
	},

	// Reset model
	resetModel: function() {

		// Check if cutting models
		if(viewport.cutShape !== null) {
	
			// Reset cut shape's orientation
			viewport.cutShape.position.set(0, bedHighMaxZ - bedLowMinZ - viewport.models[0].mesh.position.y, 0);
			viewport.cutShape.rotation.set(0, 0, 0);
			viewport.cutShape.scale.set(1, 1, 1);
		}
	
		// Otherwise
		else

			// Go through all models
			for(var i = 1; i < viewport.models.length; i++)

				// Check if model is selected
				if(viewport.models[i].glow !== null) {
	
					// Reset model's orientation
					viewport.models[i].mesh.position.set(0, 0, 0);
					viewport.models[i].mesh.rotation.set(0, 0, 0);
					viewport.models[i].mesh.scale.set(1, 1, 1);
				}
		
		// Fix model's Y
		viewport.fixModelY();
	},

	// Delete model
	deleteModel: function() {

		// Check if cutting models
		if(viewport.cutShape !== null) {
	
			// Remove cut shape
			viewport.scene[0].remove(viewport.cutShape);
			viewport.scene[0].remove(viewport.cutShapeOutline);
			viewport.cutShape = null;
			viewport.cutShapeOutline = null;
		
			// Deselect button
			$("#slicing_configuration_dialog .modal-extra button.cut").removeClass("disabled");
		
			// Enable import and clone buttons
			$("#slicing_configuration_dialog .modal-extra button.import, #slicing_configuration_dialog .modal-extra button.clone").prop("disabled", false);
			
			// Hide cut shape options
			$("#slicing_configuration_dialog .modal-extra div.cutShape").removeClass("show");
		}
	
		// Otherwise
		else

			// Go through all models
			for(var i = 1; i < viewport.models.length; i++)

				// Check if model is selected
				if(viewport.models[i].glow !== null) {
	
					// Remove model
					viewport.scene[0].remove(viewport.models[i].mesh);
					viewport.scene[1].remove(viewport.models[i].glow);
					if(viewport.models[i].adhesion !== null) {
						viewport.scene[0].remove(viewport.models[i].adhesion.mesh);
						viewport.scene[1].remove(viewport.models[i].adhesion.glow);
					}
					viewport.models.splice(i--, 1);
				}

		// Remove selection
		viewport.transformControls.setAllowedTranslation("XZ");
		viewport.transformControls.detach();

		// Update model changes
		viewport.updateModelChanges();

		// Update boundaries
		viewport.updateBoundaries();

		// Render
		viewport.render();
	},

	// Remove selection
	removeSelection: function() {

		// Check if an object is selected
		if(viewport.transformControls.object) {

			// Go through all models
			for(var i = 1; i < viewport.models.length; i++)

				// Check if glow exists
				if(viewport.models[i].glow !== null) {

					// Set model's color
					viewport.models[i].mesh.material = filamentMaterials[viewportFilamentColor];
					
					// Set adhesion's color
					if(viewport.models[i].adhesion !== null) {
						viewport.models[i].adhesion.mesh.material = filamentMaterials[viewportFilamentColor];
						viewport.scene[1].remove(viewport.models[i].adhesion.glow);
						viewport.models[i].adhesion.glow = null;
					}

					// Remove glow
					viewport.scene[1].remove(viewport.models[i].glow);
					viewport.models[i].glow = null;
				}

			// Remove selection
			viewport.transformControls.detach();

			// Update model changes
			viewport.updateModelChanges();
		}
	},

	// Select model
	selectModel: function(model) {

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
					value: viewport.camera.position
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

		// Go through all models
		for(var i = 1; i < viewport.models.length; i++)

			// Check if model is being selected
			if(viewport.models[i].mesh == model) {
	
				// Select model
				viewport.transformControls.attach(model);
				
				// Set select material
				var selectMaterial = new THREE.MeshLambertMaterial({
					color: 0xEC9F3B,
					side: THREE.DoubleSide
				});

				// Set model's color
				model.material = selectMaterial;
				
				// Set adhesion's color
				if(viewport.models[i].adhesion !== null) {
					viewport.models[i].adhesion.mesh.material = selectMaterial;
					if(viewport.models[i].adhesion.glow !== null)
						viewport.scene[1].remove(viewport.models[i].adhesion.glow);
				}
		
				// Remove existing glow
				if(viewport.models[i].glow !== null)
					viewport.scene[1].remove(viewport.models[i].glow);
		
				// Create glow
				model.updateMatrix();
				viewport.models[i].glow = new THREE.Mesh(model.geometry, glowMaterial.clone());
				viewport.models[i].glow.applyMatrix(model.matrix);
				viewport.models[i].glow.renderOrder = 1;
				
				// Add glow to scene
				viewport.scene[1].add(viewport.models[i].glow);
				
				// Check if adhesion exists
				if(viewport.models[i].adhesion !== null) {
				
					// Create adhesion glow
					viewport.models[i].adhesion.mesh.updateMatrix();
					viewport.models[i].adhesion.glow = new THREE.Mesh(viewport.models[i].adhesion.mesh.geometry, outlineMaterial.clone());
					viewport.models[i].adhesion.glow.applyMatrix(viewport.models[i].adhesion.mesh.matrix);
					viewport.models[i].adhesion.glow.renderOrder = 0;
					
					// Add glow to scene
					viewport.scene[1].add(viewport.models[i].adhesion.glow);
				}

				// Update model changes
				viewport.updateModelChanges();
			}
	
			// Otherwise check if model is selected
			else if(viewport.models[i].glow !== null) {
	
				// Set model's glow color
				viewport.models[i].glow.material.uniforms.color.value.setHex(0xFFFFB3);
				
				// Set adhesion's glow color
				if(viewport.models[i].adhesion !== null)
					viewport.models[i].adhesion.glow.material.uniforms.color.value.setHex(0xFFFFB3);
			}
	},

	// Apply changes
	applyChanges: function(name, value) {

		// Get currently selected model
		var model = viewport.transformControls.object;

		// Save matrix
		viewport.savedMatrix = model.matrix.clone();

		// Check if in translate mode
		if($("#slicing_configuration_dialog .modal-extra div.values").hasClass("translate")) {

			// Set model's position
			if(name == 'x')
				model.position.x = -parseFloat(value);
			else if(name == 'y')
				model.position.y = parseFloat(value);
			else if(name == 'z')
				model.position.z = parseFloat(value);
		}

		// Otherwise check if in rotate mode
		else if($("#slicing_configuration_dialog .modal-extra div.values").hasClass("rotate")) {

			// Set model's rotation
			if(name == 'x')
				model.rotation.x = THREE.Math.degToRad(parseFloat(value));
			else if(name == 'y')
				model.rotation.y = THREE.Math.degToRad(parseFloat(value));
			else if(name == 'z')
				model.rotation.z = THREE.Math.degToRad(parseFloat(value));
		}

		// Otherwise check if in scale mode
		else if($("#slicing_configuration_dialog .modal-extra div.values").hasClass("scale")) {

			// Set model's scale
			if(name == 'x' || viewport.scaleLock[0])
				model.scale.x = parseFloat(value) == 0 ? 0.000000000001 : parseFloat(value);
			if(name == 'y' || viewport.scaleLock[1])
				model.scale.y = parseFloat(value) == 0 ? 0.000000000001 : parseFloat(value);
			if(name == 'z' || viewport.scaleLock[2])
				model.scale.z = parseFloat(value == 0 ? 0.000000000001 : parseFloat(value));
		}

		// Apply group transformation
		viewport.applyGroupTransformation();

		// Clear saved matrix
		viewport.savedMatrix = null;

		// Fix model's Y
		viewport.fixModelY();
	},

	// Update model changes
	updateModelChanges: function() {

		// Get currently selected model
		var model = viewport.transformControls.object;
	
		// Check if a showing measurements, a model is currently selected, and not cutting models
		if(viewport.showMeasurements && model && viewport.cutShape === null) {

			// Get model's boundary box
			var boundaryBox = new THREE.Box3().setFromObject(model);

			// Set width measurement
			viewport.measurements[0][0].geometry.vertices[0].set(boundaryBox.max.x + 1, boundaryBox.min.y - 1, boundaryBox.min.z - 1);
			viewport.measurements[0][0].geometry.vertices[1].set(boundaryBox.min.x - 1, boundaryBox.min.y - 1, boundaryBox.min.z - 1);
			viewport.measurements[0][1].set(boundaryBox.max.x + (boundaryBox.min.x - boundaryBox.max.x) / 2, boundaryBox.min.y, boundaryBox.min.z);
			var value = boundaryBox.max.x - boundaryBox.min.x;
			$("#slicing_configuration_dialog .modal-extra div.measurements > p.width").text(value.toFixed(3) + "mm / " + (value / 25.4).toFixed(3) + "in");

			// Set depth measurement
			viewport.measurements[1][0].geometry.vertices[0].set(boundaryBox.min.x - 1, boundaryBox.min.y - 1, boundaryBox.min.z - 1);
			viewport.measurements[1][0].geometry.vertices[1].set(boundaryBox.min.x - 1, boundaryBox.min.y - 1, boundaryBox.max.z + 1);
			viewport.measurements[1][1].set(boundaryBox.min.x, boundaryBox.min.y, boundaryBox.min.z + (boundaryBox.max.z - boundaryBox.min.z) / 2);
			value = boundaryBox.max.z - boundaryBox.min.z;
			$("#slicing_configuration_dialog .modal-extra div.measurements > p.depth").text(value.toFixed(3) + "mm / " + (value / 25.4).toFixed(3) + "in");

			// Set height measurement
			viewport.measurements[2][0].geometry.vertices[0].set(boundaryBox.min.x - 1, boundaryBox.min.y - 1, boundaryBox.max.z + 1);
			viewport.measurements[2][0].geometry.vertices[1].set(boundaryBox.min.x - 1, boundaryBox.max.y + 1, boundaryBox.max.z + 1);
			viewport.measurements[2][1].set(boundaryBox.min.x, boundaryBox.min.y + (boundaryBox.max.y - boundaryBox.min.y) / 2, boundaryBox.max.z);
			value = boundaryBox.max.y - boundaryBox.min.y;
			$("#slicing_configuration_dialog .modal-extra div.measurements > p.height").text(value.toFixed(3) + "mm / " + (value / 25.4).toFixed(3) + "in");

			// Show measurements
			for(var i = 0; i < viewport.measurements.length; i++) {
				viewport.measurements[i][0].geometry.verticesNeedUpdate = true;
				viewport.measurements[i][0].visible = viewport.showMeasurements;
			}

			$("#slicing_configuration_dialog .modal-extra div.measurements > p").addClass("show");
		}

		// Otherwise
		else {

			// Hide measurements
			for(var i = 0; i < viewport.measurements.length; i++)
				viewport.measurements[i][0].visible = false;

			$("#slicing_configuration_dialog .modal-extra div.measurements > p").removeClass("show");
		}

		// Set currently active buttons
		$("#slicing_configuration_dialog .modal-extra button.translate, #slicing_configuration_dialog .modal-extra button.rotate, #slicing_configuration_dialog .modal-extra button.scale").removeClass("disabled");
		$("#slicing_configuration_dialog .modal-extra div.values").removeClass("translate rotate scale").addClass(viewport.transformControls.getMode());
		$("#slicing_configuration_dialog .modal-extra button." + viewport.transformControls.getMode()).addClass("disabled");

		// Check if a model is currently selected
		if(model) {
	
			// Enable delete, clone, and reset
			$("#slicing_configuration_dialog .modal-extra button.delete, #slicing_configuration_dialog .modal-extra button.clone, #slicing_configuration_dialog .modal-extra button.reset").removeClass("disabled");

			// Show values
			$("#slicing_configuration_dialog .modal-extra div.values div").addClass("show").children('p').addClass("show");
			if($("#slicing_configuration_dialog .modal-extra div.values").hasClass("translate") && viewport.cutShape === null)
				$("#slicing_configuration_dialog .modal-extra div.values input[name=\"y\"]").parent().removeClass("show");

			// Check if an input is not focused
			if(!$("#slicing_configuration_dialog .modal-extra input:focus").length) {

				// Check if in translate mode
				if($("#slicing_configuration_dialog .modal-extra div.values").hasClass("translate")) {

					// Display position values
					$("#slicing_configuration_dialog .modal-extra div.values p span:not(.axis)").text("mm").attr("title", '');
					$("#slicing_configuration_dialog .modal-extra div.values input[name=\"x\"]").val((model.position.x.toFixed(3) == 0 ? 0 : -model.position.x).toFixed(3)).attr("min", '');
					$("#slicing_configuration_dialog .modal-extra div.values input[name=\"y\"]").val(model.position.y.toFixed(3)).attr("min", '');
					$("#slicing_configuration_dialog .modal-extra div.values input[name=\"z\"]").val(model.position.z.toFixed(3)).attr("min", '');
				}

				// Otherwise check if in rotate mode
				else if($("#slicing_configuration_dialog .modal-extra div.values").hasClass("rotate")) {

					// Display rotation values
					$("#slicing_configuration_dialog .modal-extra div.values p span:not(.axis)").text('°').attr("title", '');
					$("#slicing_configuration_dialog .modal-extra div.values input[name=\"x\"]").val((model.rotation.x * 180 / Math.PI).toFixed(3)).attr("min", '');
					$("#slicing_configuration_dialog .modal-extra div.values input[name=\"y\"]").val((model.rotation.y * 180 / Math.PI).toFixed(3)).attr("min", '');
					$("#slicing_configuration_dialog .modal-extra div.values input[name=\"z\"]").val((model.rotation.z * 180 / Math.PI).toFixed(3)).attr("min", '');
				}

				// Otherwise check if in scale mode
				else if($("#slicing_configuration_dialog .modal-extra div.values").hasClass("scale")) {

					// Display scale values
					for(var i = 0; i < 3; i++)
						$("#slicing_configuration_dialog .modal-extra div.values p span:not(.axis)").eq(i).text(viewport.scaleLock[i] ? '🔒' : '🔓').attr("title", viewport.scaleLock[i] ? "Unlock" : "Lock");
					$("#slicing_configuration_dialog .modal-extra div.values input[name=\"x\"]").val(model.scale.x.toFixed(3)).attr("min", '0');
					$("#slicing_configuration_dialog .modal-extra div.values input[name=\"y\"]").val(model.scale.y.toFixed(3)).attr("min", '0');
					$("#slicing_configuration_dialog .modal-extra div.values input[name=\"z\"]").val(model.scale.z.toFixed(3)).attr("min", '0');
				}
			}

			// Apply group transformation
			viewport.applyGroupTransformation();
		
			// Go through all models
			var numberOfModelsSelected = 0;
			for(var i = 1; i < viewport.models.length; i++)

				// Check if glow exists
				if(viewport.models[i].glow !== null) {
			
					// Increment number of models selected
					numberOfModelsSelected++;

					// Update glow's orientation
					viewport.models[i].glow.position.copy(viewport.models[i].mesh.position);
					viewport.models[i].glow.rotation.copy(viewport.models[i].mesh.rotation);
					viewport.models[i].glow.scale.copy(viewport.models[i].mesh.scale);
					
					// Check if adhesion exists
					if(viewport.models[i].adhesion !== null) {
					
						// Restore original geometry
						viewport.models[i].adhesion.mesh.geometry = viewport.models[i].adhesion.geometry.clone();
					
						// Update adhesion's orientation
						viewport.models[i].adhesion.mesh.rotation.copy(viewport.models[i].mesh.rotation);
						viewport.models[i].adhesion.mesh.scale.copy(viewport.models[i].mesh.scale);
						
						// Apply transformation to adhesion's geometry
						viewport.models[i].adhesion.mesh.updateMatrix();
						viewport.models[i].adhesion.mesh.geometry.applyMatrix(viewport.models[i].adhesion.mesh.matrix);
						viewport.models[i].adhesion.mesh.geometry.center();
						
						// Set adhesion's orientation
						viewport.models[i].adhesion.mesh.position.set(viewport.models[i].mesh.position.x, bedLowMinZ, viewport.models[i].mesh.position.z);
						viewport.models[i].adhesion.mesh.rotation.set(0, 0, 0);
						var boundaryBox = new THREE.Box3().setFromObject(viewport.models[i].mesh);
						viewport.models[i].adhesion.mesh.scale.set((boundaryBox.max.x - boundaryBox.min.x + viewport.adhesionSize * 2) / (boundaryBox.max.x - boundaryBox.min.x), 0.000000000001, (boundaryBox.max.z - boundaryBox.min.z + viewport.adhesionSize * 2) / (boundaryBox.max.z - boundaryBox.min.z));
						
						// Update adhesion glow's orientation
						viewport.models[i].adhesion.glow.geometry = viewport.models[i].adhesion.mesh.geometry;
						viewport.models[i].adhesion.glow.position.copy(viewport.models[i].adhesion.mesh.position);
						viewport.models[i].adhesion.glow.rotation.copy(viewport.models[i].adhesion.mesh.rotation);
						viewport.models[i].adhesion.glow.scale.copy(viewport.models[i].adhesion.mesh.scale);
					}
				}
		
			// Enable or disable merge button
			if(numberOfModelsSelected >= 2)
				$("#slicing_configuration_dialog .modal-extra button.merge").removeClass("disabled");
			else
				$("#slicing_configuration_dialog .modal-extra button.merge").addClass("disabled");
			
			// Check if cutting models
			if(viewport.cutShape !== null) {
			
				// Update cut shape's outline's orientation
				viewport.cutShapeOutline.position.copy(viewport.cutShape.position);
				viewport.cutShapeOutline.rotation.copy(viewport.cutShape.rotation);
				viewport.cutShapeOutline.scale.copy(viewport.cutShape.scale);
			}
		}

		// Otherwise check if not cutting models
		else if(viewport.cutShape === null) {

			// Disable delete, clone, and reset
			$("#slicing_configuration_dialog .modal-extra button.delete, #slicing_configuration_dialog .modal-extra button.clone, #slicing_configuration_dialog .modal-extra button.reset").addClass("disabled");

			// Hide values
			$("#slicing_configuration_dialog .modal-extra div.values div").removeClass("show").children('p').removeClass("show");

			// Blur input
			$("#slicing_configuration_dialog .modal-extra div.values input").blur();
		}
	
		// Check if no model is selected
		if(!model)
	
			// Disable merge button
			$("#slicing_configuration_dialog .modal-extra button.merge").addClass("disabled");
		
		// Check if no models exist
		if(viewport.models.length == 1)
		
			// Disable cut button
			$("#slicing_configuration_dialog .modal-extra button.cut").addClass("off");
		
		// Otherwise
		else
		
			// Enable cut button
			$("#slicing_configuration_dialog .modal-extra button.cut").removeClass("off");
	},

	// Apply group transformation
	applyGroupTransformation: function() {

		// Check if a matrix was saved
		if(viewport.savedMatrix) {

			// Get new matrix
			viewport.transformControls.object.updateMatrix();
			var newMatrix = viewport.transformControls.object.matrix;
	
			// Check current mode
			switch(viewport.transformControls.getMode()) {
	
				// Check if in translate mode
				case "translate" :
		
					// Get saved position
					var savedValue = new THREE.Vector3();
					savedValue.setFromMatrixPosition(viewport.savedMatrix);
	
					// Get new position
					var newValue = new THREE.Vector3();
					newValue.setFromMatrixPosition(newMatrix);
				break;
		
				// Check if in rotate mode
				case "rotate" :
		
					// Get saved position
					var savedRotation = new THREE.Euler();
					savedRotation.setFromRotationMatrix(viewport.savedMatrix);
					var savedValue = savedRotation.toVector3();
			
					// Get new position
					var newRotation = new THREE.Euler();
					newRotation.setFromRotationMatrix(newMatrix);
					var newValue = newRotation.toVector3();
				break;
		
				// Check if in scale mode
				case "scale" :
		
					// Get saved position
					var savedValue = new THREE.Vector3();
					savedValue.setFromMatrixScale(viewport.savedMatrix);
	
					// Get new position
					var newValue = new THREE.Vector3();
					newValue.setFromMatrixScale(newMatrix);
				break;
			}
	
			// Get changes
			var changes = savedValue.sub(newValue);

			// Go through all models
			for(var i = 1; i < viewport.models.length; i++)

				// Check if model is selected
				if(viewport.models[i].glow && viewport.models[i].mesh != viewport.transformControls.object)
		
					// Check current mode
					switch(viewport.transformControls.getMode()) {
			
						// Check if in translate mode
						case "translate" :
				
							// Update model's position
							viewport.models[i].mesh.position.sub(changes);
						break;
				
						// Check if in rotate mode
						case "rotate" :
				
							// Update model's rotation
							viewport.models[i].mesh.rotation.setFromVector3(viewport.models[i].mesh.rotation.toVector3().sub(changes));
						break;
				
						// Check if in scale mode
						case "scale" :
				
							// Update model's size
							viewport.models[i].mesh.scale.sub(changes);
							
							// Prevent scaling less than zero
							if(viewport.models[i].mesh.scale.x <= 0)
								viewport.models[i].mesh.scale.x = 0.000000000001;
							if(viewport.models[i].mesh.scale.y <= 0)
								viewport.models[i].mesh.scale.y = 0.000000000001;
							if(viewport.models[i].mesh.scale.z <= 0)
								viewport.models[i].mesh.scale.z = 0.000000000001;
						break;
					}
	
			// Save new matrix
			viewport.savedMatrix = newMatrix.clone();
		}
	},

	// Get 2D position
	get2dPosition: function(vector) {

		// Initialize variables
		var clonedVector = vector.clone();
		var position = new THREE.Vector2();

		// Normalized device coordinate
		clonedVector.project(viewport.camera);

		// Get 2D position
		position.x = Math.round((clonedVector.x + 1) * viewport.renderer.domElement.width / 2);
		position.y = Math.round((-clonedVector.y + 1) * viewport.renderer.domElement.height / 2);

		// Return position
		return position;
	},

	// Update boundaries
	updateBoundaries: function() {

		// Create maximums and minimums for bed tiers
		var maximums = [];
		var minimums = [];
		for(var i = 0; i < 3; i++) {
			maximums[i] = new THREE.Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
			minimums[i] = new THREE.Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
		}

		// Go through all models
		for(var i = 1; i < viewport.models.length; i++) {

			// Get current model
			var model = viewport.models[i].mesh;

			// Update model's matrix
			model.updateMatrixWorld();

			// Go through all model's vertices
			for(var j = 0; j < model.geometry.vertices.length; j++) {

				// Get absolute position of vertex
				var vector = model.geometry.vertices[j].clone();
				vector.applyMatrix4(model.matrixWorld);
				vector.x *= -1;

				// Get maximum and minimum for each bed tier
				if(vector.y < bedLowMaxZ) {
					maximums[0].max(vector);
					minimums[0].min(vector);
				}

				else if(vector.y < bedMediumMaxZ) {
					maximums[1].max(vector);
					minimums[1].min(vector);
				}

				else {
					maximums[2].max(vector);
					minimums[2].min(vector);
				}
			}
		}

		// Go through all boundaries
		for(var i = 0; i < viewport.boundaries.length; i++) {

			// Reset boundary
			viewport.boundaries[i].material.color.setHex(0x00FF00);
			viewport.boundaries[i].material.opacity = 0.2;
			viewport.boundaries[i].visible = viewport.showBoundaries;
			viewport.boundaries[i].renderOrder = 2;
		}

		// Check if models goes out of bounds on low front
		if((viewport.platformAdhesion != "None" && (minimums[0].z - viewport.adhesionSize < bedLowMinY - extruderCenterY || minimums[1].z - viewport.adhesionSize < bedLowMinY - extruderCenterY || minimums[2].z - viewport.adhesionSize < bedLowMinY - extruderCenterY)) || (viewport.platformAdhesion == "None" && minimums[0].z < bedLowMinY - extruderCenterY)) {

			// Set boundary
			viewport.boundaries[1].material.color.setHex(0xFF0000);
			viewport.boundaries[1].material.opacity = 0.7;
			viewport.boundaries[1].visible = true;
			viewport.boundaries[1].renderOrder = 1;
		}

		// Otherwise
		else

			// Set boundary's visibility
			viewport.boundaries[1].visible = viewport.showBoundaries;

		// Check if models goes out of bounds on low back
		if((viewport.platformAdhesion != "None" && (maximums[0].z + viewport.adhesionSize > bedLowMaxY - extruderCenterY || maximums[1].z + viewport.adhesionSize > bedLowMaxY - extruderCenterY || maximums[2].z + viewport.adhesionSize > bedLowMaxY - extruderCenterY)) || (viewport.platformAdhesion == "None" && maximums[0].z > bedLowMaxY - extruderCenterY)) {

			// Set boundary
			viewport.boundaries[2].material.color.setHex(0xFF0000);
			viewport.boundaries[2].material.opacity = 0.7;
			viewport.boundaries[2].visible = true;
			viewport.boundaries[2].renderOrder = 1;
		}

		// Otherwise
		else

			// Set boundary's visibility
			viewport.boundaries[2].visible = viewport.showBoundaries;

		// Check if models goes out of bounds on low right
		if((viewport.platformAdhesion != "None" && (maximums[0].x + viewport.adhesionSize > bedLowMaxX - extruderCenterX || maximums[1].x + viewport.adhesionSize > bedLowMaxX - extruderCenterX || maximums[2].x + viewport.adhesionSize > bedLowMaxX - extruderCenterX)) || (viewport.platformAdhesion == "None" && maximums[0].x > bedLowMaxX - extruderCenterX)) {

			// Set boundary
			viewport.boundaries[3].material.color.setHex(0xFF0000);
			viewport.boundaries[3].material.opacity = 0.7;
			viewport.boundaries[3].visible = true;
			viewport.boundaries[3].renderOrder = 1;
		}

		// Otherwise
		else

			// Set boundary's visibility
			viewport.boundaries[3].visible = viewport.showBoundaries;

		// Check if models goes out of bounds on low left
		if((viewport.platformAdhesion != "None" && (minimums[0].x - viewport.adhesionSize < bedLowMinX - extruderCenterX || minimums[1].x - viewport.adhesionSize < bedLowMinX - extruderCenterX || minimums[2].x - viewport.adhesionSize < bedLowMinX - extruderCenterX)) || (viewport.platformAdhesion == "None" && minimums[0].x < bedLowMinX - extruderCenterX)) {

			// Set boundary
			viewport.boundaries[4].material.color.setHex(0xFF0000);
			viewport.boundaries[4].material.opacity = 0.7;
			viewport.boundaries[4].visible = true;
			viewport.boundaries[4].renderOrder = 1;
		}

		// Otherwise
		else

			// Set boundary's visibility
			viewport.boundaries[4].visible = viewport.showBoundaries;

		// Check if models goes out of bounds on medium front
		if(minimums[1].z < bedMediumMinY - extruderCenterY) {

			// Set boundary
			viewport.boundaries[5].material.color.setHex(0xFF0000);
			viewport.boundaries[5].material.opacity = 0.7;
			viewport.boundaries[5].visible = true;
			viewport.boundaries[5].renderOrder = 1;
		}

		// Otherwise
		else

			// Set boundary's visibility
			viewport.boundaries[5].visible = viewport.showBoundaries;

		// Check if models goes out of bounds on medium back
		if(maximums[1].z > bedMediumMaxY - extruderCenterY) {

			// Set boundary
			viewport.boundaries[6].material.color.setHex(0xFF0000);
			viewport.boundaries[6].material.opacity = 0.7;
			viewport.boundaries[6].visible = true;
			viewport.boundaries[6].renderOrder = 1;
		}

		// Otherwise
		else

			// Set boundary's visibility
			viewport.boundaries[6].visible = viewport.showBoundaries;

		// Check if models goes out of bounds on medium right
		if(maximums[1].x > bedMediumMaxX - extruderCenterX) {

			// Set boundary
			viewport.boundaries[7].material.color.setHex(0xFF0000);
			viewport.boundaries[7].material.opacity = 0.7;
			viewport.boundaries[7].visible = true;
			viewport.boundaries[7].renderOrder = 1;
		}

		// Otherwise
		else

			// Set boundary's visibility
			viewport.boundaries[7].visible = viewport.showBoundaries;

		// Check if models goes out of bounds on medium left
		if(minimums[1].x < bedMediumMinX - extruderCenterX) {

			// Set boundary
			viewport.boundaries[8].material.color.setHex(0xFF0000);
			viewport.boundaries[8].material.opacity = 0.7;
			viewport.boundaries[8].visible = true;
			viewport.boundaries[8].renderOrder = 1;
		}

		// Otherwise
		else

			// Set boundary's visibility
			viewport.boundaries[8].visible = viewport.showBoundaries;

		// Check if models goes out of bounds on high front
		if(minimums[2].z < bedHighMinY - extruderCenterY) {

			// Set boundary
			viewport.boundaries[9].material.color.setHex(0xFF0000);
			viewport.boundaries[9].material.opacity = 0.7;
			viewport.boundaries[9].visible = true;
			viewport.boundaries[9].renderOrder = 1;
		}

		// Otherwise
		else

			// Set boundary's visibility
			viewport.boundaries[9].visible = viewport.showBoundaries;

		// Check if models goes out of bounds on high back
		if(maximums[2].z > bedHighMaxY - extruderCenterY) {

			// Set boundary
			viewport.boundaries[10].material.color.setHex(0xFF0000);
			viewport.boundaries[10].material.opacity = 0.7;
			viewport.boundaries[10].visible = true;
			viewport.boundaries[10].renderOrder = 1;
		}

		// Otherwise
		else

			// Set boundary's visibility
			viewport.boundaries[10].visible = viewport.showBoundaries;

		// Check if models goes out of bounds on high right
		if(maximums[2].x > bedHighMaxX - extruderCenterX) {

			// Set boundary
			viewport.boundaries[11].material.color.setHex(0xFF0000);
			viewport.boundaries[11].material.opacity = 0.7;
			viewport.boundaries[11].visible = true;
			viewport.boundaries[11].renderOrder = 1;
		}

		// Otherwise
		else

			// Set boundary's visibility
			viewport.boundaries[11].visible = viewport.showBoundaries;

		// Check if models goes out of bounds on high left
		if(minimums[2].x < bedHighMinX - extruderCenterX) {

			// Set boundary
			viewport.boundaries[12].material.color.setHex(0xFF0000);
			viewport.boundaries[12].material.opacity = 0.7;
			viewport.boundaries[12].visible = true;
			viewport.boundaries[12].renderOrder = 1;
		}

		// Otherwise
		else

			// Set boundary's visibility
			viewport.boundaries[12].visible = viewport.showBoundaries;

		// Check if models goes out of bounds on high top
		if(maximums[2].y > bedHighMaxZ) {

			// Set boundary
			viewport.boundaries[13].material.color.setHex(0xFF0000);
			viewport.boundaries[13].material.opacity = 0.7;
			viewport.boundaries[13].visible = true;
			viewport.boundaries[13].renderOrder = 1;
		}

		// Otherwise
		else

			// Set boundary's visibility
			viewport.boundaries[13].visible = viewport.showBoundaries;

		// Check if models goes out of bounds on connector between low and medium front
		if((bedMediumMinY < bedLowMinY && viewport.boundaries[1].material.color.getHex() == 0xFF0000) || viewport.boundaries[5].material.color.getHex() == 0xFF0000) {

			// Set boundary
			viewport.boundaries[14].material.color.setHex(0xFF0000);
			viewport.boundaries[14].material.opacity = 0.7;
			viewport.boundaries[14].visible = true;
			viewport.boundaries[14].renderOrder = 1;
		}

		// Otherwise
		else

			// Set boundary's visibility
			viewport.boundaries[14].visible = viewport.showBoundaries;

		// Check if models goes out of bounds on connector between low and medium back
		if((bedMediumMaxY > bedLowMaxY && viewport.boundaries[2].material.color.getHex() == 0xFF0000) || viewport.boundaries[6].material.color.getHex() == 0xFF0000) {

			// Set boundary
			viewport.boundaries[15].material.color.setHex(0xFF0000);
			viewport.boundaries[15].material.opacity = 0.7;
			viewport.boundaries[15].visible = true;
			viewport.boundaries[15].renderOrder = 1;
		}

		// Otherwise
		else

			// Set boundary's visibility
			viewport.boundaries[15].visible = viewport.showBoundaries;

		// Check if models goes out of bounds on connector between low and medium right
		if((bedMediumMaxX > bedLowMaxX && viewport.boundaries[3].material.color.getHex() == 0xFF0000) || viewport.boundaries[7].material.color.getHex() == 0xFF0000) {

			// Set boundary
			viewport.boundaries[16].material.color.setHex(0xFF0000);
			viewport.boundaries[16].material.opacity = 0.7;
			viewport.boundaries[16].visible = true;
			viewport.boundaries[16].renderOrder = 1;
		}

		// Otherwise
		else

			// Set boundary's visibility
			viewport.boundaries[16].visible = viewport.showBoundaries;

		// Check if models goes out of bounds on connector between low and medium left
		if((bedMediumMinX < bedLowMinX && viewport.boundaries[4].material.color.getHex() == 0xFF0000) || viewport.boundaries[8].material.color.getHex() == 0xFF0000) {

			// Set boundary
			viewport.boundaries[17].material.color.setHex(0xFF0000);
			viewport.boundaries[17].material.opacity = 0.7;
			viewport.boundaries[17].visible = true;
			viewport.boundaries[17].renderOrder = 1;
		}

		// Otherwise
		else

			// Set boundary's visibility
			viewport.boundaries[17].visible = viewport.showBoundaries;

		// Check if models goes out of bounds on connector between medium and high front
		if((bedHighMinY < bedMediumMinY && viewport.boundaries[5].material.color.getHex() == 0xFF0000) || viewport.boundaries[9].material.color.getHex() == 0xFF0000) {

			// Set boundary
			viewport.boundaries[18].material.color.setHex(0xFF0000);
			viewport.boundaries[18].material.opacity = 0.7;
			viewport.boundaries[18].visible = true;
			viewport.boundaries[18].renderOrder = 1;
		}

		// Otherwise
		else

			// Set boundary's visibility
			viewport.boundaries[18].visible = viewport.showBoundaries;

		// Check if models goes out of bounds on connector between medium and high back
		if((bedHighMaxY > bedMediumMaxY && viewport.boundaries[6].material.color.getHex() == 0xFF0000) || viewport.boundaries[10].material.color.getHex() == 0xFF0000) {

			// Set boundary
			viewport.boundaries[19].material.color.setHex(0xFF0000);
			viewport.boundaries[19].material.opacity = 0.7;
			viewport.boundaries[19].visible = true;
			viewport.boundaries[19].renderOrder = 1;
		}

		// Otherwise
		else

			// Set boundary's visibility
			viewport.boundaries[19].visible = viewport.showBoundaries;

		// Check if models goes out of bounds on connector between medium and high right
		if((bedHighMaxX > bedMediumMaxX && viewport.boundaries[7].material.color.getHex() == 0xFF0000) || viewport.boundaries[11].material.color.getHex() == 0xFF0000) {

			// Set boundary
			viewport.boundaries[20].material.color.setHex(0xFF0000);
			viewport.boundaries[20].material.opacity = 0.7;
			viewport.boundaries[20].visible = true;
			viewport.boundaries[20].renderOrder = 1;
		}

		// Otherwise
		else

			// Set boundary's visibility
			viewport.boundaries[20].visible = viewport.showBoundaries;

		// Check if models goes out of bounds on connector between medium and high left
		if((bedHighMinX < bedMediumMinX && viewport.boundaries[8].material.color.getHex() == 0xFF0000) || viewport.boundaries[12].material.color.getHex() == 0xFF0000) {

			// Set boundary
			viewport.boundaries[21].material.color.setHex(0xFF0000);
			viewport.boundaries[21].material.opacity = 0.7;
			viewport.boundaries[21].visible = true;
			viewport.boundaries[21].renderOrder = 1;
		}

		// Otherwise
		else

			// Set boundary's visibility
			viewport.boundaries[21].visible = viewport.showBoundaries;
	},

	// Apply cut
	applyCut: function() {
	
		// Display cover
		$("#slicing_configuration_dialog .modal-cover").addClass("show").css("z-index", "9999").children("p").text("Applying cut…");

		setTimeout(function() {

			// Deselect button
			$("#slicing_configuration_dialog .modal-extra button.cut").removeClass("disabled");
	
			// Enable import and clone buttons
			$("#slicing_configuration_dialog .modal-extra button.import, #slicing_configuration_dialog .modal-extra button.clone").prop("disabled", false);
			
			// Hide cut shape options
			$("#slicing_configuration_dialog .modal-extra div.cutShape").removeClass("show");

			// Initialize variables
			var intersections = [];
			var differences = [];
			
			// Increase sphere detail if cut shape is a sphere
			if(viewport.cutShape.geometry.type == "SphereGeometry")
				viewport.cutShape.geometry = new THREE.SphereGeometry(25, 25, 25);
	
			// Update cut shape's geometry
			viewport.cutShape.geometry.applyMatrix(viewport.cutShape.matrix);
			viewport.cutShape.position.set(0, 0, 0);
			viewport.cutShape.rotation.set(0, 0, 0);
			viewport.cutShape.scale.set(1, 1, 1);

			// Go through all models
			for(var i = 1; i < viewport.models.length; i++) {
	
				// Update model's geometry
				viewport.models[i].mesh.geometry.applyMatrix(viewport.models[i].mesh.matrix);
				viewport.models[i].mesh.position.set(0, 0, 0);
				viewport.models[i].mesh.rotation.set(0, 0, 0);
				viewport.models[i].mesh.scale.set(1, 1, 1);
	
				// Create difference and intersection meshes
				var cutShapeBsp = new ThreeBSP(viewport.cutShape);
				var modelBsp = new ThreeBSP(viewport.models[i].mesh);
				var meshDifference = modelBsp.subtract(cutShapeBsp).toMesh(new THREE.MeshLambertMaterial(filamentMaterials[viewportFilamentColor]));
				var meshIntersection = modelBsp.intersect(cutShapeBsp).toMesh(new THREE.MeshLambertMaterial(filamentMaterials[viewportFilamentColor]));
	
				// Delete model
				viewport.scene[0].remove(viewport.models[i].mesh);
				if(viewport.models[i].adhesion !== null)
					viewport.scene[0].remove(viewport.models[i].adhesion.mesh);
				var type = viewport.models[i].type;
				viewport.models.splice(i--, 1);
	
				// Check if difference mesh exists
				if(meshDifference.geometry.vertices.length) {
	
					// Center difference mesh's geometry
					meshDifference.updateMatrixWorld();
					var positionBefore = meshDifference.geometry.vertices[0].clone();
					positionBefore.applyMatrix4(meshDifference.matrixWorld);

					meshDifference.geometry.center();
					meshDifference.geometry.computeFaceNormals();

					var positionAfter = meshDifference.geometry.vertices[0].clone();
					positionAfter.applyMatrix4(meshDifference.matrixWorld);
					meshDifference.position.set(meshDifference.position.x + positionBefore.x - positionAfter.x, meshDifference.position.y + positionBefore.y - positionAfter.y, meshDifference.position.z + positionBefore.z - positionAfter.z);
			
					// Add difference mesh to list
					differences.push({
						mesh: meshDifference,
						type: null,
						glow: null
					});
				}
	
				// Check if intersection mesh exists
				if(meshIntersection.geometry.vertices.length) {

					// Center intersection mesh's geometry
					meshIntersection.updateMatrixWorld();
					var positionBefore = meshIntersection.geometry.vertices[0].clone();
					positionBefore.applyMatrix4(meshIntersection.matrixWorld);

					meshIntersection.geometry.center();
					meshIntersection.geometry.computeFaceNormals();

					var positionAfter = meshIntersection.geometry.vertices[0].clone();
					positionAfter.applyMatrix4(meshIntersection.matrixWorld);
					meshIntersection.position.set(meshIntersection.position.x + positionBefore.x - positionAfter.x, meshIntersection.position.y + positionBefore.y - positionAfter.y, meshIntersection.position.z + positionBefore.z - positionAfter.z);
			
					// Add intersection mesh to list
					intersections.push({
						mesh: meshIntersection,
						type: null,
						glow: null
					});
				}
			}
	
			// Remove cut shape
			viewport.scene[0].remove(viewport.cutShape);
			viewport.scene[0].remove(viewport.cutShapeOutline);
			viewport.cutShape = null;
			viewport.cutShapeOutline = null;
			viewport.transformControls.detach();
			viewport.transformControls.setAllowedTranslation("XZ");
	
			// Go through all intersections
			for(var i = 0; i < intersections.length; i++) {
	
				// Add intersection mesh to scene
				viewport.scene[0].add(intersections[i].mesh);
	
				// Add intersection mesh to list
				viewport.models.push({
					mesh: intersections[i].mesh,
					type: intersections[i].type,
					glow: null,
					adhesion: viewport.createPlatformAdhesion(intersections[i].mesh)
				});
	
				// Select intersection mesh
				viewport.selectModel(intersections[i].mesh);
			}
	
			// Go through all differences
			for(var i = 0; i < differences.length; i++) {
	
				// Add difference mesh to scene
				viewport.scene[0].add(differences[i].mesh);
	
				// Add difference mesh to list
				viewport.models.push({
					mesh: differences[i].mesh,
					type: differences[i].type,
					glow: null,
					adhesion: viewport.createPlatformAdhesion(differences[i].mesh)
				});
	
				// Select difference mesh
				viewport.selectModel(differences[i].mesh);
			}

			// Fix model's Y
			viewport.fixModelY();
	
			// Remove selection
			viewport.removeSelection();
	
			// Go through all intersections
			for(var i = 0; i < intersections.length; i++)
	
				// Select intersection mesh
				viewport.selectModel(intersections[i].mesh);
	
			// Upate measurements
			viewport.updateModelChanges();

			// Render
			viewport.render();
			
			// Hide cover
			$("#slicing_configuration_dialog .modal-cover").removeClass("show");
			setTimeout(function() {
				$("#slicing_configuration_dialog .modal-cover").css("z-index", '');
			}, 200);
		}, 600);
	},
	
	// Set cut shape
	setCutShape: function(shape) {
	
		// Initialize variables
		var changed = false;
		
		// Select button
		$("#slicing_configuration_dialog .modal-extra div.cutShape button." + shape).addClass("disabled").siblings("button").removeClass("disabled");
	
		// Check if cut shape is a sphere
		if(shape == "cube" && viewport.cutShape.geometry.type == "SphereGeometry") {
		
			// Change cut shape to a cube
			viewport.cutShape.geometry = new THREE.CubeGeometry(50, 50, 50);
			changed = true;
		}
	
		// Otherwise check if cut chape is a cube
		else if(shape == "sphere" && viewport.cutShape.geometry.type == "BoxGeometry") {
		
			// Change cut shape to a sphere
			viewport.cutShape.geometry = new THREE.SphereGeometry(25, 10, 10);
			changed = true;
		}
		
		// Check if cut shape changed
		if(changed) {
		
			// Update cut shape outline
			viewport.cutShapeOutline.geometry = viewport.lineGeometry(viewport.cutShape.geometry);

			// Render
			viewport.render();
		}
	},

	// Apply merge
	applyMerge: function() {
	
		// Display cover
		$("#slicing_configuration_dialog .modal-cover").addClass("show").css("z-index", "9999").children("p").text("Applying merge…");

		setTimeout(function() {

			// Initialize variables
			var meshUnion = viewport.transformControls.object;
	
			// Update currently selected model's geometry
			meshUnion.geometry.applyMatrix(meshUnion.matrix);
			meshUnion.position.set(0, 0, 0);
			meshUnion.rotation.set(0, 0, 0);
			meshUnion.scale.set(1, 1, 1);

			// Go through all models
			for(var i = 1; i < viewport.models.length; i++)

				// Check if model is selected and it's not the newest selected model
				if(viewport.models[i].glow && viewport.models[i].mesh != viewport.transformControls.object) {
		
					// Update model's geometry
					viewport.models[i].mesh.geometry.applyMatrix(viewport.models[i].mesh.matrix);
					viewport.models[i].mesh.position.set(0, 0, 0);
					viewport.models[i].mesh.rotation.set(0, 0, 0);
					viewport.models[i].mesh.scale.set(1, 1, 1);
		
					// Create union mesh
					var unionBsp = new ThreeBSP(meshUnion);
					var modelBsp = new ThreeBSP(viewport.models[i].mesh);
					meshUnion = unionBsp.union(modelBsp).toMesh(new THREE.MeshLambertMaterial(filamentMaterials[viewportFilamentColor]));
	
					// Delete model
					viewport.scene[0].remove(viewport.models[i].mesh);
					viewport.scene[1].remove(viewport.models[i].glow);
					if(viewport.models[i].adhesion !== null) {
						viewport.scene[0].remove(viewport.models[i].adhesion.mesh);
						viewport.scene[1].remove(viewport.models[i].adhesion.glow);
					}
					viewport.models.splice(i--, 1);
	
					// Center union mesh's geometry
					meshUnion.updateMatrixWorld();
					var positionBefore = meshUnion.geometry.vertices[0].clone();
					positionBefore.applyMatrix4(meshUnion.matrixWorld);

					meshUnion.geometry.center();
					meshUnion.geometry.computeFaceNormals();

					var positionAfter = meshUnion.geometry.vertices[0].clone();
					positionAfter.applyMatrix4(meshUnion.matrixWorld);
					meshUnion.position.set(meshUnion.position.x + positionBefore.x - positionAfter.x, meshUnion.position.y + positionBefore.y - positionAfter.y, meshUnion.position.z + positionBefore.z - positionAfter.z);
				}
	
			// Go through all models
			for(var i = 1; i < viewport.models.length; i++)
	
				// Check if currently selected model
				if(viewport.models[i].mesh == viewport.transformControls.object) {
		
					// Delete model
					viewport.scene[0].remove(viewport.models[i].mesh);
					viewport.scene[1].remove(viewport.models[i].glow);
					if(viewport.models[i].adhesion !== null) {
						viewport.scene[0].remove(viewport.models[i].adhesion.mesh);
						viewport.scene[1].remove(viewport.models[i].adhesion.glow);
					}
					var type = viewport.models[i].type;
					viewport.models.splice(i--, 1);
			
					// Break
					break;
				}
	
			// Add union mesh to scene
			viewport.scene[0].add(meshUnion);

			// Add union mesh to list
			viewport.models.push({
				mesh: meshUnion,
				type: null,
				glow: null,
				adhesion: viewport.createPlatformAdhesion(meshUnion)
			});

			// Select union mesh
			viewport.selectModel(meshUnion);
	
			// Fix model's Y
			viewport.fixModelY();
		
			// Hide cover
			$("#slicing_configuration_dialog .modal-cover").removeClass("show");
			setTimeout(function() {
				$("#slicing_configuration_dialog .modal-cover").css("z-index", '');
			}, 200);
		}, 600);
	},
	
	// Line geometry
	lineGeometry: function(geometry) {

		// Create line geometry
		var lineGeometry = new THREE.Geometry();
	
		// Go through all geometry's quads
		for(var i = 0; i < geometry.faces.length - 1; i += 2) {
	
			// Get quad's vertices
			var quadVertices = [];
			quadVertices[0] = geometry.vertices[geometry.faces[i].a].clone();
			quadVertices[1] = geometry.vertices[geometry.faces[i].b].clone();
			quadVertices[2] = geometry.vertices[geometry.faces[i + 1].b].clone();
			quadVertices[3] = geometry.vertices[geometry.faces[i + 1].c].clone();
			quadVertices[4] = quadVertices[0];
		
			// Check if first quad
			if(!lineGeometry.vertices.length) {
		
				// Append quad's vertices to line geometry
				for(var j = 0; j < 4; j++)
					lineGeometry.vertices.push(quadVertices[j], quadVertices[j + 1]);
			}
		
			// Otherwise
			else {
		
				// Go through all quad's vertecies
				for(var j = 0; j < 4; j++)
		
					// Go through all line geometry's vertecies
					for(var k = 0; k < lineGeometry.vertices.length - 1; k += 2) {
				
						// Check if line exists
						if((lineGeometry.vertices[k].equals(quadVertices[j]) && lineGeometry.vertices[k + 1].equals(quadVertices[j + 1])) || (lineGeometry.vertices[k].equals(quadVertices[j + 1]) && lineGeometry.vertices[k + 1].equals(quadVertices[j])))
					
							// Break
							break;
					
						// Check if line doesn't exists
						if(k == lineGeometry.vertices.length - 2) {
					
							// Append quad's vertices to line geometry
							lineGeometry.vertices.push(quadVertices[j], quadVertices[j + 1]);
							break;
						}
					}
			}
		}
	
		// Compute line distance
		lineGeometry.computeLineDistances();
	
		// Return line geometry
		return lineGeometry;
	},

	// Render
	render: function() {

		// Update controls
		viewport.transformControls.update();
		viewport.orbitControls.update();

		// Check if a model is currently selected
		if(viewport.transformControls.object) {

			// Get camera distance to model
			var distance = viewport.camera.position.distanceTo(viewport.transformControls.object.position);
			if(distance < 200)
				distance = 200;
			else if(distance > 500)
				distance = 500;

			// Set measurement size
			$("#slicing_configuration_dialog .modal-extra div.measurements > p").css("font-size", 8 + ((500 / distance) - 1) / (2.5 - 1) * (13 - 8) + "px");

			// Set z index order for measurement values
			var order = [];
			for(var j = 0; j < 3; j++)
				order[j] = viewport.camera.position.distanceTo(viewport.measurements[j][1]);

			for(var j = 0; j < 3; j++) {
				var lowest = order.indexOf(Math.max.apply(Math, order));
				$("#slicing_configuration_dialog .modal-extra div.measurements > p").eq(lowest).css("z-index", j);
				order[lowest] = Number.NEGATIVE_INFINITY;
			}

			// Position measurement values
			for(var j = 0; j < 3; j++) {
				var position = viewport.get2dPosition(viewport.measurements[j][1]);
				$("#slicing_configuration_dialog .modal-extra div.measurements > p").eq(j).css({
					"top": position.y - 3 + "px",
					"left": position.x - $("#slicing_configuration_dialog .modal-extra div.measurements > p").eq(j).width() / 2 + "px"
				});
			}

			// Go through all models
			for(var i = 1; i < viewport.models.length; i++)

				// Check if model is selected
				if(viewport.models[i].glow !== null)
		
					// Update glow's view vector
					viewport.models[i].glow.material.uniforms.viewVector.value = new THREE.Vector3().subVectors(viewport.camera.position, viewport.models[i].glow.position);
		}

		// Render scene
		viewport.renderer.clear();
		viewport.renderer.render(viewport.scene[0], viewport.camera);
		viewport.renderer.clearDepth();
		viewport.renderer.render(viewport.scene[1], viewport.camera);
	}
};
