// swipe.js
// Basic swipe detection to toggle .sidebar-hidden on <body>

let xDown = null;
let yDown = null;

document.addEventListener('touchstart', handleTouchStart, false);
document.addEventListener('touchmove', handleTouchMove, false);

function handleTouchStart(evt) {
  // Record initial touch coordinates
  const firstTouch = evt.touches[0];
  xDown = firstTouch.clientX;
  yDown = firstTouch.clientY;
}

function handleTouchMove(evt) {
  // If no initial X/Y, we can't compare
  if (!xDown || !yDown) return;

  const xUp = evt.touches[0].clientX;
  const yUp = evt.touches[0].clientY;

  const xDiff = xDown - xUp;
  const yDiff = yDown - yUp;

  if (xDiff > 0) {
    // user swiped left => hide sidebar
    document.body.classList.add("sidebar-hidden");
  } else {
    // user swiped right => show sidebar
    document.body.classList.remove("sidebar-hidden");
  }
  
  // Reset for next swipe
  xDown = null;
  yDown = null;
}
