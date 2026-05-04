/**
 * transitions.js — Page transition engine
 * Provides Slide, Fade, and Page Curl effects for the PDF reader.
 */

/**
 * Execute a page transition.
 * @param {HTMLCanvasElement} canvas - The main display canvas
 * @param {HTMLElement} container - The page-container element
 * @param {string} type - 'slide' | 'fade' | 'curl'
 * @param {'next'|'prev'} direction - Navigation direction
 * @param {function} renderNewPage - Async function that renders the new page onto the canvas
 * @returns {Promise<void>}
 */
export async function transition(canvas, container, type, direction, renderNewPage) {
  switch (type) {
    case 'fade':
      return fadeTransition(canvas, container, renderNewPage);
    case 'curl':
      return curlTransition(canvas, container, direction, renderNewPage);
    case 'slide':
    default:
      return slideTransition(canvas, container, direction, renderNewPage);
  }
}

/** Slide transition using CSS animations */
async function slideTransition(canvas, container, direction, renderNewPage) {
  const outClass = direction === 'next' ? 'page-transition-slide-out-left' : 'page-transition-slide-out-right';
  const inClass = direction === 'next' ? 'page-transition-slide-in-right' : 'page-transition-slide-in-left';

  // Slide out
  canvas.classList.add(outClass);
  await waitForAnimation(canvas);
  canvas.classList.remove(outClass);

  // Hide canvas while rendering to prevent single-frame flash
  canvas.style.visibility = 'hidden';
  await renderNewPage();

  // Slide in — animation starts at opacity 0, so restoring visibility is safe
  canvas.classList.add(inClass);
  canvas.style.visibility = '';
  await waitForAnimation(canvas);
  canvas.classList.remove(inClass);
}

/** Fade crossfade transition */
async function fadeTransition(canvas, container, renderNewPage) {
  canvas.classList.add('page-transition-fade-out');
  await waitForAnimation(canvas);
  canvas.classList.remove('page-transition-fade-out');

  // Hide canvas while rendering to prevent single-frame flash
  canvas.style.visibility = 'hidden';
  await renderNewPage();

  // Fade in — animation starts at opacity 0, so restoring visibility is safe
  canvas.classList.add('page-transition-fade-in');
  canvas.style.visibility = '';
  await waitForAnimation(canvas);
  canvas.classList.remove('page-transition-fade-in');
}

/** Page curl effect using canvas 2D drawing */
async function curlTransition(canvas, container, direction, renderNewPage) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  // Capture current page as image
  const currentImage = await createImageBitmap(canvas);

  // Render new page underneath
  await renderNewPage();
  const newImage = await createImageBitmap(canvas);

  const duration = 500;
  const start = performance.now();

  return new Promise((resolve) => {
    function animate(now) {
      let progress = Math.min((now - start) / duration, 1);
      // Ease out cubic
      progress = 1 - Math.pow(1 - progress, 3);

      ctx.clearRect(0, 0, w, h);

      // Draw new page (revealed underneath)
      ctx.drawImage(newImage, 0, 0);

      // Draw curling old page
      const curlX = direction === 'next'
        ? w - progress * w
        : progress * w;

      ctx.save();

      if (direction === 'next') {
        // Clip to the uncurled part
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(curlX, 0);
        // Bezier curve for the curl edge
        const cpX = curlX + w * 0.08;
        ctx.quadraticCurveTo(cpX, h * 0.5, curlX, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(currentImage, 0, 0);

        // Shadow along the curl edge
        ctx.restore();
        ctx.save();
        const grad = ctx.createLinearGradient(curlX - 30, 0, curlX + 10, 0);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(0.7, 'rgba(0,0,0,0.15)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(curlX - 30, 0, 40, h);
      } else {
        // Curling from left
        ctx.beginPath();
        ctx.moveTo(w, 0);
        ctx.lineTo(curlX, 0);
        const cpX = curlX - w * 0.08;
        ctx.quadraticCurveTo(cpX, h * 0.5, curlX, h);
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(currentImage, 0, 0);

        ctx.restore();
        ctx.save();
        const grad = ctx.createLinearGradient(curlX + 30, 0, curlX - 10, 0);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(0.7, 'rgba(0,0,0,0.15)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(curlX - 10, 0, 40, h);
      }

      ctx.restore();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Final clean render of the new page
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(newImage, 0, 0);
        currentImage.close();
        newImage.close();
        resolve();
      }
    }
    requestAnimationFrame(animate);
  });
}

/** Helper: wait for a CSS animation to complete */
function waitForAnimation(el) {
  return new Promise((resolve) => {
    function done() {
      el.removeEventListener('animationend', done);
      resolve();
    }
    el.addEventListener('animationend', done);
    // Fallback timeout
    setTimeout(resolve, 600);
  });
}

export default { transition };
