# VVGL Player

WebGL Player for VVID files

VVGL is a WebGL based rendering engine for LRN files. This should be considered an alternative rendering engine to SVG, one of the major components of vv.js.

## Getting started

VVGL uses a node, webpack build environment. Make sure Node, Webpack, Yarn etc... are all installed

**Install dependencies**

    npm install

**data.json**

You need a specially formatted JSON file. One is already included in the vvid folder, and you can generate more from src/encoder.js, which takes in the outputs from vectorization, and outputs a data.json file

*Run demo file*


    yarn JSONFILE=vvid/data.json demo:serve


## Background

**WebGL**
To understand the VVGL player, you'll need to learn the fundamentals of WebGL.  [WebGL Fundamentals](https://webglfundamentals.org/) has a great introduction to WebGL. In addition, [Khronos.org](https://www.khronos.org/opengl/wiki) and [Mozilla Developer Network](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/) are good references for OpenGL, and the WebGL API respectively.

**Bezier curves**
On top of WebGL, it's critical that you understand Bezier curves (and specifically Cubic Bezier curves). There is a good animation [here](https://www.jasondavies.com/animated-bezier/), a few [videos](https://www.youtube.com/watch?v=pnYccz1Ha34).

**Linear Algebra**
It's also helpful to have a background in basic linear algebra, and specifically vector and matrix multiplication.


## Theory

To understand how the WebGL player works at a theory level, you need to know:

* How to render a bezier curve using linear algebra
* How to draw arbitrary polygons as a series of triangles
* How to construct complex shapes as a superposition of polygons and bezier curves
* How to cancel out shape interference through bitwise inversions

**Bezier Curves as Linear Algebra**

The formula for a cubic Bezier curve is as follows

![bezier](docs/bezier.svg)

You can substitute the t-values with easier to read variables

![coefficients](docs/coefficients.gif)

The bezier curve equation then becomes

![](docs/linalg1.gif)

Of course, a,b,c,d are still functions of t, but they now look more like linear algebra equations.

You can now treat the bezier equation as matrix multiplication, as below

![](docs/linalg2.gif)

Of course, while the points are actual numbers, a,b,c,d are just functions of t. The key here is to now evaluate a,b,c and d for different values of t, from 0 to 1

![](docs/linalg3.gif)

Here, each value in the matrices is now a concrete number. To be even more explicit, the equation B(t) now results in a vector of the different points along the bezier curve

![](docs/linalg4.gif)

Finally, remember that a, b, c and d are just functions of t, and aren't dependent on the control points. The a,b,c,d matrix therefore doesn't change between bezier curves, and you can therefore consider it a constant

![](docs/t.gif)

Every bezier curve, therefore, can be calculated by multiplying the 4 control points by a constant matrix T

![](docs/linalg5.gif)

In this way, you can feed hundreds of thousands of bezier curves to the GPU in parallel, and it will output millions of vertex points efficiently (in less than 1 ms), becuase it's just about multiplying 10^5 vectors by a constant matrix


**Drawing abritrary polygons using Triangles**

WebGL and OpenGL only really understand lines and triangles. Everything that is rendered in WebGL therefore needs to be broken down into triangles.

