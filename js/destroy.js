// Select the button
const button = document.querySelector('button');
const clickSound = document.getElementById('clickSound'); // Select the audio element

// Function to wrap text nodes into individual letters and select other elements
function wrapElements(element) {
    if (element.nodeType === Node.TEXT_NODE) {
        // Split text into individual letters wrapped in spans
        const text = element.textContent.trim();
        if (text.length > 0) {
            const wrappedText = [...text]
                .map((letter) => `<span class="letter">${letter}</span>`)
                .join('');
            const wrapper = document.createElement('span');
            wrapper.innerHTML = wrappedText;
            element.replaceWith(wrapper);
        }
    } else if (element.nodeType === Node.ELEMENT_NODE) {
        // For div elements, add the falling-element class
        if (element.tagName.toLowerCase() === 'div') {
            element.classList.add('falling-element');
        }
        // Recursively wrap child nodes
        Array.from(element.childNodes).forEach(wrapElements);
    }
}

// New function: Trembling and falling animation for elements
function startTremblingAndFalling() {
    clickSound.currentTime = 0; // Reset audio playback to the start
    clickSound.play(); // Play the click sound

    // Apply wrapElements only after the button is clicked
    const elementsToWrap = document.querySelectorAll('#index, #exhibit, .container, p, li, a, img, div');
    elementsToWrap.forEach(wrapElements);

    const fallingItems = document.querySelectorAll('.letter, .falling-element, div');

    fallingItems.forEach((item) => {
        // Trembling phase
        let shakingInterval = setInterval(() => {
            // Apply random shaking by translating and rotating
            const shakeX = Math.random() * 4 - 2; // Random movement between -2px and 2px
            const shakeY = Math.random() * 4 - 2;
            const rotate = Math.random() * 10 - 5; // Random small rotation
            item.style.transform = `translate(${shakeX}px, ${shakeY}px) rotate(${rotate}deg)`;
        }, 50); // Update every 50ms for continuous trembling

        // After a random delay, switch from trembling to falling
        const randomDelay = Math.random() * 3 + 2; // Between 2 and 5 seconds delay
        setTimeout(() => {
            clearInterval(shakingInterval); // Stop shaking

            // Now make the item fall
            const fallDuration = Math.random() * 2 + 1; // Between 1 and 3 seconds
            item.style.transition = `transform ${fallDuration}s ease-in`;
            item.style.transform = `translateY(${window.innerHeight}px) rotate(${Math.random() * 360}deg)`;
        }, randomDelay * 1000);
    });
}

// Attach the click event listener to the button
button.addEventListener('click', startTremblingAndFalling);
