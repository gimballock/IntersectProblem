import {
    Color,
    WebGLRenderer, Scene, PerspectiveCamera,
    ConeGeometry, TorusKnotGeometry, BoxBufferGeometry, DodecahedronGeometry,
    MeshPhongMaterial, MeshNormalMaterial, LineBasicMaterial,
    Vector3, Box3, Sphere, PlaneGeometry, Group,
    DirectionalLight,
    Mesh, LineSegments,
    BoxHelper, AxesHelper,
    SphereGeometry, EdgesGeometry
} from "three";

import { DragControls } from "three/examples/jsm/controls/DragControls.js";
import { WEBGL } from 'three/examples/jsm/WebGL.js';


// --------------- CONSTANTS -----------------
// Used to print status message every <LOG_INTERVAL> seconds 
// by comparing current time to prevTime whenever render() is called
const LOG_INTERVAL = 0.5;

// Error term to decide if objects are "kissing" vs inersecting or not-intersecting
const ERROR_TERM = 0.1;

// Length of the path the secondary object traverses in it's motion loop
const PATH_LENGTH = 10

const INTERSECT_COLOR = new Color("red")
const AMBIGIOUS_COLOR = new Color("yellow")

// Global state of simulation: Are the pair of objects intersecting, not, or just touching?
const IntersectState = {
	AMBIGIOUS:    "Touching",
	NO_INTERSECT: "...",
	INTERSECT:    "Overlapping"};

// Bounding Box intersection test processes each dimenstion independently
// This enum allows the test to track the current dimension
const DIMENSION = { X:0, Y:1, Z:2 };

// Intersection test method: bounding spheres, bounding boxes, convex hulls (time permitting)
const RENDER_MODE = { 
    BOXES: "Bounding Box", 
    SPHERES: "Bounding Sphere" };

const SHAPE_CONFIGS = {
    PRIMARY: { color: 0x44aa88, position: new Vector3(2,2,5) },
    SECONDARY: { color: 0x8844aa, position: new Vector3(2,2,2) }};

// ----------------- GLOBALS -------------------

// Basic scene objects
let renderer, scene, camera;

// Current render-mode & intersect test
let mode = RENDER_MODE.BOXES;

// For regular status-logs, this tracks the time of the last log msg
let prevTime = 0

// map of wireframe objects by type: spheres, boxes, convex-hulls
let wireframes = new Map();
for( let currModeName in RENDER_MODE) {
    // initialize an empty map to hold wireframe models for each render mode
    wireframes.set(RENDER_MODE[currModeName], new Map()); }

// References to meshs for the two objects
let primaryObj, secondaryObj;


/**
 * Create xy, yz, zx unit planes and the three axies
 */
function initAxiesAndPlanes() {
    const planeSize = 9
    const planeGeom = new PlaneGeometry(planeSize, planeSize)
    const planeMaterial = new MeshPhongMaterial({ color: new Color("lightgrey")})

    const planeObjs = [
        new Mesh(planeGeom, planeMaterial), 
        new Mesh(planeGeom, planeMaterial), 
        new Mesh(planeGeom, planeMaterial)];

    planeObjs[0].translateX(planeSize/2)
                .translateY(planeSize/2);

    planeObjs[1].translateY(planeSize/2)
                .translateZ(planeSize/2)
                .rotateY(Math.PI / 2);

    planeObjs[2].translateX(planeSize/2)
                .translateZ(planeSize/2)
                .rotateX(-Math.PI / 2);
    
    planeObjs.forEach(planeObj => scene.add(planeObj));

    // Draw the 3 axes, make them extend out a little further than the 3 walls
    scene.add( new AxesHelper(planeSize + 1) );
}

/**
 * Create associated wireframe box and sphere
 * @param {Mesh} objMesh 
 */
