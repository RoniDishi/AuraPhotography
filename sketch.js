var capture;
var capturedImage = null;
var cameraButton;
var restartButton;
var photoTaken = false;
var detections = [];
var analyzing = false;
var auraGraphics;
var rotationAngle = 0;
var pinkImage, redImage, blueImage, greenImage;
var currentAuraImage;
var modelsLoaded = false;
var cameraButtonImg;
var restartButtonImg;
var analyzingImage;
var scaleFactor = 1;
var offsetX = 0, offsetY = 0;
var auraImageWidth, auraImageHeight;

function preload() {
  console.log("Preload started");
  pinkImage = loadImage('pink.png', () => console.log("Pink image loaded successfully"), () => console.log("Failed to load pink image"));
  redImage = loadImage('red.png', () => console.log("Red image loaded successfully"), () => console.log("Failed to load red image"));
  blueImage = loadImage('blue.png', () => console.log("Blue image loaded successfully"), () => console.log("Failed to load blue image"));
  greenImage = loadImage('green.png', () => console.log("Green image loaded successfully"), () => console.log("Failed to load green image"));
  cameraButtonImg = loadImage('camera.png', () => console.log("Camera button loaded successfully"), () => console.log("Failed to load camera button"));
  restartButtonImg = loadImage('restart.png', () => console.log("Restart button loaded successfully"), () => console.log("Failed to load restart button"));
  analyzingImage = loadImage('Analyzing.png', () => console.log("Analyzing image loaded successfully"), () => console.log("Failed to load analyzing image"));
  console.log("Preload finished");
}

function setup() {
  console.log("Setup started");
  createCanvas(windowWidth, windowHeight);
  initializeCapture();
  createButtons();
  
  auraGraphics = createGraphics(width, height);

  auraImageWidth = 500;
  auraImageHeight = auraImageWidth * (pinkImage.height / pinkImage.width);

  currentAuraImage = greenImage;

  Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights'),
    faceapi.nets.faceLandmark68Net.loadFromUri('https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights'),
    faceapi.nets.faceExpressionNet.loadFromUri('https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights')
  ]).then(function() {
    console.log('Models Loaded!');
    modelsLoaded = true;
  }).catch(function(err) {
    console.error("Error loading models:", err);
  });
  
  console.log("Setup finished");
}

function initializeCapture() {
  console.log("Initializing capture");
  if (capture) {
    capture.remove();
  }
  capture = createCapture(VIDEO, function() {
    console.log("Capture is ready");
  });
  capture.hide();
}

function createButtons() {
  var buttonSize = min(width, height) * 0.15;
  
  if (!cameraButton) {
    cameraButton = createImg('camera.png', 'Take Photo');
    cameraButton.mousePressed(handleButtonPress);
  }
  cameraButton.size(buttonSize, buttonSize);
  cameraButton.position(width/2 - buttonSize/2, height - buttonSize - 20);
  cameraButton.style('object-fit', 'contain');

  if (!restartButton) {
    restartButton = createImg('restart.png', 'Restart');
    restartButton.mousePressed(handleButtonPress);
    restartButton.hide();
  }
  restartButton.size(buttonSize, buttonSize);
  restartButton.position(width/2 - buttonSize/2, height - buttonSize - 20);
  restartButton.style('object-fit', 'contain');
}

function handleButtonPress() {
  if (!photoTaken) {
    takePhoto();
    cameraButton.hide();
    restartButton.show();
  } else {
    restart();
    restartButton.hide();
    cameraButton.show();
  }
}

function takePhoto() {
  capturedImage = capture.get();
  photoTaken = true;
  analyzing = true;
  analyzeExpression();
}

function restart() {
  capturedImage = null;
  photoTaken = false;
  detections = [];
  analyzing = false;
  currentAuraImage = greenImage;
  initializeCapture();
  auraGraphics.clear();
}

