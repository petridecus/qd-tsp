// canvas for the problem
let G_problemCanvasWidth = null;
let G_problemCanvasHeight = null;
let G_problemCtx = null;
let G_problemCanvas = null;
let G_problemCtxOffscreen = null;
let G_problemCanvasOffscreen = null;

// canvas for the behavior
let G_behaviorCanvasWidth = null;
let G_behaviorCanvasHeight = null;
let G_behaviorCtx = null;
let G_behaviorCanvas = null;
let G_behaviorCtxOffscreen = null;
let G_behaviorCanvasOffscreen = null;

// misc
let G_problemMessage = null;
let G_solverRunning = null;

const CITY_RADIUS_CANVAS = 20;
const BEHAVIOR_BINS = 5;
const BEHAVIOR_RADIUS_CANVAS = 5;

let G_problemScale = 1.0;

let gridVisible = true;

let G_problem = [
    [0.00, 0.00],
    [0.19, 0.20],
    [0.18, 0.97],
    [0.69, 0.41],
    [0.81, 0.08],
    [0.68, 0.19],
    [0.08, 0.57],
    [1.00, 0.31],
    [0.70, 1.00]
];

/*
let G_problem = [
    [0.2, 0.2],
    [0.2, 0.8],
    [0.8, 0.2],
    [0.8, 0.8],
    [0.6, 0.5]
];
*/

let G_problemEdgeLengthMin = null;
let G_problemEdgeLengthMax = null;



let G_solution = null;
let G_solutionScore = null;
let G_solutionScoreBest = null;
let G_solutionEdgeLengthMin = null;
let G_solutionEdgeLengthMax = null;
let G_solutionBehavior = null;
let G_solutionBehaviorBin = null;
let G_solutionBehaviorBinElites = new Map();

let G_cityHighlighted = null
let G_citySelected = null

let G_binHighlighted = null
let G_binSelected = null



window.addEventListener('load', startup, false);

// Initialize the program
function startup() {
    // Initialize the canvases
    G_problemCanvas = document.getElementById('problemcanvas');
    G_problemCtx = G_problemCanvas.getContext('2d');

    G_problemCanvasWidth = G_problemCanvas.width;
    G_problemCanvasHeight = G_problemCanvas.height;

    G_problemCanvasOffscreen = document.createElement('canvas');
    G_problemCanvasOffscreen.width = G_problemCanvas.width;
    G_problemCanvasOffscreen.height = G_problemCanvas.height;
    G_problemCtxOffscreen = G_problemCanvasOffscreen.getContext('2d');

    //
    G_behaviorCanvas = document.getElementById('behaviorcanvas');
    G_behaviorCtx = G_behaviorCanvas.getContext('2d');

    G_behaviorCanvasWidth = G_behaviorCanvas.width;
    G_behaviorCanvasHeight = G_behaviorCanvas.height;

    G_behaviorCanvasOffscreen = document.createElement('canvas');
    G_behaviorCanvasOffscreen.width = G_behaviorCanvas.width;
    G_behaviorCanvasOffscreen.height = G_behaviorCanvas.height;
    G_behaviorCtxOffscreen = G_behaviorCanvasOffscreen.getContext('2d');

    // misc
    G_problemMessage = document.getElementById('problemmessage');

    // set up problem
    var psize = 4;
    var pseed = 7;

    var urlParams = new URLSearchParams(window.location.search);
    var pid = urlParams.get('pid');
    if (pid) {
	var pids = pid.split('-');
	if (pids.length === 2) {
	    var urlSize = Number.parseInt(pids[0]);
	    var urlSeed = Number.parseInt(pids[1]);
	    if (urlSize >= 3 && urlSize <= 50 &&
		urlSeed >= 1 && urlSeed <= 99) {
		psize = urlSize;
		pseed = urlSeed;
	    }
	}
    }

    prand = sfc32(pseed, pseed, pseed, pseed);

    G_problem = [];
    for (var ii = 0; ii < psize; ++ ii) {
	G_problem.push([prand(), prand()]);
    }
    console.log(G_problem);

    G_problemEdgeLengthMin = 999.9;
    G_edgeLengthMax = 0.0;
    for (var ii = 0; ii < G_problem.length; ++ ii) {
	for (var jj = ii + 1; jj < G_problem.length; ++ jj) {
	    var src = G_problem[ii];
	    var dst = G_problem[jj];
	    var dist = distance(src, dst);
	    G_problemEdgeLengthMin = Math.min(G_problemEdgeLengthMin, dist);
	    G_problemEdgeLengthMax = Math.max(G_problemEdgeLengthMax, dist);
	}
    }

    G_problemScale = 0.5 + 0.5 * lremapClamp(G_problem.length, 50, 5);

    randomSolution();

    G_problemCanvas.addEventListener('mousedown', problemMouseDownHandler);
    G_problemCanvas.addEventListener('mousemove', problemMouseMoveHandler);
    G_problemCanvas.addEventListener('mouseleave', problemMouseLeaveHandler);
    G_problemCanvas.addEventListener('mouseup', problemMouseUpHandler);

    G_behaviorCanvas.addEventListener('mousedown', behaviorMouseDownHandler);
    G_behaviorCanvas.addEventListener('mousemove', behaviorMouseMoveHandler);
    G_behaviorCanvas.addEventListener('mouseleave', behaviorMouseLeaveHandler);
    G_behaviorCanvas.addEventListener('mouseup', behaviorMouseUpHandler);

    // Start looping functions
    //setInterval(drawScene, 30);

    // Clear state
    /*
    clearMouse();
    clearKeys();
    */

    /*
    window.addEventListener('mousedown', mouseDownHandler);
    window.addEventListener('mousemove', mouseMoveHandler);
    window.addEventListener('mouseup', mouseUpHandler);
    G_glCanvas.addEventListener('wheel', mouseWheelHandler);
    G_glCanvas.addEventListener('dblclick', mouseDoubleHandler);

    window.addEventListener('keydown', keydownHandler);
    window.addEventListener('keyup', keyupHandler);
    */
}