function createWireframes(objMesh) {
    // Generate and save the box wireframe in case we use that render mode
    let wireframeBoxMesh = new BoxHelper( objMesh );
    
    // Generate and save the sphere wireframe in case we use that render mode
    objMesh.geometry.computeBoundingSphere();
    const boundingSphere = objMesh.geometry.boundingSphere
    const sphereGeometry = new SphereGeometry(boundingSphere.radius, 8, 6);
    const wireframeSphereMesh = new LineSegments(
        new EdgesGeometry(sphereGeometry, 1), 
        new LineBasicMaterial({color: new Color("yellow")}));
    wireframeSphereMesh.position.copy(objMesh.position)

    wireframes.get(RENDER_MODE.BOXES).set(objMesh, wireframeBoxMesh);
    wireframes.get(RENDER_MODE.SPHERES).set(objMesh, wireframeSphereMesh);

    scene.add(objMesh);
    scene.add(wireframeBoxMesh);
    scene.add(wireframeSphereMesh);

    // Update scene graph to show correct wireframe models
    for(const currModeName in RENDER_MODE) {
        const currMode = RENDER_MODE[currModeName];
        const wf = wireframes.get(currMode).get(objMesh)
        wf.visible = (currMode == mode);}
}

/**
 * Add 3d primitive geometry to the scene using default material, also create associated wireframes
 * @param {*} geometry Primitive shape
 * @param {*} color Initial color
 * @param {*} position Initial position
 * @returns {Mesh} geometry + material
 */
function makeInstance(geometry, color, position) {    
    const material = new MeshPhongMaterial({ color: color });
    const objMesh = new Mesh(geometry, material);
    objMesh.position.copy(position);

    createWireframes(objMesh)
    
    return objMesh;
}

/**
 * Setup the THREE.js environment to render content to the screen: 
 *   renderer, scene, camera, light, axies, walls and the two objects
 * Also allow primaryObject to be dragged around the ground plane with the mouse
 */
function init() {
    // Test for WEBGL availability
    if (!WEBGL.isWebGLAvailable()) {
        const warning = WEBGL.getWebGLErrorMessage();
        document.getElementById('container').appendChild(warning);
        return;
    }
    
    // Setup the renderer and scene
    renderer = new WebGLRenderer();
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.setPixelRatio( window.devicePixelRatio );
    document.body.appendChild( renderer.domElement );

    scene = new Scene();


    // Setup the camera
    camera = new PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 0.1, 100 );
    camera.position.set( 10, 10, 10 );
    camera.lookAt( scene.position );

    camera.position.z = 15;

    // Create a light
    const color = 0xFFFFFF;
    const intensity = 1;
    const light = new DirectionalLight(color, intensity);
    light.position.set(10, 8, 6);
    scene.add(light);

    // By default a Plane object is spanned by the XZ axes
    initAxiesAndPlanes();
    

    // Create primary and secondary objects
    primaryObj = makeInstance(
        new TorusKnotGeometry(), 
        SHAPE_CONFIGS.PRIMARY.color, 
        SHAPE_CONFIGS.PRIMARY.position);

    secondaryObj = makeInstance(
        new DodecahedronGeometry(), //ConeGeometry(), 
        SHAPE_CONFIGS.SECONDARY.color, 
        SHAPE_CONFIGS.SECONDARY.position)


    // Enable secondary object to be dragged around
    const controls = new DragControls( [ primaryObj ], camera, renderer.domElement );
    controls.addEventListener( 'drag', (event) => {
        // restrict mouse dragging to the floor plane (xz-plane actually)
        primaryObj.position.y = SHAPE_CONFIGS.PRIMARY.position.y
    } );
}

/**
 * Sets the associated wireframe box of the provided object to the object's position
 * @param {Object3D} objMesh Either primary or secondary object
 */
function updateBoundingBox(objMesh) {
    const boxes = wireframes.get(RENDER_MODE.BOXES)
    boxes.get(objMesh).update()
}

/**
 * Sets the associated wireframe sphere of the provided object to the object's position
 * @param {Object3D} objMesh Either primary or secondary object
 */
function updateBoundingSphere(objMesh) {
    const spheres = wireframes.get(RENDER_MODE.SPHERES);
    objMesh.getWorldPosition(spheres.get(objMesh).position)
}

/**
 * Update the position and orientation of the elements in the scene
 * @param {float} time seconds since start of program
 */
