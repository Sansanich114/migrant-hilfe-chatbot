// swipe.js
// Basic swipe detection to toggle .sidebar-hidden on <body>

// We'll interpret a "right-swipe" as "hide sidebar"
// and a "left-swipe" as "show sidebar."

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
  if (!xDown || !yDown) return;

  const xUp = evt.touches[0].clientX;
  const yUp = evt.touches[0].clientY;

  const xDiff = xDown - xUp;
  const yDiff = yDown - yUp;

  // Only care about horizontal movement
  if (Math.abs(xDiff) > Math.abs(yDiff)) {
    if (xDiff < 0) {
      // user swiped right => HIDE sidebar
      document.body.classList.add("sidebar-hidden");
    } else {
      // user swiped left => SHOW sidebar
      document.body.classList.remove("sidebar-hidden");
    }
  }

  xDown = null;
  yDown = null;
}
