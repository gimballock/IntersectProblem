import {
    Color,
    WebGLRenderer, Scene, PerspectiveCamera,
    TorusKnotGeometry, DodecahedronGeometry,
    MeshPhongMaterial, LineBasicMaterial,
    Vector3, Box3, Sphere, PlaneGeometry, ConvexGeometry,
    DirectionalLight,
    Mesh, LineSegments,
    BoxHelper, AxesHelper,
    SphereGeometry, EdgesGeometry
} from "three";

import { DragControls } from "three/examples/jsm/controls/DragControls.js";
import { WEBGL } from 'three/examples/jsm/WebGL.js';


// --------------- CONSTANTS -----------------

// Error term to decide if objects are "kissing" vs intersecting or not-intersecting
const ERROR_TERM = 0.01;

// Length of the path the secondary object traverses in it's motion loop
const PATH_LENGTH = 10

const INTERSECT_COLOR = new Color("red")
const AMBIGIOUS_COLOR = new Color("yellow")

// Global state of simulation: Are the pair of objects intersecting, not, or just touching?
const IntersectState = {
	AMBIGUOUS:    "Touching",
	NO_INTERSECT: "...",
	INTERSECT:    "Overlapping"};

// Used for dimensionless box calculations
const InnerIntersectState = {
    TO: "Touching from the outside",
    TI: "Touching from the inside",
    NTO: "Not touching from the outside",
    NTI: "Not touching from the inside",
      I: "Intersecting"
};

// Bounding Box intersection test processes each dimension independently
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
let mode = RENDER_MODE.SPHERES;

// map of wireframe objects by type: spheres, boxes, convex-hulls
let wireframes = new Map();
for( let currModeName in RENDER_MODE) {
    // initialize an empty map to hold wireframe models for each render mode
    wireframes.set(RENDER_MODE[currModeName], new Map()); }

// References to meshes of the two objects
let primaryObj, secondaryObj;


/**
 * Create xy, yz, zx unit planes and the three axis
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
 * We have wirframe meshes for each mode of each of the two objects. When the 
 * render mode changes we must toggle the 'visible' flag of every one of these 
 * meshes.
 */