function updateScene(time) {    
    // update rotation
    const speed = 1.1;
    const rot = time * speed;

    // to show how the bounding shapes change over time
    primaryObj.rotation.x = rot;
    primaryObj.rotation.y = rot;

    // secondaryObj.rotation.x = -rot;
    // secondaryObj.rotation.y = -rot;

    // update positions
    let t = time % PATH_LENGTH;
    let target = t;
    secondaryObj.position.z = target;

    // update wireframes
    if(mode == RENDER_MODE.BOXES) {
        updateBoundingBox(primaryObj)
        updateBoundingBox(secondaryObj)}

    else if(mode == RENDER_MODE.SPHERES) {
        updateBoundingSphere(primaryObj)
        updateBoundingSphere(secondaryObj)}
}

/**
 * Helper function for sphereIntersect that allows for unit testing
 * @param {*} center1 sphere1's center
 * @param {*} center2 sphere2's center
 * @param {*} radius1 sphere1's radius
 * @param {*} radius2 sphere2's radius
 * @returns {IntersectState} whether the spheres touch or overlap or neither
 */
function sphereIntersectHelper(center1, center2, radius1, radius2) {
    let intersectState = IntersectState.INTERSECT

    let distance = center1.distanceTo(center2)
    let radiusSum = radius1 + radius2
    let termDiff = distance - radiusSum 

    // Special case: zero distance spheres of any radius must intersect
    if( distance < ERROR_TERM )
        intersectState = IntersectState.INTERSECT;
    
    // With non-zero distance minus both radii equals zero (approx) if they are just touching
    else if( Math.abs(termDiff) < ERROR_TERM )
        intersectState = IntersectState.AMBIGIOUS;
    
    // If distance is greater than the sum of the radii then the spheres are not touching
    else if( termDiff > 0 )
        intersectState = IntersectState.NO_INTERSECT;
    
    // Otherwise the distance is less than the sum of the radii so the spheres are intersecting
    // else intersectState = IntersectState.INTERSECT; <-- default value

    return intersectState
}

/**
 * Compute whether the primary and secondary spheres intersect, touch, or are completly disconnected from each other.
 * @returns {IntersectState} whether the spheres touch or overlap or neither
 */
function sphereIntersect() {
    const bs1 = (new Sphere()).copy(primaryObj.geometry.boundingSphere)
        .applyMatrix4( primaryObj.matrixWorld );
    const bs2 = (new Sphere()).copy(secondaryObj.geometry.boundingSphere)
        .applyMatrix4( secondaryObj.matrixWorld );
    
    const intersectState = sphereIntersectHelper(bs1.center, bs2.center, bs1.radius, bs2.radius)
    return intersectState;
}

/**
 * Helper function for the overall AABB intersection test resolves the intersection status for a specific dimension.
 * @param {float} bb1Min Distance from origin of minimum point of bounding box 1 (point closest to the origin)
 * @param {float} bb2Min Distance from origin of minimum point of bounding box 2 (point closest to the origin)
 * @param {float} bb1Size Size of bounding box 1
 * @param {float} bb2Size Size of bounding box 2
 * @returns {IntersectState} whether the boxes intersect or not in the specified dimension
 */
function partialBoxIntersect(bb1Min, bb2Min, bb1Size, bb2Size) {
    let dimState = IntersectState.INTERSECT

    // A) Special case: Coincident corresponding verticies (e.g. both bottom-left verticies match)
    //    - if a box's dimension is zero  --> ambigious           [[]----------]
    //    - else                          --> intersecting        [[------]----]
    // Note: If both boxes have zero width then just touching means the same thing as intersecting!
    let isCoincident = (bb1Min == bb2Min)
    let isExactOverlap = isCoincident && (bb1Size == bb2Size)
    let isDegenerate = (bb1Size <= ERROR_TERM) || (bb2Size <= ERROR_TERM)
    
    if(isExactOverlap)
        dimState = IntersectState.INTERSECT;
    
    else if(isCoincident)
        dimState = isDegenerate 
            ? IntersectState.AMBIGIOUS   // same start and one has no range --> just touching edge of other box
            : IntersectState.INTERSECT;  // same start and both have non-zero range --> intersecting

    // B) Normal case: Ranges for the closer box and the further box have different start points
    //   AMBIGIOUS:  Width of closer box is equal to the distance to start of the other box  [-----][-----] 
    //   INTERSECT:  The distance away is less then the width of the closer box.             [----[===]---]
    //   NO-INTERSECT: The distance away is more then the width of the closer box.           [----]   [---]
    else {
        // 1) Rename box1 and box2 as nearBox and farBox since we know they are not the same location
        let [nearBoxMin, farBoxMin] = Math.abs(bb1Min) < Math.abs(bb2Min) ? [bb1Min, bb2Min] : [bb2Min, bb1Min]
            
        // 2) Note distance between boxes AND width of nearest box
        let nearBoxLen = (nearBoxMin == bb1Min) ? bb1Size : bb2Size
        let distance = Math.abs(farBoxMin - nearBoxMin) // equivalently to using max point
        
        // 3) Compare [distance between boxes] vs [width of the closer box]
        let termDiff = distance - nearBoxLen
        if( Math.abs(termDiff) < ERROR_TERM )
            dimState = IntersectState.AMBIGIOUS;
        else if( termDiff > 0)
            dimState = IntersectState.NO_INTERSECT;
        // else dimState = IntersectState.INTERSECT; <-- default value
    }

    return dimState
}

