Intersect problem:
For some specified pair of shapes, write a program that determins if they are intersecting or not intersecting or neither.


Using THREE.js b/c:
- supports 2d, 3d, bounding box, bounding sphere, differnet primative shapes
- well supported by community
- uses a simple language
- easily to deploy (no compiling, complex build process)


Types of shapes or approximate bounding volume I could potentially support:
- spheres,
- boxes,
- convex polyhedra,
- faceted closed non-self-intersecting

Bounding Sphere: intersections are computed using r1 and r2 for the radius of circles 1 and 2 respectively.
- ambigious:        circles are just touching of they are exactly r1 + r2 distance away from each other
- not intersecting: circles are more than r1 + r2 distance away from each other
- intersecting:     circles are less than r1 + r2 distance away from each other

Bounding Boxe (axis-aligned): Box doesn't rotate as the bounded object changes, parameters (h, w) for each obj
- ambigious:        boxes are just touching if they are exactly w1 + w2 distance apart horizontally
                    and/or h1 + h2 distance apart vertically
- not intersecting: boxes are more than r1 + r2 distance away from each other
- intersecting:     circles are less than r1 + r2 distance away from each other

Convex-hulls: Compute bounding shape that ignores all concavity,
- e.g. a 5-sided start would become a pentagon, pacman w/ a face mask
- https://www.bowdoin.edu/~ltoma/teaching/cs3250-CompGeom/spring17/Lectures/cg-convexintersection.pdf

Ray-casting: ?
    - if bb (or bc) is not intersecting then return not intersecting
    - find verticies from one of the objects within the region of intersection
    -  cast a ray from each point and use ray-intersection test against the other object
        - i guess you can bound the "length" of the ray so that it's not an infinite beam







More on the AABB intersection test:

Seperately for vertical and horizontal: [distance between boxes] vs [width of the closer box]
[distance between boxes]: Take the distance between the min points (or equivalently the max point from each box)
[width of the closer box]: Get the width of either box 1 or box 2
                           { bb1.min.x < bb2.min.x -> bb1.max.x - bb1.min.x
                             otherwise             -> bb2.max.x - bb2.min.x
- ambigious:        if equal then the boxes are touching
- non-intersecting: distance > width
- intersecting:     distance < width

To combine the vertical and horizontal intersections use the following table:
                 vertical
horizontal           | ambigious        | intersecting     | non-intersecting
    -----------------+------------------+------------------+------------------
    ambigious        | ambigious        | ambigious        | non-intersecting
    -----------------+------------------+------------------+------------------
    intersecting     | ambigious        | intersecting     | non-intersecting
    -----------------+------------------+------------------+------------------
    non-intersecting | non-intersecting | non-intersecting | non-intersecting

In 3 dimensions its more complicated but we can see some patterns:
- if any dimension is non-intersecting then the overall state is non-intersecting
- otherwise if any dimension is ambigious then the overall state is ambigious
- finally all dimensions must be intersecting so overall is intersecting