// Load and display writings
document.addEventListener('DOMContentLoaded', () => {
  fetch('./writings.json')
    .then(response => response.json())
    .then(data => {
      const writingsContainer = document.getElementById('writings-container');
      data.forEach(writing => {
        const writingElement = `
          <div class="bg-gray-800 rounded-lg p-6">
            <h3 class="text-2xl font-bold">${writing.title}</h3>
            <p class="mt-2 text-gray-400">${writing.description}</p>
            <button class="mt-4 px-4 py-2 bg-indigo-600 rounded-lg text-white hover:bg-indigo-500" onclick="alert('${writing.content}')">Read More</button>
          </div>
        `;
        writingsContainer.innerHTML += writingElement;
      });
    })
    .catch(err => console.error('Error loading writings:', err));
});