/**
 * Dimensionless intersection test used as a helper for boxIntersect
 *  To combine the vertical and horizontal intersections use the following table:
 * 
 *                    vertical
 * horizontal           | ambigious        | intersecting     | non-intersecting
 *     -----------------+------------------+------------------+------------------
 *     ambigious        | ambigious        | ambigious        | non-intersecting
 *     -----------------+------------------+------------------+------------------
 *     intersecting     | ambigious        | intersecting     | non-intersecting
 *     -----------------+------------------+------------------+------------------
 *     non-intersecting | non-intersecting | non-intersecting | non-intersecting
 *
 * Combine the dimensional box states to get the overall box state:
 * - if any dimension is non-intersecting then the overall state is non-intersecting
 * - otherwise if any dimension is ambigious then the overall state is ambigious
 * - finally all dimensions must be intersecting so overall is intersecting
 * 
 * @param {*} perDimensionStatus 
 * @returns {IntersectState} intersectedness (if that's a word)
 */
function combinePartialBoxIntersects(perDimensionStatus) {
    let overallBoxState = IntersectState.INTERSECT
    for (const dimState of perDimensionStatus){
        // Any non-intersecting dimension short-circuits the overall calculation 
        if(dimState == IntersectState.NO_INTERSECT) {
            overallBoxState = IntersectState.NO_INTERSECT
            break; }

        // Any ambigious status (assuming no non-intersecting statuses) becomes the overall status 
        const isAlreadyAmbigious = (overallBoxState == IntersectState.AMBIGIOUS)
        if(!isAlreadyAmbigious && dimState == IntersectState.AMBIGIOUS)
            overallBoxState = IntersectState.AMBIGIOUS;
    }
    return overallBoxState
}

/**
 * Compute whether the primary and secondary boxes intersect, touch, or are completly disconnected from each other.
 * @returns {IntersectState} 3d connectedness between the two boxes
 */
function boxIntersect() {
    let perDimensionStatus = new Array(3)
    
    //TODO: (HACK) I can't quite figure out how to get the size and verticies 
    //      from the BoxHelper object so i'm creating a Box3 object here.
    // Box3 objects are 3D cubes, they have 8 verticies but the THREE.js object stores:
    // - .min (Vertex3): the point closest to the origin
    // - .max (Vertex3): furtherest from the origin
    // - .getSize() (Vertex3): the <width, height, depth> of the cube.
    // Note: The other 6 points can be obtained by combining the x,y,z components of the min and max points
    const bb1 = (new Box3()).copy( primaryObj.geometry.boundingBox )
                            .applyMatrix4( primaryObj.matrixWorld );
    const bb2 = (new Box3()).copy( secondaryObj.geometry.boundingBox )
                            .applyMatrix4( secondaryObj.matrixWorld );

    // Vector of width, height, depth for each box
    const bb1Sizes = bb1.getSize(new Vector3())
    const bb2Sizes = bb2.getSize(new Vector3())

    // Compute a per-dimension intersect status then combine them at the end
    for (const dimName in DIMENSION) {
        const dimIdx = DIMENSION[dimName];
        const [bb1Min, bb2Min] = [bb1.min.getComponent(dimIdx), bb2.min.getComponent(dimIdx)];
        const [bb1Size, bb2Size] = [bb1Sizes.getComponent(dimIdx), bb2Sizes.getComponent(dimIdx)];

        // Pass in the "min" point and the "width" of both boxes and save the resulting assesment
        perDimensionStatus[dimIdx] = partialBoxIntersect(bb1Min, bb2Min, bb1Size, bb2Size);
    }

    let overallBoxState = combinePartialBoxIntersects(perDimensionStatus);

    // If neither NO_INTERSECT or AMBIGIOUS are found then the result is INTERSECT which is the default
    return overallBoxState;
}