function updateWireframes() {
    [primaryObj, secondaryObj].forEach( objMesh => {
        Object.values(RENDER_MODE).forEach(currMode => {
            const wf = wireframes.get(currMode).get(objMesh)
            wf.visible = (currMode == mode) 
        })
    })
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
 * For the RENDER_MODE list return the value succeeding the one saved to 'mode' by the specified offset.
 * IE offset = 1 returns the next element, offset = -1 returns the previous element.
 * @param {Integer} offset How far in the list of RENDER_MODES to increment by
 * @returns offset = 1 returns the next element
 *          offset = -1 returns the previous element
 */
function changeRenderMode(offset) {
    const modeValues = Object.values(RENDER_MODE)
    let nextModeIdx = (modeValues.indexOf(mode) + offset) % modeValues.length

    // mod can produce negative values from [-length, 0] if provided a negative offset
    // So add length to the result to shift the answer back to the [0, length] range
    if(nextModeIdx < 0)
        nextModeIdx += modeValues.length
    
    return modeValues[nextModeIdx];
}

/**
 * Keyboard event callback function used to process RENDER_MODE toggling.
 * Capture the p/n keys, update the render mode and switch wireframe models.
 * @param {THREE.js event object} event 
 * @returns null
 */
function onDocumentKeyDown(event) {
    let nextMode = () => { return changeRenderMode(1) }
    let prevMode = () => { return changeRenderMode(-1) }
    let keyCode = event.which;
    
    if (keyCode == 78)           // 'n' = 78
        mode = nextMode();
    else if (keyCode == 80)      // 'p' = 80
        mode = prevMode();
    else return
    console.log(keyCode == 78 ? "Next" : "Previous", "intersect mode:", mode);
    
    updateWireframes();
};

/**
 * Setup the THREE.js environment to render content to the screen: 
 *   renderer, scene, camera, light, axis, walls and the two objects
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

    // var hullGeometry = new THREE.ConvexGeometry(points);
    // hullMesh = createMesh(hullGeometry);
    // scene.add(hullMesh);
    
    // Update scene graph to show correct wireframe models
    updateWireframes()

    // Enable secondary object to be dragged around
    const controls = new DragControls( [ primaryObj ], camera, renderer.domElement );
    controls.addEventListener( 'drag', (event) => {
        // restrict mouse dragging to the floor plane (xz-plane actually)
        primaryObj.position.y = SHAPE_CONFIGS.PRIMARY.position.y
    } );

    document.addEventListener("keydown", onDocumentKeyDown, false);
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
 * @param {*} d distance between spheres
 * @param {*} radius1 sphere1's radius
 * @param {*} radius2 sphere2's radius
 * @returns {IntersectState} whether the spheres touch or overlap or neither
 */
function sphereIntersectHelper(d, radius1, radius2) {
    let radiiSum = radius1 + radius2
    let radiiDiff = Math.abs(radius1 - radius2)
    let isTouchingOutside = (Math.abs(d - radiiSum) <= ERROR_TERM)  // ()(  )
    let isTouchingInside = (Math.abs(d - radiiDiff) <= ERROR_TERM)  // ( ( ))
    
    if(isTouchingOutside || isTouchingInside)
        return IntersectState.AMBIGUOUS;

    // spheres are disconnected from inside or outside:   ( () )  OR  ()  ( )
    if(d > radiiSum || d < radiiDiff)
        return IntersectState.NO_INTERSECT;

    // Finally it must be that: radiiDiff < d < radiiSum
    return IntersectState.INTERSECT;
}

/**
 * Compute whether the primary and secondary spheres intersect, touch, or are completely disconnected from each other.
 * @returns {IntersectState} whether the spheres touch or overlap or neither
 */
function sphereIntersect() {
    const bs1 = (new Sphere()).copy(primaryObj.geometry.boundingSphere)
        .applyMatrix4( primaryObj.matrixWorld );
    const bs2 = (new Sphere()).copy(secondaryObj.geometry.boundingSphere)
        .applyMatrix4( secondaryObj.matrixWorld );
    
    const dist = bs1.center.distanceTo(bs2.center);
    const intersectState = sphereIntersectHelper(dist, bs1.radius, bs2.radius)
    return intersectState;
}

/**
 * Helper function for the overall AABB intersection test resolves the intersection status for a specific dimension.
 * 
 *  Touching from the outside (TO)
 *      |    +--+----+   min_1 + size_1 = min_2
 *
 *  Touching from the inside (TI)
 *      |    +--+=====+   min_1 + size_1 = min_2 + size_2
 *  OR
 *      |    +====+---+   min_1 = min_2 && size_1 != size_2
 *
 *  Not touching from the outside (NTO)
 *      |    +--+ +---+   min_1 + size_1 < min_2
 *
 *  Not touching from the inside (NTI)
 *      |    +--+==+--+   min_1 + size_1 > min_2  &&  size_1 > size_2
 * 
 *  Intersect
 *      |    +-----+      min_1 + size_1 > min_2  &&  size_1 < size_2
 *      |       +-----+
 *
 * @param {float} bb1Min Distance from origin of minimum point of bounding box 1 (point closest to the origin)
 * @param {float} bb2Min Distance from origin of minimum point of bounding box 2 (point closest to the origin)
 * @param {float} bb1Size Size of bounding box 1
 * @param {float} bb2Size Size of bounding box 2
 * @returns {InnerIntersectState} whether the boxes intersect or not in the specified dimension
 */
function partialBoxIntersect(bb1Min, bb2Min, bb1Size, bb2Size) {

    // Rename inputs as nearBox and farBox, nearSize and farSize
    const [nearMin, farMin, nearLen, farLen] = Math.abs(bb1Min) < Math.abs(bb2Min) 
        ? [bb1Min, bb2Min, bb1Size, bb2Size] 
        : [bb2Min, bb1Min, bb2Size, bb1Size]

    const d = Math.abs(bb2Min - bb1Min)           // distance between min points
    const sizeDiff = Math.abs(bb2Size - bb1Size)  // difference between sizes

    const insideLeftTouch  = (d <= ERROR_TERM) && (sizeDiff > ERROR_TERM)  // starts are left aligned
    const insideRightTouch = nearMin + nearLen == farMin +  farLen         // ends are right aligned

    if( insideLeftTouch || insideRightTouch )
        return InnerIntersectState.TI
        
    if( Math.abs(d - nearLen) <= ERROR_TERM )
        return InnerIntersectState.TO

    if( d > nearLen ) 
        return InnerIntersectState.NTO
        
    if( nearLen > farLen)
        return InnerIntersectState.NTI
    
    return InnerIntersectState.I
}

/**
 *       | nto |  to |   i|  ti | nti 
 *   ---------------------------------
 *   nto | nto | nto | nto| nto | nto 
 *    to | nto |  to |  to|  to |  to 
 *     i | nto |  to |   i|   i |   i 
 *    ti | nto |  to |   i|  ti |  ti 
 *   nti | nto |  to |   i|  ti | nti 
 *  
 *  These conver to the overall state like this:
 *  nto, nti --> NO_INTERSECT
 *  to, ti   --> AMBIGUOUS
 *  i        --> INTERSECT
 * 
 *  These actually condense down into a couple simple rules: 
 *  The algorithm:
 *  1. If any dimension is NTO                   --> NO_INTERSECT
 *  2. else if any dim is TO                     --> AMBIGUOUS
 *  3. else if any dim is I                      --> INTERSECT
 *  4. else if any dimension is TI               --> AMBIGUOUS
 *  5. else all dimension must be NTI            --> NO_INTERSECT
 * 
 * @param {InnerIntersectState} perDimensionStatus 
 * @returns 
 */
function combinePartialBoxIntersects(perDimensionStatus) {
    if( perDimensionStatus[0] == InnerIntersectState.NTO 
        || perDimensionStatus[1] == InnerIntersectState.NTO
        || perDimensionStatus[2] == InnerIntersectState.NTO )
        return IntersectState.NO_INTERSECT;
    
    if( perDimensionStatus[0] == InnerIntersectState.TO 
        || perDimensionStatus[1] == InnerIntersectState.TO
        || perDimensionStatus[2] == InnerIntersectState.TO )
        return IntersectState.AMBIGUOUS;

    if( perDimensionStatus[0] == InnerIntersectState.I
        || perDimensionStatus[1] == InnerIntersectState.I
        || perDimensionStatus[2] == InnerIntersectState.I )
        return IntersectState.INTERSECT;
    
    if( perDimensionStatus[0] == InnerIntersectState.TI
        || perDimensionStatus[1] == InnerIntersectState.TI
        || perDimensionStatus[2] == InnerIntersectState.TI )
        return IntersectState.AMBIGUOUS;

    return IntersectState.NO_INTERSECT;
}

// function partialBoxIntersect(bb1Min, bb2Min, bb1Size, bb2Size) {
//     let dimState = IntersectState.INTERSECT

//     // A) Special case: Coincident corresponding vertices (e.g. both bottom-left vertices match)
//     //    - if a box's dimension is zero  --> ambiguous           [[]----------]
//     //    - else                          --> intersecting        [[------]----]
//     // Note: If both boxes have zero width then just touching means the same thing as intersecting!
//     let isCoincident = (bb1Min == bb2Min)
//     let isExactOverlap = isCoincident && (bb1Size == bb2Size)
//     let isDegenerate = (bb1Size <= ERROR_TERM) || (bb2Size <= ERROR_TERM)
    
//     if(isExactOverlap)
//         dimState = IntersectState.AMBIGUOUS;
    
//     else if(isCoincident)
//         dimState = IntersectState.AMBIGUOUS;  // same start and both have non-zero range --> intersecting

//     // B) Normal case: Ranges for the closer box and the further box have different start points
//     //   AMBIGUOUS:  Width of closer box is equal to the distance to start of the other box  [-----][-----] 
//     //   INTERSECT:  The distance away is less then the width of the closer box.             [----[===]---]
//     //   NO-INTERSECT: The distance away is more then the width of the closer box.           [----]   [---]
//     else {
//         // 1) Rename box1 and box2 as nearBox and farBox since we know they are not the same location
//         let [nearBoxMin, farBoxMin] = Math.abs(bb1Min) < Math.abs(bb2Min) ? [bb1Min, bb2Min] : [bb2Min, bb1Min]
            
//         // 2) Note distance between boxes AND width of nearest box
//         let nearBoxLen = (nearBoxMin == bb1Min) ? bb1Size : bb2Size
//         let distance = Math.abs(farBoxMin - nearBoxMin) // equivalently to using max point
        
//         // 3) Compare [distance between boxes] vs [width of the closer box]
//         let termDiff = distance - nearBoxLen
//         if( Math.abs(termDiff) < ERROR_TERM )
//             dimState = IntersectState.AMBIGUOUS;
//         else if( termDiff > 0)
//             dimState = IntersectState.NO_INTERSECT;
//         // else dimState = IntersectState.INTERSECT; <-- default value
//     }

//     return dimState
// }

// /**
//  * Dimensionless intersection test used as a helper for boxIntersect
//  *  To combine the vertical and horizontal intersections use the following table:
//  * 
//  *                    vertical
//  * horizontal           | ambiguous        | intersecting     | non-intersecting
//  *     -----------------+------------------+------------------+------------------
//  *     ambiguous        | ambiguous        | ambiguous        | non-intersecting
//  *     -----------------+------------------+------------------+------------------
//  *     intersecting     | ambiguous        | intersecting     | non-intersecting
//  *     -----------------+------------------+------------------+------------------
//  *     non-intersecting | non-intersecting | non-intersecting | non-intersecting
//  *
//  * Combine the dimensional box states to get the overall box state:
//  * - if any dimension is non-intersecting then the overall state is non-intersecting
//  * - otherwise if any dimension is ambiguous then the overall state is ambiguous
//  * - finally all dimensions must be intersecting so overall is intersecting
//  * 
//  * @param {*} perDimensionStatus 
//  * @returns {IntersectState} intersectedness (if that's a word)
//  */
// function combinePartialBoxIntersects(perDimensionStatus) {
//     let overallBoxState = IntersectState.INTERSECT
//     for (const dimState of perDimensionStatus){
//         // Any non-intersecting dimension short-circuits the overall calculation 
//         if(dimState == IntersectState.NO_INTERSECT) {
//             overallBoxState = IntersectState.NO_INTERSECT
//             break; }

//         // Any ambiguous status (assuming no non-intersecting statuses) becomes the overall status 
//         const isAlreadyAmbigious = (overallBoxState == IntersectState.AMBIGUOUS)
//         if(!isAlreadyAmbigious && dimState == IntersectState.AMBIGUOUS)
//             overallBoxState = IntersectState.AMBIGUOUS;
//     }
//     return overallBoxState
// }

/**
 * Compute whether the primary and secondary boxes intersect, touch, or are completely disconnected from each other.
 * @returns {IntersectState} 3d connectedness between the two boxes
 */
function boxIntersect() {
    let perDimensionStatus = new Array(3)
    
    //TODO: (HACK) I can't quite figure out how to get the size and vertices 
    //      from the BoxHelper object so I'm creating a Box3 object here.
    // Box3 objects are 3D cubes, they have 8 vertices but the THREE.js object stores:
    // - .min (Vertex3): the point closest to the origin
    // - .max (Vertex3): further-est from the origin
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

        // Pass in the "min" point and the "width" of both boxes and save the resulting assessment
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
    console.log("", Math.trunc(time), mode, state);

    // draw scene
    renderer.render(scene, camera);

    // request next frame
    requestAnimationFrame(render);
}


// ----------
//   tests
// ----------

// // Degenerate spheres
// const degenerate_sphere_test = sphereIntersectHelper(0, 0, 0) == IntersectState.AMBIGUOUS
//     && sphereIntersectHelper(0, 0, 0) == IntersectState.AMBIGUOUS
// console.assert( degenerate_sphere_test, "Degenerate spheres should be ambiguous");

// // Same center different sizes
// const eclipse_sphere_test = sphereIntersectHelper(10+(ERROR_TERM/2), 10, 100) == IntersectState.NO_INTERSECT
//     && sphereIntersectHelper(0, 50, 50) == IntersectState.AMBIGUOUS
//     && sphereIntersectHelper(0, 0, 50) == IntersectState.NO_INTERSECT
// console.assert( eclipse_sphere_test, "Same center different sizes should not intersect, can touch if sizes match");

// // Check a regular sphere against a degenerate sphere as the first and second object
// const one_degenerate_sphere_test = sphereIntersectHelper(1, 1, 0) == IntersectState.AMBIGUOUS
//     && sphereIntersectHelper(2, 0, 2) == IntersectState.AMBIGUOUS
//     && sphereIntersectHelper(2, 2, 0) == IntersectState.AMBIGUOUS
//     && sphereIntersectHelper(2, 1.5, 0) == IntersectState.NO_INTERSECT
//     && sphereIntersectHelper(2, 2.5, 0) == IntersectState.NO_INTERSECT;
// console.assert( one_degenerate_sphere_test, "Touching spheres should be ambiguous");

// const no_intersect_sphere_test = sphereIntersectHelper(3, 1, 1) == IntersectState.NO_INTERSECT;
// console.assert( no_intersect_sphere_test, "Spheres separated should not intersect");

// // Check interior touch
// const interior_touch_sphere_test = sphereIntersectHelper(9, 10, 1) == IntersectState.AMBIGUOUS
//     && sphereIntersectHelper(9, 10, 1) == IntersectState.AMBIGUOUS;
// console.assert( interior_touch_sphere_test, "Spheres touching from inside should be anbiguous");

// // Check half overlap and full eclipse
// const intersect_sphere_test = sphereIntersectHelper(1, 1, 1) == IntersectState.INTERSECT;
// console.assert( intersect_sphere_test, "Spheres separated should not intersect");


// //---------------------------

// // point-point tests
// const pbi_point_point_overlap = partialBoxIntersect(0,0,0,0) == InnerIntersectState.TI
// console.assert( pbi_point_point_overlap, "Degenerate case should be touch-inside");

// const pbi_point_point_no_overlap = partialBoxIntersect(0,1,0,0) == InnerIntersectState.NTO
//     && partialBoxIntersect(1,0,0,0) == InnerIntersectState.NTO
// console.assert( pbi_point_point_no_overlap, "Degenerate case should be no-touch-outside");

// // point-line tests
// const pbi_point_line_touching = partialBoxIntersect(0,0,1,0) == InnerIntersectState.TI
//                        && partialBoxIntersect(0,0,0,1) == InnerIntersectState.TI
//                        && partialBoxIntersect(0,1,1,0) == InnerIntersectState.TI
//                        && partialBoxIntersect(1,0,0,1) == InnerIntersectState.TI
// console.assert( pbi_point_line_touching, "Point on ends of range should be touch-inside");

// const pbi_point_line_not_touching_out = partialBoxIntersect(1,0,1,0) == InnerIntersectState.NTO
//                                    && partialBoxIntersect(0,2,1,0) == InnerIntersectState.NTO
// console.assert( pbi_point_line_not_touching_out, "Disconnected outside point should be no-touch-out");


// const pbi_point_line_not_touching_in = partialBoxIntersect(0,1,2,0) == InnerIntersectState.NTI
//                                   && partialBoxIntersect(1,0,0,2) == InnerIntersectState.NTI
// console.assert( pbi_point_line_not_touching_in, "Disconnected inside point should be no-touch-in");

// // line-line tests
// const pbi_line_line_no_touch_out = partialBoxIntersect(0,2,1,1) == InnerIntersectState.NTO
// console.assert( pbi_line_line_no_touch_out, "Disconnected lines should be no-touch-out");

// const pbi_line_line_no_touch_in = partialBoxIntersect(0,1,3,1) == InnerIntersectState.NTI
// console.assert( pbi_line_line_no_touch_in, "Eclipsed lines should be no-touch-in");

// const pbi_line_line_touch_out = partialBoxIntersect(0,1,1,1) == InnerIntersectState.TO
//                            && partialBoxIntersect(10,0,100,10) == InnerIntersectState.TO
// console.assert( pbi_line_line_touch_out, "connected lines should be touch-out");

// const pbi_line_line_touch_in = partialBoxIntersect(0,0,2,1) == InnerIntersectState.TI  // left aligned
//                           && partialBoxIntersect(0,1,2,1) == InnerIntersectState.TI  // right aligned
// console.assert( pbi_line_line_touch_in, "same start diff lengths should be touch-in");

// const pbi_line_line_intersect = partialBoxIntersect(0,1,2,2) == InnerIntersectState.I
//                           && partialBoxIntersect(1,0,2,2) == InnerIntersectState.I
// console.assert( pbi_line_line_intersect, "Regular intersections should return intersect");

// const pbi_line_line_perfect = partialBoxIntersect(0,0,2,2) == InnerIntersectState.TI
// console.assert( pbi_line_line_perfect, "Perfect overlap should return touch-in");

// // NSO test
// const combined_no_intersect_test = combinePartialBoxIntersects([InnerIntersectState.NTO,InnerIntersectState.NTO,InnerIntersectState.NTO]) == IntersectState.NO_INTERSECT
//     && combinePartialBoxIntersects([InnerIntersectState.NTO,InnerIntersectState.I,InnerIntersectState.TI]) == IntersectState.NO_INTERSECT
//     && combinePartialBoxIntersects([InnerIntersectState.TO,InnerIntersectState.NTO,InnerIntersectState.NTI]) == IntersectState.NO_INTERSECT
//     && combinePartialBoxIntersects([InnerIntersectState.TO,InnerIntersectState.NTI,InnerIntersectState.NTO]) == IntersectState.NO_INTERSECT
// console.assert( combined_no_intersect_test, "Any one NSO should return no-intersect");

// // NSI test
// const combined_nti_test = combinePartialBoxIntersects([
//     InnerIntersectState.NTI,InnerIntersectState.NTI,InnerIntersectState.NTI]) == IntersectState.NO_INTERSECT
// console.assert( combined_nti_test, "All three NSIs should be no-intersect");

// // TO
// const combined_to_test = combinePartialBoxIntersects([InnerIntersectState.TO,InnerIntersectState.TI,InnerIntersectState.I]) == IntersectState.AMBIGUOUS
// console.assert( combined_to_test, "TO dominated I, TI and NTI to produce ambiguous");

// // I test
// const combined_intersect_test = combinePartialBoxIntersects([InnerIntersectState.I,InnerIntersectState.TI,InnerIntersectState.NTI]) == IntersectState.INTERSECT
// console.assert( combined_intersect_test, "I dominated TI and NTI to produce intersect");

// TI test
const combined_ti_test = combinePartialBoxIntersects([InnerIntersectState.TI,InnerIntersectState.NTI,InnerIntersectState.NTI]) == IntersectState.AMBIGUOUS
console.assert( combined_ti_test, "TI dominated NTI to produce ambiguous");

console.log("--------- tests complete ----------")

//---------------------------


init()

// request initial frame
requestAnimationFrame(render);