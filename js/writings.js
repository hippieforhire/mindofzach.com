// writings.js
document.addEventListener('DOMContentLoaded', () => {
  const writingsContainer = document.getElementById('writings-container');

  window.loadWritings = function() {
    // Reverting to ./writings.json so it matches the original structure
    fetch('./writings.json')
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        if (!data.writings || !Array.isArray(data.writings)) {
          throw new Error('Invalid writings format');
        }
        writingsContainer.innerHTML = ''; // Clear previous writings
        data.writings.forEach(writing => {
          const writingCard = document.createElement('div');
          writingCard.classList.add('bg-gray-800', 'p-4', 'rounded-lg', 'shadow-md');

          const title = document.createElement('h3');
          title.classList.add('text-2xl', 'font-bold', 'mb-2');
          title.textContent = writing.title;

          const description = document.createElement('p');
          description.classList.add('text-gray-400', 'mb-2');
          description.textContent = writing.description;

          const content = document.createElement('p');
          content.classList.add('text-gray-300');
          content.textContent = writing.content;

          writingCard.appendChild(title);
          writingCard.appendChild(description);
          writingCard.appendChild(content);
          writingsContainer.appendChild(writingCard);
        });
      })
      .catch(error => {
        writingsContainer.innerHTML = `<p class="text-red-500">Failed to load writings: ${error.message}</p>`;
      });
  }
});