/**
 * Changes the shape color based on if it's intersect state
 * @param {Color} originalColor, used if state is non-intersecting
 * @param {IntersectState} state
 * @returns {Color} the new color
 */
function getIntersectColor(originalColor, state) {
    if (state == IntersectState.NO_INTERSECT)
        return originalColor;
    else 
        return (state == IntersectState.INTERSECT) 
            ? INTERSECT_COLOR : AMBIGIOUS_COLOR
}

/**
 * Renders the scene by calling renderer.render, called by requestAnimationFrame(render)
 * @param {float} time thousandths of a second since start of program
 */
function render(time) {
    time *= 0.001;  // convert time to seconds

    updateScene(time)
    
    // process intersections
    let state = IntersectState.INTERSECT;
    if(mode == RENDER_MODE.SPHERES)
        state = sphereIntersect();
    else if(mode == RENDER_MODE.BOXES)
        state = boxIntersect();

    // Set the object colors based on the intersect results
    let [primaryColor, secondaryColor] = [
        getIntersectColor(SHAPE_CONFIGS.PRIMARY.color, state), 
        getIntersectColor(SHAPE_CONFIGS.SECONDARY.color, state)]
    primaryObj.material.color.set(primaryColor);
    secondaryObj.material.color.set(secondaryColor);

    // Log result to console
    console.log(Math.trunc(time), mode, state);

    // draw scene
    renderer.render(scene, camera);

    // request next frame
    requestAnimationFrame(render);
}


// ----------
//   tests
// ----------

// Degenerate spheres
const degenerate_sphere_test = sphereIntersectHelper(new Vector3(0,0,0), new Vector3(0,0,0), 0, 0) == IntersectState.INTERSECT
console.assert( degenerate_sphere_test, "Degenerate spheres should intersect");

// Test error threshold and different sizes
const overlapping_sphere_test = sphereIntersectHelper(new Vector3(10,10,10), new Vector3(10,10,10), 0, 0) == IntersectState.INTERSECT
    && sphereIntersectHelper(new Vector3(10,10,10), new Vector3(10,10,10+(ERROR_TERM/2)), 10, 100) == IntersectState.INTERSECT
console.assert( overlapping_sphere_test, "Overlapping spheres should intersect");

// Check a regular sphere against a degenerate sphere as the first and second object
const one_degenerate_sphere_test = sphereIntersectHelper(new Vector3(0,0,0), new Vector3(1,0,0), 1, 0) == IntersectState.AMBIGIOUS
    && sphereIntersectHelper(new Vector3(0,0,0), new Vector3(0,2,0), 0, 2) == IntersectState.AMBIGIOUS
    && sphereIntersectHelper(new Vector3(0,2,0), new Vector3(0,4,0), 2, 0) == IntersectState.AMBIGIOUS;
console.assert( one_degenerate_sphere_test, "Touching spheres should be ambigious");

const no_intersect_sphere_test = sphereIntersectHelper(new Vector3(0,0,0), new Vector3(3,0,0), 1, 1) == IntersectState.NO_INTERSECT;
console.assert( no_intersect_sphere_test, "Spheres seperated should not intersect");

// Check error term and different sizes
const perfect_intersect_sphere_test = sphereIntersectHelper(new Vector3(1,1,1), new Vector3(1,1,1), 1, 1) == IntersectState.INTERSECT
    && sphereIntersectHelper(new Vector3(0,0,0), new Vector3(0,0+(ERROR_TERM/2,0), 2, 20) == IntersectState.INTERSECT);
console.assert( perfect_intersect_sphere_test, "Spheres seperated should not intersect");

