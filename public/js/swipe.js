// swipe.js
// Basic swipe detection to toggle .sidebar-hidden on <body>

// We'll interpret a "right-swipe" as "show sidebar" and a "left-swipe" as "hide sidebar."

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

  // We'll only care about horizontal movement
  if (Math.abs(xDiff) > Math.abs(yDiff)) {
    if (xDiff < 0) {
      // user swiped right => show sidebar
      document.body.classList.remove("sidebar-hidden");
    } else {
      // user swiped left => hide sidebar
      document.body.classList.add("sidebar-hidden");
    }
  }
  
  // Reset for next swipe
  xDown = null;
  yDown = null;
}