// from: https://github.com/bryc/code/blob/master/jshash/PRNGs.md
function sfc32(a, b, c, d) {
    return function() {
      a |= 0; b |= 0; c |= 0; d |= 0;
      var t = (a + b | 0) + d | 0;
      d = d + 1 | 0;
      a = b ^ b >>> 9;
      b = c + (c << 3) | 0;
      c = c << 21 | c >>> 11;
      c = c + t | 0;
      return (t >>> 0) / 4294967296;
    }
}

function startStopSolver() {
    if (G_solverRunning === null) {
	G_solverRunning = setInterval(stepSolver, 500);
	document.getElementById('startstopsolver').innerHTML = 'Stop';
    } else {
	clearInterval(G_solverRunning);
	G_solverRunning = null;
	document.getElementById('startstopsolver').innerHTML = 'Start';
    }
}

function stepSolver() {
    var binKeys = Array.from(G_solutionBehaviorBinElites.keys());

    if (binKeys.length === 0) {
	if (Math.random() < 0.2) {
	    randomSolution();
	} else {
	    mutateSolution();
	}
    } else if (binKeys.length === 1) {
	if (Math.random() < 0.2) {
	    randomSolution();
	} else {
	    G_solution = G_solutionBehaviorBinElites.get(binKeys[0]).solution.slice();
	    mutateSolution();
	}
    } else {
	if (Math.random() < 0.2) {
	    randomSolution();
	} else {
	    shuffle(binKeys);
	    if (Math.random() < 0.5) {
		var s0 = G_solutionBehaviorBinElites.get(binKeys[0]).solution.slice();
		G_solution = s0;
		mutateSolution();
	    } else {
		var s0 = G_solutionBehaviorBinElites.get(binKeys[0]).solution.slice();
		var s1 = G_solutionBehaviorBinElites.get(binKeys[1]).solution.slice();
		crossoverSolutions(s0, s1);
	    }
	}
    }
}

function lremapClamp(x, lo, hi) {
    return Math.max(0.0, Math.min(1.0, (x - lo) / (hi - lo)))
}