function analyzeExpression() {
  faceapi.detectAllFaces(capturedImage.canvas, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceExpressions()
    .then(function(results) {
      detections = results;
      analyzing = false;
    })
    .catch(function(err) {
      console.error("Error analyzing expression:", err);
      analyzing = false;
    });
}

function updateAura(expressions) {
  if (!photoTaken) {
    currentAuraImage = greenImage;
    console.log("Setting green aura (live camera)");
    return null;
  }

  console.log("Detected expressions:", JSON.stringify(expressions));

  var dominantExpression = Object.keys(expressions).reduce((a, b) => expressions[a] > expressions[b] ? a : b);
  console.log("Dominant expression:", dominantExpression);

  if (dominantExpression === 'happy' && expressions.happy > 0.5) {
    currentAuraImage = pinkImage;
    console.log("Setting pink aura");
    return [color(255, 182, 193), color(255, 105, 180), color(255, 20, 147)];
  } else if ((dominantExpression === 'angry' || dominantExpression === 'disgusted') && (expressions.angry > 0.5 || expressions.disgusted > 0.5)) {
    currentAuraImage = redImage;
    console.log("Setting red aura");
    return [color(255, 69, 0), color(220, 20, 60), color(139, 0, 0)];
  } else {
    currentAuraImage = blueImage;
    console.log("Setting blue aura (sad or neutral)");
    return [color(173, 216, 230), color(135, 206, 235), color(100, 149, 237)];
  }
}

function drawAura(detection) {
  if (!photoTaken) return;

  auraGraphics.clear();
  var box = detection.detection.box;
  var centerX = (box.x + box.width / 2) * scaleFactor + offsetX;
  var centerY = (box.y + box.height / 2) * scaleFactor + offsetY;
  var radius = max(box.width, box.height) * 1.5 * scaleFactor;
  
  var colorScheme = updateAura(detection.expressions);
  
  auraGraphics.push();
  auraGraphics.translate(centerX, centerY);
  
  for (var r = radius; r > 0; r -= 2) {
    var inter = map(r, 0, radius, 0, 1);
    var c = lerpColor(colorScheme[0], colorScheme[2], inter);
    c.setAlpha(map(r, 0, radius, 200, 0));
    
    auraGraphics.noStroke();
    auraGraphics.fill(c);
    
    auraGraphics.beginShape();
    for (var a = 0; a < TWO_PI; a += 0.1) {
      var xoff = map(cos(a + rotationAngle), -1, 1, 0, 4);
      var yoff = map(sin(a + rotationAngle), -1, 1, 0, 4);
      var timeOff = frameCount * 0.02;
      var offset = map(noise(xoff, yoff, timeOff), 0, 1, 0.7, 1.3);
      var waveOffset = sin(a * 8 + rotationAngle * 2) * 0.1;
      var x = r * (offset + waveOffset) * cos(a);
      var y = r * (offset + waveOffset) * sin(a);
      auraGraphics.curveVertex(x, y);
    }
    auraGraphics.endShape(CLOSE);
  }
  
  auraGraphics.pop();
  
  rotationAngle += 0.02;
}

function drawAuraImage() {
  if (currentAuraImage) {
    let displayWidth = auraImageWidth;
    let displayHeight = auraImageHeight;

    if (width < auraImageWidth) {
      let scaleFactor = width / auraImageWidth;
      displayWidth *= scaleFactor;
      displayHeight *= scaleFactor;
    }

    let auraImageX = width - displayWidth;
    let auraImageY = 0;

    image(currentAuraImage, auraImageX, auraImageY, displayWidth, displayHeight);
    console.log("Drawing aura image:", 
                currentAuraImage === pinkImage ? "pink" : 
                currentAuraImage === redImage ? "red" : 
                currentAuraImage === blueImage ? "blue" :
                currentAuraImage === greenImage ? "green" : "unknown");
    console.log("Current aura image dimensions:", currentAuraImage.width, "x", currentAuraImage.height);
  } else {
    console.log("No aura image to display (should not happen now)");
  }
}

function draw() {
  if (!modelsLoaded) {
    console.log("Waiting for models to load...");
    return;
  }

  background(255);
  
  var sourceImage = photoTaken ? capturedImage : capture;
  
  if (sourceImage.width > 0) {
    var aspectRatio = sourceImage.height / sourceImage.width;

    if (width / height > sourceImage.width / sourceImage.height) {
      scaleFactor = width / sourceImage.width;
      offsetY = (height - sourceImage.height * scaleFactor) / 2;
      offsetX = 0;
    } else {
      scaleFactor = height / sourceImage.height;
      offsetX = (width - sourceImage.width * scaleFactor) / 2;
      offsetY = 0;
    }

    push();
    translate(offsetX, offsetY);
    scale(scaleFactor);
    image(sourceImage, 0, 0);
    pop();
  
    if (photoTaken && detections.length > 0) {
      drawAura(detections[0]);
      blendMode(SCREEN);
      image(auraGraphics, 0, 0);
      blendMode(BLEND);
    }
  } else {
    console.log("Source image not ready");
  }

  if (analyzing) {
    let analyzingWidth = min(width * 0.2, analyzingImage.width);
    let analyzingHeight = analyzingWidth * (analyzingImage.height / analyzingImage.width);

    let x = width / 2 - analyzingWidth / 2;
    let y = height / 2 - analyzingHeight / 2;

    image(analyzingImage, x, y, analyzingWidth, analyzingHeight);
  }

  drawAuraImage();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (auraGraphics) {
    auraGraphics.resizeCanvas(width, height);
  }
  createButtons();
  redraw();
}