The obvious solution is to use triangulation, and there are [libraries](https://github.com/mapbox/earcut) which can triangulate large polygons efficiently. These algorithms use the CPU however, and the runtime for thousands of objects (as in a typical animated scene) ends up being ~30ms per frame

The non-obvious solution is to use a neat feature of geometry theory: For any arbitrary polygon, if you draw a [triangle fan](https://en.wikipedia.org/wiki/Triangle_fan), that is - the series of triangles made by connecting a vertex to every subsequent pair of vertices (as shown below)

![](docs/Image142.gif)

where the triangles in triangle fan are 1-2-3, 1-3-4, 1-4-5, 1-5-6 and 1-6-7, the areas inside the polygon will be covered by an odd number of triangles. The areas outside the polygon will be covered by an even number of triangles.

This neat quirk lets you take advantage of 2 OpenGL/WebGL features to draw any closed 2d shape:
* Triangle Fans
* Stencil Buffers

For the stencil buffer, you can use the stencil mask function to mark any pixel with an 8-bit id without actually drawing the pixel. You can also use the stencil INVERT function to do a bitwise flip of the pixel's 8-bit id, and the stencil test to draw only draw triangles on pixels where the 8-bit id is equal to a certain value.

What you can do therefore, is to draw a triangle fan for every polygon, using the stencil mask to set the pixels to a given id, and the stencil invert function to flip the pixel ids every time a triangle is drawn. Because of the neat quirk mentioned above, every pixel inside the polygon will have a common 8-bit id, and everything outside the polygon will remain unaffected, because they will have undergone an even number of inverts.

This idea comes from the [GL Programming textbook](http://www.glprogramming.com/red/chapter14.html#name13), which you can look at for reference.

**Shapes as superpositions of polygons and bezier curves**

Let's say you define a shape as a string of bezier curves. Here, we outline how to construct that shape as a superposition of independent bezier curves, and the polygon formed by the bezier-curve end points.

![](docs/stencil.jpg)

Consider the shape shown above, which is constructed of 2 lines and 2 bezier curves. Here, we would form a polygon from the 4 bezier curve end points, which we call the 'coarse polygon'.

Using the technique for drawing arbitrary polygons in the previous section, you can easily render the coarse polygon.

Using the linear algebra technique mentioned above, you can also render each bezier curve independantly.

With the rendered curves and the rendered polygon, you have all the triangles needed to build the shape. Constructing the shape isn't just a matter of adding the bezier curves to the coarse polygon though. Some curves 'cut into' the polygon (i.e. they are concave). To properly build the shape, you effectively do a bitwise 'or' operation on the rendered bezier curves and coarse polygon, only painting areas which are either in the polygon or in a curve, but not areas that are both in the polygon and in a curve, as seen below.

![](docs/stencil2.jpg)

Fortunately, the stencil buffer functionality of OpenGL  / WebGL enable exactly these kinds of 'bitwise' operations, enabling construction of any closed shape defined as a series of bezier curves, no matter how abritrarily complex.




**Drawing everything on the GPU**

If you understand both points of theory above, the algorithm from here is exceedingly simple. Every shape is a series of bezier curves. For each shape, you supply a list of the bezier curve control points, and the GPU will calculate n points along each bezier curve. These points are now the vertices of a very complex polygon, and you do the stencil buffer method mentioned above to paint only the areas inside the shape.


## Implementation

To implement the theory above, there are some specific functions of WebGL to make sure to understand

**Textures**

In any given frame, there are about ~10^4 shapes and ~10^5 bezier curves. Rendering each shape (let alone each curve) individually therefore requires thousands of calls to the GPU, and lots of data back and forth.

Communication between the GPU and CPU is by far the biggest bottleneck when working with WebGL, so the idea is to minimize data transfer between the CPU and the GPU.

The solution is to send all the bezier curves at once. To do this, you use a [texture](https://webglfundamentals.org/webgl/lessons/webgl-3d-textures.html), which is a fancy word for an embedded image

Here, you encode bezier coordinants as pixel rgba pixel values. In the GPU shader program, you read individual pixel values as if they were entries in a large table, and then you parse them to get the required pixel information.

Sending the bezier curves all at once, you could theoretically render the scene in 2 draw calls (instead of thousands), and any overhead in terms of parsing pixel values on the GPU is vastly outweighed by the reduction in CPU/GPU communication.


**Stencil**

By theoretically, you might have gotten that things are being drawn in more than 2 draw calls. One of the major downsides of using the stencil-invert technique is shape interference, which happens when the different triangle fans of different shapes start to paint over each other.

The way around this is to use the stencil mask function, and draw different shapes using different stencil mask values (can be anything from 0 to 255). This prevents shape interference at the cost of requiring more draw calls.

For efficiency, we randomly assign shapes into stencil 'buckets', so that each shape in a bucket is drawn with a single stencil mask value.

You can therefore decide how many different stencil masks you want: If you do 255, every scene will require 510 draw calls. If you chose 20, every scene will have 40 draw calls. Shape interference seems to become minimal at around 100 stencil buckets. You can visualize interference by changing the "num_buckets" variable in the setBezierTexture function


## Results

https://files.vectorly.io/demo/webgl-player/2/index.html


## Issues

There are still some key issues to tackle.

* Some curves still show mysterious black spots or black zones, which may or may not be due to shape interference
* Using Chromes performance monitor shows periodic spikes in GPU usage even on frames where nothing is happening. The framreate also mysteriously drops to 30fps and rises to 60fps, again even when nothing new is being rendered
* There may be a more efficient way of rendering than using textures, by taking advantage of Instanced Arrays, but initial investigations indicate there's not an easy way of connecting bezier curves together into a single polygon
* TODO: Add support for homography