function newSolution() {
    G_solutionScore = 0.0;
    G_solutionEdgeLengthMin = 999.9;
    G_solutionEdgeLengthMax = 0.0;
    for (var ii = 0; ii < G_solution.length; ++ ii) {
	var src = G_problem[G_solution[ii]];
	var dst = G_problem[G_solution[(ii + 1) % G_solution.length]];
	var dist = distance(src, dst);
	G_solutionScore += dist;
	G_solutionEdgeLengthMin = Math.min(G_solutionEdgeLengthMin, dist);
	G_solutionEdgeLengthMax = Math.max(G_solutionEdgeLengthMax, dist);
    }
    G_solutionScore *= 10000;
    if (G_solutionScoreBest === null) {
	G_solutionScoreBest = G_solutionScore;
    } else {
	G_solutionScoreBest = Math.min(G_solutionScoreBest, G_solutionScore);
    }

    var problemEdgeLengthMid = 0.5 * (G_problemEdgeLengthMin + G_problemEdgeLengthMax);

    G_solutionBehavior = [lremapClamp(G_solutionEdgeLengthMin, G_problemEdgeLengthMin, problemEdgeLengthMid),
			  lremapClamp(G_solutionEdgeLengthMax, problemEdgeLengthMid, G_problemEdgeLengthMax)];
    G_solutionBehaviorBin = [Math.min(Math.floor(G_solutionBehavior[0] * BEHAVIOR_BINS), BEHAVIOR_BINS - 1),
			     Math.min(Math.floor(G_solutionBehavior[1] * BEHAVIOR_BINS), BEHAVIOR_BINS - 1)];

    var binKey = G_solutionBehaviorBin.toString();
    var binElite = G_solutionBehaviorBinElites.get(binKey);
    if (binElite === undefined || binElite.score > G_solutionScore) {
	var newElite = {
	    score: G_solutionScore,
	    solution: G_solution.slice()
	};
	G_solutionBehaviorBinElites.set(binKey, newElite);
    }

    G_problemMessage.innerHTML = 'length: ' + G_solutionScore.toFixed(0) + '<br/>best: ' + G_solutionScoreBest.toFixed(0);

    drawScene();
}

function problemMouseDownHandler(evt) {
    /*
    if (G_cityHighlighted !== null) {
	if (G_citySelected !== null) {
	    if (G_cityHighlighted !== G_citySelected) {
		var i0 = G_solution.indexOf(G_citySelected);
		var i1 = G_solution.indexOf(G_cityHighlighted);
		//[G_solution[i0], G_solution[i1]] = [G_solution[i1], G_solution[i0]];
		if (i0 + 1 === i1 || i0 === i1 + 1) {
		    [G_solution[i0], G_solution[i1]] = [G_solution[i1], G_solution[i0]];
		} else if (i0 < i1) {
		    for (var ii = i1; ii > i0 + 1; -- ii) {
			[G_solution[ii - 1], G_solution[ii]] = [G_solution[ii], G_solution[ii - 1]];
		    }
		} else {
		    for (var ii = i1; ii < i0 - 1; ++ ii) {
			[G_solution[ii + 1], G_solution[ii]] = [G_solution[ii], G_solution[ii + 1]];
		    }
		}
	    }
	    G_citySelected = null;
	    newSolution();
	} else {
	    G_citySelected = G_cityHighlighted;
	    drawScene();
	}
    }
    */
    if (G_cityHighlighted !== null) {
	G_citySelected = [G_cityHighlighted];
	drawScene();
    } else {
	G_citySelected = null;
	drawScene();
    }
}

function problemMouseMoveHandler(evt) {
    var mcpt = [evt.offsetX, evt.offsetY];

    var mouseCity = null;
    var mouseCityDsq = null;
    for (var ii = 0; ii < G_problem.length; ++ ii) {
	var cpt = problemToCanvas(G_problem[ii]);
	var dsq = distanceSqr(mcpt, cpt);
	if (dsq < Math.pow(Math.max(2, CITY_RADIUS_CANVAS * G_problemScale), 2)) {
	    if (mouseCity === null || dsq < mouseCityDsq) {
		mouseCity = ii;
		mouseCityDsq = dsq;
	    }
	}
    }

    if (G_cityHighlighted !== mouseCity) {
	G_cityHighlighted = mouseCity;
	if (G_cityHighlighted !== null && G_citySelected !== null) {
	    var index = G_citySelected.indexOf(G_cityHighlighted);
	    if (index === -1) {
		G_citySelected.push(G_cityHighlighted);
	    } else {
		G_citySelected = G_citySelected.slice(0, index + 1);
	    }
	}
	drawScene();
    }
}

function problemMouseLeaveHandler(evt) {
    G_cityHighlighted = null;
    G_citySelected = null;
    drawScene();
}

function problemMouseUpHandler(evt) {
    if (G_citySelected !== null) {
	var newSol = G_citySelected;

	var startFrom = G_solution.indexOf(newSol[0]);
	for (var ii = 0; ii < G_solution.length; ++ ii) {
	    var val = G_solution[(startFrom + ii) % G_solution.length];
	    if (newSol.indexOf(val) == -1) {
		newSol.push(val);
	    }
	}
	G_solution = newSol;
	G_citySelected = null;
	newSolution();
    }
}