// Check half overlap and full eclipse
const intersect_sphere_test = sphereIntersectHelper(new Vector3(1,1,1), new Vector3(1,1,2), 1, 1) == IntersectState.INTERSECT
    && sphereIntersectHelper(new Vector3(0,0,0), new Vector3(1,0+(ERROR_TERM/2,0), 2, 20) == IntersectState.INTERSECT);
console.assert( intersect_sphere_test, "Spheres seperated should not intersect");




// Arguably this could be either ambigious or interecting but i have to pick one
const both_degenerate_and_overlapping_test = partialBoxIntersect(0,0,0,0) == IntersectState.INTERSECT
console.assert( both_degenerate_and_overlapping_test, "Overlapping squares both degenerate should intersect");

// relabeling box1 and box2 as closerBox and furtherBox should give these two expressions the same result 
const both_degenerate_test = (partialBoxIntersect(0,100,0,0) == IntersectState.NO_INTERSECT)
                        && (partialBoxIntersect(1.5,0,0,0) == IntersectState.NO_INTERSECT)
console.assert( both_degenerate_test, "Degenerate non-overlapping squares should not intersect");

// relabeling box1 and box2 as closerBox and furtherBox should give these two expressions the same result also
const connected_degenerate_test  = (partialBoxIntersect(0,0,1,0) == IntersectState.AMBIGIOUS)
                              && (partialBoxIntersect(3,3,0,10.5) == IntersectState.AMBIGIOUS)
                              && (partialBoxIntersect(5,15,10,0) == IntersectState.AMBIGIOUS); // 5+10 = 15+0
console.assert( connected_degenerate_test, "A point connected to a box should be ambigious");

// check overlapping from origin, off origin and w/ floats
const perfect_overlap_test = (partialBoxIntersect(0,0,1,1) == IntersectState.INTERSECT)
                        && (partialBoxIntersect(1,1,10,10) == IntersectState.INTERSECT)
                        && (partialBoxIntersect(5.1,5.1,10.1,10.1) == IntersectState.INTERSECT);
console.assert( perfect_overlap_test, "Perfectly overlapping squares should intersect");

const non_intersect_test = (partialBoxIntersect(0,2,1,1) == IntersectState.NO_INTERSECT)
                        && (partialBoxIntersect(2,0,1.5,1.5) == IntersectState.NO_INTERSECT)
                        && (partialBoxIntersect(5,10,0,0) == IntersectState.NO_INTERSECT);
console.assert( non_intersect_test, "Non-intersecting boxes should not intersect");

const ambigious_test = (partialBoxIntersect(0,2.1,2.1,100) == IntersectState.AMBIGIOUS)
                    && (partialBoxIntersect(2,0,100,2) == IntersectState.AMBIGIOUS)
                    && (partialBoxIntersect(5,10,5,5) == IntersectState.AMBIGIOUS);
console.assert( ambigious_test, "Touching boxes should be ambigious");

const intersect_test = (partialBoxIntersect(0,50,100,100) == IntersectState.INTERSECT)
                    && (partialBoxIntersect(5,55,105,105) == IntersectState.INTERSECT)
                    && (partialBoxIntersect(0,25,100,50) == IntersectState.INTERSECT);
console.assert( intersect_test, "Overlapping boxes should intersect");

