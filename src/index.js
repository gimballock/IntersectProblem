import {
    Color,
    WebGLRenderer, Scene, PerspectiveCamera,
    ConeGeometry, TorusKnotGeometry, BoxBufferGeometry,
    MeshPhongMaterial, MeshNormalMaterial, LineBasicMaterial,
    Vector3, Box3, Sphere, PlaneGeometry,
    DirectionalLight,
    Mesh, LineSegments,
    BoxHelper, AxesHelper,
    SphereGeometry, EdgesGeometry
} from "three";

import { DragControls } from "three/examples/jsm/controls/DragControls.js";
import { WEBGL } from 'three/examples/jsm/WebGL.js';

// Used to print status message every <LOG_INTERVAL> seconds 
// by comparing current time to prevTime whenever render() is called
const LOG_INTERVAL = 0.5

// Error term to decide if objects are "kissing" vs inersecting or not-intersecting
const ERROR_TERM = 0.1

const IntersectState = {
	AMBIGIOUS: "Ambigious",
	NO_INTERSECT: "Not intersecting",
	INTERSECT: "Intersecting"
}

const DIMENSION = { X:0, Y:1, Z:2 }

const RENDER_MODE = { BOXES, SPHERES }

let prevTime = 0

let renderer, scene, camera;
let mode = 
let helpers = new Map();

let primaryObj, secondaryObj;

/**
 * Length of the path the secondary object traverses in it's motion loop
 */
let pathLength = 10


function makeInstance(geometry, color, x, y, z = 0) {
    const material = new MeshPhongMaterial({ color: color });
    const objMesh = new Mesh(geometry, material);
    scene.add(objMesh);
    geometry.translate(x,y,z)
    
    helpers.set(objMesh, new BoxHelper( objMesh ));    
    scene.add(helpers.get(objMesh));


    objMesh.geometry.computeBoundingSphere();
    const boundingSphere = objMesh.geometry.boundingSphere
    const sphereGeometry = new EdgesGeometry(new SphereGeometry(boundingSphere.radius, 8, 6), 1);
    const sphereMaterial = new LineBasicMaterial({color: new Color("yellow")});
    const sphereMesh = new LineSegments(sphereGeometry, sphereMaterial);
    sphereMesh.position.copy(boundingSphere.center)
    scene.add(sphereMesh);

    return objMesh;
}


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

    // Draw the 3 axes
    scene.add( new AxesHelper(planeSize + 1) );
}

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
    const primaryGeom = new TorusKnotGeometry();
    primaryObj = makeInstance(primaryGeom, 0x44aa88, 2, 2, 5);

    const secondaryGeom = new ConeGeometry();
    secondaryObj = makeInstance(secondaryGeom, 0x8844aa, 2, 2, 2)


    // Enable secondary object to be dragged around
    const controls = new DragControls( [ secondaryObj ], camera, renderer.domElement );
    controls.addEventListener( 'drag', () => {
        requestAnimationFrame(render);
    } );

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
    // primaryObj.rotation.x = rot;
    // primaryObj.rotation.y = rot;

    // secondaryObj.rotation.x = -rot;
    // secondaryObj.rotation.y = -rot;

    // update positions
    // secondary object should move past the primary object centered at the origin 
    // - modulate the time by the length of the path you want it to traverse
    // - now subtract half of the total path length to center the path on the origin
    let t = time % pathLength;
    let target = t;

    secondaryObj.position.z = target;

    // update bounding boxes
    helpers.forEach((helper) => { helper.update() })

}

