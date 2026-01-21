// Add to existing script or create new <script> tag
function secondsToAge(totalSeconds) {
  const years = Math.floor(totalSeconds / 31536000);
  totalSeconds %= 31536000;
  const months = Math.floor(totalSeconds / 2592000);
  totalSeconds %= 2592000;
  const days = Math.floor(totalSeconds / 86400);
  totalSeconds %= 86400;
  const hours = Math.floor(totalSeconds / 3600);
  totalSeconds %= 3600;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  return `${years}y ${months}m ${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function updateAge() {
  const birthDate = new Date('2003-01-10T00:00:00');
  const now = new Date();
  const ageInSeconds = Math.floor((now - birthDate) / 1000);
  
  document.getElementById('age').textContent = secondsToAge(ageInSeconds);
}

setInterval(updateAge, 1000);
updateAge();