function behaviorMouseDownHandler(evt) {
    /*
    if (G_binHighlighted !== null) {
	if (G_binSelected !== null) {
	    var binSelectedElite = G_solutionBehaviorBinElites.get(G_binSelected.toString());
	    if (binSelectedElite !== undefined) {
		if (G_binSelected.toString() == G_binHighlighted.toString()) {
		    G_solution = binSelectedElite.solution.slice();
		} else{
		    var binHighlightedElite = G_solutionBehaviorBinElites.get(G_binHighlighted.toString());
		    crossoverSolutions(binHighlightedElite.solution, binSelectedElite.solution);
		}
		G_binSelected = null;
		newSolution();
	    }
	} else {
	    if (G_solutionBehaviorBinElites.has(G_binHighlighted.toString())) {
		G_binSelected = [G_binHighlighted, G_binHighlighted];
		drawScene();
	    }
	}
    }
    */
    if (G_binHighlighted !== null) {
	if (G_solutionBehaviorBinElites.has(G_binHighlighted.toString())) {
	    G_binSelected = [G_binHighlighted, G_binHighlighted];
	}
    } else {
	G_binSelected = null;
    }
    drawScene();
}

function behaviorMouseMoveHandler(evt) {
    var mcpt = [evt.offsetX, evt.offsetY];

    var mouseBin = null;
    for (var ii = 0; ii < BEHAVIOR_BINS; ++ ii) {
	for (var jj = 0; jj < BEHAVIOR_BINS; ++ jj) {
	    var pt0 = behaviorToCanvas([ii / BEHAVIOR_BINS, jj / BEHAVIOR_BINS]);
	    var pt1 = behaviorToCanvas([(ii + 1) / BEHAVIOR_BINS, (jj + 1) / BEHAVIOR_BINS]);

	    if (pt0[0] <= mcpt[0] && mcpt[0] <= pt1[0] &&
		pt1[1] <= mcpt[1] && mcpt[1] <= pt0[1]) {
		mouseBin = [ii, jj];
	    }
	}
    }
    if (G_binHighlighted !== mouseBin) {
	G_binHighlighted = mouseBin;
	if (G_binHighlighted !== null && G_binSelected !== null) {
	    if (G_solutionBehaviorBinElites.has(G_binHighlighted.toString())) {
		G_binSelected[1] = G_binHighlighted;
	    } else {
		G_binSelected[1] = null;
	    }
	}
	drawScene();
    }
}

function behaviorMouseLeaveHandler(evt) {
    G_binHighlighted = null;
    G_binSelected = null;
    drawScene();
}