function render(time) {
    time *= 0.001;  // convert time to seconds

    updateScene(time)

    

    // ------------------- PROCESS INTERSECTIONS HERE ----------------------

    
    // looped status log
    if (time > (prevTime + LOG_INTERVAL)) {
        
        let sphereState = IntersectState.INTERSECT

        let bs1 = (new Sphere())
            .copy(primaryObj.geometry.boundingSphere)
            .applyMatrix4( primaryObj.matrixWorld );
        let bs2 = (new Sphere())
            .copy(secondaryObj.geometry.boundingSphere)
            .applyMatrix4( secondaryObj.matrixWorld );
        
        // TODO: use squared distance to avoid the division
        let distance = bs1.center.distanceTo(bs2.center)
        let radiusSum = bs1.radius + bs2.radius
        let termDiff = distance - radiusSum 

        if( Math.abs(termDiff) < ERROR_TERM )
            sphereState = IntersectState.AMBIGIOUS;
        else if( termDiff > 0)
            sphereState = IntersectState.NO_INTERSECT;
        // else sphereState = IntersectState.INTERSECT; <-- default value

        console.log(Math.trunc(time), "Sphere", sphereState, termDiff);

        // -------------------------------------------


        // Seperately for vertical and horizontal: [distance between boxes] vs [width of the closer box]
        // [distance between boxes]: Take the distance between the min points (or equivalently the max point from each box)
        // [width of the closer box]: Get the width of either box 1 or box 2
        //                            { bb1.min.x < bb2.min.x -> bb1.max.x - bb1.min.x
        //                              otherwise             -> bb2.max.x - bb2.min.x 
        // - ambigious:        if equal then the boxes are touching
        // - non-intersecting: distance > width
        // - intersecting:     distance < width

        // To combine the vertical and horizontal intersections use the following table:
        //                  vertical
        // horizontal           | ambigious        | intersecting     | non-intersecting
        //     -----------------+------------------+------------------+------------------
        //     ambigious        | ambigious        | ambigious        | non-intersecting
        //     -----------------+------------------+------------------+------------------
        //     intersecting     | ambigious        | intersecting     | non-intersecting
        //     -----------------+------------------+------------------+------------------
        //     non-intersecting | non-intersecting | non-intersecting | non-intersecting
        //
        // In 3 dimensions its more complicated but we can see some patterns:
        // - if any dimension is non-intersecting then the overall state is non-intersecting
        // - otherwise if any dimension is ambigious then the overall state is ambigious
        // - finally all dimensions must be intersecting so overall is intersecting


        // Box3 objects are 3D cubes, they have 8 verticies but the THREE.js object stores:
        // - .min (Vertex3): the point closest to the origin
        // - .max (Vertex3): furtherest from the origin
        // - .getSize() (Vertex3): the <width, height, depth> of the cube.
        // Note: The other 6 points can be obtained by combining the x,y,z components of the min and max points

        let boxStates = new Array(3)
        
        const bb1 = (new Box3())
            .copy( primaryObj.geometry.boundingBox )
            .applyMatrix4( primaryObj.matrixWorld );
        const bb1Sizes = bb1.getSize(new Vector3())
        
        const bb2 = (new Box3())
            .copy( secondaryObj.geometry.boundingBox )
            .applyMatrix4( secondaryObj.matrixWorld );
        const bb2Lengths = bb2.getSize(new Vector3())

        for (const dimName in DIMENSION) {
            const dimIdx = DIMENSION[dimName]; // get the index of the dimension: [x,y,z] -> [0,1,2]
            let dimState = IntersectState.INTERSECT

            // For the current dimension (x,y,z) set these values
            const [bb1Min, bb2Min] = [bb1.min.getComponent(dimIdx), bb2.min.getComponent(dimIdx)]
            const [bb1Length, bb2Length] = [bb1Sizes.getComponent(dimIdx), bb2Lengths.getComponent(dimIdx)]
            
            // 1) If boxes have same min point (could alternatively use max point of each box)
            //    - if one of the widths is zero --> ambigious
            //    - else                         --> intersecting
            let isCoincident = (bb1Min == bb2Min)
            let isDegenerate = (bb1Length <= ERROR_TERM) || (bb2Length <= ERROR_TERM)
            if(isCoincident)
                dimState = isDegenerate 
                    ? IntersectState.AMBIGIOUS   // same start and one has no range --> just touching edge of other box
                    : IntersectState.INTERSECT;  // same start and both have non-zero range --> intersecting

            else {
                // 2) Rename box1 and box2 as nearBox and farBox since we know they are not the same location
                let [nearBoxMin, farBoxMin] = Math.abs(bb1Min) < Math.abs(bb2Min) ? [bb1Min, bb2Min] : [bb2Min, bb1Min]
                    
                // 3) Set distance between boxes and length of nearist box (to the origin)
                let nearBoxLen = (nearBoxMin == bb1Min) ? bb1Length : bb2Length
                let distance = Math.abs(farBoxMin - nearBoxMin) // equivalently to using max point
                
                // 4) Compare [distance between boxes] vs [width of the closer box]
                let termDiff = distance - nearBoxLen
                if( Math.abs(termDiff) < ERROR_TERM )
                    dimState = IntersectState.AMBIGIOUS;
                else if( termDiff > 0)
                    dimState = IntersectState.NO_INTERSECT;
                // else dimState = IntersectState.INTERSECT; <-- default value
            }

            boxStates[dimIdx] = dimState
            // console.log(Math.trunc(time), "Bounding Box", dimIdx == 0 ? 'x' : dimIdx == 1 ? 'y' : 'z', dimState);
        }

        // Combine the dimensional box states to get the overall box state:
        // - if any dimension is non-intersecting then the overall state is non-intersecting
        // - otherwise if any dimension is ambigious then the overall state is ambigious
        // - finally all dimensions must be intersecting so overall is intersecting
        let overallBoxState = IntersectState.INTERSECT
        for (const dimState of boxStates){
            if(dimState == IntersectState.NO_INTERSECT) {
                overallBoxState = IntersectState.NO_INTERSECT
                break;
            } 
            const isAlreadyAmbigious = (overallBoxState == IntersectState.AMBIGIOUS)
            if(!isAlreadyAmbigious && dimState == IntersectState.AMBIGIOUS)
                overallBoxState = IntersectState.AMBIGIOUS;
        }

        console.log(Math.trunc(time), "Box", overallBoxState, boxStates);

        prevTime = time
    }

    // -------------------------------------------------------------------

    
    // draw scene
    renderer.render(scene, camera);

    // get the next frame
    requestAnimationFrame(render);
}

init()
requestAnimationFrame(render);