// test 3 no-intersects, 2 no-intersects, 1 no-intersect
const combined_no_intersect_test =
    // 3 NO_INTERSECT
    combinePartialBoxIntersects([IntersectState.NO_INTERSECT,IntersectState.NO_INTERSECT,IntersectState.NO_INTERSECT]) == IntersectState.NO_INTERSECT

    // 2 NO_INTERSECT + 1 INTERSECT
    && combinePartialBoxIntersects([IntersectState.INTERSECT,IntersectState.NO_INTERSECT,IntersectState.NO_INTERSECT]) == IntersectState.NO_INTERSECT
    && combinePartialBoxIntersects([IntersectState.NO_INTERSECT,IntersectState.INTERSECT,IntersectState.NO_INTERSECT]) == IntersectState.NO_INTERSECT
    && combinePartialBoxIntersects([IntersectState.NO_INTERSECT,IntersectState.NO_INTERSECT,IntersectState.INTERSECT]) == IntersectState.NO_INTERSECT

    // 2 NO_INTERSECT + 1 AMBIGIOUS
    && combinePartialBoxIntersects([IntersectState.AMBIGIOUS,IntersectState.NO_INTERSECT,IntersectState.NO_INTERSECT]) == IntersectState.NO_INTERSECT
    && combinePartialBoxIntersects([IntersectState.NO_INTERSECT,IntersectState.AMBIGIOUS,IntersectState.NO_INTERSECT]) == IntersectState.NO_INTERSECT
    && combinePartialBoxIntersects([IntersectState.NO_INTERSECT,IntersectState.NO_INTERSECT,IntersectState.AMBIGIOUS]) == IntersectState.NO_INTERSECT

    // 1 NO_INTERSECT + 2 INTERSECT
    && combinePartialBoxIntersects([IntersectState.NO_INTERSECT,IntersectState.INTERSECT,IntersectState.INTERSECT]) == IntersectState.NO_INTERSECT
    && combinePartialBoxIntersects([IntersectState.INTERSECT,IntersectState.NO_INTERSECT,IntersectState.INTERSECT]) == IntersectState.NO_INTERSECT
    && combinePartialBoxIntersects([IntersectState.INTERSECT,IntersectState.INTERSECT,IntersectState.NO_INTERSECT]) == IntersectState.NO_INTERSECT

    // 1 NO_INTERSECT + 2 AMBIGIOUS
    && combinePartialBoxIntersects([IntersectState.NO_INTERSECT,IntersectState.AMBIGIOUS,IntersectState.AMBIGIOUS]) == IntersectState.NO_INTERSECT
    && combinePartialBoxIntersects([IntersectState.AMBIGIOUS,IntersectState.NO_INTERSECT,IntersectState.AMBIGIOUS]) == IntersectState.NO_INTERSECT
    && combinePartialBoxIntersects([IntersectState.AMBIGIOUS,IntersectState.AMBIGIOUS,IntersectState.NO_INTERSECT]) == IntersectState.NO_INTERSECT;
console.assert( combined_no_intersect_test, "Any non-intersection should be no intersection overall");

const combined_ambigious_test =
    // 3 AMBIGIOUS
    combinePartialBoxIntersects([IntersectState.AMBIGIOUS,IntersectState.AMBIGIOUS,IntersectState.AMBIGIOUS]) == IntersectState.AMBIGIOUS

    // 2 AMBIGIOUS + 1 INTERSECT
    && combinePartialBoxIntersects([IntersectState.INTERSECT,IntersectState.AMBIGIOUS,IntersectState.AMBIGIOUS]) == IntersectState.AMBIGIOUS
    && combinePartialBoxIntersects([IntersectState.AMBIGIOUS,IntersectState.INTERSECT,IntersectState.AMBIGIOUS]) == IntersectState.AMBIGIOUS
    && combinePartialBoxIntersects([IntersectState.AMBIGIOUS,IntersectState.AMBIGIOUS,IntersectState.INTERSECT]) == IntersectState.AMBIGIOUS
    
    // 1 AMBIGIOUS + 2 INTERSECT
    && combinePartialBoxIntersects([IntersectState.AMBIGIOUS,IntersectState.INTERSECT,IntersectState.INTERSECT]) == IntersectState.AMBIGIOUS
    && combinePartialBoxIntersects([IntersectState.INTERSECT,IntersectState.AMBIGIOUS,IntersectState.INTERSECT]) == IntersectState.AMBIGIOUS
    && combinePartialBoxIntersects([IntersectState.INTERSECT,IntersectState.INTERSECT,IntersectState.AMBIGIOUS]) == IntersectState.AMBIGIOUS;
console.assert( combined_no_intersect_test, "Any ambigious w/ no non-intersections should be ambigious overall");

const combined_intersect_test =
    // 3 INTERSECT
    combinePartialBoxIntersects([IntersectState.INTERSECT,IntersectState.INTERSECT,IntersectState.INTERSECT]) == IntersectState.INTERSECT;
console.assert( combined_intersect_test, "Combined intersects should be intersecting");

console.log("tests complete")

//---------------------------

init()

// request initial frame
requestAnimationFrame(render);