function behaviorMouseUpHandler(evt) {
    if (G_binSelected !== null) {
	if (G_binSelected[0] !== null && G_binSelected[1] !== null) {
	    var binSelected0Elite = G_solutionBehaviorBinElites.get(G_binSelected[0].toString());
	    if (G_binSelected[0].toString() === G_binSelected[1].toString()) {
		G_solution = binSelected0Elite.solution.slice();
	    } else{
		var binSelected1Elite = G_solutionBehaviorBinElites.get(G_binSelected[1].toString());
		crossoverSolutions(binSelected0Elite.solution, binSelected1Elite.solution);
	    }
	    G_binSelected = null;
	    newSolution();
	} else {
	    G_binSelected = null;
	    drawScene();
	}
    }
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function randomSolution() {
    console.log('random');
    G_solution = [];
    for (var ii = 0; ii < G_problem.length; ++ ii) {
	G_solution.push(ii);
    }
    shuffle(G_solution);

    newSolution();
}

function crossoverSolutions(s0, s1) {
    console.log('crossover');
    var length = G_solution.length;
    var crossstart = Math.floor(Math.random() * length);
    var crosslength = Math.floor(Math.random() * (length - 1));
    var child = [];
    for (var ii = 0; ii < crosslength; ++ ii) {
	var val = s0[(crossstart + ii) % length];
	child.push(val);
    }
    for (var ii = 0; ii < length; ++ ii) {
	var val = s1[ii];
	if (child.indexOf(val) == -1) {
	    child.push(val);
	}
    }

    //console.log(crossstart, crosslength, child, s0, s1);

    G_solution = child;
    newSolution();
}

function mutateSolution() {
    console.log('mutate');
    var ii = Math.floor(Math.random() * G_solution.length);
    var jj = Math.floor(Math.random() * ii);
    [G_solution[ii], G_solution[jj]] = [G_solution[jj], G_solution[ii]];

    newSolution();
}

function distanceSqr(p0, p1) {
    return ((p0[0] - p1[0]) * (p0[0] - p1[0])) + ((p0[1] - p1[1]) * (p0[1] - p1[1]));
}

function distance(p0, p1) {
    return Math.sqrt(distanceSqr(p0, p1));
}

function problemToCanvas(ppt) {
    return [1.5 * CITY_RADIUS_CANVAS + ppt[0] * (G_problemCanvasWidth - 3.0 * CITY_RADIUS_CANVAS),
	    1.5 * CITY_RADIUS_CANVAS + (1.0 - ppt[1]) * (G_problemCanvasHeight - 3.0 * CITY_RADIUS_CANVAS)];
}

function behaviorToCanvas(bpt) {
    return [Math.round(1.5 * BEHAVIOR_RADIUS_CANVAS + bpt[0] * (G_behaviorCanvasWidth - 3.0 * BEHAVIOR_RADIUS_CANVAS)),
	    Math.round(1.5 * BEHAVIOR_RADIUS_CANVAS + (1.0 - bpt[1]) * (G_behaviorCanvasHeight - 3.0 * BEHAVIOR_RADIUS_CANVAS))];
}

function drawEdge(edge, color, width) {
    var cc0 = problemToCanvas(G_problem[edge[0]]);
    var cc1 = problemToCanvas(G_problem[edge[1]]);
    G_problemCtxOffscreen.beginPath();
    G_problemCtxOffscreen.moveTo(cc0[0], cc0[1]);
    G_problemCtxOffscreen.lineTo(cc1[0], cc1[1]);
    G_problemCtxOffscreen.strokeStyle = color;
    G_problemCtxOffscreen.lineWidth = width;
    G_problemCtxOffscreen.stroke();
}

function drawCity(index, ppt) {
    var cpt = problemToCanvas(ppt);
    G_problemCtxOffscreen.beginPath();
    G_problemCtxOffscreen.arc(cpt[0], cpt[1], Math.max(2, CITY_RADIUS_CANVAS * G_problemScale), 0, 2 * Math.PI);
    G_problemCtxOffscreen.fillStyle = '#dddddd';
    G_problemCtxOffscreen.fill();
    if (G_citySelected !== null && G_citySelected.indexOf(index) !== -1) {
	G_problemCtxOffscreen.strokeStyle = '#009900';
	G_problemCtxOffscreen.lineWidth = Math.max(1, 5 * G_problemScale);
	G_problemCtxOffscreen.stroke();
    }
    if (index === G_cityHighlighted) {
	G_problemCtxOffscreen.strokeStyle = '#999900';
	G_problemCtxOffscreen.lineWidth = Math.max(1, 3 * G_problemScale);
	G_problemCtxOffscreen.stroke();
    }
}

function drawScene() {
    window.requestAnimationFrame(doDrawScene);
}

// Render the page
function doDrawScene() {
    // clear
    G_problemCtxOffscreen.clearRect(0, 0, G_problemCanvasWidth, G_problemCanvasHeight);
    G_behaviorCtxOffscreen.clearRect(0, 0, G_behaviorCanvasWidth, G_behaviorCanvasHeight);

    // draw
    for (var ii = 0; ii < G_solution.length; ++ ii) {
	var src = G_solution[ii];
	var dst = G_solution[(ii + 1) % G_solution.length];
	drawEdge([src, dst], '#999999', Math.max(1, 10 * G_problemScale));
    }
    if (G_citySelected !== null) {
	for (var ii = 0; ii + 1 < G_citySelected.length; ++ ii) {
	    var src = G_citySelected[ii];
	    var dst = G_citySelected[ii + 1];
	    drawEdge([src, dst], '#009900', Math.max(1, 3 * G_problemScale));
	}
    }
    for (var ii = 0; ii < G_problem.length; ++ ii) {
	drawCity(ii, G_problem[ii]);
    }

    G_behaviorCtxOffscreen.lineWidth = 1;
    G_behaviorCtxOffscreen.strokeStyle = '#222222';
    var ww = G_behaviorCanvasWidth / BEHAVIOR_BINS;
    var hh = G_behaviorCanvasHeight / BEHAVIOR_BINS;
    for (var ii = 0; ii < BEHAVIOR_BINS; ++ ii) {
	for (var jj = 0; jj < BEHAVIOR_BINS; ++ jj) {
	    var pt0 = behaviorToCanvas([ii / BEHAVIOR_BINS, jj / BEHAVIOR_BINS]);
	    var pt1 = behaviorToCanvas([(ii + 1) / BEHAVIOR_BINS, (jj + 1) / BEHAVIOR_BINS]);
	    G_behaviorCtxOffscreen.beginPath();
	    G_behaviorCtxOffscreen.rect(pt0[0], pt0[1], pt1[0] - pt0[0], pt1[1] - pt0[1]);
	    G_behaviorCtxOffscreen.stroke();

	    if (ii === G_solutionBehaviorBin[0] && jj === G_solutionBehaviorBin[1]) {
		G_behaviorCtxOffscreen.fillStyle = '#5555aa';
	    } else if (G_solutionBehaviorBinElites.has([ii, jj].toString())) {
		G_behaviorCtxOffscreen.fillStyle = '#7777ee';
	    } else {
		G_behaviorCtxOffscreen.fillStyle = '#dddddd';
	    }
	    G_behaviorCtxOffscreen.fill();
	}
    }

    if (G_binSelected !== null) {
	for (var bb = 0; bb < G_binSelected.length; ++ bb) {
	    if (G_binSelected[bb] === null) {
		continue;
	    }

	    var ii = G_binSelected[bb][0];
	    var jj = G_binSelected[bb][1];

	    G_behaviorCtxOffscreen.lineWidth = 5;
	    G_behaviorCtxOffscreen.strokeStyle = '#009900';

	    var pt0 = behaviorToCanvas([ii / BEHAVIOR_BINS, jj / BEHAVIOR_BINS]);
	    var pt1 = behaviorToCanvas([(ii + 1) / BEHAVIOR_BINS, (jj + 1) / BEHAVIOR_BINS]);
	    G_behaviorCtxOffscreen.beginPath();
	    G_behaviorCtxOffscreen.rect(pt0[0], pt0[1], pt1[0] - pt0[0], pt1[1] - pt0[1]);
	    G_behaviorCtxOffscreen.stroke();
	}
    }

    if (G_binHighlighted !== null) {
	var ii = G_binHighlighted[0];
	var jj = G_binHighlighted[1];

	G_behaviorCtxOffscreen.lineWidth = 3;
	if (G_solutionBehaviorBinElites.has(G_binHighlighted.toString())) {
	    G_behaviorCtxOffscreen.strokeStyle = '#999900';
	} else {
	    G_behaviorCtxOffscreen.strokeStyle = '#999999';
	}

	var pt0 = behaviorToCanvas([ii / BEHAVIOR_BINS, jj / BEHAVIOR_BINS]);
	var pt1 = behaviorToCanvas([(ii + 1) / BEHAVIOR_BINS, (jj + 1) / BEHAVIOR_BINS]);
	G_behaviorCtxOffscreen.beginPath();
	G_behaviorCtxOffscreen.rect(pt0[0], pt0[1], pt1[0] - pt0[0], pt1[1] - pt0[1]);
	G_behaviorCtxOffscreen.stroke();
    }

    var ptbc = behaviorToCanvas(G_solutionBehavior);
    G_behaviorCtxOffscreen.beginPath();
    G_behaviorCtxOffscreen.arc(ptbc[0], ptbc[1], BEHAVIOR_RADIUS_CANVAS, 0, 2 * Math.PI);
    G_behaviorCtxOffscreen.fillStyle = '#0000dd';
    G_behaviorCtxOffscreen.fill();

    // draw offscreen canvases
    G_problemCtx.clearRect(0, 0, G_problemCanvasWidth, G_problemCanvasHeight);
    G_problemCtx.drawImage(G_problemCanvasOffscreen, 0, 0);
    G_behaviorCtx.clearRect(0, 0, G_behaviorCanvasWidth, G_behaviorCanvasHeight);
    G_behaviorCtx.drawImage(G_behaviorCanvasOffscreen, 0, 0);
}

function toggleGridVisibility() {
    if (gridVisible) {
        document.getElementById("grid-and-instructions").style.display = "none";
    } else {
        document.getElementById("grid-and-instructions").style.display = "";
    }

    gridVisible = !gridVisible;
}
